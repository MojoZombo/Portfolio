/**
 * Dual-Mode Radial Button Ripple Effect
 * 
 * Desktop (Mouse):
 * - Instant Activation: Zero latency upon mouse entry, perfectly consistent on every pass
 * - Edge Projection: Originates from and exits into the true perimeter edge
 * - Re-entry Safe: Immediately cancels any in-flight exit/reverse animation with no race conditions
 * - Dynamic Exit: Smoothly reverses if mouse leaves early; animates out towards exit edge if fully covered
 * - Auto Revert: Automatically cleans up and reverts buttons when modals open/close or cursor leaves
 * 
 * Mobile (Touch):
 * - Origin: Activates directly from exact tap location (where user touched)
 * - Hold: Maintains full active highlight while finger is held
 * - Move Off: Smoothly reverses & undos the animation when finger leaves button bounds
 * - Normal Tap: Completes expanding animation and then fades away smoothly back to original background
 */

interface ActiveButtonAnimation {
  anim?: Animation;
  startX: number;
  startY: number;
  endRadius: number;
  startTime: number;
  duration: number;
  isCovered: boolean;
  isEntering?: boolean;
  wasClicked?: boolean;
}

interface ActiveTouchAnimation {
  btn: HTMLElement;
  touchX: number;
  touchY: number;
  endRadius: number;
  startTime: number;
  duration: number;
  enterAnim: Animation;
  fadeAnim?: Animation | null;
  state: 'entering' | 'holding' | 'fading';
  isReleased: boolean;
}

const activeMouseAnims = new WeakMap<HTMLElement, ActiveButtonAnimation>();
const activeTouchMap = new Map<number, ActiveTouchAnimation>();
const btnTouchMap = new WeakMap<HTMLElement, ActiveTouchAnimation>();

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

/**
 * Reverts a button ripple back to its clean unhovered/unclicked state.
 * Cancels active mouse animations on ::before and removes .is-hovered.
 * Note: Does NOT abort in-flight mobile touch tap animations, allowing
 * them to complete their full expansion and fade out smoothly.
 */
export function revertButtonRipple(btn: HTMLElement, forceTouch: boolean = false): void {
  // If forceTouch is false and this button is running a mobile touch tap,
  // let it finish expanding and fade out naturally!
  if (!forceTouch && btnTouchMap.has(btn)) {
    return;
  }

  btn.classList.remove('is-hovered');
  const data = activeMouseAnims.get(btn);
  if (data?.anim) {
    data.anim.onfinish = null;
    try {
      data.anim.cancel();
    } catch {}
  }
  activeMouseAnims.delete(btn);

  if (forceTouch) {
    const touchData = btnTouchMap.get(btn);
    if (touchData) {
      if (touchData.enterAnim) {
        try { touchData.enterAnim.cancel(); } catch {}
      }
      if (touchData.fadeAnim) {
        try { touchData.fadeAnim.cancel(); } catch {}
      }
      btnTouchMap.delete(btn);
    }
  }
}

let lastMouseCoords: { x: number; y: number } | null = null;

export function isMousePhysicallyOver(btn: HTMLElement): boolean {
  if (btn.matches(':hover')) return true;
  if (lastMouseCoords) {
    const rect = btn.getBoundingClientRect();
    return (
      lastMouseCoords.x >= rect.left &&
      lastMouseCoords.x <= rect.right &&
      lastMouseCoords.y >= rect.top &&
      lastMouseCoords.y <= rect.bottom
    );
  }
  return false;
}

/**
 * Reverts any button that still has .is-hovered but is not currently physically hovered by the cursor.
 */
export function revertAllOrphanedRipples(): void {
  if (typeof document === 'undefined') return;
  const hovered = document.querySelectorAll<HTMLElement>('.btn-ripple.is-hovered');
  hovered.forEach((btn) => {
    // If a mobile touch tap animation is in progress, do not kill it!
    if (btnTouchMap.has(btn)) return;
    if (!isMousePhysicallyOver(btn)) {
      revertButtonRipple(btn);
    }
  });
}

let suppressMouseEnterUntil = 0;

/**
 * Reverts all button ripples unconditionally (e.g. when opening/closing modals or changing views),
 * while preserving active buttons that are still directly under the user's cursor or running touch taps.
 */
