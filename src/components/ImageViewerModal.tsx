import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';
import { sounds } from '../utils/sound';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
  lang: Language;
  images?: string[];
  initialIndex?: number;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  lang,
  images,
  initialIndex = 0
}) => {
  const t = translations[lang];

  // Resolve list of images
  const allImages = images && images.length > 0
    ? images
    : imageUrl
      ? [imageUrl]
      : [];

  const [currentIndex, setCurrentIndex] = useState(
    initialIndex >= 0 && initialIndex < allImages.length ? initialIndex : 0
  );
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync index when initialIndex changes or modal reopens
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < allImages.length) {
      setCurrentIndex(initialIndex);
    }
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  }, [imageUrl, initialIndex, allImages.length]);

  const activeImage = allImages[currentIndex] || imageUrl;

  const handleZoomIn = useCallback(() => {
    sounds.playClick();
    setScale((prev) => Math.min(Math.round((prev + 0.25) * 100) / 100, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    sounds.playClick();
    setScale((prev) => {
      const next = Math.max(Math.round((prev - 0.25) * 100) / 100, 0.4);
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
        positionRef.current = { x: 0, y: 0 };
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    sounds.playClick();
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  }, []);

  const handlePrevImage = useCallback(() => {
    if (allImages.length <= 1) return;
    sounds.playClick();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  }, [allImages.length]);

  const handleNextImage = useCallback(() => {
    if (allImages.length <= 1) return;
    sounds.playClick();
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
    setScale(1);
    setPosition({ x: 0, y: 0 });
    positionRef.current = { x: 0, y: 0 };
  }, [allImages.length]);

  // Native Wheel Event Handler for smooth mouse scroll zoom
  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setScale((prev) => {
        const next = Math.min(Math.max(Math.round(prev * zoomFactor * 100) / 100, 0.4), 6);
        if (next <= 0.9) {
          setPosition({ x: 0, y: 0 });
          positionRef.current = { x: 0, y: 0 };
        }
        return next;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0' || e.key === 'r' || e.key === 'R') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handlePrevImage, handleNextImage, handleZoomIn, handleZoomOut, handleReset]);

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    setPosition({ x: newX, y: newY });
    positionRef.current = { x: newX, y: newY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click to toggle quick zoom
  const handleDoubleClick = () => {
    if (scale > 1.2) {
      handleReset();
    } else {
      sounds.playClick();
      setScale(2.2);
    }
  };

  if (!isOpen || !activeImage) return null;

  return (
    <div
      ref={containerRef}
      id="image-viewer-backdrop"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-3 bg-black/92 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. TOP BAR CONTROLS */}
      <div className="w-full max-w-5xl flex items-center justify-between z-20 px-4 py-2.5 rounded-xl bg-[#0e1422]/95 border border-slate-700/80 shadow-2xl backdrop-blur-md shrink-0 mt-2">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <span className="text-xs sm:text-sm font-bold text-slate-100 truncate font-cinzel">
            {title || t.viewHunterProof}
          </span>
          {allImages.length > 1 && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-sky-950 border border-sky-600/50 text-[11px] font-mono text-sky-300 font-bold">
              {currentIndex + 1} / {allImages.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom controls */}
          <button
            id="btn-zoom-in"
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            id="btn-zoom-out"
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            id="btn-zoom-reset"
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono"
            title="Reset zoom (R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">100%</span>
          </button>

          {/* Quick 2x */}
          <button
            type="button"
            onClick={handleDoubleClick}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={scale > 1.2 ? 'Reset (1x)' : 'Zoom 2x'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Close button */}
          <button
            id="btn-close-zoom-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 ml-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-200 hover:text-white transition-all cursor-pointer"
            title={t.closeZoom}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. IMAGE CONTAINER (WITH MOUSE DRAG & MOUSE WHEEL ZOOM) */}
      <div
        className="relative w-full flex-1 flex items-center justify-center overflow-hidden my-2 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Left Arrow for Multi-images */}
        {allImages.length > 1 && (
          <button
            id="btn-prev-image"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevImage();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-[#0a0f18]/85 hover:bg-sky-950 text-white border border-slate-700 hover:border-sky-500 shadow-2xl backdrop-blur transition-all cursor-pointer hover:scale-110 active:scale-95"
            title={lang === 'th' ? 'รูปก่อนหน้า (ลูกศรซ้าย)' : 'Previous image (Left Arrow)'}
          >
            <ChevronLeft className="w-6 h-6 text-sky-300" />
          </button>
        )}

        {/* Right Arrow for Multi-images */}
        {allImages.length > 1 && (
          <button
            id="btn-next-image"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNextImage();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-[#0a0f18]/85 hover:bg-sky-950 text-white border border-slate-700 hover:border-sky-500 shadow-2xl backdrop-blur transition-all cursor-pointer hover:scale-110 active:scale-95"
            title={lang === 'th' ? 'รูปถัดไป (ลูกศรขวา)' : 'Next image (Right Arrow)'}
          >
            <ChevronRight className="w-6 h-6 text-sky-300" />
          </button>
        )}

        {/* Image wrapper */}
        <div
          className="will-change-transform select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 120ms ease-out'
          }}
        >
          <img
            src={activeImage}
            alt={title || 'Proof Image'}
            draggable={false}
            className="max-w-[90vw] max-h-[70vh] sm:max-h-[75vh] object-contain rounded-xl shadow-[0_20px_70px_rgba(0,0,0,0.9)] border border-slate-700 pointer-events-none"
          />
        </div>
      </div>

      {/* 3. BOTTOM CONTROL BAR & FILMSTRIP */}
      <div className="w-full max-w-3xl flex flex-col items-center gap-2 z-20 shrink-0 mb-1">
        {/* Filmstrip thumbnails if multiple images */}
        {allImages.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto p-1.5 rounded-xl bg-[#0b101c]/90 border border-slate-700/80 shadow-lg backdrop-blur max-w-full">
            {allImages.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setCurrentIndex(idx);
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border transition-all cursor-pointer shrink-0 ${
                  currentIndex === idx
                    ? 'border-sky-400 ring-2 ring-sky-500/40 scale-105 shadow-md'
                    : 'border-slate-700 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 px-1 text-[8px] font-mono bg-black/80 text-white font-bold rounded-tl">
                  #{idx + 1}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Zoom Info & Interaction Hint */}
        <div className="flex items-center gap-3 px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 shadow-lg">
          <span className="font-mono text-sky-400 font-bold">
            {Math.round(scale * 100)}%
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-slate-400">
            {lang === 'th'
              ? '🖱️ สกอลล์เม้าส์เพื่อซูม • คลิกค้างแล้วลากเพื่อเลื่อน • ดับเบิ้ลคลิกเพื่อซูม 2x'
              : '🖱️ Scroll wheel to zoom • Click & drag to pan • Double-click for 2x'}
          </span>
        </div>
      </div>
    </div>
  );
};
