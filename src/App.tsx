import React, { useState, useEffect } from 'react';
import { BackgroundGrid } from './components/BackgroundGrid';
import { Header } from './components/Header';
import { TimelineItem } from './components/TimelineItem';
import { TimelineRuler } from './components/TimelineRuler';
import { ProjectModal } from './components/ProjectModal';
import { CADStudioWorkbench } from './components/studio/CADStudioWorkbench';
import { PosterBakerPage } from './components/poster/PosterBakerPage';
import { CADLoadingScreen } from './components/CADLoadingScreen';
import { projectsData } from './data/projectsData';
import { Project } from './types/project';
import { ExternalLink, Cpu, Camera } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string>(projectsData[0]?.id || '');
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(() => {
    return (
      window.location.hash === '#studio' ||
      window.location.search.includes('studio=true')
    );
  });
  const [isBakerOpen, setIsBakerOpen] = useState<boolean>(() => {
    return (
      window.location.hash === '#baker' ||
      window.location.search.includes('baker=true')
    );
  });

  // Listen for hash changes (e.g. #studio, #baker)
  useEffect(() => {
    const handleHashChange = () => {
      setIsStudioOpen(
        window.location.hash === '#studio' ||
        window.location.search.includes('studio=true')
      );
      setIsBakerOpen(
        window.location.hash === '#baker' ||
        window.location.search.includes('baker=true')
      );
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
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
    <div className="relative min-h-screen flex flex-col font-sans transition-colors selection:bg-blue-500 selection:text-white">
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
              onSelect={(p) => setSelectedProject(p)}
              onVisible={(id) => setActiveProjectId(id)}
            />
          ))}
        </div>
      </main>

      {/* Project Engineering Spec Modal */}
      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      {/* Minimal Engineering Footer */}
      <footer className="relative z-20 w-full py-12 text-slate-500 dark:text-slate-400 font-mono text-xs text-center border-t border-slate-200/40 dark:border-slate-800/40 mt-12">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} JADEN FANN // MECHANICAL ENGINEER</span>
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <button
              onClick={() => {
                window.location.hash = 'baker';
                setIsBakerOpen(true);
              }}
              className="hover:text-emerald-500 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 cursor-pointer text-[11px]"
              title="Open 1:1 Exact Model Poster Baker"
            >
              <Camera size={12} className="text-emerald-500" />
              <span>Poster Baker</span>
            </button>

            <button
              onClick={() => {
                window.location.hash = 'studio';
                setIsStudioOpen(true);
              }}
              className="hover:text-blue-500 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 cursor-pointer text-[11px]"
              title="Open Fullscreen 3D CAD Alignment & Kinematics Studio"
            >
              <Cpu size={12} className="text-blue-500" />
              <span>3D CAD Studio</span>
            </button>
            <a
              href="https://showspace.so/s/jadenfann"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition-colors flex items-center gap-1"
            >
              <span>SHOWSPACE</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="./Jaden_Fann_Resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition-colors"
            >
              RESUME
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
