import React, { useMemo, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface TextDisplayProps {
  targetText: string;
  userInput: string;
  currentIndex: number;
}

export const TextDisplay: React.FC<TextDisplayProps> = React.memo(
  ({ targetText, userInput, currentIndex }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const activeWordRef = useRef<HTMLDivElement | null>(null);

    const words = useMemo(() => {
      return targetText.split(' ');
    }, [targetText]);

    const wordOffsets = useMemo(() => {
      const offsets: number[] = [];
      let currentOffset = 0;
      for (const word of words) {
        offsets.push(currentOffset);
        currentOffset += word.length + 1;
      }
      return offsets;
    }, [words]);

    const activeWordIdx = useMemo(() => {
      let activeIdx = 0;
      for (let i = 0; i < wordOffsets.length; i += 1) {
        if (currentIndex >= wordOffsets[i]) {
          activeIdx = i;
        } else {
          break;
        }
      }
      return activeIdx;
    }, [wordOffsets, currentIndex]);

    useEffect(() => {
      const activeWord = activeWordRef.current;
      const container = containerRef.current;
      if (!activeWord || !container) return;

      try {
        const activeTop = activeWord.offsetTop;
        const activeHeight = activeWord.offsetHeight;
        const targetScroll = activeTop - activeHeight;
        container.scrollTop = Math.max(0, targetScroll);
      } catch (err) {
        logger.warn('Failed to calculate scroll coordinates', {
          category: 'dom',
          error: err,
        });
      }
    }, [activeWordIdx]);

    return (
      <div
        ref={containerRef}
        data-testid="typing-text-display"
        className="typing-font text-2xl md:text-3xl font-medium leading-[1.6] select-none outline-none tracking-wide text-text-tertiary flex flex-wrap gap-x-0 gap-y-2 max-h-[160px] md:max-h-[190px] overflow-y-hidden w-full relative"
        style={{ scrollBehavior: 'smooth' }}
      >
        {words.map((word, wordIdx) => {
          const offset = wordOffsets[wordIdx];
          const isActiveWord = wordIdx === activeWordIdx;
          const isPastWord = wordIdx < activeWordIdx;

          return (
            <div
              key={wordIdx}
              ref={isActiveWord ? activeWordRef : undefined}
              className={`flex relative transition-opacity duration-200 ${
                isPastWord ? 'opacity-65' : ''
              }`}
            >
              {word.split('').map((char, charIdx) => {
                const absIdx = offset + charIdx;
                const isTyped = absIdx < currentIndex;
                const isActive = absIdx === currentIndex;
                const typedChar = userInput[absIdx];
                const isCorrect = typedChar === char;

                let charClass = 'text-text-tertiary transition-colors duration-75';
                if (isTyped) {
                  charClass = isCorrect
                    ? 'text-text-primary transition-colors duration-75'
                    : 'text-error bg-error/20 rounded-sm font-semibold';
                } else if (isActive) {
                  charClass = 'text-text-secondary';
                }

                return (
                  <span key={charIdx} className={`relative ${charClass}`}>
                    {isActive && (
                      <span className="absolute -left-[1px] top-[10%] h-[80%] w-[2.5px] bg-accent rounded-full animate-caret shadow-[0_0_8px_var(--accent)]" />
                    )}
                    {char}
                  </span>
                );
              })}

              {wordIdx < words.length - 1 &&
                (() => {
                  const spaceIdx = offset + word.length;
                  const isSpaceTyped = spaceIdx < currentIndex;
                  const isSpaceActive = spaceIdx === currentIndex;
                  const typedSpace = userInput[spaceIdx];

                  let spaceClass = 'text-text-tertiary';
                  if (isSpaceTyped) {
                    spaceClass =
                      typedSpace === ' '
                        ? 'text-text-primary opacity-60'
                        : 'text-error bg-error/20 rounded-sm font-semibold';
                  }

                  return (
                    <span className={`relative ${spaceClass}`}>
                      {isSpaceActive && (
                        <span className="absolute left-0 top-[10%] h-[80%] w-[2.5px] bg-accent rounded-full animate-caret shadow-[0_0_8px_var(--accent)]" />
                      )}
                      &nbsp;
                    </span>
                  );
                })()}
            </div>
          );
        })}
      </div>
    );
  }
);

TextDisplay.displayName = 'TextDisplay';
