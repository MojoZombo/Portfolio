import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { BackgroundGrid } from './components/BackgroundGrid';
import { Header } from './components/Header';
import { ProjectIndex } from './components/ProjectIndex';
import { TimelineItem } from './components/TimelineItem';
import { TimelineRuler } from './components/TimelineRuler';
import { ProjectModal } from './components/ProjectModal';
// Authoring tools: loaded only when #studio / #baker is opened
const CADStudioWorkbench = lazy(async () => {
  const [{ CADStudioWorkbench: Workbench }, { TransformCalibrationProvider }] = await Promise.all([
    import('./components/studio/CADStudioWorkbench'),
    import('./context/TransformCalibrationContext'),
  ]);
  return {
    default: (props: { onExit: () => void }) => (
      <TransformCalibrationProvider>
        <Workbench {...props} />
      </TransformCalibrationProvider>
    ),
  };
});
const PosterBakerPage = lazy(() =>
  import('./components/poster/PosterBakerPage').then((m) => ({ default: m.PosterBakerPage }))
);
import { ResumeModal } from './components/ResumeModal';
import { projectsData } from './data/projectsData';
import { Project } from './types/project';
import { ExternalLink, Cpu, Camera, Mail, Linkedin, Copy, Check } from 'lucide-react';
import { initButtonRipple, revertAllButtonRipples } from './utils/buttonRipple';

const DEFAULT_MOBILE_TITLE_HEIGHT = 116;
const MOBILE_TITLE_EXTRA_GAP = 14;
const MOBILE_BELOW_BREATHE = 24;
const MOBILE_SWITCH_HYSTERESIS = 0.52;
const MOBILE_FAST_ENTER_VELOCITY = 1.15; // px/ms (~1150 px/s, >4 cards/sec)
const MOBILE_FAST_EXIT_VELOCITY = 0.14;  // px/ms (~140 px/s, ~70px coast left)
const MOBILE_FAST_JUMP_CARDS = 1.35;     // enter cruising on multi-card jump (e.g., List jump)
const MOBILE_SETTLE_IDLE_MS = 110;       // fallback settle timer when scrollend is absent

