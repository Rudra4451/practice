'use client';

import React, { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  avatarUrl?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-20 h-20',
} as const;

const ICON_CLASSES = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-9 h-9',
} as const;

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  alt,
  size = 'sm',
}) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const errored = Boolean(avatarUrl && failedUrl === avatarUrl);

  useEffect(() => {
    if (!avatarUrl || errored) return;
    const frame = requestAnimationFrame(() => {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth === 0) {
        setFailedUrl(avatarUrl);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [avatarUrl, errored]);

  return (
    <div
      className={`${SIZE_CLASSES[size]} rounded-full border border-border bg-surface-accent flex items-center justify-center overflow-hidden flex-shrink-0 text-text-secondary`}
    >
      {avatarUrl && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={avatarUrl}
          ref={imgRef}
          src={avatarUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
          className="w-full h-full object-cover"
        />
      ) : (
        <User className={ICON_CLASSES[size]} aria-hidden="true" />
      )}
    </div>
  );
};
