/**
 * Mouse-Aware Radial Button Ripple Effect
 * 
 * - On mouseenter: Smoothly expands a circular clipPath from cursor entry point (startX, startY).
 * - On mouseleave:
 *   - If the animation hadn't fully finished covering the button yet:
 *     Reverses the animation back to where it started from its current radius.
 *   - If the animation had finished:
 *     Animates out towards where the mouse left the button (exitX, exitY).
 */

interface ActiveButtonAnimation {
  anim?: Animation;
  startX: number;
  startY: number;
  endRadius: number;
  startTime: number;
  duration: number;
  isCovered: boolean;
}

export function initButtonRipple(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const activeAnims = new WeakMap<HTMLElement, ActiveButtonAnimation>();
  const ENTER_DURATION = 360;
  const EXIT_DURATION = 300;

  const handleMouseEnter = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    btn.classList.add('is-hovered');
    const rect = btn.getBoundingClientRect();
    const startX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const startY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const endRadius = Math.hypot(
      Math.max(startX, rect.width - startX),
      Math.max(startY, rect.height - startY)
    );

    const prev = activeAnims.get(btn);
    if (prev?.anim) {
      try {
        prev.anim.cancel();
      } catch {
        // no-op
      }
    }

    try {
      const enterAnim = btn.animate(
        [
          { clipPath: `circle(0px at ${startX}px ${startY}px)`, opacity: 1 },
          { clipPath: `circle(${endRadius}px at ${startX}px ${startY}px)`, opacity: 1 }
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
        startX,
        startY,
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
      // Fallback: browser doesn't support pseudoElement in animate
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    btn.classList.remove('is-hovered');

    const data = activeAnims.get(btn);
    const rect = btn.getBoundingClientRect();
    const exitX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const exitY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    if (data?.anim) {
      try {
        data.anim.cancel();
      } catch {
        // no-op
      }
    }

    if (data && !data.isCovered) {
      // Case A: hadn't fully finished covering yet -> reverse the animation from where it started!
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
    } else {
      // Case B: animation had finished -> animate out from where the mouse left the button!
      const maxRadius = Math.hypot(
        Math.max(exitX, rect.width - exitX),
        Math.max(exitY, rect.height - exitY)
      );

      try {
        const exitAnim = btn.animate(
          [
            { clipPath: `circle(${maxRadius}px at ${exitX}px ${exitY}px)`, opacity: 1 },
            { clipPath: `circle(0px at ${exitX}px ${exitY}px)`, opacity: 1 }
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
          startX: exitX,
          startY: exitY,
          endRadius: maxRadius,
          startTime: performance.now(),
          duration: EXIT_DURATION,
          isCovered: false
        });
      } catch {
        activeAnims.delete(btn);
      }
    }
  };

  document.addEventListener('mouseenter', handleMouseEnter, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);

  return () => {
    document.removeEventListener('mouseenter', handleMouseEnter, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
  };
}
