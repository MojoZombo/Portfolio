import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [targetNextIndex, setTargetNextIndex] = useState<number | null>(null);
  const [targetPrevIndex, setTargetPrevIndex] = useState<number | null>(null);

  // Layer elevation state: incoming image rises above the outgoing center image (z-30 vs z-20)
  // at the exact midpoint of the transition (150ms / |progress| > 0.5) when both images are semi-opaque
  const [isNextOnTop, setIsNextOnTop] = useState(false);
  const [isPrevOnTop, setIsPrevOnTop] = useState(false);

  // Which side preview card the mouse is over; effects are suppressed while animating/dragging
  const [hoverSide, setHoverSide] = useState<'prev' | 'next' | null>(null);
  const nextHovered = hoverSide === 'next' && !isAnimating && !isDragging;
  const prevHovered = hoverSide === 'prev' && !isAnimating && !isDragging;

  const stageRef = useRef<HTMLDivElement>(null);
  const midpointTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [slotOffset, setSlotOffset] = useState(300);
  const hasDragged = useRef(false);

  // Measure stage width to compute tucked slot offset:
  // On mobile: center card is 82% wide (gap is 91%..100%, center of gap is at 95.5%, offset = 45.5% of stage width)
  // This places the center of the side image directly at the center of the gap to the right of the middle image.
  // On desktop: center card is ~56% wide, offset ~38% keeps preview cards tucked and centered in the gap.
  useEffect(() => {
    const updateOffset = () => {
      if (!stageRef.current) return;
      const width = stageRef.current.offsetWidth;
      if (width < 640) {
        setSlotOffset(Math.round(width * 0.455));
      } else {
        setSlotOffset(Math.round(Math.min(350, width * 0.38)));
      }
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => {
      window.removeEventListener('resize', updateOffset);
      if (midpointTimer.current) clearTimeout(midpointTimer.current);
    };
  }, []);

  // Motion value driving unified 5-card stage offset (zero tilt)
  const slideOffset = useMotionValue(0);

  // Normalized gesture progress: 0 = rest, -1 = slide to next, +1 = slide to prev
  const progress = useTransform(slideOffset, (val) => val / (slotOffset || 300));

  // Card Positions along unified 5-slot stage track
  const prevPrevCardX = useTransform(slideOffset, (val) => -2 * slotOffset + val);
  const prevCardX = useTransform(slideOffset, (val) => -slotOffset + val);
  const centerCardX = slideOffset;
  const nextCardX = useTransform(slideOffset, (val) => slotOffset + val);
  const nextNextCardX = useTransform(slideOffset, (val) => 2 * slotOffset + val);

  // Scales for all 5 cards:
  // Center: 1.0 at rest, drops to 0.64 at ±1
  const centerScale = useTransform(progress, [-1, 0, 1], [0.64, 1.0, 0.64]);
  // Next: 0.64 at rest, expands to 1.0 at center (-1), drops to 0.4 if pushed offscreen (+1)
  const nextScale = useTransform(progress, [-1, 0, 1], [1.0, 0.64, 0.4]);
  // NextNext (image after next): starts at 0.4 offscreen, expands to 0.64 as it glides into next preview slot (-1)
  const nextNextScale = useTransform(progress, [-1, 0, 1], [0.64, 0.4, 0.4]);
  // Prev: 0.64 at rest, expands to 1.0 at center (+1), drops to 0.4 if pushed offscreen (-1)
  const prevScale = useTransform(progress, [-1, 0, 1], [0.4, 0.64, 1.0]);
  // PrevPrev (image before prev): starts at 0.4 offscreen, expands to 0.64 as it glides into prev preview slot (+1)
  const prevPrevScale = useTransform(progress, [-1, 0, 1], [0.4, 0.4, 0.64]);

  // Opacities for all 5 cards:
  const centerOpacity = useTransform(progress, [-1, 0, 1], [0.4, 1.0, 0.4]);
  const nextOpacity = useTransform(progress, [-1, 0, 1], [1.0, 0.4, 0]);
  const nextNextOpacity = useTransform(progress, [-1, 0, 1], [0.4, 0, 0]);
  const prevOpacity = useTransform(progress, [-1, 0, 1], [0, 0.4, 1.0]);
  const prevPrevOpacity = useTransform(progress, [-1, 0, 1], [0, 0, 0.4]);

  if (!images || images.length === 0) return null;

  const total = images.length;
  const currentImg = images[currentIndex];
  const prevIndex = (currentIndex - 1 + total) % total;
  const prevPrevIndex = (currentIndex - 2 + total) % total;
  const nextIndex = (currentIndex + 1) % total;
  const nextNextIndex = (currentIndex + 2) % total;

  const renderedNextIndex = targetNextIndex ?? nextIndex;
  const renderedNextNextIndex = targetNextIndex !== null ? (targetNextIndex + 1) % total : nextNextIndex;
  const renderedPrevIndex = targetPrevIndex ?? prevIndex;
  const renderedPrevPrevIndex = targetPrevIndex !== null ? (targetPrevIndex - 1 + total) % total : prevPrevIndex;

  const goToNext = (targetIdx?: number) => {
    if (isAnimating || total <= 1) return;
    setIsAnimating(true);
    setHoverSide(null);
    const destIndex = targetIdx !== undefined ? targetIdx : (currentIndex + 1) % total;
    if (targetIdx !== undefined) {
      setTargetNextIndex(destIndex);
    }

    if (midpointTimer.current) clearTimeout(midpointTimer.current);

    // If not already elevated from a drag past halfway, elevate incoming card to top layer
    // at the 150ms midpoint when images cross each other
    if (!isNextOnTop) {
      midpointTimer.current = setTimeout(() => {
        setIsNextOnTop(true);
      }, 150);
    }

    animate(slideOffset, -slotOffset, {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1],
    }).then(() => {
      if (midpointTimer.current) clearTimeout(midpointTimer.current);
      // Synchronously batch index advance, offset reset, and layer reset in a single pass to eliminate flashes
      setCurrentIndex(destIndex);
      setTargetNextIndex(null);
      slideOffset.set(0);
      setIsNextOnTop(false);
      setIsAnimating(false);
      hasDragged.current = false;
    });
  };

  const goToPrev = (targetIdx?: number) => {
    if (isAnimating || total <= 1) return;
    setIsAnimating(true);
    setHoverSide(null);
    const destIndex = targetIdx !== undefined ? targetIdx : (currentIndex - 1 + total) % total;
    if (targetIdx !== undefined) {
      setTargetPrevIndex(destIndex);
    }

    if (midpointTimer.current) clearTimeout(midpointTimer.current);

    if (!isPrevOnTop) {
      midpointTimer.current = setTimeout(() => {
        setIsPrevOnTop(true);
      }, 150);
    }

    animate(slideOffset, slotOffset, {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1],
    }).then(() => {
      if (midpointTimer.current) clearTimeout(midpointTimer.current);
      setCurrentIndex(destIndex);
      setTargetPrevIndex(null);
      slideOffset.set(0);
      setIsPrevOnTop(false);
      setIsAnimating(false);
      hasDragged.current = false;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPrev();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative w-full rounded-lg overflow-hidden bg-slate-100/60 dark:bg-slate-900/40 my-3 select-none focus:outline-none"
    >
      {/* Main Image Display Stage with Continuous 5-Slot Track */}
      <div
        ref={stageRef}
        className="relative h-[360px] sm:h-[420px] w-full flex items-center justify-center overflow-hidden p-2 sm:p-4 touch-pan-y"
      >
        {/* PrevPrev Card (Image before previous: slides in from offstage left into prev slot) */}
        {total > 1 && (
          <motion.div
            key="carousel-prev-prev"
            style={{
              x: prevPrevCardX,
              scale: prevPrevScale,
              opacity: prevPrevOpacity,
            }}
            className="absolute top-0 bottom-0 flex items-center justify-center w-[82%] sm:w-[58%] md:w-[56%] max-w-[560px] z-0 pointer-events-none"
          >
            <div className="relative inline-block max-h-full max-w-full">
              <img
                src={images[renderedPrevPrevIndex].url}
                alt=""
                className="max-h-[300px] sm:max-h-[360px] max-w-full object-contain rounded-lg select-none pointer-events-none"
                draggable={false}
              />
            </div>
          </motion.div>
        )}

        {/* Previous Card (Centered in the left gap, elevates to z-30 on top of main card past midpoint) */}
        {total > 1 && (
          <motion.div
            key="carousel-prev"
            style={{
              x: prevCardX,
              scale: prevScale,
              opacity: prevOpacity,
            }}
            onClick={() => {
              if (!isAnimating && !isDragging) goToPrev();
            }}
            onMouseEnter={() => setHoverSide('prev')}
            onMouseLeave={() => setHoverSide((s) => (s === 'prev' ? null : s))}
            className={`absolute top-0 bottom-0 flex items-center justify-center w-[82%] sm:w-[58%] md:w-[56%] max-w-[560px] cursor-pointer ${
              isPrevOnTop ? 'z-30' : 'z-10'
            } ${isAnimating ? 'pointer-events-none' : 'pointer-events-auto'}`}
            aria-label={`Previous photo: ${images[renderedPrevIndex]?.caption || images[renderedPrevIndex]?.title || 'Photo'}`}
            title={`Previous: ${images[renderedPrevIndex]?.caption || images[renderedPrevIndex]?.title || 'Photo'}`}
          >
            <div
              className={`relative inline-block max-h-full max-w-full ${
                isAnimating ? '' : 'transition-transform duration-200'
              } ${prevHovered ? 'scale-[1.06]' : 'scale-100'}`}
            >
              <img
                src={images[renderedPrevIndex].url}
                alt={images[renderedPrevIndex].caption || 'Previous photo'}
                className="max-h-[300px] sm:max-h-[360px] max-w-full object-contain rounded-lg select-none pointer-events-none"
                draggable={false}
              />
              {/* Hover highlight: removed instantly (not faded) once the slide animation starts */}
              {prevHovered && (
                <div className="absolute inset-0 rounded-lg bg-white/30 dark:bg-white/20 pointer-events-none" />
              )}
            </div>
          </motion.div>
        )}

        {/* Active Center Card (Elevated in front at z-20 at rest, scale 1.0, zero tilt) */}
        <motion.div
          key="carousel-center"
          style={{
            x: centerCardX,
            scale: centerScale,
            opacity: centerOpacity,
          }}
          onPanStart={() => {
            if (isAnimating) return;
            setIsDragging(true);
            hasDragged.current = false;
          }}
          onPan={(_, info) => {
            if (isAnimating) return;
            if (Math.abs(info.offset.x) > 5) {
              hasDragged.current = true;
            }
            slideOffset.set(info.offset.x);
            const progressVal = info.offset.x / (slotOffset || 300);
            if (progressVal < -0.5) {
              setIsNextOnTop(true);
              setIsPrevOnTop(false);
            } else if (progressVal > 0.5) {
              setIsPrevOnTop(true);
              setIsNextOnTop(false);
            } else {
              setIsNextOnTop(false);
              setIsPrevOnTop(false);
            }
          }}
          onPanEnd={(_, info) => {
            if (isAnimating) return;
            const swipeThreshold = 35;
            const velocityThreshold = 220;
            const x = info.offset.x;
            const vx = info.velocity.x;

            if (x < -swipeThreshold || vx < -velocityThreshold) {
              goToNext();
            } else if (x > swipeThreshold || vx > velocityThreshold) {
              goToPrev();
            } else {
              animate(slideOffset, 0, { duration: 0.22, ease: 'easeOut' });
              setIsNextOnTop(false);
              setIsPrevOnTop(false);
            }
            setTimeout(() => setIsDragging(false), 50);
          }}
          className="absolute top-0 bottom-0 flex items-center justify-center w-[82%] sm:w-[58%] md:w-[56%] max-w-[560px] z-20 pointer-events-none touch-pan-y"
        >
          <div
            className="relative inline-block max-h-full max-w-full cursor-grab active:cursor-grabbing pointer-events-auto group"
            onClick={() => {
              if (!hasDragged.current && !isDragging && onImageClick) {
                onImageClick(currentImg);
              }
            }}
          >
            <img
              src={currentImg.url}
              alt={currentImg.caption || currentImg.title || 'Project image'}
              className="max-h-[300px] sm:max-h-[360px] max-w-full object-contain rounded-lg pointer-events-none select-none"
              draggable={false}
            />
            <div
              className="absolute top-2.5 right-2.5 p-1.5 rounded bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity select-none pointer-events-none"
              title="Enlarge photo"
            >
              <ZoomIn size={14} />
            </div>
          </div>
        </motion.div>

        {/* Next Card (Centered in the right gap, elevates to z-30 on top of main card past midpoint) */}
        {total > 1 && (
          <motion.div
            key="carousel-next"
            style={{
              x: nextCardX,
              scale: nextScale,
              opacity: nextOpacity,
            }}
            onClick={() => {
              if (!isAnimating && !isDragging) goToNext();
            }}
            onMouseEnter={() => setHoverSide('next')}
            onMouseLeave={() => setHoverSide((s) => (s === 'next' ? null : s))}
            className={`absolute top-0 bottom-0 flex items-center justify-center w-[82%] sm:w-[58%] md:w-[56%] max-w-[560px] cursor-pointer ${
              isNextOnTop ? 'z-30' : 'z-10'
            } ${isAnimating ? 'pointer-events-none' : 'pointer-events-auto'}`}
            aria-label={`Next photo: ${images[renderedNextIndex]?.caption || images[renderedNextIndex]?.title || 'Photo'}`}
            title={`Next: ${images[renderedNextIndex]?.caption || images[renderedNextIndex]?.title || 'Photo'}`}
          >
            <div
              className={`relative inline-block max-h-full max-w-full ${
                isAnimating ? '' : 'transition-transform duration-200'
              } ${nextHovered ? 'scale-[1.06]' : 'scale-100'}`}
            >
              <img
                src={images[renderedNextIndex].url}
                alt={images[renderedNextIndex].caption || 'Next photo'}
                className="max-h-[300px] sm:max-h-[360px] max-w-full object-contain rounded-lg select-none pointer-events-none"
                draggable={false}
              />
              {/* Hover highlight: removed instantly (not faded) once the slide animation starts */}
              {nextHovered && (
                <div className="absolute inset-0 rounded-lg bg-white/30 dark:bg-white/20 pointer-events-none" />
              )}
            </div>
          </motion.div>
        )}

        {/* NextNext Card (Image after next: seamlessly glides in from offstage right into next slot) */}
        {total > 1 && (
          <motion.div
            key="carousel-next-next"
            style={{
              x: nextNextCardX,
              scale: nextNextScale,
              opacity: nextNextOpacity,
            }}
            className="absolute top-0 bottom-0 flex items-center justify-center w-[82%] sm:w-[58%] md:w-[56%] max-w-[560px] z-0 pointer-events-none"
          >
            <div className="relative inline-block max-h-full max-w-full">
              <img
                src={images[renderedNextNextIndex].url}
                alt=""
                className="max-h-[300px] sm:max-h-[360px] max-w-full object-contain rounded-lg select-none pointer-events-none"
                draggable={false}
              />
            </div>
          </motion.div>
        )}

        {/* Edge arrow indicators: pinned to the carousel edges, shown only while hovering a side card at rest */}
        {prevHovered && (
          <div className="absolute inset-y-0 left-0 w-20 sm:w-28 z-40 pointer-events-none flex items-center justify-start pl-1 sm:pl-2 bg-gradient-to-r from-white/80 dark:from-slate-950/60 to-transparent">
            <ChevronLeft size={40} strokeWidth={2.5} className="text-slate-900 dark:text-white" />
          </div>
        )}
        {nextHovered && (
          <div className="absolute inset-y-0 right-0 w-20 sm:w-28 z-40 pointer-events-none flex items-center justify-end pr-1 sm:pr-2 bg-gradient-to-l from-white/80 dark:from-slate-950/60 to-transparent">
            <ChevronRight size={40} strokeWidth={2.5} className="text-slate-900 dark:text-white" />
          </div>
        )}
      </div>

      {/* Caption & Navigation Controls Bar */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-100 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
          {total > 1 && (
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-200/80 dark:bg-slate-800/80 px-2 py-1 rounded">
              <button
                type="button"
                onClick={() => goToPrev()}
                className="btn-ripple w-6 h-6 flex items-center justify-center rounded text-slate-700 dark:text-slate-300 hover:text-white cursor-pointer"
                aria-label="Previous slide"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-blue-600 dark:text-blue-400 font-semibold px-1 text-center select-none text-xs min-w-[36px]">
                {currentIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => goToNext()}
                className="btn-ripple w-6 h-6 flex items-center justify-center rounded text-slate-700 dark:text-slate-300 hover:text-white cursor-pointer"
                aria-label="Next slide"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {total === 1 && (
            <span className="text-blue-600 dark:text-blue-400 font-semibold shrink-0">
              1 / 1
            </span>
          )}

          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

          <span className="truncate text-slate-700 dark:text-slate-300 font-sans text-xs sm:text-sm">
            {currentImg.caption || currentImg.title || 'Mechanical CAD Detail'}
          </span>
        </div>

        {/* Navigation Indicator Dots */}
        {total > 1 && (
          <div className="flex items-center gap-1.5 shrink-0 self-center sm:self-auto">
            {images.map((img, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => {
                  if (idx === currentIndex) return;
                  if (idx > currentIndex) {
                    goToNext(idx);
                  } else {
                    goToPrev(idx);
                  }
                }}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'w-6 bg-blue-600 dark:bg-blue-400'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
                aria-label={`Go to slide ${idx + 1}: ${img.caption || img.title || 'Photo'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
