import React, { useEffect, useState } from 'react';
import { Project, MediaItem } from '../types/project';
import { ModelViewer } from '../canvas/ModelViewer';
import { ImageCarousel } from './ImageCarousel';
import { CompanyLogo } from './CompanyLogo';
import { X, Cpu, CheckCircle2, Layers, AlertCircle, ExternalLink, ZoomIn, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose }) => {
  const [selectedImage, setSelectedImage] = useState<{ url: string; caption?: string } | null>(null);
  const [is3DFullscreen, setIs3DFullscreen] = useState(false);

  // Lock background body scroll whenever modal or lightbox is open
  useEffect(() => {
    if (project || selectedImage || is3DFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [project, selectedImage, is3DFullscreen]);

  // Handle ESC key for fullscreen 3D view and lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedImage) {
          setSelectedImage(null);
        } else if (is3DFullscreen) {
          setIs3DFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, is3DFullscreen]);

  if (!project) return null;

  // Extract YouTube ID helper
  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : url;
  };

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md">
          {/* Backdrop Click */}
          <div className="fixed inset-0" onClick={onClose} />

          {/* Modal Window Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-[#141C28] rounded-2xl border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Header Title Bar */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                {project.company && (
                  <CompanyLogo company={project.company} logoUrl={project.companyLogo} size="sm" />
                )}
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-100 text-blue-800 dark:bg-slate-800 dark:text-slate-300 border border-blue-200 dark:border-slate-700">
                  {project.date.toUpperCase()}
                </span>
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight">
                  {project.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {project.projectWebsiteUrl && (
                  <a
                    href={project.projectWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-blue-200 dark:border-slate-700 transition-colors"
                  >
                    <span>Project Webpage</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto p-6 sm:p-8 space-y-8">
              
              {/* Interactive 3D Model Showcase */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 relative shadow-inner">
                {/* 3D Viewer Header Badges & Fullscreen Button */}
                <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-4 z-10 flex items-center justify-between pointer-events-none">
                  {/* Hidden on mobile, visible on tablet/desktop */}
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-2 bg-white/85 dark:bg-slate-900/85 px-2.5 py-1 rounded-md backdrop-blur border border-slate-200 dark:border-slate-800 shadow-sm pointer-events-auto">
                    <Cpu size={13} className="text-blue-500" />
                    <span>INTERACTIVE 3D CAD MODEL // DRAG TO ORBIT // SCROLL TO ZOOM</span>
                  </div>

                  <button
                    onClick={() => setIs3DFullscreen(true)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-mono font-medium shadow-sm border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 pointer-events-auto cursor-pointer"
                    title="Open Fullscreen 3D Model Inspector"
                  >
                    <Maximize2 size={13} className="text-blue-500" />
                    <span>Fullscreen 3D</span>
                  </button>
                </div>

                <ModelViewer
                  modelType={project.modelType}
                  isActive={true}
                  className="h-80 sm:h-96 w-full"
                  allowZoom={true}
                />
              </div>

              {/* Subtitle & Tag Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
                <p className="text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300 font-mono">
                  {project.subtitle}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 text-xs rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Structured Verbatim Sections */}
              {project.structuredSections && project.structuredSections.length > 0 ? (
                <div className="space-y-8">
                  {project.structuredSections.map((section, sIdx) => {
                    const isVideosOnly = section.media && section.media.every(m => m.type === 'youtube');

                    return (
                      <div key={sIdx} className="space-y-4 border-b border-slate-100 dark:border-slate-800/50 pb-7 last:border-b-0">
                        <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>{section.heading}</span>
                        </h3>

                        {/* Paragraphs */}
                        {section.paragraphs && (
                          <div className="space-y-2.5 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                            {section.paragraphs.map((p, pIdx) => (
                              <p key={pIdx}>{p}</p>
                            ))}
                          </div>
                        )}

                        {/* Sub-sections */}
                        {section.subSections && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            {section.subSections.map((sub, subIdx) => (
                              <div
                                key={subIdx}
                                className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-1.5"
                              >
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-2">
                                  <span className="text-blue-500 font-mono text-xs">›</span>
                                  <span>{sub.title}</span>
                                </h4>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {sub.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Dedicated Carousel Section if specified */}
                        {section.imagesLayout === 'carousel' && section.images && section.images.length > 0 && (
                          <div className="pt-2">
                            <ImageCarousel
                              images={section.images}
                              onImageClick={(img) => setSelectedImage({ url: img.url, caption: img.caption || img.title })}
                            />
                          </div>
                        )}

                        {/* Photos Layout */}
                        {section.images && section.images.length > 0 && section.imagesLayout !== 'carousel' && (
                          <div className="pt-2 space-y-4">
                            {section.imagesLayout === 'grid-2-1' ? (
                              <div className="space-y-4">
                                {/* Top Row: 2 photos side-by-side */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                  {section.images.slice(0, 2).map((img, iIdx) => (
                                    <div key={iIdx} className="flex items-center justify-center">
                                      <div
                                        onClick={() => setSelectedImage({ url: img.url, caption: img.caption || img.title })}
                                        className="group relative rounded-xl overflow-hidden cursor-pointer shadow-md inline-block max-w-full border border-slate-200 dark:border-slate-800"
                                      >
                                        <img
                                          src={img.url}
                                          alt={img.title || 'CAD model photo'}
                                          className="block max-h-80 w-auto object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300"
                                          loading="lazy"
                                        />
                                        <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded backdrop-blur flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                                          <ZoomIn size={12} />
                                          <span>Enlarge</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Bottom Row: 1 photo centered below */}
                                {section.images.length > 2 && (
                                  <div className="flex items-center justify-center pt-1">
                                    <div
                                      onClick={() => setSelectedImage({ url: section.images![2].url, caption: section.images![2].caption || section.images![2].title })}
                                      className="group relative rounded-xl overflow-hidden cursor-pointer shadow-md inline-block max-w-2xl border border-slate-200 dark:border-slate-800"
                                    >
                                      <img
                                        src={section.images[2].url}
                                        alt={section.images[2].title || 'CAD model photo'}
                                        className="block max-h-80 w-auto object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300 mx-auto"
                                        loading="lazy"
                                      />
                                      <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded backdrop-blur flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                                        <ZoomIn size={12} />
                                        <span>Enlarge</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : section.imagesLayout === 'grid-2' ? (
                              /* 2 photos side-by-side */
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                {section.images.map((img, iIdx) => (
                                  <div key={iIdx} className="flex items-center justify-center">
                                    <div
                                      onClick={() => setSelectedImage({ url: img.url, caption: img.caption || img.title })}
                                      className="group relative rounded-xl overflow-hidden cursor-pointer shadow-md inline-block max-w-full border border-slate-200 dark:border-slate-800"
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.title || 'CAD photo'}
                                        className="block max-h-80 w-auto object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300"
                                        loading="lazy"
                                      />
                                      <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded backdrop-blur flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                                        <ZoomIn size={12} />
                                        <span>Enlarge</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* Single centered photos */
                              <div className="space-y-4">
                                {section.images.map((img, iIdx) => (
                                  <div key={iIdx} className="flex items-center justify-center pt-1">
                                    <div
                                      onClick={() => setSelectedImage({ url: img.url, caption: img.caption || img.title })}
                                      className="group relative rounded-xl overflow-hidden cursor-pointer shadow-md inline-block max-w-2xl border border-slate-200 dark:border-slate-800"
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.title || 'Project photo'}
                                        className="block max-h-96 w-auto object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300 mx-auto"
                                        loading="lazy"
                                      />
                                      <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded backdrop-blur flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                                        <ZoomIn size={12} />
                                        <span>Enlarge</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section Media / Video Players */}
                        {section.media && section.media.length > 0 && (
                          <div className={`pt-2 ${isVideosOnly && section.media.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}`}>
                            {section.media.map((item: MediaItem, mIdx: number) => (
                              <div key={mIdx} className="space-y-1.5">
                                {item.type === 'youtube' ? (
                                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black aspect-video shadow-sm">
                                    <iframe
                                      src={getYouTubeEmbedUrl(item.url)}
                                      title={item.title || 'Video Demo'}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="w-full h-full border-0"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => setSelectedImage({ url: item.url, caption: item.caption || item.title })}
                                    className="group relative rounded-xl overflow-hidden cursor-pointer shadow-md inline-block max-w-2xl border border-slate-200 dark:border-slate-800 mx-auto"
                                  >
                                    <img
                                      src={item.url}
                                      alt={item.title || 'Photo'}
                                      className="block max-h-80 w-auto object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300"
                                      loading="lazy"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback extended description */
                <div className="space-y-3">
                  <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Project Overview & Design Implementation
                  </h3>
                  <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {project.extendedDescription.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Specifications Grid */}
              <div className="space-y-3">
                <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Layers size={14} className="text-blue-500" />
                  <span>Technical Specifications</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {project.specs.map((spec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between"
                    >
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {spec.label}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Materials & Manufacturing */}
              <div className="space-y-3">
                <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>Materials & Manufacturing Methods</span>
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                  {project.materialsAndManufacturing.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-blue-500 font-bold">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Engineering Challenges Solved */}
              <div className="space-y-3">
                <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-500" />
                  <span>Engineering Challenges & Solutions</span>
                </h3>
                <ul className="space-y-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                  {project.keyChallenges.map((challenge, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{challenge}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Modal Footer Bar */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs font-mono shrink-0">
              <span className="text-slate-400 dark:text-slate-500">
                {project.company ? `${project.company.toUpperCase()} // ${project.date.toUpperCase()}` : project.date.toUpperCase()}
              </span>
              {project.projectWebsiteUrl && (
                <a
                  href={project.projectWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Full Project Website</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Top-Level Fullscreen Lightbox Modal for Photos */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 select-none cursor-pointer"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 p-2.5 text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors z-20 cursor-pointer shadow-lg"
              aria-label="Close Lightbox"
            >
              <X size={22} />
            </button>
            <div
              className="max-w-5xl max-h-[88vh] flex flex-col items-center justify-center cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.url}
                alt={selectedImage.caption || 'Expanded photo'}
                className="max-h-[82vh] w-auto rounded-xl shadow-2xl border border-slate-800 object-contain"
              />
              {selectedImage.caption && (
                <p className="text-slate-200 font-mono text-xs sm:text-sm mt-3 text-center bg-slate-900/90 px-4 py-2 rounded-md border border-slate-800 max-w-2xl">
                  {selectedImage.caption}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-Level Fullscreen 3D CAD Inspector Modal */}
      <AnimatePresence>
        {is3DFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 select-none"
          >
            {/* Fullscreen 3D Header Bar */}
            <div className="w-full max-w-6xl flex items-center justify-between z-20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">
                  <Cpu size={18} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {project.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIs3DFullscreen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer shadow-lg"
                >
                  <Minimize2 size={14} />
                  <span>Exit Fullscreen</span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
                    ESC
                  </span>
                </button>
              </div>
            </div>

            {/* Fullscreen 3D Viewport */}
            <div className="w-full flex-1 max-w-6xl flex items-center justify-center relative overflow-visible my-2">
              <ModelViewer
                modelType={project.modelType}
                isActive={true}
                className="h-[80vh] sm:h-[86vh] w-full"
                allowZoom={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
