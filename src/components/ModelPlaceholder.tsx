import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

interface ModelPlaceholderProps {
  modelType: string;
  isActive?: boolean;
  isHovered?: boolean;
  className?: string;
}

export const ModelPlaceholder: React.FC<ModelPlaceholderProps> = ({
  modelType,
  isActive = false,
  className = 'h-[480px] sm:h-[560px] w-full',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Check if we have pre-rendered static poster assets
  // Defaulting to clean procedural SVG/Canvas technical isometric projection
  const blueprintStroke = isDark ? '#94A8C4' : '#1E293B';
  const blueprintFill = isDark ? '#233247' : '#F8FAFC';

  // Render dedicated blueprint isometric wireframe per model
  const renderIsometricBlueprint = () => {
    switch (modelType) {
      case 'robot-hand':
        return (
          <svg viewBox="0 0 400 400" className="w-full h-full max-w-[340px] max-h-[340px] drop-shadow-sm">
            {/* Wrist / Palm base mount */}
            <path
              d="M160 280 L240 280 L255 330 L145 330 Z"
              fill={blueprintFill}
              stroke={blueprintStroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Palm Structure */}
            <path
              d="M140 190 L260 190 L240 280 L160 280 Z"
              fill={blueprintFill}
              stroke={blueprintStroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Thumb */}
            <path
              d="M140 210 L95 180 L80 195 L125 240 Z"
              fill={blueprintFill}
              stroke={blueprintStroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Index Finger */}
            <path
              d="M150 190 L150 100 L168 100 L168 190 Z"
              fill={blueprintFill}
              stroke={blueprintStroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Middle Finger */}
            <path
              d="M178 190 L178 80 L196 80 L196 190 Z"
              fill={blueprintFill}
              stroke={blueprintStroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Ring Finger */}
            <path
              d="M206 190 L206 95 L224 95 L224 190 Z"
              fill={blueprintFill}
              stroke={blueprintStroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Pinky Finger */}
            <path
              d="M234 190 L234 125 L250 125 L250 190 Z"
              fill={blueprintFill}
              stroke={blueprintStroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Technical CAD Centerlines */}
            <line x1="200" y1="50" x2="200" y2="350" stroke={blueprintStroke} strokeWidth="0.75" strokeDasharray="6,4" opacity="0.4" />
            <line x1="60" y1="200" x2="340" y2="200" stroke={blueprintStroke} strokeWidth="0.75" strokeDasharray="6,4" opacity="0.4" />
          </svg>
        );

      case 'cable-robot-2':
      case 'drone-catch':
        return (
          <svg viewBox="0 0 400 400" className="w-full h-full max-w-[340px] max-h-[340px] drop-shadow-sm">
            {/* 4 Corner Pulleys & Gantry Structure */}
            <rect x="70" y="70" width="260" height="260" rx="4" fill="none" stroke={blueprintStroke} strokeWidth="1.5" />
            {/* Corner Motor Pods */}
            <circle cx="70" cy="70" r="16" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            <circle cx="330" cy="70" r="16" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            <circle cx="70" cy="330" r="16" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            <circle cx="330" cy="330" r="16" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            {/* Cables */}
            <line x1="70" y1="70" x2="180" y2="180" stroke={blueprintStroke} strokeWidth="1" strokeDasharray="3,3" />
            <line x1="330" y1="70" x2="220" y2="180" stroke={blueprintStroke} strokeWidth="1" strokeDasharray="3,3" />
            <line x1="70" y1="330" x2="180" y2="220" stroke={blueprintStroke} strokeWidth="1" strokeDasharray="3,3" />
            <line x1="330" y1="330" x2="220" y2="220" stroke={blueprintStroke} strokeWidth="1" strokeDasharray="3,3" />
            {/* Central End-Effector Payload */}
            <rect x="175" y="175" width="50" height="50" rx="4" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.75" />
            <circle cx="200" cy="200" r="8" fill="none" stroke={blueprintStroke} strokeWidth="1.5" />
          </svg>
        );

      case 'catamaran':
        return (
          <svg viewBox="0 0 400 400" className="w-full h-full max-w-[340px] max-h-[340px] drop-shadow-sm">
            {/* Port & Starboard Pontoons */}
            <path d="M100 80 C100 60, 130 60, 130 80 L130 320 C130 340, 100 340, 100 320 Z" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            <path d="M270 80 C270 60, 300 60, 300 80 L300 320 C300 340, 270 340, 270 320 Z" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            {/* Crossbeam Deck */}
            <rect x="130" y="160" width="140" height="80" rx="2" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            {/* Rigid Wingsail */}
            <path d="M190 60 L210 60 L210 240 L190 240 Z" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.75" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 400 400" className="w-full h-full max-w-[340px] max-h-[340px] drop-shadow-sm">
            {/* Generic Isometric Cube & Mechanism Blueprint */}
            <path d="M200 80 L320 150 L200 220 L80 150 Z" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            <path d="M80 150 L200 220 L200 340 L80 270 Z" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            <path d="M320 150 L200 220 L200 340 L320 270 Z" fill={blueprintFill} stroke={blueprintStroke} strokeWidth="1.5" />
            <circle cx="200" cy="150" r="28" fill="none" stroke={blueprintStroke} strokeWidth="1.2" strokeDasharray="4,3" />
          </svg>
        );
    }
  };

  return (
    <div className={`relative ${className} select-none flex items-center justify-center overflow-visible`}>
      {/* Animated container for spinning preview when active */}
      <motion.div
        animate={isActive ? { rotateY: [0, 360] } : { rotateY: 0 }}
        transition={isActive ? { repeat: Infinity, duration: 10, ease: 'linear' } : { duration: 0 }}
        className="w-full h-full flex items-center justify-center pointer-events-none"
      >
        {renderIsometricBlueprint()}
      </motion.div>
    </div>
  );
};
