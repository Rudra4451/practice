import React, { useMemo, useRef, useEffect } from 'react';

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
  const activeCharRef = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Scroll so the active character is always visible inside the container
  useEffect(() => {
    if (!activeCharRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const active = activeCharRef.current;

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    // If the active character is below the visible area, scroll down
    if (activeRect.bottom > containerRect.bottom - 8) {
      container.scrollTop += activeRect.bottom - containerRect.bottom + 8;
    }
    // If above, scroll up
    if (activeRect.top < containerRect.top + 8) {
      container.scrollTop -= containerRect.top - activeRect.top + 8;
    }
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="typing-font text-2xl md:text-3xl leading-relaxed select-none outline-none tracking-wide text-text-secondary/60 flex flex-wrap gap-x-[0.35em] gap-y-3 max-h-[160px] overflow-y-hidden w-full relative"
      style={{ scrollBehavior: 'smooth' }}
    >
      {words.map((word, wordIdx) => {
        const offset = wordOffsets[wordIdx];

        return (
          <div key={wordIdx} className="flex relative">
            {word.split('').map((char, charIdx) => {
              const absIdx = offset + charIdx;
              const isTyped = absIdx < currentIndex;
              const isActive = absIdx === currentIndex;
              const typedChar = userInput[absIdx];
              const isCorrect = typedChar === char;

              let charClass = 'text-text-secondary/50 transition-colors duration-100';
              if (isTyped) {
                charClass = isCorrect
                  ? 'text-char-correct font-bold'
                  : 'text-error bg-error/15 font-bold';
              }

              return (
                <span
                  key={charIdx}
                  ref={isActive ? (el) => { activeCharRef.current = el; } : undefined}
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

              let spaceClass = 'text-text-secondary/50';
              if (isSpaceTyped) {
                spaceClass = typedSpace === ' '
                  ? 'text-char-correct font-bold opacity-60'
                  : 'text-error bg-error/15 font-bold';
              }

              return (
                <span
                  ref={isSpaceActive ? (el) => { activeCharRef.current = el; } : undefined}
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
