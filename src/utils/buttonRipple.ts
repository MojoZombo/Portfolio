/**
 * Mouse-Aware Radial Button Ripple Effect
 * 
 * Intercepts mouseenter on .btn-ripple elements and smoothly expands a circular
 * clipPath from the exact cursor entrance point (x, y) to the furthest corner.
 * On mouseleave, smoothly fades out.
 */

export function initButtonRipple(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const activeAnims = new WeakMap<HTMLElement, { enterAnim?: Animation; exitAnim?: Animation }>();

  const handleMouseEnter = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    btn.classList.add('is-hovered');
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const endRadius = Math.hypot(
      Math.max(x, rect.width - x),
      Math.max(y, rect.height - y)
    );

    const prev = activeAnims.get(btn);
    if (prev?.exitAnim) {
      try {
        prev.exitAnim.cancel();
      } catch {
        // no-op
      }
    }
    if (prev?.enterAnim) {
      try {
        prev.enterAnim.cancel();
      } catch {
        // no-op
      }
    }

    try {
      const enterAnim = btn.animate(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)`, opacity: 1 },
          { clipPath: `circle(${endRadius}px at ${x}px ${y}px)`, opacity: 1 }
        ],
        {
          duration: 360,
          easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
          fill: 'forwards',
          pseudoElement: '::before'
        }
      );
      activeAnims.set(btn, { enterAnim });
    } catch {
      // Fallback: simple CSS transition
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    btn.classList.remove('is-hovered');

    const prev = activeAnims.get(btn);
    if (prev?.exitAnim) {
      try {
        prev.exitAnim.cancel();
      } catch {
        // no-op
      }
    }

    try {
      const exitAnim = btn.animate(
        [
          { opacity: 1 },
          { opacity: 0 }
        ],
        {
          duration: 240,
          easing: 'ease-out',
          fill: 'forwards',
          pseudoElement: '::before'
        }
      );

      exitAnim.onfinish = () => {
        const current = activeAnims.get(btn);
        if (current?.enterAnim) {
          try {
            current.enterAnim.cancel();
          } catch {
            // no-op
          }
        }
        activeAnims.delete(btn);
      };

      if (prev) {
        prev.exitAnim = exitAnim;
      } else {
        activeAnims.set(btn, { exitAnim });
      }
    } catch {
      // Fallback
    }
  };

  document.addEventListener('mouseenter', handleMouseEnter, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);

  return () => {
    document.removeEventListener('mouseenter', handleMouseEnter, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
  };
}
