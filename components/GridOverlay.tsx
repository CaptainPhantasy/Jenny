import React, { useLayoutEffect, useRef, useState } from 'react';

interface GridOverlayProps {
  /** Grid cell size in inches. 0 = off. */
  inches: number;
  /** Aspect ratio (width / height) of the source image/video, or null if none loaded. */
  imageAspect: number | null;
}

// CSS defines 1 inch as exactly 96 px (independent of the physical monitor).
// This gives a consistent, printable "1 inch" reference grid for the classroom.
const PX_PER_INCH = 96;

/**
 * Draws a physical grid (default 1 inch cells) aligned to the rendered image area.
 * The canvas uses "contain" fitting, so the image is letterboxed inside the
 * container. We replicate that same fit here so the grid lines land on the artwork
 * rather than the empty black bars.
 *
 * The outer container is ALWAYS mounted (even when the grid is off) so the
 * ResizeObserver stays attached and reports the size the moment the grid is enabled.
 */
export const GridOverlay: React.FC<GridOverlayProps> = ({ inches, imageAspect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = inches > 0 && size.w > 0 && size.h > 0;

  // Compute the "contain" rectangle of the image inside the container.
  let rectW = size.w;
  let rectH = size.h;
  if (imageAspect && size.w > 0 && size.h > 0) {
    const containerAspect = size.w / size.h;
    if (imageAspect > containerAspect) {
      // Image wider than container -> fit to width, letterbox top/bottom
      rectW = size.w;
      rectH = size.w / imageAspect;
    } else {
      // Image taller -> fit to height, letterbox left/right
      rectH = size.h;
      rectW = size.h * imageAspect;
    }
  }

  const offsetX = (size.w - rectW) / 2;
  const offsetY = (size.h - rectH) / 2;

  const cell = inches * PX_PER_INCH;
  const cols = active && cell > 0 ? Math.floor(rectW / cell) : 0;
  const rows = active && cell > 0 ? Math.floor(rectH / cell) : 0;

  const lines: React.ReactNode[] = [];
  if (active) {
    // Vertical lines (interior)
    for (let i = 1; i <= cols; i++) {
      lines.push(
        <div
          key={`v-${i}`}
          className="absolute bg-white/30"
          style={{ left: `${offsetX + i * cell}px`, top: `${offsetY}px`, width: '1px', height: `${rectH}px` }}
        />
      );
    }
    // Horizontal lines (interior)
    for (let j = 1; j <= rows; j++) {
      lines.push(
        <div
          key={`h-${j}`}
          className="absolute bg-white/30"
          style={{ top: `${offsetY + j * cell}px`, left: `${offsetX}px`, height: '1px', width: `${rectW}px` }}
        />
      );
    }
  }

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {active && (
        <>
          {/* Outer border around the image area */}
          <div
            className="absolute border border-white/40"
            style={{ left: `${offsetX}px`, top: `${offsetY}px`, width: `${rectW}px`, height: `${rectH}px` }}
          />
          {lines}
          {/* Legend */}
          <div
            className="absolute text-[10px] font-mono text-white/70 bg-slate-900/70 px-2 py-0.5 rounded"
            style={{ left: `${offsetX + 4}px`, top: `${offsetY + 4}px` }}
          >
            {inches === 1 ? '1 inch grid' : `${inches}" grid`}
          </div>
        </>
      )}
    </div>
  );
};
