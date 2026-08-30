import React, { useEffect, useState } from 'react';
import { Project } from '../types/project';
import { ModelViewer } from '../canvas/ModelViewer';
import { ImageCarousel } from './ImageCarousel';
import { CompanyLogo } from './CompanyLogo';
import { ExternalLink, ZoomIn, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose }) => {
  const [selectedImage, setSelectedImage] = useState<{ url: string; caption?: string } | null>(null);
  const [is3DFullscreen, setIs3DFullscreen] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedImage) {
          setSelectedImage(null);
        } else if (is3DFullscreen) {
          setIs3DFullscreen(false);
        } else if (project) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, onClose, selectedImage, is3DFullscreen]);

  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Consider it at the bottom if within 30px
    setIsScrolledToBottom(scrollHeight - scrollTop <= clientHeight + 30);
  };

  // Prevent background body scrolling when modal or fullscreen 3D is active
  useEffect(() => {
    if (project) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [project]);

  if (!project) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 overflow-hidden bg-black/75 backdrop-blur-md">
          {/* Backdrop Click */}
          <div className="fixed inset-0" onClick={onClose} />

          {/* Modal Window Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full h-full sm:h-auto max-w-5xl max-h-[100dvh] sm:max-h-[92vh] flex flex-col bg-white dark:bg-[#141C28] rounded-none sm:rounded-2xl border-0 sm:border sm:border-slate-300 dark:sm:border-none shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Header Title Bar */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {project.company && (
                  <CompanyLogo
                    company={project.company}
                    logoUrl={project.companyLogo}
                    companyUrl={project.companyUrl}
                    size="sm"
                  />
                )}
                <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {project.date.toUpperCase()}
                </span>
                <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight line-clamp-1">
                  {project.title}
                </h2>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {project.projectWebsiteUrl && (
                  <a
                    href={project.projectWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
                  >
                    <span>Project Webpage</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 p-0 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div 
              className="overflow-y-auto p-4 sm:p-8 space-y-8 pb-20 sm:pb-8 relative"
              onScroll={handleScroll}
            >
              
              {/* Interactive 3D Model Showcase */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg p-3 relative">
                {/* 3D Viewer Top Fullscreen Button */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 flex items-center justify-end pointer-events-none">
                  <button
                    type="button"
                    onClick={() => setIs3DFullscreen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 text-xs font-mono font-medium border border-slate-300 dark:border-slate-700 transition-colors pointer-events-auto cursor-pointer"
                    title="Open Fullscreen 3D Model Inspector"
                  >
                    <Maximize2 size={13} className="text-blue-600 dark:text-blue-400" />
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
                      {tag}
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
                        <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                          {section.heading}
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-1">
                            {section.subSections.map((sub, subIdx) => (
                              <div key={subIdx} className="space-y-1">
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">
                                  {sub.title}
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                  {section.images.slice(0, 2).map((img, iIdx) => (
                                    <div key={iIdx} className="flex items-center justify-center">
                                      <div
                                        onClick={() => setSelectedImage({ url: img.url, caption: img.caption || img.title })}
                                        className="group relative rounded-lg overflow-hidden cursor-pointer inline-block max-w-full border border-slate-200 dark:border-slate-800"
                                      >
                                        <img
                                          src={img.url}
                                          alt={img.title || 'CAD model photo'}
                                          className="block max-h-80 w-auto object-contain rounded-lg"
                                          loading="lazy"
                                        />
                                        <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <ZoomIn size={12} />
                                          <span>Enlarge</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {section.images.length > 2 && (
                                  <div className="flex items-center justify-center pt-1">
                                    <div
                                      onClick={() => setSelectedImage({ url: section.images![2].url, caption: section.images![2].caption || section.images![2].title })}
                                      className="group relative rounded-lg overflow-hidden cursor-pointer inline-block max-w-2xl border border-slate-200 dark:border-slate-800"
                                    >
                                      <img
                                        src={section.images[2].url}
                                        alt={section.images[2].title || 'CAD model photo'}
                                        className="block max-h-80 w-auto object-contain rounded-lg mx-auto"
                                        loading="lazy"
                                      />
                                      <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ZoomIn size={12} />
                                        <span>Enlarge</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : section.imagesLayout === 'grid-2' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                {section.images.map((img, iIdx) => (
                                  <div key={iIdx} className="flex items-center justify-center">
                                    <div
                                      onClick={() => setSelectedImage({ url: img.url, caption: img.caption || img.title })}
                                      className="group relative rounded-lg overflow-hidden cursor-pointer inline-block max-w-full border border-slate-200 dark:border-slate-800"
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.title || 'CAD model photo'}
                                        className="block max-h-80 w-auto object-contain rounded-lg"
                                        loading="lazy"
                                      />
                                      <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ZoomIn size={12} />
                                        <span>Enlarge</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <div
                                  onClick={() => setSelectedImage({ url: section.images![0].url, caption: section.images![0].caption || section.images![0].title })}
                                  className="group relative rounded-lg overflow-hidden cursor-pointer inline-block max-w-2xl border border-slate-200 dark:border-slate-800"
                                >
                                  <img
                                    src={section.images[0].url}
                                    alt={section.images[0].title || 'CAD model photo'}
                                    className="block max-h-80 w-auto object-contain rounded-lg mx-auto"
                                    loading="lazy"
                                  />
                                  <div className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-mono px-2 py-1 rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ZoomIn size={12} />
                                    <span>Enlarge</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Embedded YouTube / Native Videos */}
                        {section.media && section.media.length > 0 && (
                          <div className="pt-2 space-y-4">
                            {isVideosOnly && section.media.length > 1 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {section.media.map((item, mIdx) => {
                                  const isDirectVideo = item.type === 'video' || item.url.endsWith('.mp4') || item.url.endsWith('.webm');
                                  const videoId = item.url.includes('v=')
                                    ? item.url.split('v=')[1]?.split('&')[0]
                                    : item.url.split('/').pop();

                                  return (
                                    <div key={mIdx} className="space-y-2">
                                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-black flex items-center justify-center">
                                        {isDirectVideo ? (
                                          <video
                                            src={item.url}
                                            controls
                                            playsInline
                                            preload="metadata"
                                            className="w-full h-full object-contain"
                                          />
                                        ) : (
                                          <iframe
                                            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                                            title={item.title || `Project Video ${mIdx + 1}`}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                          />
                                        )}
                                      </div>
                                      {item.title && (
                                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                          {item.title}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="space-y-4 max-w-3xl mx-auto">
                                {section.media.map((item, mIdx) => {
                                  const isDirectVideo = item.type === 'video' || item.url.endsWith('.mp4') || item.url.endsWith('.webm');
                                  const videoId = item.url.includes('v=')
                                    ? item.url.split('v=')[1]?.split('&')[0]
                                    : item.url.split('/').pop();

                                  return (
                                    <div key={mIdx} className="space-y-2">
                                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-black flex items-center justify-center">
                                        {isDirectVideo ? (
                                          <video
                                            src={item.url}
                                            controls
                                            playsInline
                                            preload="metadata"
                                            className="w-full h-full object-contain"
                                          />
                                        ) : (
                                          <iframe
                                            src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                                            title={item.title || `Project Video ${mIdx + 1}`}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                          />
                                        )}
                                      </div>
                                      {item.title && (
                                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 text-center">
                                          {item.title}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {project.extendedDescription.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Specifications Grid */}
              {project.specs && project.specs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Technical Specifications
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 py-1">
                    {project.specs.map((spec, idx) => (
                      <div key={idx} className="border-b border-slate-100 dark:border-slate-800/60 pb-2 flex flex-col justify-between">
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {spec.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials & Manufacturing */}
              {project.materialsAndManufacturing && project.materialsAndManufacturing.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Materials & Manufacturing Methods
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                    {project.materialsAndManufacturing.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-slate-400 dark:text-slate-600 font-bold select-none">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Engineering Challenges Solved */}
              {project.keyChallenges && project.keyChallenges.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Engineering Challenges & Solutions
                  </h3>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    {project.keyChallenges.map((challenge, idx) => (
                      <li key={idx} className="border-l-2 border-slate-300 dark:border-slate-700 pl-3.5 py-0.5 leading-relaxed">
                        <span>{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
            
            {/* Mobile Scroll Indicator */}
            <div 
              className={`absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white via-white/90 dark:from-[#141C28] dark:via-[#141C28]/90 to-transparent pointer-events-none transition-opacity duration-300 flex items-end justify-center pb-6 sm:hidden ${isScrolledToBottom ? 'opacity-0' : 'opacity-100'}`}
            >
              <div className="animate-bounce bg-slate-900/10 dark:bg-white/10 p-2 rounded-full backdrop-blur-sm text-slate-500 dark:text-slate-400 shadow-sm border border-slate-900/5 dark:border-white/10 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
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
              className="absolute top-6 right-6 w-9 h-9 p-0 flex items-center justify-center text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors z-20 cursor-pointer"
              aria-label="Close Lightbox"
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
            <div
              className="max-w-5xl max-h-[88vh] flex flex-col items-center justify-center cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.url}
                alt={selectedImage.caption || 'Expanded photo'}
                className="max-h-[82vh] w-auto rounded-lg border border-slate-800 object-contain"
              />
              {selectedImage.caption && (
                <p className="text-slate-200 font-mono text-xs sm:text-sm mt-3 text-center bg-slate-900/90 px-4 py-2 rounded-lg border border-slate-800 max-w-2xl">
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
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between select-none overflow-hidden"
          >
            {/* Floating Top Header Bar */}
            <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 flex items-center justify-between z-30 pointer-events-none">
              <div className="flex items-center gap-2.5 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded border border-slate-700/60 pointer-events-auto">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight font-mono">
                  {project.title}
                </h3>
              </div>

              <div className="flex items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setIs3DFullscreen(false)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono font-medium text-slate-200 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 transition-colors cursor-pointer"
                >
                  <Minimize2 size={13} className="text-blue-400" />
                  <span>Exit Fullscreen</span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300">
                    ESC
                  </span>
                </button>
              </div>
            </div>

            {/* Edge-to-Edge Fullscreen 3D Viewport */}
            <div className="w-full h-full flex-1 relative overflow-hidden">
              <ModelViewer
                modelType={project.modelType}
                isActive={true}
                className="w-full h-screen"
                allowZoom={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
