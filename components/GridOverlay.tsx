import React from 'react';

interface GridOverlayProps {
  size: number;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({ size }) => {
  if (size === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex border-2 border-white/30 rounded-sm">
      {/* Columns */}
      <div className="absolute inset-0 flex flex-row">
        {Array.from({ length: size - 1 }).map((_, i) => (
          <div key={`col-${i}`} className="flex-1 border-r border-white/30 backdrop-invert-[0.1]" />
        ))}
        <div className="flex-1" /> {/* Last spacer */}
      </div>
      
      {/* Rows */}
      <div className="absolute inset-0 flex flex-col">
        {Array.from({ length: size - 1 }).map((_, i) => (
          <div key={`row-${i}`} className="flex-1 border-b border-white/30 backdrop-invert-[0.1]" />
        ))}
        <div className="flex-1" /> {/* Last spacer */}
      </div>
    </div>
  );
};