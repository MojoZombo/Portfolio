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
const MOBILE_TITLE_EXTRA_GAP = 10;
const MOBILE_BELOW_BREATHE = 24;
const MOBILE_SCRUB_WINDOW_MS = 150;
const MOBILE_SCRUB_ENTER_DELTA = 95;
const MOBILE_SCRUB_EXIT_DELTA = 35;
const MOBILE_SETTLE_DELAY_MS = 95;
const MOBILE_SLOW_SWITCH_HYSTERESIS = 0.52;

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
        const targetTop = Math.max(0, centerDocY - (window.innerHeight * 0.5 + 10));
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
    const scrollSamples: { t: number; y: number }[] = [];
    let isContinuousScrub = false;
    let committedIdx = mobileActiveIndexRef.current;
    let displayU = committedIdx;
    let displayVel = 0;
    let targetU = committedIdx;
    let rafId = 0;
    let lastFrameTime = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

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
      const focusY = scrollY + vh * 0.5 + 10;

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

    const renderMobileScrub = (u: number) => {
      if (cancelled) return;
      const n = projectsData.length;
      const clampedU = Math.max(0, Math.min(Math.max(0, n - 1), u));
      const k = n <= 1 ? 0 : Math.min(n - 2, Math.floor(clampedU));
      const t = n <= 1 ? 0 : clampedU - k;
      const e = reduced ? (t < 0.5 ? 0 : 1) : smootherstep(0.06, 0.94, t);

      const sK = getPocketHeight(k);
      const sNext = n > 1 ? getPocketHeight(k + 1) : sK;

      const pK = reduced ? (t < 0.5 ? 1 : 0) : 1 - smootherstep(0.18, 0.48, t);
      const pNext =
        n <= 1 ? 0 : reduced ? (t >= 0.5 ? 1 : 0) : smootherstep(0.44, 0.76, t);

      for (let i = 0; i < n; i++) {
        const entry = mobileItemRefs.current[i];
        if (!entry) continue;

        let offsetY = 0;
        if (i < k) {
          offsetY = 0;
        } else if (i === k) {
          offsetY = sK * (1 - e);
        } else if (i === k + 1) {
          offsetY = (sK + MOBILE_BELOW_BREATHE) * (1 - e) + sNext * e;
        } else {
          offsetY =
            (sK + MOBILE_BELOW_BREATHE) * (1 - e) +
            (sNext + MOBILE_BELOW_BREATHE) * e;
        }

        if (entry.modelEl) {
          entry.modelEl.style.transition = 'none';
          entry.modelEl.style.transform = `translate3d(0, ${offsetY.toFixed(2)}px, 0)`;
        }

        let titleProgress = 0;
        let tuckY = i < k ? -10 : 10;
        if (i === k) {
          titleProgress = pK;
          tuckY = reduced ? 0 : -10 * (1 - pK);
        } else if (n > 1 && i === k + 1) {
          titleProgress = pNext;
          tuckY = reduced ? 0 : 10 * (1 - pNext);
        }

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

      const prevIdx = mobileActiveIndexRef.current;
      const roundedIdx = Math.max(0, Math.min(n - 1, Math.round(clampedU)));
      if (roundedIdx !== prevIdx) {
        const shouldCommit =
          clampedU === 0 || clampedU === n - 1 || Math.abs(clampedU - prevIdx) > 0.53;
        if (shouldCommit) {
          mobileActiveIndexRef.current = roundedIdx;
          setMobileActiveIndex(roundedIdx);
          setActiveProjectId(projectsData[roundedIdx].id);
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
      } else {
        const omega = isContinuousScrub ? 22 : 11;
        const steps = rawDt > 0.018 ? 2 : 1;
        const stepDt = rawDt / steps;
        for (let s = 0; s < steps; s++) {
          const accel = omega * omega * (targetU - displayU) - 2 * omega * displayVel;
          displayVel += accel * stepDt;
          displayU += displayVel * stepDt;
        }

        const maxU = Math.max(0, projectsData.length - 1);
        if (displayU < 0) {
          displayU = 0;
          displayVel = 0;
        } else if (displayU > maxU) {
          displayU = maxU;
          displayVel = 0;
        }

        if (Math.abs(targetU - displayU) < 0.0008 && Math.abs(displayVel) < 0.004) {
          displayU = targetU;
          displayVel = 0;
        }
      }

      renderMobileScrub(displayU);

      if (Math.abs(targetU - displayU) > 0.0008 || Math.abs(displayVel) > 0.004) {
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

    const snapToNearest = (instant = false) => {
      const n = projectsData.length;
      const scrollU = computeScrollU();
      isContinuousScrub = false;
      committedIdx = Math.max(0, Math.min(n - 1, Math.round(scrollU)));
      targetU = committedIdx;

      if (instant || reduced) {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        lastFrameTime = 0;
        displayU = targetU;
        displayVel = 0;
        renderMobileScrub(displayU);
      } else {
        ensureLoopRunning();
      }
    };

    const handleScroll = () => {
      const now = performance.now();
      const scrollY = window.scrollY || window.pageYOffset || 0;
      scrollSamples.push({ t: now, y: scrollY });
      while (scrollSamples.length > 0 && now - scrollSamples[0].t > MOBILE_SCRUB_WINDOW_MS) {
        scrollSamples.shift();
      }
      const windowDelta =
        scrollSamples.length >= 2
          ? Math.abs(scrollSamples[scrollSamples.length - 1].y - scrollSamples[0].y)
          : 0;

      const n = projectsData.length;
      const scrollU = computeScrollU();

      if (!isContinuousScrub && windowDelta >= MOBILE_SCRUB_ENTER_DELTA) {
        isContinuousScrub = true;
        targetU = scrollU;
      } else if (isContinuousScrub) {
        if (windowDelta <= MOBILE_SCRUB_EXIT_DELTA) {
          isContinuousScrub = false;
          committedIdx = Math.max(0, Math.min(n - 1, Math.round(scrollU)));
          targetU = committedIdx;
        } else {
          targetU = scrollU;
        }
      } else {
        if (scrollU === 0) {
          committedIdx = 0;
        } else if (scrollU === n - 1) {
          committedIdx = n - 1;
        } else if (Math.abs(scrollU - committedIdx) > MOBILE_SLOW_SWITCH_HYSTERESIS) {
          committedIdx = Math.max(0, Math.min(n - 1, Math.round(scrollU)));
        }
        targetU = committedIdx;
      }

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (cancelled) return;
        scrollSamples.length = 0;
        snapToNearest(false);
      }, MOBILE_SETTLE_DELAY_MS);

      ensureLoopRunning();
    };

    const handleResize = () => {
      measureCenters();
      snapToNearest(true);
    };

    const handleMotionChange = (ev: MediaQueryListEvent) => {
      reduced = ev.matches;
      snapToNearest(true);
    };

    rescrubMobileRef.current = () => renderMobileScrub(displayU);
    measureCenters();
    snapToNearest(true);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    motionMq?.addEventListener('change', handleMotionChange);

    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        if (cancelled) return;
        measureCenters();
        snapToNearest(true);
      });
    }

    return () => {
      cancelled = true;
      rescrubMobileRef.current = null;
      if (settleTimer) clearTimeout(settleTimer);
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
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
