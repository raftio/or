"use client";

import { useEffect, useRef, useState } from "react";

interface OrLoaderProps {
  size?: number;
  filled?: boolean;
  done?: boolean;
  className?: string;
}

export function OrLoader({
  size = 48,
  filled = false,
  done = false,
  className = "",
}: OrLoaderProps) {
  const textRef = useRef<SVGTextElement>(null);
  const [dashLen, setDashLen] = useState(300);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const len = el.getComputedTextLength() * 3.2;
    if (len > 0) setDashLen(Math.round(len));
  }, []);

  const w = size * 2;
  const h = size;

  const textProps = {
    x: "60",
    y: "46",
    textAnchor: "middle" as const,
    fontSize: "52",
    fontFamily: "Space Grotesk, system-ui, sans-serif",
    fontWeight: "700",
  };

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 120 60"
      fill="none"
      className={className}
      role="status"
      aria-label="Loading"
    >
      <defs>
        <filter id="or-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ghost outline — hidden when filled mode */}
      {!filled && (
        <text
          {...textProps}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.06"
        >
          OR
        </text>
      )}

      {/* Animated draw-on */}
      <text
        ref={textRef}
        {...textProps}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={done ? undefined : dashLen}
        strokeDashoffset={done ? undefined : dashLen}
        filter={!done && !filled ? "url(#or-glow)" : undefined}
      >
        {!done && (
          filled ? (
            <>
              <animate
                attributeName="stroke-dashoffset"
                values={`${dashLen};0`}
                dur="1.5s"
                fill="freeze"
                repeatCount="1"
              />
              <animate
                attributeName="fill-opacity"
                values="0;1"
                dur="1.5s"
                fill="freeze"
                repeatCount="1"
              />
            </>
          ) : (
            <animate
              attributeName="stroke-dashoffset"
              values={`${dashLen};0;0;${dashLen}`}
              keyTimes="0;0.4;0.6;1"
              dur="2.5s"
              repeatCount="indefinite"
            />
          )
        )}
        OR
      </text>
    </svg>
  );
}
