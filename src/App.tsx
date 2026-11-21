import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { BackgroundGrid } from './components/BackgroundGrid';
import { Header } from './components/Header';
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
const MOBILE_ACTIVE_HYSTERESIS = 36;

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
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const mobileActiveIndexRef = useRef(0);
  const mobileTitleHeightsRef = useRef<Record<number, number>>({});
  const [mobilePushAmount, setMobilePushAmount] = useState(
    DEFAULT_MOBILE_TITLE_HEIGHT + MOBILE_TITLE_EXTRA_GAP
  );
  const [enableMobilePushTransition, setEnableMobilePushTransition] = useState(false);
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
    setSelectedProject(p);
    if (window.location.hash.replace(/^#\/?/, '') !== p.id) {
      window.history.pushState(null, '', `#${p.id}`);
    }
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

  const handleMobileTitleMeasure = useCallback((idx: number, height: number) => {
    mobileTitleHeightsRef.current[idx] = height;
    if (idx === mobileActiveIndexRef.current) {
      const nextPush = Math.round(height) + MOBILE_TITLE_EXTRA_GAP;
      setMobilePushAmount((prev) => (Math.abs(prev - nextPush) >= 1 ? nextPush : prev));
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

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setEnableMobilePushTransition(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport || isBakerOpen || isStudioOpen) return;

    const centersRef: number[] = [];
    let ticking = false;

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

    const updateMobileActive = () => {
      if (centersRef.length === 0) {
        measureCenters();
      }
      if (centersRef.length === 0) return;

      const scrollY = window.scrollY || window.pageYOffset || 0;
      const vh = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const n = projectsData.length;

      let targetIdx = mobileActiveIndexRef.current;

      if (scrollY <= 8) {
        targetIdx = 0;
      } else if (scrollY + vh >= docHeight - 8) {
        targetIdx = n - 1;
      } else {
        const currentIdx = mobileActiveIndexRef.current;
        const currentPush =
          (mobileTitleHeightsRef.current[currentIdx] ?? DEFAULT_MOBILE_TITLE_HEIGHT) +
          MOBILE_TITLE_EXTRA_GAP;
        const focusY = scrollY + vh * 0.5 + 28 - currentPush / 2;

        let nearestIdx = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < n; i++) {
          const center = centersRef[i];
          if (center === undefined) continue;
          const dist = Math.abs(center - focusY);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = i;
          }
        }

        const currentCenter = centersRef[currentIdx];
        const currentDist = currentCenter !== undefined ? Math.abs(currentCenter - focusY) : Infinity;

        if (nearestIdx !== currentIdx && nearestDist + MOBILE_ACTIVE_HYSTERESIS < currentDist) {
          targetIdx = nearestIdx;
        }
      }

      if (targetIdx !== mobileActiveIndexRef.current) {
        mobileActiveIndexRef.current = targetIdx;
        setMobileActiveIndex(targetIdx);
        setActiveProjectId(projectsData[targetIdx].id);
        const measured = mobileTitleHeightsRef.current[targetIdx] ?? DEFAULT_MOBILE_TITLE_HEIGHT;
        setMobilePushAmount(Math.round(measured) + MOBILE_TITLE_EXTRA_GAP);
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          ticking = false;
          updateMobileActive();
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      measureCenters();
      updateMobileActive();
    };

    measureCenters();
    updateMobileActive();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        measureCenters();
        updateMobileActive();
      });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
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
      <Header />

      {/* Continuous Dynamic Timeline Ruler along the side */}
      <TimelineRuler projects={projectsData} activeId={activeProjectId} />

      {/* Main Interactive Projects Timeline */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col pb-44 md:pb-0">
          {projectsData.map((project, index) => (
            <TimelineItem
              key={project.id}
              project={project}
              index={index}
              onSelect={handleSelectProject}
              onVisible={handleVisibleProject}
              isPausedByModal={Boolean(selectedProject) || isResumeOpen}
              mobileIsActive={index === mobileActiveIndex}
              mobileRelation={index < mobileActiveIndex ? -1 : index > mobileActiveIndex ? 1 : 0}
              mobileModelOffsetY={
                index < mobileActiveIndex
                  ? 0
                  : index === mobileActiveIndex
                  ? mobilePushAmount
                  : mobilePushAmount + MOBILE_BELOW_BREATHE
              }
              enableMobilePushTransition={enableMobilePushTransition}
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
