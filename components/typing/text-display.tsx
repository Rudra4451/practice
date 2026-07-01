import React, { useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
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

  const words = useMemo(() => {
    return targetText.split(' ');
  }, [targetText]);

  const wordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let currentOffset = 0;
    words.forEach((word) => {
      offsets.push(currentOffset);
      currentOffset += word.length + 1;
    });
    return offsets;
  }, [words]);

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
      logger.warn('Failed to calculate scroll coordinates', { category: 'dom', error: err });
    }
  }, [activeWordIdx]);

  return (
    <div
      ref={containerRef}
      className="typing-font text-2xl md:text-3xl font-medium leading-[1.6] select-none outline-none tracking-wide text-text-tertiary flex flex-wrap gap-x-0 gap-y-2 max-h-[160px] md:max-h-[190px] overflow-y-hidden w-full relative"
      style={{ scrollBehavior: 'smooth' }}
    >
      {words.map((word, wordIdx) => {
        const offset = wordOffsets[wordIdx];
        const isActiveWord = wordIdx === activeWordIdx;
        const isPastWord = wordIdx < activeWordIdx;
        const isFarFutureWord = wordIdx > activeWordIdx + 4;

        return (
          <div
            key={wordIdx}
            ref={isActiveWord ? activeWordRef : undefined}
            className={`flex relative transition-all duration-300 ${
              isFarFutureWord ? 'opacity-10 blur-[2px] pointer-events-none' : ''
            } ${isPastWord ? 'opacity-70' : ''}`}
          >
            {word.split('').map((char, charIdx) => {
              const absIdx = offset + charIdx;
              const isTyped = absIdx < currentIndex;
              const isActive = absIdx === currentIndex;
              const typedChar = userInput[absIdx];
              const isCorrect = typedChar === char;

              let charClass = 'text-text-tertiary transition-colors duration-150';
              if (isTyped) {
                charClass = isCorrect
                  ? 'text-text-primary'
                  : 'text-error bg-error/20 rounded-sm font-semibold shadow-[0_0_8px_rgba(244,63,94,0.3)]';
              } else if (isActive) {
                charClass = 'text-text-secondary';
              }

              return (
                <motion.span
                  key={charIdx}
                  className={`relative ${charClass}`}
                  initial={false}
                  animate={isTyped && isCorrect ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ 
                    scale: { type: 'tween', ease: 'easeOut', duration: 0.2 }
                  }}
                >
                  {/* Blinking caret */}
                  {isActive && (
                    <span
                      className="absolute -left-[1px] top-[10%] h-[80%] w-[2.5px] bg-accent rounded-full animate-caret shadow-[0_0_8px_var(--accent)]"
                    />
                  )}
                  {char}
                </motion.span>
              );
            })}

            {/* Space character between words */}
            {wordIdx < words.length - 1 && (() => {
              const spaceIdx = offset + word.length;
              const isSpaceTyped = spaceIdx < currentIndex;
              const isSpaceActive = spaceIdx === currentIndex;
              const typedSpace = userInput[spaceIdx];

              let spaceClass = 'text-text-tertiary';
              if (isSpaceTyped) {
                spaceClass = typedSpace === ' '
                  ? 'text-text-primary opacity-60'
                  : 'text-error bg-error/20 rounded-sm font-semibold shadow-[0_0_8px_rgba(244,63,94,0.3)]';
              }

              return (
                <span
                  className={`relative ${spaceClass}`}
                >
                  {isSpaceActive && (
                    <span
                      className="absolute left-0 top-[10%] h-[80%] w-[2.5px] bg-accent rounded-full animate-caret shadow-[0_0_8px_var(--accent)]"
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