export function revertAllButtonRipples(): void {
  suppressMouseEnterUntil = Date.now() + 350;
  if (typeof document === 'undefined') return;
  const hovered = document.querySelectorAll<HTMLElement>('.btn-ripple.is-hovered');
  hovered.forEach((btn) => {
    // If a mobile touch tap animation is in progress, do not kill it!
    if (btnTouchMap.has(btn)) return;
    if (isMousePhysicallyOver(btn)) return;
    revertButtonRipple(btn);
  });
}

export function initButtonRipple(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let lastTouchTime = 0;
  const ENTER_DURATION = 320;
  const EXIT_DURATION = 280;

  // -------------------------------------------------------------
  // DESKTOP MOUSE HANDLERS
  // -------------------------------------------------------------
  const startMouseAnimation = (btn: HTMLElement, startX: number, startY: number) => {
    const prev = activeMouseAnims.get(btn);
    if (prev?.isCovered) {
      btn.classList.add('is-hovered');
      return;
    }
    // If the animation is already in flight expanding forward, keep running
    if (prev?.isEntering && prev?.anim) {
      btn.classList.add('is-hovered');
      return;
    }
    // Cancel any previous exit or reverse animation immediately
    if (prev?.anim) {
      prev.anim.onfinish = null;
      try {
        prev.anim.cancel();
      } catch {}
    }

    const rect = btn.getBoundingClientRect();
    const endRadius = Math.hypot(
      Math.max(startX, rect.width - startX),
      Math.max(startY, rect.height - startY)
    );

    btn.classList.add('is-hovered');

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
        isCovered: false,
        isEntering: true,
        wasClicked: prev?.wasClicked ?? false
      };

      enterAnim.onfinish = () => {
        animData.isCovered = true;
        animData.isEntering = false;
      };

      activeMouseAnims.set(btn, animData);
    } catch {
      btn.classList.add('is-hovered');
    }
  };

  const handleMouseEnter = (e: MouseEvent) => {
    lastMouseCoords = { x: e.clientX, y: e.clientY };
    // Suppress synthetic mouseenter fired when modals close over the cursor
    if (Date.now() < suppressMouseEnterUntil) return;
    // Ignore synthetic mouse events caused by mobile touch
    if (Date.now() - lastTouchTime < 800) return;
    if ((e as any).sourceCapabilities?.firesTouchEvents) return;

    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn) return;

    // Ignore transitions between elements inside the same button
    if (e.relatedTarget instanceof Node && btn.contains(e.relatedTarget)) return;

    const prev = activeMouseAnims.get(btn);
    if (prev?.isCovered || (prev?.isEntering && prev?.anim)) {
      btn.classList.add('is-hovered');
      return;
    }

    // Cancel any existing exit or reverse animation immediately to avoid race conditions
    if (prev?.anim) {
      prev.anim.onfinish = null;
      try {
        prev.anim.cancel();
      } catch {}
    }

    const rect = btn.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const rawY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const edge = projectToNearestEdge(rawX, rawY, rect.width, rect.height);

    // Instant activation with zero latency
    startMouseAnimation(btn, edge.x, edge.y);
  };

  const triggerMouseExit = (btn: HTMLElement, clientX: number, clientY: number) => {
    btn.classList.remove('is-hovered');
    const data = activeMouseAnims.get(btn);
    if (!data) return;

    if (data.anim) {
      data.anim.onfinish = null;
      try {
        data.anim.cancel();
      } catch {}
    }

    const rect = btn.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const rawY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const exitEdge = projectToNearestEdge(rawX, rawY, rect.width, rect.height);

    // If button was clicked, or if it was already fully covered, animate out smoothly towards exit edge
    // If it was a quick unclicked sweep aborted before full coverage, reverse back to start
    if (!data.isCovered && !data.wasClicked && data.startTime > 0) {
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

        activeMouseAnims.set(btn, { ...data, anim: reverseAnim, isEntering: false, isCovered: false });
      } catch {
        activeMouseAnims.delete(btn);
      }
    } else {
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
          isCovered: false,
          isEntering: false
        });
      } catch {
        activeMouseAnims.delete(btn);
      }
    }
  };

  const handleMouseLeave = (e: MouseEvent) => {
    lastMouseCoords = { x: e.clientX, y: e.clientY };
    if (Date.now() - lastTouchTime < 800) return;
    if ((e as any).sourceCapabilities?.firesTouchEvents) return;

    const target = e.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLElement>('.btn-ripple');
    if (!btn) return;

    // If pointer is still inside this button, ignore internal movement between children
    if (e.relatedTarget instanceof Node && btn.contains(e.relatedTarget)) return;

    const rect = btn.getBoundingClientRect();
    const isInside = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );

    if (isInside) {
      // The cursor is still physically inside the button (e.g. synthetic event from re-render)
      btn.classList.add('is-hovered');
      return;
    }

    triggerMouseExit(btn, e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    lastMouseCoords = { x: e.clientX, y: e.clientY };
    if (Date.now() - lastTouchTime < 1000) return;
    if ((e as any).sourceCapabilities?.firesTouchEvents) return;
    // Whenever the mouse moves, check if any buttons with .is-hovered were orphaned (no longer under cursor)
    revertAllOrphanedRipples();
  };

  const handleClick = (e: MouseEvent) => {
    lastMouseCoords = { x: e.clientX, y: e.clientY };
    if (Date.now() - lastTouchTime < 1000) return;
    if ((e as any).sourceCapabilities?.firesTouchEvents) return;
    // A click might trigger a modal, navigation, or state update that leaves a button orphaned
    requestAnimationFrame(() => {
      revertAllOrphanedRipples();
    });
    setTimeout(() => {
      revertAllOrphanedRipples();
    }, 60);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      requestAnimationFrame(() => {
        revertAllButtonRipples();
      });
    }
  };

  // -------------------------------------------------------------
  // MOBILE TOUCH HANDLERS (POINTER EVENTS)
  // -------------------------------------------------------------
  const TOUCH_ENTER_DURATION = 260;
  const TOUCH_FADE_DURATION = 240;

  const triggerTouchFade = (touchData: ActiveTouchAnimation) => {
    if (touchData.state === 'fading') return;
    touchData.state = 'fading';

    // Smoothly transition text color back
    touchData.btn.classList.remove('is-hovered');

    try {
      const fadeAnim = touchData.btn.animate(
        [
          { clipPath: `circle(${touchData.endRadius}px at ${touchData.touchX}px ${touchData.touchY}px)`, opacity: 1 },
          { clipPath: `circle(${touchData.endRadius}px at ${touchData.touchX}px ${touchData.touchY}px)`, opacity: 0 }
        ],
        {
          duration: TOUCH_FADE_DURATION,
          easing: 'ease-out',
          fill: 'forwards',
          pseudoElement: '::before'
        }
      );
      touchData.fadeAnim = fadeAnim;

      fadeAnim.onfinish = () => {
        try { fadeAnim.cancel(); } catch {}
        try { touchData.enterAnim.cancel(); } catch {}
        btnTouchMap.delete(touchData.btn);
      };
    } catch {
      try { touchData.enterAnim.cancel(); } catch {}
      btnTouchMap.delete(touchData.btn);
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';

    if (isTouch) {
      lastTouchTime = Date.now();
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest<HTMLElement>('.btn-ripple');
      if (!btn) return;

      // Clean up any existing active animation on this button or pointer
      const existingBtnTouch = btnTouchMap.get(btn);
      if (existingBtnTouch) {
        if (existingBtnTouch.fadeAnim) {
          try { existingBtnTouch.fadeAnim.cancel(); } catch {}
        }
        if (existingBtnTouch.enterAnim) {
          try { existingBtnTouch.enterAnim.cancel(); } catch {}
        }
        btnTouchMap.delete(btn);
      }

      const existingPointerTouch = activeTouchMap.get(e.pointerId);
      if (existingPointerTouch && existingPointerTouch !== existingBtnTouch) {
        if (existingPointerTouch.fadeAnim) {
          try { existingPointerTouch.fadeAnim.cancel(); } catch {}
        }
        if (existingPointerTouch.enterAnim) {
          try { existingPointerTouch.enterAnim.cancel(); } catch {}
        }
        activeTouchMap.delete(e.pointerId);
      }

      const rect = btn.getBoundingClientRect();
      // Activate animation from exactly where touched
      const touchX = e.clientX - rect.left;
      const touchY = e.clientY - rect.top;
      const endRadius = Math.hypot(
        Math.max(touchX, rect.width - touchX),
        Math.max(touchY, rect.height - touchY)
      );

      btn.classList.add('is-hovered');

      try {
        const enterAnim = btn.animate(
          [
            { clipPath: `circle(0px at ${touchX}px ${touchY}px)`, opacity: 1 },
            { clipPath: `circle(${endRadius}px at ${touchX}px ${touchY}px)`, opacity: 1 }
          ],
          {
            duration: TOUCH_ENTER_DURATION,
            easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)',
            fill: 'forwards',
            pseudoElement: '::before'
          }
        );

        const touchData: ActiveTouchAnimation = {
          btn,
          touchX,
          touchY,
          endRadius,
          startTime: performance.now(),
          duration: TOUCH_ENTER_DURATION,
          enterAnim,
          fadeAnim: null,
          state: 'entering',
          isReleased: false
        };

        enterAnim.onfinish = () => {
          if (touchData.isReleased) {
            triggerTouchFade(touchData);
          } else {
            touchData.state = 'holding';
          }
        };

        activeTouchMap.set(e.pointerId, touchData);
        btnTouchMap.set(btn, touchData);
      } catch {
        btn.classList.remove('is-hovered');
      }
    } else {
      lastMouseCoords = { x: e.clientX, y: e.clientY };
      // Desktop mouse pointerdown: ensure highlighted and marked as clicked
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest<HTMLElement>('.btn-ripple');
      if (!btn) return;

      btn.classList.add('is-hovered');

      const data = activeMouseAnims.get(btn);
      if (data) {
        data.wasClicked = true;
      } else {
        const rect = btn.getBoundingClientRect();
        const rawX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const rawY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const edge = projectToNearestEdge(rawX, rawY, rect.width, rect.height);
        startMouseAnimation(btn, edge.x, edge.y);
        const newData = activeMouseAnims.get(btn);
        if (newData) newData.wasClicked = true;
      }
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

    const data = activeTouchMap.get(e.pointerId);
    if (!data || data.state === 'fading') return;

    const rect = data.btn.getBoundingClientRect();
    // Allow slight finger wobble margin of 12px
    const isInside =
      e.clientX >= rect.left - 12 &&
      e.clientX <= rect.right + 12 &&
      e.clientY >= rect.top - 12 &&
      e.clientY <= rect.bottom + 12;

    if (!isInside && !data.isReleased) {
      // Finger moved intentionally off the button before release -> abort/reverse
      activeTouchMap.delete(e.pointerId);
      btnTouchMap.delete(data.btn);

      const elapsed = performance.now() - data.startTime;
      const rawProgress = Math.min(1, Math.max(0.05, elapsed / data.duration));
      const easedProgress = Math.sin((rawProgress * Math.PI) / 2);
      const currentRadius = data.endRadius * easedProgress;
      const reverseDuration = Math.max(100, Math.round(180 * rawProgress));

      try {
        data.enterAnim.cancel();
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
    lastTouchTime = Date.now();

    const data = activeTouchMap.get(e.pointerId);
    if (!data) return;
    activeTouchMap.delete(e.pointerId);

    data.isReleased = true;

    if (data.state === 'holding') {
      triggerTouchFade(data);
    }
    // If still in 'entering' state, enterAnim will finish expanding fully to endRadius,
    // and its onfinish callback will automatically trigger triggerTouchFade(data).
  };

  const handlePointerCancel = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      lastTouchTime = Date.now();
    }
    const data = activeTouchMap.get(e.pointerId);
    if (!data) return;
    activeTouchMap.delete(e.pointerId);

    // Treat cancel as release so in-flight tap finishes expanding fully and fades out smoothly
    data.isReleased = true;
    if (data.state === 'holding') {
      triggerTouchFade(data);
    }
  };

  document.addEventListener('mouseenter', handleMouseEnter, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);
  document.addEventListener('mousemove', handleMouseMove, { passive: true });
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('pointerup', handlePointerUp, true);
  document.addEventListener('pointercancel', handlePointerCancel, true);
  window.addEventListener('blur', revertAllButtonRipples);
  document.addEventListener('visibilitychange', revertAllButtonRipples);

  return () => {
    document.removeEventListener('mouseenter', handleMouseEnter, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('pointerdown', handlePointerDown, true);
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('pointerup', handlePointerUp, true);
    document.removeEventListener('pointercancel', handlePointerCancel, true);
    window.removeEventListener('blur', revertAllButtonRipples);
    document.removeEventListener('visibilitychange', revertAllButtonRipples);
  };
}
