/**
 * Mouse-Aware Radial Button Ripple Effect with Edge Projection & Debounce
 * 
 * - Edge Projection: Ensures the animation always originates from and exits into
 *   the true perimeter edge of the button (nearest to where the cursor entered/left),
 *   never floating in the middle.
 * - Intent Debounce: Ignores rapid mouse sweeps past buttons (< 50ms), preventing
 *   accidental flickers.
 * - Dynamic Exit:
 *   - If aborted before fully covering (< 100%): smoothly reverses back to the entry edge point.
 *   - If fully covered: animates out towards the exact exit edge point where the cursor crossed.
 */

interface ActiveButtonAnimation {
  anim?: Animation;
  debounceTimer?: ReturnType<typeof setTimeout> | null;
  startX: number;
  startY: number;
  endRadius: number;
  startTime: number;
  duration: number;
  isCovered: boolean;
}

/**
 * Projects any cursor coordinate (x, y) to the nearest outer edge of the button rectangle.
 */
function projectToNearestEdge(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const clampedX = Math.max(0, Math.min(width, x));
  const clampedY = Math.max(0, Math.min(height, y));

  const dLeft = clampedX;
  const dRight = width - clampedX;
  const dTop = clampedY;
  const dBottom = height - clampedY;

  const minD = Math.min(dLeft, dRight, dTop, dBottom);

  if (minD === dLeft) return { x: 0, y: clampedY };
  if (minD === dRight) return { x: width, y: clampedY };
  if (minD === dTop) return { x: clampedX, y: 0 };
  return { x: clampedX, y: height };
}

export function initButtonRipple(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const activeAnims = new WeakMap<HTMLElement, ActiveButtonAnimation>();
  const DEBOUNCE_MS = 50;
  const ENTER_DURATION = 360;
  const EXIT_DURATION = 300;

  const startAnimation = (btn: HTMLElement, edgeX: number, edgeY: number) => {
    const rect = btn.getBoundingClientRect();
    const endRadius = Math.hypot(
      Math.max(edgeX, rect.width - edgeX),
      Math.max(edgeY, rect.height - edgeY)
    );

    const prev = activeAnims.get(btn);
    if (prev?.anim) {
      try {
        prev.anim.cancel();
      } catch {
        // no-op
      }
    }

    btn.classList.add('is-hovered');

    try {
      const enterAnim = btn.animate(
        [
          { clipPath: `circle(0px at ${edgeX}px ${edgeY}px)`, opacity: 1 },
          { clipPath: `circle(${endRadius}px at ${edgeX}px ${edgeY}px)`, opacity: 1 }
        ],
        {
          duration: ENTER_DURATION,
          easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
          fill: 'forwards',
          pseudoElement: '::before'
        }
      );

      const animData: ActiveButtonAnimation = {
        anim: enterAnim,
        debounceTimer: null,
        startX: edgeX,
        startY: edgeY,
        endRadius,
        startTime: performance.now(),
        duration: ENTER_DURATION,
        isCovered: false
      };

      enterAnim.onfinish = () => {
        animData.isCovered = true;
      };

      activeAnims.set(btn, animData);
    } catch {
      // Fallback
    }
  };

  const handleMouseEnter = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    const rect = btn.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const edge = projectToNearestEdge(rawX, rawY, rect.width, rect.height);

    const prev = activeAnims.get(btn);
    if (prev?.debounceTimer) {
      clearTimeout(prev.debounceTimer);
    }
    if (prev?.anim) {
      try {
        prev.anim.cancel();
      } catch {
        // no-op
      }
    }

    // Set debounce timer to filter out fast cursor passes
    const debounceTimer = setTimeout(() => {
      startAnimation(btn, edge.x, edge.y);
    }, DEBOUNCE_MS);

    activeAnims.set(btn, {
      debounceTimer,
      startX: edge.x,
      startY: edge.y,
      endRadius: 0,
      startTime: 0,
      duration: ENTER_DURATION,
      isCovered: false
    });
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    const data = activeAnims.get(btn);

    // If mouse left before the debounce timer finished, abort completely with zero animation
    if (data?.debounceTimer) {
      clearTimeout(data.debounceTimer);
      activeAnims.delete(btn);
      btn.classList.remove('is-hovered');
      return;
    }

    btn.classList.remove('is-hovered');

    const rect = btn.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const exitEdge = projectToNearestEdge(rawX, rawY, rect.width, rect.height);

    if (data?.anim) {
      try {
        data.anim.cancel();
      } catch {
        // no-op
      }
    }

    if (data && !data.isCovered && data.startTime > 0) {
      // Case A: hadn't fully finished covering yet -> reverse back to start edge point!
      const elapsed = performance.now() - data.startTime;
      const rawProgress = Math.min(1, Math.max(0.05, elapsed / data.duration));
      const easedProgress = Math.sin((rawProgress * Math.PI) / 2);
      const currentRadius = data.endRadius * easedProgress;
      const reverseDuration = Math.max(100, Math.round(data.duration * rawProgress));

      try {
        const reverseAnim = btn.animate(
          [
            { clipPath: `circle(${currentRadius}px at ${data.startX}px ${data.startY}px)`, opacity: 1 },
            { clipPath: `circle(0px at ${data.startX}px ${data.startY}px)`, opacity: 1 }
          ],
          {
            duration: reverseDuration,
            easing: 'ease-out',
            fill: 'forwards',
            pseudoElement: '::before'
          }
        );

        reverseAnim.onfinish = () => {
          try {
            reverseAnim.cancel();
          } catch {}
          activeAnims.delete(btn);
        };

        activeAnims.set(btn, { ...data, anim: reverseAnim });
      } catch {
        activeAnims.delete(btn);
      }
    } else if (data && data.isCovered) {
      // Case B: animation had finished -> animate out towards the exit edge point!
      const maxRadius = Math.hypot(
        Math.max(exitEdge.x, rect.width - exitEdge.x),
        Math.max(exitEdge.y, rect.height - exitEdge.y)
      );

      try {
        const exitAnim = btn.animate(
          [
            { clipPath: `circle(${maxRadius}px at ${exitEdge.x}px ${exitEdge.y}px)`, opacity: 1 },
            { clipPath: `circle(0px at ${exitEdge.x}px ${exitEdge.y}px)`, opacity: 1 }
          ],
          {
            duration: EXIT_DURATION,
            easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
            fill: 'forwards',
            pseudoElement: '::before'
          }
        );

        exitAnim.onfinish = () => {
          try {
            exitAnim.cancel();
          } catch {}
          activeAnims.delete(btn);
        };

        activeAnims.set(btn, {
          anim: exitAnim,
          startX: exitEdge.x,
          startY: exitEdge.y,
          endRadius: maxRadius,
          startTime: performance.now(),
          duration: EXIT_DURATION,
          isCovered: false
        });
      } catch {
        activeAnims.delete(btn);
      }
    } else {
      activeAnims.delete(btn);
    }
  };

  // Immediate activation on pointerdown to ensure zero latency when clicking immediately
  const handlePointerDown = (e: PointerEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn) return;

    const data = activeAnims.get(btn);
    if (data?.debounceTimer) {
      clearTimeout(data.debounceTimer);
      startAnimation(btn, data.startX, data.startY);
    }
  };

  document.addEventListener('mouseenter', handleMouseEnter, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);
  document.addEventListener('pointerdown', handlePointerDown, true);

  return () => {
    document.removeEventListener('mouseenter', handleMouseEnter, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
    document.removeEventListener('pointerdown', handlePointerDown, true);
  };
}
