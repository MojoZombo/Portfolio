import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

interface CompanyLogoProps {
  company?: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  company,
  logoUrl,
  size = 'md',
  className = '',
}) => {
  const [hasImageError, setHasImageError] = useState(false);

  if (!company) return null;

  const sizeClasses = {
    sm: 'h-4 w-4 text-[10px]',
    md: 'h-5 w-5 text-xs',
    lg: 'h-7 w-7 text-sm',
  };

  const badgeSizeClasses = {
    sm: 'text-[11px] gap-1.5 px-2 py-0.5',
    md: 'text-xs gap-2 px-2.5 py-1',
    lg: 'text-sm gap-2.5 px-3.5 py-1.5',
  };

  // Render dedicated SVG brand icons
  const renderBrandIcon = () => {
    if (logoUrl && !hasImageError) {
      return (
        <img
          src={logoUrl}
          alt={`${company} logo`}
          className={`${sizeClasses[size]} object-contain rounded-sm shrink-0 bg-white/10`}
          onError={() => setHasImageError(true)}
          loading="lazy"
        />
      );
    }

    const compLower = company.toLowerCase();

    if (compLower.includes('berkeley')) {
      // UC Berkeley Blue & Gold California script seal
      return (
        <span className="flex items-center justify-center font-serif font-black text-[#003262] dark:text-[#FDB515] text-[12px] leading-none shrink-0 px-0.5 select-none tracking-tight">
          Cal
        </span>
      );
    }

    if (compLower.includes('sentien')) {
      // Sentien Robotics tech beacon
      return (
        <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-blue-500 fill-current shrink-0`}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" opacity="0.8" />
          <polyline points="2 17 12 22 22 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="2 12 12 17 22 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (compLower.includes('raise')) {
      // Raise Robotics heavy construction tech
      return (
        <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-amber-500 fill-current shrink-0`}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <polyline points="3 17 7 17 7 21" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    }

    if (compLower.includes('taflab')) {
      // TAFLab Wave dynamics
      return (
        <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-cyan-500 fill-none stroke-current stroke-2 shrink-0`}>
          <path d="M2 12c3-4 6-4 9 0s6 4 9 0" strokeLinecap="round" />
          <path d="M2 17c3-4 6-4 9 0s6 4 9 0" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    }

    if (compLower.includes('first') || compLower.includes('ftc')) {
      // FIRST Robotics triangle/circle/square
      return (
        <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-red-500 fill-current shrink-0`}>
          <polygon points="12 3 4 19 20 19" fill="#2563eb" opacity="0.9" />
          <circle cx="12" cy="13" r="3.5" fill="#ef4444" />
        </svg>
      );
    }

    if (compLower.includes('robosub') || compLower.includes('underwater')) {
      // RoboSub marine icon
      return (
        <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-emerald-500 fill-none stroke-current stroke-2 shrink-0`}>
          <circle cx="12" cy="12" r="8" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      );
    }

    return <Building2 size={14} className="text-slate-400 shrink-0" />;
  };

  return (
    <div
      className={`inline-flex items-center font-mono font-medium rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur ${badgeSizeClasses[size]} ${className}`}
    >
      {renderBrandIcon()}
      <span className="tracking-tight">{company}</span>
    </div>
  );
};