const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const App: React.FC = () => {
  useEffect(() => {
    let lastMousedownTime = 0;
    let lastMousedownTarget: HTMLElement | null = null;
    let clickCount = 0;

    const blockLayoutSelection = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMousedownTime < 400) {
        clickCount++;
      } else {
        clickCount = 1;
      }
      lastMousedownTime = now;
      lastMousedownTarget = e.target as HTMLElement;

      if (clickCount > 1) {
        if (lastMousedownTarget && ['div', 'main', 'header', 'footer', 'section', 'svg', 'path', 'a', 'button', 'img', 'nav', 'ul', 'li'].includes(lastMousedownTarget.tagName.toLowerCase())) {
          e.preventDefault();
        }
      }
    };

    const handleSelectStart = (e: Event) => {
      // If a selection starts immediately after a multi-click on a structural/button element, block it.
      // This catches chromium bugs where it jumps to the next DOM text node.
      if (clickCount > 1 && Date.now() - lastMousedownTime < 100 && lastMousedownTarget) {
        if (['div', 'main', 'header', 'footer', 'section', 'svg', 'path', 'a', 'button', 'img', 'nav', 'ul', 'li'].includes(lastMousedownTarget.tagName.toLowerCase())) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('mousedown', blockLayoutSelection, { passive: false });
    window.addEventListener('selectstart', handleSelectStart, { passive: false });
    
    const cleanupRipple = initButtonRipple();
    
    return () => {
      window.removeEventListener('mousedown', blockLayoutSelection);
      window.removeEventListener('selectstart', handleSelectStart);
      cleanupRipple();
    };
  }, []);
  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    if (rawHash && rawHash !== 'resume' && rawHash !== 'studio' && rawHash !== 'baker') {
      return projectsData.find(p => p.id === rawHash) || null;
    }
    return null;
  });
  const [activeProjectId, setActiveProjectId] = useState<string>(projectsData[0]?.id || '');
  const [isProjectIndexOpen, setIsProjectIndexOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const mobileActiveIndexRef = useRef(0);
  const mobileTitleHeightsRef = useRef<Record<number, number>>({});
  const mobileItemRefs = useRef<
    Record<number, { modelEl: HTMLDivElement | null; titleEl: HTMLDivElement | null }>
  >({});
  const rescrubMobileRef = useRef<(() => void) | null>(null);
  const [copiedFooterEmail, setCopiedFooterEmail] = useState(false);
  const footerCopyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (footerCopyTimerRef.current) clearTimeout(footerCopyTimerRef.current);
    };
  }, []);

  const handleCopyFooterEmail = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText('fann@berkeley.edu').catch(() => {});
    }
    setCopiedFooterEmail(true);
    if (footerCopyTimerRef.current) clearTimeout(footerCopyTimerRef.current);
    footerCopyTimerRef.current = setTimeout(() => {
      setCopiedFooterEmail(false);
    }, 1800);
  };
  const [isResumeOpen, setIsResumeOpen] = useState<boolean>(() => {
    return (
      window.location.hash === '#resume' ||
      window.location.hash === '#/resume' ||
      window.location.search.includes('resume=true')
    );
  });
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(() => {
    return (
      window.location.hash === '#studio' ||
      window.location.hash === '#/studio' ||
      window.location.search.includes('studio=true')
    );
  });
  const [isBakerOpen, setIsBakerOpen] = useState<boolean>(() => {
    return (
      window.location.hash === '#baker' ||
      window.location.hash === '#/baker' ||
      window.location.search.includes('baker=true')
    );
  });

  // Listen for hash changes (e.g. #resume, #studio, #baker, #tesla-actuator, etc.)
  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      const isResume = rawHash === 'resume' || window.location.search.includes('resume=true');
      const isStudio = rawHash === 'studio' || window.location.search.includes('studio=true');
      const isBaker = rawHash === 'baker' || window.location.search.includes('baker=true');

      setIsResumeOpen(isResume);
      setIsStudioOpen(isStudio);
      setIsBakerOpen(isBaker);
      if (isResume || isStudio || isBaker || rawHash) {
        setIsProjectIndexOpen(false);
      }

      if (isStudio || isBaker) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }

      if (!isResume && !isStudio && !isBaker && rawHash) {
        const found = projectsData.find(p => p.id === rawHash);
        setSelectedProject(found || null);
      } else if (!rawHash) {
        setSelectedProject(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const handleSelectProject = React.useCallback((p: Project) => {
    revertAllButtonRipples();
    setIsProjectIndexOpen(false);
    setSelectedProject(p);
    if (window.location.hash.replace(/^#\/?/, '') !== p.id) {
      window.history.pushState(null, '', `#${p.id}`);
    }
  }, []);

  const handleToggleProjectIndex = useCallback(() => {
    revertAllButtonRipples();
    setIsProjectIndexOpen((prev) => !prev);
  }, []);

  const handleJumpToProject = useCallback((project: Project, index: number) => {
    revertAllButtonRipples();
    setIsProjectIndexOpen(false);
    document.body.style.overflow = '';

    window.requestAnimationFrame(() => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && index === 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const el = document.getElementById(`project-${project.id}`);
      if (!el) return;

      if (isMobile) {
        const rect = el.getBoundingClientRect();
        const centerDocY =
          rect.top + (window.scrollY || window.pageYOffset || 0) + rect.height / 2;
        const targetTop = Math.max(0, centerDocY - (window.innerHeight * 0.5 - 42));
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, []);

  const handleCloseProjectModal = React.useCallback(() => {
    revertAllButtonRipples();
    setSelectedProject(null);
    const currentHash = window.location.hash.replace(/^#\/?/, '');
    if (currentHash && currentHash !== 'resume' && currentHash !== 'studio' && currentHash !== 'baker') {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const handleVisibleProject = React.useCallback((id: string) => {
    setActiveProjectId(id);
  }, []);

  const handleRegisterMobileRefs = useCallback(
    (idx: number, modelEl: HTMLDivElement | null, titleEl: HTMLDivElement | null) => {
      if (!modelEl && !titleEl) {
        delete mobileItemRefs.current[idx];
      } else {
        mobileItemRefs.current[idx] = { modelEl, titleEl };
        rescrubMobileRef.current?.();
      }
    },
    []
  );

  const handleMobileTitleMeasure = useCallback((idx: number, height: number) => {
    const prev = mobileTitleHeightsRef.current[idx];
    if (prev === undefined || Math.abs(prev - height) >= 1) {
      mobileTitleHeightsRef.current[idx] = height;
      rescrubMobileRef.current?.();
    }
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport, { passive: true });
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useLayoutEffect(() => {
    if (!isMobileViewport || isBakerOpen || isStudioOpen) return;

    let cancelled = false;
    const centersRef: number[] = [];
    let committedIdx = Math.max(0, mobileActiveIndexRef.current);
    let displayU = committedIdx;
    let displayVel = 0;
    let targetU = committedIdx;
    let displayOpen = 1;
    let openVel = 0;
    let targetOpen = 1;
    let isCruising = false;
    let pendingLandIdx: number | null = null;
    let lastScrollY = window.scrollY || window.pageYOffset || 0;
    let lastScrollTime = 0;
    let smoothVel = 0;
    let settleTimer: number | null = null;
    let lastRulerIdx = -1;
    let rafId = 0;
    let lastFrameTime = 0;

    const motionMq =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    let reduced = motionMq?.matches ?? false;

    const measureCenters = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      for (let i = 0; i < projectsData.length; i++) {
        const el = document.getElementById(`project-${projectsData[i].id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          centersRef[i] = rect.top + scrollY + rect.height / 2;
        }
      }
    };

    const getPocketHeight = (idx: number): number =>
      Math.round(mobileTitleHeightsRef.current[idx] ?? DEFAULT_MOBILE_TITLE_HEIGHT) +
      MOBILE_TITLE_EXTRA_GAP;

    const computeScrollU = (): number => {
      if (centersRef.length === 0) {
        measureCenters();
      }
      if (centersRef.length === 0) return committedIdx;

      const n = projectsData.length;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const vh = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const focusY = scrollY + vh * 0.5 - 42;

      if (n <= 1 || scrollY <= 4 || focusY <= centersRef[0]) {
        return 0;
      }
      if (scrollY + vh >= docHeight - 4 || focusY >= centersRef[n - 1]) {
        return n - 1;
      }
      for (let seg = 0; seg < n - 1; seg++) {
        const topC = centersRef[seg];
        const botC = centersRef[seg + 1];
        if (focusY <= botC) {
          return seg + (focusY - topC) / Math.max(1, botC - topC);
        }
      }
      return n - 1;
    };

    const setActiveMobileIdx = (next: number) => {
      if (next !== mobileActiveIndexRef.current) {
        mobileActiveIndexRef.current = next;
        setMobileActiveIndex(next);
      }
    };

    const syncRuler = (idx: number) => {
      const clamped = Math.max(0, Math.min(projectsData.length - 1, idx));
      if (clamped !== lastRulerIdx) {
        lastRulerIdx = clamped;
        setActiveProjectId(projectsData[clamped].id);
      }
    };

    const renderMobileScrub = (u: number, openness: number) => {
      if (cancelled) return;
      const n = projectsData.length;
      const o = reduced ? 1 : Math.max(0, Math.min(1, openness));
      const clampedU = Math.max(0, Math.min(Math.max(0, n - 1), u));
      const k = n <= 1 ? 0 : Math.min(n - 2, Math.floor(clampedU));
      const t = n <= 1 ? 0 : clampedU - k;
      const e = reduced ? (t < 0.5 ? 0 : 1) : smootherstep(0.05, 0.95, t);

      const sK = getPocketHeight(k);
      const sNext = n > 1 ? getPocketHeight(k + 1) : sK;

      const pK = reduced ? (t < 0.5 ? 1 : 0) : 1 - smootherstep(0.08, 0.44, t);
      const pNext =
        n <= 1 ? 0 : reduced ? (t >= 0.5 ? 1 : 0) : smootherstep(0.42, 0.78, t);

      for (let i = 0; i < n; i++) {
        const entry = mobileItemRefs.current[i];
        if (!entry) continue;

        let baseOffsetY = 0;
        if (i < k) {
          baseOffsetY = 0;
        } else if (i === k) {
          baseOffsetY = sK * (1 - e);
        } else if (i === k + 1) {
          baseOffsetY = (sK + MOBILE_BELOW_BREATHE) * (1 - e) + sNext * e;
        } else {
          baseOffsetY =
            (sK + MOBILE_BELOW_BREATHE) * (1 - e) +
            (sNext + MOBILE_BELOW_BREATHE) * e;
        }
        const offsetY = baseOffsetY * o;

        if (entry.modelEl) {
          entry.modelEl.style.transition = 'none';
          entry.modelEl.style.transform = `translate3d(0, ${offsetY.toFixed(2)}px, 0)`;
        }

        let baseTitleProgress = 0;
        let tuckY = i < k ? -10 : 10;
        const revealTuck = 10 * (1 - o);
        if (i === k) {
          baseTitleProgress = pK;
          tuckY = reduced ? 0 : -10 * (1 - pK) * o + revealTuck;
        } else if (n > 1 && i === k + 1) {
          baseTitleProgress = pNext;
          tuckY = reduced ? 0 : 10 * (1 - pNext) * o + revealTuck;
        }
        const titleProgress = baseTitleProgress * o;

        const scale = reduced ? 1 : 0.98 + 0.02 * titleProgress;
        if (entry.titleEl) {
          entry.titleEl.style.transition = 'none';
          entry.titleEl.style.opacity = titleProgress.toFixed(3);
          entry.titleEl.style.transform = `translate3d(0, ${tuckY.toFixed(
            2
          )}px, 0) scale(${scale.toFixed(4)})`;
          entry.titleEl.style.pointerEvents = titleProgress > 0.5 ? 'auto' : 'none';
        }
      }
    };

    const tick = (now: number) => {
      if (cancelled) {
        rafId = 0;
        return;
      }

      const rawDt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 0.016;
      lastFrameTime = now;

      if (reduced) {
        displayU = targetU;
        displayVel = 0;
        displayOpen = 1;
        openVel = 0;
      } else {
        const omegaU = 12;
        const omegaOpen = targetOpen < displayOpen ? 16 : 12;
        const steps = rawDt > 0.018 ? 2 : 1;
        const stepDt = rawDt / steps;
        for (let s = 0; s < steps; s++) {
          const accelU = omegaU * omegaU * (targetU - displayU) - 2 * omegaU * displayVel;
          displayVel += accelU * stepDt;
          displayU += displayVel * stepDt;

          const accelOpen =
            omegaOpen * omegaOpen * (targetOpen - displayOpen) - 2 * omegaOpen * openVel;
          openVel += accelOpen * stepDt;
          displayOpen += openVel * stepDt;
        }

        const maxU = Math.max(0, projectsData.length - 1);
        if (displayU < 0) {
          displayU = 0;
          displayVel = 0;
        } else if (displayU > maxU) {
          displayU = maxU;
          displayVel = 0;
        }

        if (displayOpen < 0) {
          displayOpen = 0;
          openVel = 0;
        } else if (displayOpen > 1) {
          displayOpen = 1;
          openVel = 0;
        }

        if (Math.abs(targetU - displayU) < 0.0008 && Math.abs(displayVel) < 0.004) {
          displayU = targetU;
          displayVel = 0;
        }
        if (Math.abs(targetOpen - displayOpen) < 0.001 && Math.abs(openVel) < 0.005) {
          displayOpen = targetOpen;
          openVel = 0;
        }

        // Keep pocket position aligned with current focus while tucked during fast flicks
        if (isCruising && displayOpen <= 0.03) {
          const nearestIdx = Math.round(computeScrollU());
          displayU = nearestIdx;
          targetU = nearestIdx;
          displayVel = 0;
        }

        // Complete two-phase jump once old pocket finishes tucking
        if (!isCruising && pendingLandIdx !== null && displayOpen <= 0.04) {
          committedIdx = pendingLandIdx;
          displayU = pendingLandIdx;
          targetU = pendingLandIdx;
          displayVel = 0;
          pendingLandIdx = null;
          targetOpen = 1;
          setActiveMobileIdx(committedIdx);
          syncRuler(committedIdx);
        }
      }

      renderMobileScrub(displayU, displayOpen);

      const uSettled = Math.abs(targetU - displayU) <= 0.0008 && Math.abs(displayVel) <= 0.004;
      const openSettled = Math.abs(targetOpen - displayOpen) <= 0.001 && Math.abs(openVel) <= 0.005;

      if (!uSettled || !openSettled || pendingLandIdx !== null) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = 0;
        lastFrameTime = 0;
      }
    };

    const ensureLoopRunning = () => {
      if (!rafId && !cancelled) {
        lastFrameTime = 0;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const enterCruising = (scrollU: number) => {
      if (reduced) return;
      isCruising = true;
      pendingLandIdx = null;
      targetOpen = 0;
      setActiveMobileIdx(-1);
      syncRuler(Math.round(scrollU));
      ensureLoopRunning();
    };

    const settleToIndex = (rawIdx: number, instant = false) => {
      const n = projectsData.length;
      const clamped = Math.max(0, Math.min(n - 1, rawIdx));
      isCruising = false;
      syncRuler(clamped);

      if (instant || reduced) {
        pendingLandIdx = null;
        committedIdx = clamped;
        displayU = clamped;
        targetU = clamped;
        displayVel = 0;
        displayOpen = 1;
        targetOpen = 1;
        openVel = 0;
        setActiveMobileIdx(clamped);
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        lastFrameTime = 0;
        renderMobileScrub(displayU, displayOpen);
        return;
      }

      if (displayOpen <= 0.04) {
        pendingLandIdx = null;
        committedIdx = clamped;
        displayU = clamped;
        targetU = clamped;
        displayVel = 0;
        targetOpen = 1;
        setActiveMobileIdx(clamped);
        ensureLoopRunning();
        return;
      }

      if (Math.abs(clamped - displayU) > 1.05) {
        pendingLandIdx = clamped;
        committedIdx = clamped;
        targetOpen = 0;
        setActiveMobileIdx(-1);
        ensureLoopRunning();
        return;
      }

      pendingLandIdx = null;
      committedIdx = clamped;
      targetU = clamped;
      targetOpen = 1;
      setActiveMobileIdx(clamped);
      ensureLoopRunning();
    };

    const snapImmediate = () => {
      settleToIndex(Math.round(computeScrollU()), true);
    };

    const handleScrollEnd = () => {
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
      smoothVel = 0;
      lastScrollTime = 0;
      const finalIdx = Math.round(computeScrollU());
      if (
        isCruising ||
        pendingLandIdx !== null ||
        targetOpen < 1 ||
        finalIdx !== committedIdx
      ) {
        settleToIndex(finalIdx, false);
      }
    };

    const scheduleFallbackSettle = () => {
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        handleScrollEnd();
      }, MOBILE_SETTLE_IDLE_MS);
    };

    const handleScroll = () => {
      const n = projectsData.length;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const now = performance.now();
      const dt = now - lastScrollTime;

      if (lastScrollTime === 0 || dt > 120) {
        smoothVel = 0;
        lastScrollY = scrollY;
        lastScrollTime = now;
      } else if (dt >= 6) {
        const instVel = Math.abs(scrollY - lastScrollY) / dt;
        smoothVel = smoothVel * 0.55 + instVel * 0.45;
        lastScrollY = scrollY;
        lastScrollTime = now;
      }

      scheduleFallbackSettle();

      const scrollU = computeScrollU();

      if (scrollU === 0 || scrollU === n - 1) {
        const edgeIdx = scrollU === 0 ? 0 : n - 1;
        if (
          isCruising ||
          pendingLandIdx !== null ||
          targetOpen < 1 ||
          edgeIdx !== committedIdx
        ) {
          settleToIndex(edgeIdx, false);
        }
        return;
      }

      if (
        !reduced &&
        (smoothVel >= MOBILE_FAST_ENTER_VELOCITY ||
          (!isCruising && Math.abs(scrollU - committedIdx) >= MOBILE_FAST_JUMP_CARDS))
      ) {
        enterCruising(scrollU);
        return;
      }

      if (isCruising) {
        const nearestIdx = Math.round(scrollU);
        syncRuler(nearestIdx);
        if (smoothVel <= MOBILE_FAST_EXIT_VELOCITY) {
          settleToIndex(nearestIdx, false);
        }
        return;
      }

      let nextIdx = committedIdx;
      if (Math.abs(scrollU - committedIdx) > MOBILE_SWITCH_HYSTERESIS) {
        nextIdx = Math.max(0, Math.min(n - 1, Math.round(scrollU)));
      }

      if (
        pendingLandIdx !== null ||
        targetOpen < 1 ||
        nextIdx !== committedIdx ||
        Math.abs(targetU - nextIdx) > 0.0001
      ) {
        settleToIndex(nextIdx, false);
      }
    };

    const handleResize = () => {
      measureCenters();
      snapImmediate();
    };

    const handleMotionChange = (ev: MediaQueryListEvent) => {
      reduced = ev.matches;
      snapImmediate();
    };

    rescrubMobileRef.current = () => renderMobileScrub(displayU, displayOpen);
    measureCenters();
    snapImmediate();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scrollend', handleScrollEnd, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    motionMq?.addEventListener('change', handleMotionChange);

    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        if (cancelled) return;
        measureCenters();
        snapImmediate();
      });
    }

    return () => {
      cancelled = true;
      rescrubMobileRef.current = null;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scrollend', handleScrollEnd);
      window.removeEventListener('resize', handleResize);
      motionMq?.removeEventListener('change', handleMotionChange);
      Object.values(mobileItemRefs.current).forEach(({ modelEl, titleEl }) => {
        if (modelEl) {
          modelEl.style.transform = '';
          modelEl.style.transition = '';
        }
        if (titleEl) {
          titleEl.style.transform = '';
          titleEl.style.opacity = '';
          titleEl.style.pointerEvents = '';
          titleEl.style.transition = '';
        }
      });
    };
  }, [isMobileViewport, isBakerOpen, isStudioOpen]);

  // If in dedicated Poster Baker mode, render full-screen Poster Baker
  if (isBakerOpen) {
    return (
      <Suspense fallback={null}>
        <PosterBakerPage
          onExit={() => {
            setIsBakerOpen(false);
            if (window.location.hash === '#baker') {
              window.history.pushState(null, '', window.location.pathname);
            }
          }}
        />
      </Suspense>
    );
  }

  // If in dedicated Studio mode, render full-screen Studio Workbench
  if (isStudioOpen) {
    return (
      <Suspense fallback={null}>
        <CADStudioWorkbench
          onExit={() => {
            setIsStudioOpen(false);
            if (window.location.hash === '#studio') {
              window.history.pushState(null, '', window.location.pathname);
            }
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Infinite Scrolling Perspective CAD Drafting Grid */}
      <BackgroundGrid />

      {/* Top Header */}
      <Header
        isProjectIndexOpen={isProjectIndexOpen}
        onToggleProjectIndex={handleToggleProjectIndex}
      />

      {/* Project Index Popover (desktop) / Bottom Sheet (mobile) */}
      <ProjectIndex
        isOpen={isProjectIndexOpen}
        onClose={() => setIsProjectIndexOpen(false)}
        projects={projectsData}
        activeProjectId={activeProjectId}
        onSelectProject={handleJumpToProject}
      />

      {/* Continuous Dynamic Timeline Ruler along the side */}
      <TimelineRuler projects={projectsData} activeId={activeProjectId} />

      {/* Main Interactive Projects Timeline */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col pb-56 md:pb-0">
          {projectsData.map((project, index) => (
            <TimelineItem
              key={project.id}
              project={project}
              index={index}
              onSelect={handleSelectProject}
              onVisible={handleVisibleProject}
              isPausedByModal={Boolean(selectedProject) || isResumeOpen}
              mobileIsActive={index === mobileActiveIndex}
              onRegisterMobileRefs={handleRegisterMobileRefs}
              onMobileTitleMeasure={handleMobileTitleMeasure}
            />
          ))}
        </div>
      </main>

      {/* Project Engineering Spec Modal */}
      <ProjectModal
        project={selectedProject}
        onClose={handleCloseProjectModal}
      />

      <ResumeModal
        isOpen={isResumeOpen}
        onClose={() => {
          revertAllButtonRipples();
          setIsResumeOpen(false);
          if (window.location.hash === '#resume') {
            window.history.pushState(null, '', window.location.pathname);
          }
        }}
      />

      {/* Minimal Engineering Footer */}
      <footer className="relative z-20 w-full py-12 text-slate-500 dark:text-slate-400 font-mono text-xs text-center mt-12">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} JADEN FANN</span>
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {import.meta.env.DEV && (
              <>
                <button
                  onClick={() => {
                    window.location.hash = 'baker';
                    setIsBakerOpen(true);
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  className="hover:text-emerald-500 flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer text-[11px]"
                  title="Open 1:1 Exact Model Poster Baker"
                >
                  <Camera size={12} className="text-emerald-500" />
                  <span>Poster Baker</span>
                </button>

                <button
                  onClick={() => {
                    window.location.hash = 'studio';
                    setIsStudioOpen(true);
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  className="hover:text-blue-500 flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer text-[11px]"
                  title="Open Fullscreen 3D CAD Alignment & Kinematics Studio"
                >
                  <Cpu size={12} className="text-blue-500" />
                  <span>3D CAD Studio</span>
                </button>
              </>
            )}
            <span className="inline-flex items-center gap-1.5">
              <a
                href="mailto:fann@berkeley.edu"
                className="hover:text-blue-500 flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Mail size={12} />
                <span>fann@berkeley.edu</span>
              </a>
              <button
                type="button"
                onClick={handleCopyFooterEmail}
                aria-label="Copy email address"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {copiedFooterEmail ? (
                  <>
                    <Check size={10} className="text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </span>
            <a
              href="https://linkedin.com/in/jadenfann"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Linkedin size={12} />
              <span>LINKEDIN</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="https://showspace.so/s/jadenfann"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span>SHOWSPACE</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="#resume"
              className="hover:text-blue-500 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              RESUME
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
