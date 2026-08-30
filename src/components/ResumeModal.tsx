import React, { useEffect } from 'react';
import {
  ExternalLink,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResumeModal: React.FC<ResumeModalProps> = ({ isOpen, onClose }) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  if (!isOpen) return null;

  return (
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
          className="relative z-10 w-full max-w-4xl h-[95vh] flex flex-col bg-white dark:bg-[#141C28] rounded-2xl border border-slate-300 dark:border-none shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
        >
          {/* Header Title Bar */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Resume
              </h2>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <a
                href="./Jaden_Fann_Resume.pdf"
                download="Jaden_Fann_Resume.pdf"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
              >
                <span>Download</span>
                <Download size={12} />
              </a>
              <a
                href="./Jaden_Fann_Resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
              >
                <span>Open PDF</span>
                <ExternalLink size={12} />
              </a>
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
          <div className="flex-1 w-full h-full bg-slate-100 dark:bg-slate-900/50">
            <iframe
              src="./Jaden_Fann_Resume.pdf#view=Fit&toolbar=0&navpanes=0&scrollbar=0"
              title="Jaden Fann Resume"
              className="w-full h-full border-none"
            />
          </div>

          {/* 
            ======================================================================
            PREVIOUS TEXT-BASED RESUME PRESERVED BELOW FOR FUTURE USE
            ======================================================================
            
          <div className="overflow-y-auto p-6 sm:p-10 space-y-10 hidden">
            <header className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-sans">
                  Jaden Fann
                </h1>
                <p className="font-mono text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300">
                  Mechanical Engineer
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-mono text-slate-600 dark:text-slate-400 pt-1">
                <a
                  href="mailto:fann@berkeley.edu"
                  className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Mail size={13} />
                  <span>fann@berkeley.edu</span>
                </a>

                <span className="text-slate-300 dark:text-slate-700">·</span>

                <a
                  href="https://linkedin.com/in/jadenfann"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Linkedin size={13} />
                  <span>linkedin.com/in/jadenfann</span>
                </a>

                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} />
                  <span>Berkeley, CA</span>
                </span>
              </div>
            </header>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                <GraduationCap size={16} className="text-slate-700 dark:text-slate-300" />
                <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-slate-900 dark:text-slate-100">
                  Education
                </h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between text-sm">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      University of California, Berkeley
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      2024 – 2025
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <div>Master of Science in Mechanical Engineering</div>
                    <div className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">GPA: 3.8</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between text-sm">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      University of California, Berkeley
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      2021 – 2024
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <div>Bachelor of Science in Mechanical Engineering</div>
                    <div className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">GPA: 3.7</div>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-600 dark:text-slate-400 pt-1 leading-relaxed">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Relevant Coursework: </span>
                  Robotic Locomotion · Mechatronic Design · Manufacturing Design · FEA + Ansys · PCB Design · Dynamics & Controls
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                <Wrench size={16} className="text-slate-700 dark:text-slate-300" />
                <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-slate-900 dark:text-slate-100">
                  Technical Skills
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="space-y-1">
                  <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                    CAD / CAE & Analysis
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-mono text-xs">
                    SolidWorks, Onshape, Fusion 360, AutoCAD, Ansys Mechanical FEA, MATLAB, Simulink, ROS, Python
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                    Engineering Principles
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-mono text-xs">
                    Finite Element Analysis (FEA), Geometric Dimensioning & Tolerancing (GD&T), DFM/DFA, DFMEA, Kinematics
                  </p>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                    Fabrication & Prototyping
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-mono text-xs">
                    FDM 3D Printing, Precision Manual Lathe, Milling Machine, Drill Press, Waterjet Cutting, Laser Cutting, Soldering
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                <Briefcase size={16} className="text-slate-700 dark:text-slate-300" />
                <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-slate-900 dark:text-slate-100">
                  Work Experience
                </h2>
              </div>

              <div className="space-y-7">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Blue Origin
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                      <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        Mechanical Engineer
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      September 2025 – Present
                    </div>
                  </div>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>Designing actuation mechanisms for the Blue Moon Lunar Lander MK II.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Tesla
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-xs ml-1">(via Engineering Solutions at Berkeley)</span>
                      <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                      <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        Mechanical Engineering Contractor
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      September 2024 – January 2025
                    </div>
                  </div>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>Designed, prototyped, and tested an electromechanical two-position actuating mechanism.</li>
                    <li>Engineered and validated designs with first principles, deflection calculations, FEA, and design failure mode analysis (DFMEA) to ensure optimal performance, reliability, and safety.</li>
                    <li>Created design drawings and prototype concepts using CAD and GD&T for manufacturing and assembly.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Sentien Robotics
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                      <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        Mechanical Engineering Contractor
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      January 2023 – May 2024
                    </div>
                  </div>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>Designed and prototyped a planar cable robot, including a robust winch system running at up to 3000 RPM, to reliably catch mid-flight automated drones landing at 20 mph.</li>
                    <li>Validated and manufactured designs using SolidWorks, 3D printed prototypes, and structural design analysis to improve function and reliability.</li>
                    <li>Increased winch reliability 2x through uniform winding distribution mechanisms.</li>
                    <li>Managed cross-functional team communication and project timelines to ensure successful execution.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Inductive Robotics
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                      <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        Mechanical Engineering Intern
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      June 2024 – September 2024
                    </div>
                  </div>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>Engineered autonomous robotic charging system prototype using Onshape and FEA to design and integrate high-voltage components, battery pack, robotic arm mechanisms, and sheet metal enclosures into a cohesive system.</li>
                    <li>Designed parts for manufacturing, creating engineering and welding fabrication drawings for accurate service.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Group14 Technologies
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                      <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        Mechanical Engineering Intern
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      May 2024 – August 2024
                    </div>
                  </div>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>Designed custom mechanical parts using SolidWorks, FEA, and DFM to improve the effectiveness of material manufacturing inspection processes.</li>
                    <li>Increased sensor compatibility and inspection visibility by 90% with custom attachment plates.</li>
                    <li>Led Management of Change (MOC) process meetings & documentation for smooth project implementation.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Raise Robotics
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                      <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        Mechanical Engineering Intern
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      May 2023 – August 2023
                    </div>
                  </div>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>Designed modular robotic gripper to reliably hold and position 5 lb aluminum brackets during automated construction tasks; created design drawings and fabrication plans.</li>
                    <li>Developed stability outrigger system for 1500 lb construction robot. Used dynamic simulation to determine optimal geometry and attachment structure for increased strength and stability.</li>
                    <li>Modified and created robot assemblies with 700+ parts for URDF in CAD, improving model mates, geometries, and mass/material assignments for increased robot simulation accuracy.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div>
                      <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Re:Build Manufacturing
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                      <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        Mechanical / Manufacturing Engineering Intern
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      August 2022 – October 2022
                    </div>
                  </div>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <li>Designed and implemented fixtures and jigs for electric outboard motor assembly line, improving assembly efficiency by reducing step complexity and improving ergonomics.</li>
                    <li>Documented and developed high-fidelity work instructions for 20+ step assembly processes, creating 3D and 2D assembly drawings to improve efficiency and reduce assembly errors.</li>
                  </ul>
                </div>

              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                <Award size={16} className="text-slate-700 dark:text-slate-300" />
                <h2 className="text-sm font-mono font-bold tracking-wider uppercase text-slate-900 dark:text-slate-100">
                  Leadership & Activities
                </h2>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div>
                    <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                      Surge Electric Motorcycles
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                    <span className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      Lead Powertrain Engineer
                    </span>
                  </div>
                  <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    August 2024 – June 2025
                  </div>
                </div>
                <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>Led design, prototyping, and manufacturing of powertrain for motorcycle electrification.</li>
                  <li>Conducted motor & drive ratio selection, structural analysis, and bracket design for ideal implementation.</li>
                </ul>
              </div>
            </section>
          </div>
          */}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};