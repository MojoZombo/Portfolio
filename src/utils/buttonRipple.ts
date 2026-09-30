/**
 * Dual-Mode Radial Button Ripple Effect
 * 
 * Desktop (Mouse):
 * - Edge Projection: Originates from and exits into the true perimeter edge
 * - Intent Debounce: Ignores rapid sweeps (< 50ms)
 * - Dynamic Exit: Reverses if partial, animates out if full
 * 
 * Mobile (Touch):
 * - Origin: Activates directly from exact tap location (where user touched)
 * - Hold: Maintains full active highlight while finger is held
 * - Move Off: Smoothly reverses & undos the animation when finger leaves button bounds
 * - Normal Tap: Completes expanding animation and then fades away smoothly back to original background
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

interface ActiveTouchAnimation {
  btn: HTMLElement;
  touchX: number;
  touchY: number;
  endRadius: number;
  startTime: number;
  duration: number;
  anim: Animation;
  state: 'holding' | 'fading' | 'undone';
}

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

  const activeMouseAnims = new WeakMap<HTMLElement, ActiveButtonAnimation>();
  const activeTouchMap = new Map<number, ActiveTouchAnimation>();

  let lastTouchTime = 0;
  const DEBOUNCE_MS = 50;
  const ENTER_DURATION = 320;
  const EXIT_DURATION = 280;

  // -------------------------------------------------------------
  // DESKTOP MOUSE HANDLERS
  // -------------------------------------------------------------
  const startMouseAnimation = (btn: HTMLElement, edgeX: number, edgeY: number) => {
    const rect = btn.getBoundingClientRect();
    const endRadius = Math.hypot(
      Math.max(edgeX, rect.width - edgeX),
      Math.max(edgeY, rect.height - edgeY)
    );

    const prev = activeMouseAnims.get(btn);
    if (prev?.anim) {
      try {
        prev.anim.cancel();
      } catch {}
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

      activeMouseAnims.set(btn, animData);
    } catch {}
  };

  const handleMouseEnter = (e: MouseEvent) => {
    // Ignore synthetic mouse events caused by mobile touch
    if (Date.now() - lastTouchTime < 800) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    const rect = btn.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const edge = projectToNearestEdge(rawX, rawY, rect.width, rect.height);

    const prev = activeMouseAnims.get(btn);
    if (prev?.debounceTimer) {
      clearTimeout(prev.debounceTimer);
    }
    if (prev?.anim) {
      try {
        prev.anim.cancel();
      } catch {}
    }

    const debounceTimer = setTimeout(() => {
      startMouseAnimation(btn, edge.x, edge.y);
    }, DEBOUNCE_MS);

    activeMouseAnims.set(btn, {
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
    if (Date.now() - lastTouchTime < 800) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn || btn !== target) return;

    const data = activeMouseAnims.get(btn);

    if (data?.debounceTimer) {
      clearTimeout(data.debounceTimer);
      activeMouseAnims.delete(btn);
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
      } catch {}
    }

    if (data && !data.isCovered && data.startTime > 0) {
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
          activeMouseAnims.delete(btn);
        };

        activeMouseAnims.set(btn, { ...data, anim: reverseAnim });
      } catch {
        activeMouseAnims.delete(btn);
      }
    } else if (data && data.isCovered) {
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
          activeMouseAnims.delete(btn);
        };

        activeMouseAnims.set(btn, {
          anim: exitAnim,
          startX: exitEdge.x,
          startY: exitEdge.y,
          endRadius: maxRadius,
          startTime: performance.now(),
          duration: EXIT_DURATION,
          isCovered: false
        });
      } catch {
        activeMouseAnims.delete(btn);
      }
    } else {
      activeMouseAnims.delete(btn);
    }
  };

  // -------------------------------------------------------------
  // MOBILE TOUCH HANDLERS (POINTER EVENTS)
  // -------------------------------------------------------------
  const handlePointerDown = (e: PointerEvent) => {
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';

    if (isTouch) {
      lastTouchTime = Date.now();
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest<HTMLElement>('.btn-ripple');
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      // Activate animation from exactly where tapped
      const touchX = e.clientX - rect.left;
      const touchY = e.clientY - rect.top;
      const endRadius = Math.hypot(
        Math.max(touchX, rect.width - touchX),
        Math.max(touchY, rect.height - touchY)
      );

      // Clean up any existing anim
      const existing = activeTouchMap.get(e.pointerId);
      if (existing?.anim) {
        try { existing.anim.cancel(); } catch {}
      }

      btn.classList.add('is-hovered');

      try {
        const enterAnim = btn.animate(
          [
            { clipPath: `circle(0px at ${touchX}px ${touchY}px)`, opacity: 1 },
            { clipPath: `circle(${endRadius}px at ${touchX}px ${touchY}px)`, opacity: 1 }
          ],
          {
            duration: ENTER_DURATION,
            easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
            fill: 'forwards',
            pseudoElement: '::before'
          }
        );

        activeTouchMap.set(e.pointerId, {
          btn,
          touchX,
          touchY,
          endRadius,
          startTime: performance.now(),
          duration: ENTER_DURATION,
          anim: enterAnim,
          state: 'holding'
        });
      } catch {
        btn.classList.remove('is-hovered');
      }
    } else {
      // Desktop mouse pointerdown: zero-latency trigger if debounce was pending
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest<HTMLElement>('.btn-ripple');
      if (!btn) return;

      const data = activeMouseAnims.get(btn);
      if (data?.debounceTimer) {
        clearTimeout(data.debounceTimer);
        startMouseAnimation(btn, data.startX, data.startY);
      }
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

    const data = activeTouchMap.get(e.pointerId);
    if (!data || data.state !== 'holding') return;

    const rect = data.btn.getBoundingClientRect();
    // Allow slight finger wobble margin of 8px
    const isInside =
      e.clientX >= rect.left - 8 &&
      e.clientX <= rect.right + 8 &&
      e.clientY >= rect.top - 8 &&
      e.clientY <= rect.bottom + 8;

    if (!isInside) {
      // Finger moved off the button -> undo the animation
      data.state = 'undone';
      activeTouchMap.delete(e.pointerId);

      const elapsed = performance.now() - data.startTime;
      const rawProgress = Math.min(1, Math.max(0.05, elapsed / data.duration));
      const easedProgress = Math.sin((rawProgress * Math.PI) / 2);
      const currentRadius = data.endRadius * easedProgress;
      const reverseDuration = Math.max(100, Math.round(180 * rawProgress));

      try {
        data.anim.cancel();
      } catch {}

      try {
        const reverseAnim = data.btn.animate(
          [
            { clipPath: `circle(${currentRadius}px at ${data.touchX}px ${data.touchY}px)`, opacity: 1 },
            { clipPath: `circle(0px at ${data.touchX}px ${data.touchY}px)`, opacity: 1 }
          ],
          {
            duration: reverseDuration,
            easing: 'ease-out',
            fill: 'forwards',
            pseudoElement: '::before'
          }
        );

        reverseAnim.onfinish = () => {
          try { reverseAnim.cancel(); } catch {}
          data.btn.classList.remove('is-hovered');
        };
      } catch {
        data.btn.classList.remove('is-hovered');
      }
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

    const data = activeTouchMap.get(e.pointerId);
    if (!data || data.state !== 'holding') return;

    data.state = 'fading';
    activeTouchMap.delete(e.pointerId);

    // If tap was quick, let the enter ripple complete expanding before fading away
    const elapsed = performance.now() - data.startTime;
    const remainingEnter = Math.max(0, data.duration - elapsed);

    setTimeout(() => {
      // Fade away smoothly back to the original background
      const FADE_DURATION = 240;
      try {
        const fadeAnim = data.btn.animate(
          [
            { clipPath: `circle(${data.endRadius}px at ${data.touchX}px ${data.touchY}px)`, opacity: 1 },
            { clipPath: `circle(${data.endRadius}px at ${data.touchX}px ${data.touchY}px)`, opacity: 0 }
          ],
          {
            duration: FADE_DURATION,
            easing: 'ease-out',
            fill: 'forwards',
            pseudoElement: '::before'
          }
        );

        data.btn.classList.remove('is-hovered');

        fadeAnim.onfinish = () => {
          try { fadeAnim.cancel(); } catch {}
        };
      } catch {
        data.btn.classList.remove('is-hovered');
      }
    }, remainingEnter);
  };

  const handlePointerCancel = (e: PointerEvent) => {
    const data = activeTouchMap.get(e.pointerId);
    if (data) {
      activeTouchMap.delete(e.pointerId);
      try { data.anim.cancel(); } catch {}
      data.btn.classList.remove('is-hovered');
    }
  };

  document.addEventListener('mouseenter', handleMouseEnter, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);
  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('pointerup', handlePointerUp, true);
  document.addEventListener('pointercancel', handlePointerCancel, true);

  return () => {
    document.removeEventListener('mouseenter', handleMouseEnter, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
    document.removeEventListener('pointerdown', handlePointerDown, true);
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('pointerup', handlePointerUp, true);
    document.removeEventListener('pointercancel', handlePointerCancel, true);
  };
}
