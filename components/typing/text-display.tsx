import React, { useMemo, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface TextDisplayProps {
  targetText: string;
  userInput: string;
  currentIndex: number;
}

export const TextDisplay: React.FC<TextDisplayProps> = React.memo(({
  targetText,
  userInput,
  currentIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLDivElement | null>(null);

  // Group text into words for natural line-wrapping
  const words = useMemo(() => {
    return targetText.split(' ');
  }, [targetText]);

  // Track absolute index offset of each word
  const wordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let currentOffset = 0;
    words.forEach((word) => {
      offsets.push(currentOffset);
      currentOffset += word.length + 1; // +1 for the space
    });
    return offsets;
  }, [words]);

  // Determine which word is currently active based on character index
  const activeWordIdx = useMemo(() => {
    let activeIdx = 0;
    for (let i = 0; i < wordOffsets.length; i++) {
      if (currentIndex >= wordOffsets[i]) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [wordOffsets, currentIndex]);

  // Scroll so the active word's line is kept centered
  useEffect(() => {
    const activeWord = activeWordRef.current;
    const container = containerRef.current;
    if (!activeWord || !container) return;

    try {
      const activeTop = activeWord.offsetTop;
      const activeHeight = activeWord.offsetHeight;

      // Center the active line as the second line in view, hiding completed lines
      const targetScroll = activeTop - activeHeight;
      container.scrollTop = Math.max(0, targetScroll);
    } catch (err) {
      logger.warn('Failed to calculate scroll coordinates', { category: 'dom', error: err });
    }
  }, [activeWordIdx]);

  return (
    <div
      ref={containerRef}
      className="typing-font text-2xl md:text-3xl leading-relaxed select-none outline-none tracking-wide text-text-secondary/90 flex flex-wrap gap-x-[0.35em] gap-y-3 max-h-[160px] overflow-y-hidden w-full relative"
      style={{ scrollBehavior: 'smooth' }}
    >
      {words.map((word, wordIdx) => {
        const offset = wordOffsets[wordIdx];
        const isActiveWord = wordIdx === activeWordIdx;

        return (
          <div
            key={wordIdx}
            ref={isActiveWord ? activeWordRef : undefined}
            className="flex relative"
          >
            {word.split('').map((char, charIdx) => {
              const absIdx = offset + charIdx;
              const isTyped = absIdx < currentIndex;
              const isActive = absIdx === currentIndex;
              const typedChar = userInput[absIdx];
              const isCorrect = typedChar === char;

              let charClass = 'text-text-secondary/90 transition-colors duration-100';
              if (isTyped) {
                charClass = isCorrect
                  ? 'text-char-correct font-bold'
                  : 'text-error bg-error/15 font-bold';
              }

              return (
                <span
                  key={charIdx}
                  className={`relative ${charClass}`}
                >
                  {/* Blinking caret */}
                  {isActive && (
                    <span
                      className="absolute -left-[1px] top-[10%] h-[80%] w-[3px] bg-accent rounded-none animate-caret"
                    />
                  )}
                  {char}
                </span>
              );
            })}

            {/* Space character between words */}
            {wordIdx < words.length - 1 && (() => {
              const spaceIdx = offset + word.length;
              const isSpaceTyped = spaceIdx < currentIndex;
              const isSpaceActive = spaceIdx === currentIndex;
              const typedSpace = userInput[spaceIdx];

              let spaceClass = 'text-text-secondary/90';
              if (isSpaceTyped) {
                spaceClass = typedSpace === ' '
                  ? 'text-char-correct font-bold opacity-60'
                  : 'text-error bg-error/15 font-bold';
              }

              return (
                <span
                  className={`relative px-[0.15em] ${spaceClass}`}
                >
                  {isSpaceActive && (
                    <span
                      className="absolute left-0 top-[10%] h-[80%] w-[3px] bg-accent rounded-none animate-caret"
                    />
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
});

TextDisplay.displayName = 'TextDisplay';
