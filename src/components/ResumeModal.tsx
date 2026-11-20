import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Download,
  Mail,
  Linkedin,
  Phone,
  Globe,
  GraduationCap,
  Wrench,
  Briefcase,
  Award,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { revertAllButtonRipples } from '../utils/buttonRipple';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResumeModal: React.FC<ResumeModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<'html' | 'pdf'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'html' : 'pdf'
  );

  useEffect(() => {
    return () => {
      revertAllButtonRipples();
    };
  }, []);

  // Close on Escape and trap Tab focus inside dialog
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, iframe, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  // Prevent background body scrolling when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="resume-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 overflow-hidden bg-black/75 backdrop-blur-md"
        >
          {/* Backdrop Click */}
          <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

          {/* Modal Window Container */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-modal-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-4xl h-[100dvh] sm:h-[94vh] flex flex-col bg-white dark:bg-[#0c121e] rounded-none sm:rounded-2xl overflow-hidden text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            {/* Header Title Bar */}
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <h2 id="resume-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Resume
                </h2>

                {/* Desktop View Switcher (Readable HTML vs Embedded PDF) */}
                <div className="hidden sm:flex items-center gap-1 p-0.5 rounded bg-slate-200/80 dark:bg-slate-800/80 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setViewMode('html')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      viewMode === 'html'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Readable
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('pdf')}
                    className={`px-2.5 py-1 rounded cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      viewMode === 'pdf'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    PDF
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="./Jaden_Fann_Resume.pdf"
                  download="Jaden_Fann_Resume.pdf"
                  className="btn-ripple inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>Download</span>
                  <Download size={12} />
                </a>
                <a
                  href="./Jaden_Fann_Resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ripple inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>Open PDF</span>
                  <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ripple w-8 h-8 p-0 flex items-center justify-center rounded text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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

            {/* Body: Embedded PDF or Responsive Borderless HTML Resume */}
            {viewMode === 'pdf' ? (
              <div className="flex-1 w-full h-full bg-slate-100 dark:bg-slate-900">
                <iframe
                  src="./Jaden_Fann_Resume.pdf#view=Fit&toolbar=0&navpanes=0&scrollbar=0"
                  title="Jaden Fann Resume"
                  style={{ border: 0 }}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 bg-white dark:bg-[#0c121e]">
                {/* Contact Header Block */}
                <div className="bg-slate-100/80 dark:bg-slate-800/50 rounded-xl p-4 sm:p-5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                      Jaden Fann
                    </h3>
                    <p className="font-mono text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400">
                      Mechanical Engineer
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono text-slate-600 dark:text-slate-300">
                    <a href="tel:2069796842" className="inline-flex items-center gap-1.5 hover:text-blue-500">
                      <Phone size={12} />
                      <span>(206) 979-6842</span>
                    </a>
                    <a href="mailto:fann@berkeley.edu" className="inline-flex items-center gap-1.5 hover:text-blue-500">
                      <Mail size={12} />
                      <span>fann@berkeley.edu</span>
                    </a>
                    <a
                      href="https://linkedin.com/in/jadenfann"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-blue-500"
                    >
                      <Linkedin size={12} />
                      <span>linkedin.com/in/jadenfann</span>
                    </a>
                    <a
                      href="https://showspace.so/s/jadenfann"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-blue-500"
                    >
                      <Globe size={12} />
                      <span>showspace.so/s/jadenfann</span>
                    </a>
                  </div>
                </div>

                {/* Education */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <GraduationCap size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Education</span>
                  </div>
                  <div className="bg-slate-100/70 dark:bg-slate-800/40 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">University of California, Berkeley</span>
                        <span className="text-slate-600 dark:text-slate-300"> · M.S. Mechanical Engineering · </span>
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">GPA: 3.8</span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">2024 – 2025</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 text-xs sm:text-sm">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">University of California, Berkeley</span>
                        <span className="text-slate-600 dark:text-slate-300"> · B.S. Mechanical Engineering · </span>
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">GPA: 3.7</span>
                      </div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">2021 – 2024</span>
                    </div>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Coursework: </span>
                      Robotic Locomotion · Mechatronic Design · Manufacturing Design · FEA + Ansys · PCB Design
                    </p>
                  </div>
                </section>

                {/* Technical Skills */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Wrench size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Skills</span>
                  </div>
                  <div className="bg-slate-100/70 dark:bg-slate-800/40 rounded-xl p-4 space-y-2 text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
                    <p>SolidWorks · Onshape · Fusion 360 · AutoCAD · Ansys · MATLAB · Simulink · ROS · Python</p>
                    <p>FEA · GD&amp;T · Fabrication: (FDM Printing, Lathe, Milling Machine, Drill Press, Waterjet/Laser Cutting)</p>
                  </div>
                </section>

                {/* Work Experience */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Briefcase size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Work Experience</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      {
                        role: 'Mechanical Engineer',
                        company: 'Blue Origin',
                        period: 'September 2025 – Present',
                        bullets: ['Designing actuation mechanisms for the Blue Moon Lunar Lander MK II.'],
                      },
                      {
                        role: 'Mechanical Engineering Contractor',
                        company: 'Tesla (Engineering Solutions at Berkeley)',
                        period: 'September 2024 – January 2025',
                        bullets: [
                          'Designed, prototyped, and tested an electromechanical two-position actuating mechanism.',
                          'Engineered and validated designs with first principles, deflection calculations, FEA, and DFMEA to ensure performance, reliability, and safety.',
                          'Created design drawings and prototype concepts using CAD and GD&T for manufacturing and assembly.',
                        ],
                      },
                      {
                        role: 'Mechanical Engineering Contractor',
                        company: 'Sentien Robotics',
                        period: 'January 2023 – May 2024',
                        bullets: [
                          'Designed and prototyped a planar cable robot, including a robust winch system running at up to 3,000 rpm, to reliably catch midflight automated drones landing at 20 mph.',
                          'Validated and manufactured designs using SolidWorks, 3D printed prototypes, and design analysis; increased winch reliability 2x through uniform winding distribution.',
                          'Managed cross-functional team communication and project timeline to ensure successful execution.',
                        ],
                      },
                      {
                        role: 'Mechanical Engineering Intern',
                        company: 'Inductive Robotics',
                        period: 'June 2024 – September 2024',
                        bullets: [
                          'Engineered autonomous robotic charging system prototype using Onshape and FEA to integrate high-voltage components, battery pack, robotic mechanisms, and sheet metal into a cohesive system.',
                          'Designed parts for manufacturing, creating engineering and welding drawings for accurate service.',
                        ],
                      },
                      {
                        role: 'Mechanical Engineering Intern',
                        company: 'Group14 Technologies',
                        period: 'May 2024 – August 2024',
                        bullets: [
                          "Designed custom mechanical parts using SolidWorks, FEA, and DFM to improve Group14's silicon battery material manufacturing inspection processes.",
                          'Increased sensor compatibility and inspection visibility by 90% with custom attachment plates.',
                          'Led Management of Change process meetings and documentation for smooth project implementation.',
                        ],
                      },
                      {
                        role: 'Mechanical Engineering Intern',
                        company: 'Raise Robotics',
                        period: 'May 2023 – August 2023',
                        bullets: [
                          'Designed modular robotic gripper to reliably hold and position 5 lb aluminum brackets during automated construction tasks; created design drawings and fabrication plans.',
                          'Developed stability outrigger system for 1,500 lb construction robot using dynamic simulation to determine optimal geometry and attachment structure.',
                          'Modified and created robot assemblies with 700+ parts for URDF in CAD, improving model mates, geometries, and mass/material assignments.',
                        ],
                      },
                      {
                        role: 'Mechanical/Manufacturing Engineering Intern',
                        company: 'Re:Build Manufacturing',
                        period: 'August 2022 – October 2022',
                        bullets: [
                          "Designed and implemented fixtures and jigs for Pure Watercraft's electric outboard motor assembly line, reducing step complexity and improving ergonomics.",
                          'Documented and developed high-fidelity work instructions for 20+ step assembly processes, creating 3D and 2D assembly drawings.',
                        ],
                      },
                    ].map((exp) => (
                      <div key={exp.company} className="bg-slate-100/70 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5">
                          <div className="text-xs sm:text-sm">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{exp.company}</span>
                            <span className="text-slate-400 dark:text-slate-500 mx-1.5">·</span>
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{exp.role}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                            {exp.period}
                          </span>
                        </div>
                        <ul className="space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {exp.bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-blue-500 dark:text-blue-400 font-bold select-none">•</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Activities */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Award size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Activities</span>
                  </div>
                  <div className="bg-slate-100/70 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5">
                      <div className="text-xs sm:text-sm">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">Surge Electric Motorcycles</span>
                        <span className="text-slate-400 dark:text-slate-500 mx-1.5">·</span>
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">Lead Powertrain Engineer</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        August 2024 – June 2025
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 dark:text-blue-400 font-bold select-none">•</span>
                        <span>Led design, prototyping, and manufacturing of powertrain for motorcycle electrification.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 dark:text-blue-400 font-bold select-none">•</span>
                        <span>Conducted motor &amp; drive ratio selection, structural analysis, and bracket design for ideal implementation.</span>
                      </li>
                    </ul>
                  </div>
                </section>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
