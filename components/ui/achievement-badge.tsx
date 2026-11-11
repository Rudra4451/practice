'use client';

import React, { useState } from 'react';

interface AchievementBadgeProps {
  iconPath?: string | null;
  alt: string;
  size?: number;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  iconPath,
  alt,
  size = 40,
}) => {
  const normalizedSrc =
    iconPath && iconPath.startsWith('/') ? iconPath : '/achievements/default.svg';
  const [src, setSrc] = useState(normalizedSrc);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => {
        if (src !== '/achievements/default.svg') {
          setSrc('/achievements/default.svg');
        }
      }}
      className="rounded-xl flex-shrink-0 object-cover border border-border/70 bg-surface"
      style={{ width: size, height: size }}
    />
  );
};

