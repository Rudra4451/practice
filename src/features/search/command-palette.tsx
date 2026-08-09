'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIndexEngine, SearchResultItem } from './search-index';
import { Search, ArrowRight } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = SearchIndexEngine.query(query);

  // Global Ctrl+K / Cmd+K keybinding listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    if (item.action) {
      item.action();
    } else if (item.url) {
      router.push(item.url);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-20 p-4 bg-background/80 backdrop-blur-md animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-surface border-[1.5px] border-border rounded-[24px] shadow-[0_16px_0_var(--border)] overflow-hidden flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
          <Search className="w-5 h-5 text-accent flex-shrink-0" />
          <input
            type="text"
            placeholder="Type a command, query, or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-transparent text-text-primary text-base font-bold font-sans outline-none placeholder:text-text-tertiary"
          />
          <kbd className="px-2 py-1 bg-surface-accent border border-border/60 text-text-secondary text-xs font-mono font-bold rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex flex-col p-2 max-h-[360px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono font-bold text-text-tertiary uppercase">
              No matching search results
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between p-3 rounded-[14px] cursor-pointer transition-all duration-140 ${
                  idx === selectedIndex
                    ? 'bg-accent text-white shadow-sm'
                    : 'hover:bg-surface-accent text-text-primary'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-wide">{item.title}</span>
                  {item.subtitle && (
                    <span className={`text-xs ${idx === selectedIndex ? 'text-white/80' : 'text-text-tertiary'}`}>
                      {item.subtitle}
                    </span>
                  )}
                </div>
                <ArrowRight className={`w-4 h-4 ${idx === selectedIndex ? 'opacity-100' : 'opacity-0'}`} />
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Legend */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-surface-accent/40 border-t border-border/40 text-[10px] font-mono text-text-tertiary uppercase">
          <span>Navigation: Arrow Keys</span>
          <span>Select: Enter</span>
        </div>
      </div>
    </div>
  );
};
