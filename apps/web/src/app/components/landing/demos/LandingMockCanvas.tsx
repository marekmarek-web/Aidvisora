"use client";

import React from "react";

export const LANDING_MOCK_CANVAS_WIDTH = 1280;
export const LANDING_MOCK_CANVAS_HEIGHT = 820;

export function LandingMockCanvas({
  width = LANDING_MOCK_CANVAS_WIDTH,
  height = LANDING_MOCK_CANVAS_HEIGHT,
  children,
  className = "",
}: {
  width?: number;
  height?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const measure = () => {
      const nextScale = Math.min(1, node.clientWidth / width);
      setScale(nextScale);
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={hostRef}
      className={`mx-auto w-full overflow-hidden ${className}`}
      style={{ height: Math.round(height * scale) }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
