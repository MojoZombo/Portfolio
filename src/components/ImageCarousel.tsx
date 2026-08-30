import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CarouselImage {
  url: string;
  caption?: string;
  title?: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  onImageClick?: (image: CarouselImage) => void;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, onImageClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const currentImg = images[currentIndex];

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 my-3 select-none">
      {/* Main Image Display Area (Seamless with page) */}
      <div className="relative h-[320px] sm:h-[400px] w-full flex items-center justify-center p-3 sm:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full h-full flex items-center justify-center cursor-pointer group"
            onClick={() => onImageClick && onImageClick(currentImg)}
          >
            <img
              src={currentImg.url}
              alt={currentImg.caption || currentImg.title || 'Project image'}
              className="max-h-full max-w-full object-contain rounded-lg group-hover:scale-[1.01] transition-transform"
            />
            <div className="absolute top-3 right-3 bg-slate-900/75 hover:bg-slate-900 text-white text-xs font-mono px-2.5 py-1 rounded flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn size={13} />
              <span>Enlarge</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Previous / Next Arrow Controls */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded bg-white/90 hover:bg-white text-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/60 backdrop-blur-sm transition-colors cursor-pointer z-10"
              aria-label="Previous Image"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded bg-white/90 hover:bg-white text-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/60 backdrop-blur-sm transition-colors cursor-pointer z-10"
              aria-label="Next Image"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {/* Caption & Navigation Dots Bar */}
      <div className="px-5 py-2.5 bg-slate-100/60 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-400 font-semibold">
            {currentIndex + 1} / {images.length}
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="truncate max-w-lg text-slate-700 dark:text-slate-300 font-sans">
            {currentImg.caption || currentImg.title || 'Mechanical CAD Detail'}
          </span>
        </div>

        {/* Dots */}
        {images.length > 1 && (
          <div className="flex items-center gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'w-5 bg-blue-600 dark:bg-blue-400'
                    : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
