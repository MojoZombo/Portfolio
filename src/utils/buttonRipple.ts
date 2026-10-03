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
  anim: Animation;
  state: 'holding' | 'fading' | 'undone';
  fadeTimer?: ReturnType<typeof setTimeout> | null;
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
 * Cancels any active web animations on ::before and removes .is-hovered.
 */
export function revertButtonRipple(btn: HTMLElement): void {
  btn.classList.remove('is-hovered');
  const data = activeMouseAnims.get(btn);
  if (data?.anim) {
    data.anim.onfinish = null;
    try {
      data.anim.cancel();
    } catch {}
  }
  activeMouseAnims.delete(btn);

  // Clean up any touch animation
  const touchData = btnTouchMap.get(btn);
  if (touchData) {
    if (touchData.fadeTimer) {
      clearTimeout(touchData.fadeTimer);
      touchData.fadeTimer = null;
    }
    if (touchData.anim) {
      try { touchData.anim.cancel(); } catch {}
    }
    btnTouchMap.delete(btn);
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
    if (!isMousePhysicallyOver(btn)) {
      revertButtonRipple(btn);
    }
  });
}

let suppressMouseEnterUntil = 0;

/**
 * Reverts all button ripples unconditionally (e.g. when opening/closing modals or changing views),
 * while preserving active buttons that are still directly under the user's cursor.
 */
export function revertAllButtonRipples(): void {
  suppressMouseEnterUntil = Date.now() + 350;
  if (typeof document === 'undefined') return;
  const hovered = document.querySelectorAll<HTMLElement>('.btn-ripple.is-hovered');
  hovered.forEach((btn) => {
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
    // Whenever the mouse moves, check if any buttons with .is-hovered were orphaned (no longer under cursor)
    revertAllOrphanedRipples();
  };

  const handleClick = (e: MouseEvent) => {
    lastMouseCoords = { x: e.clientX, y: e.clientY };
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
  const handlePointerDown = (e: PointerEvent) => {
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';

    if (isTouch) {
      lastTouchTime = Date.now();
      const target = e.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest<HTMLElement>('.btn-ripple');
      if (!btn) return;

      // Capture pointer so dragging off button continues delivering pointermove/pointerup
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {}

      // Clean up any existing anim or pending fade timers on this button or pointer
      const existingBtnTouch = btnTouchMap.get(btn);
      if (existingBtnTouch) {
        if (existingBtnTouch.fadeTimer) {
          clearTimeout(existingBtnTouch.fadeTimer);
          existingBtnTouch.fadeTimer = null;
        }
        if (existingBtnTouch.anim) {
          try { existingBtnTouch.anim.cancel(); } catch {}
        }
      }

      const existingPointerTouch = activeTouchMap.get(e.pointerId);
      if (existingPointerTouch && existingPointerTouch !== existingBtnTouch) {
        if (existingPointerTouch.fadeTimer) {
          clearTimeout(existingPointerTouch.fadeTimer);
        }
        if (existingPointerTouch.anim) {
          try { existingPointerTouch.anim.cancel(); } catch {}
        }
      }

      const rect = btn.getBoundingClientRect();
      // Activate animation from exactly where tapped
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
            duration: ENTER_DURATION,
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
          duration: ENTER_DURATION,
          anim: enterAnim,
          state: 'holding',
          fadeTimer: null
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

      try {
        data.btn.releasePointerCapture(e.pointerId);
      } catch {}

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

        data.anim = reverseAnim;

        reverseAnim.onfinish = () => {
          try { reverseAnim.cancel(); } catch {}
          data.btn.classList.remove('is-hovered');
          btnTouchMap.delete(data.btn);
        };
      } catch {
        data.btn.classList.remove('is-hovered');
        btnTouchMap.delete(data.btn);
      }
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    lastTouchTime = Date.now();

    const data = activeTouchMap.get(e.pointerId);
    if (!data) return;
    activeTouchMap.delete(e.pointerId);

    try {
      data.btn.releasePointerCapture(e.pointerId);
    } catch {}

    if (data.state !== 'holding') return;
    data.state = 'fading';

    // If tap was quick, let the enter ripple complete expanding before fading away
    const elapsed = performance.now() - data.startTime;
    const remainingEnter = Math.max(0, data.duration - elapsed);

    data.fadeTimer = setTimeout(() => {
      data.fadeTimer = null;
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
          btnTouchMap.delete(data.btn);
        };
      } catch {
        data.btn.classList.remove('is-hovered');
        btnTouchMap.delete(data.btn);
      }
    }, remainingEnter);
  };

  const handlePointerCancel = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      lastTouchTime = Date.now();
    }
    const data = activeTouchMap.get(e.pointerId);
    if (data) {
      activeTouchMap.delete(e.pointerId);
      btnTouchMap.delete(data.btn);
      if (data.fadeTimer) {
        clearTimeout(data.fadeTimer);
        data.fadeTimer = null;
      }
      try {
        data.btn.releasePointerCapture(e.pointerId);
      } catch {}
      try {
        data.anim.cancel();
      } catch {}
      data.btn.classList.remove('is-hovered');
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
