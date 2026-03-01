"use client";

import { useCallback, useEffect, useState } from "react";

interface ImageLightboxProps {
  images: { url: string; filename?: string }[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const current = images[index];
  const hasMultiple = images.length > 1;

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (hasMultiple && e.key === "ArrowRight") goNext();
      if (hasMultiple && e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev, hasMultiple]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = current.url;
    a.download = current.filename ?? "image";
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {hasMultiple && (
          <span className="rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white/80">
            {index + 1} / {images.length}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="rounded-lg bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
          title="Download"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-black/50 p-2 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
          title="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Image */}
      <img
        src={current.url}
        alt={current.filename ?? ""}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
