import React, { useState, useEffect } from 'react';
import { BackgroundGrid } from './components/BackgroundGrid';
import { Header } from './components/Header';
import { TimelineItem } from './components/TimelineItem';
import { TimelineRuler } from './components/TimelineRuler';
import { ProjectModal } from './components/ProjectModal';
import { CADStudioWorkbench } from './components/studio/CADStudioWorkbench';
import { PosterBakerPage } from './components/poster/PosterBakerPage';
import { CADLoadingScreen } from './components/CADLoadingScreen';
import { ResumeModal } from './components/ResumeModal';
import { projectsData } from './data/projectsData';
import { Project } from './types/project';
import { ExternalLink, Cpu, Camera } from 'lucide-react';
import { initButtonRipple, revertAllButtonRipples } from './utils/buttonRipple';

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

  // If in dedicated Poster Baker mode, render full-screen Poster Baker
  if (isBakerOpen) {
    return (
      <PosterBakerPage
        onExit={() => {
          setIsBakerOpen(false);
          if (window.location.hash === '#baker') {
            window.history.pushState(null, '', window.location.pathname);
          }
        }}
      />
    );
  }

  // If in dedicated Studio mode, render full-screen Studio Workbench
  if (isStudioOpen) {
    return (
      <CADStudioWorkbench
        onExit={() => {
          setIsStudioOpen(false);
          if (window.location.hash === '#studio') {
            window.history.pushState(null, '', window.location.pathname);
          }
        }}
      />
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* High-Tech Animated CAD Boot & Loading Screen */}
      <CADLoadingScreen />

      {/* Infinite Scrolling Perspective CAD Drafting Grid */}
      <BackgroundGrid />

      {/* Top Header */}
      <Header />

      {/* Continuous Dynamic Timeline Ruler along the side */}
      <TimelineRuler projects={projectsData} activeId={activeProjectId} />

      {/* Main Interactive Projects Timeline */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col">
          {projectsData.map((project, index) => (
            <TimelineItem
              key={project.id}
              project={project}
              index={index}
              onSelect={handleSelectProject}
              onVisible={handleVisibleProject}
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
            <a
              href="https://showspace.so/s/jadenfann"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 flex items-center gap-1"
            >
              <span>SHOWSPACE</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="#resume"
              className="hover:text-blue-500"
            >
              RESUME
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
