import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import berkeleyLogoImg from '../assets/logos/berkeley-logo.png';
import raiseLogoImg from '../assets/logos/raise-robotics-logo.png';
import robosubLogoImg from '../assets/logos/robosub-logo.png';
import ftcLogoImg from '../assets/logos/ftc-logo.png';
import teslaLogoImg from '../assets/logos/tesla-logo.png';

interface CompanyLogoProps {
  company?: string;
  logoUrl?: string;
  companyUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const DEFAULT_COMPANY_URLS: Record<string, string> = {
  tesla: 'https://www.tesla.com',
  inductive: 'https://www.inductiverobotics.com',
  'inductive robotics': 'https://www.inductiverobotics.com',
  berkeley: 'https://www.berkeley.edu',
  'uc berkeley': 'https://www.berkeley.edu',
  'taflab (uc berkeley)': 'https://taflab.berkeley.edu',
  taflab: 'https://taflab.berkeley.edu',
  'robusub (uc berkeley)': 'https://www.berkeley.edu',
  sentien: 'https://www.sentienrobotics.com',
  'sentien robotics': 'https://www.sentienrobotics.com',
  raise: 'https://raiserobotics.ai/',
  'raise robotics': 'https://raiserobotics.ai/',
  'first tech challenge': 'https://www.firstinspires.org/robotics/ftc',
  'first robotics': 'https://www.firstinspires.org',
  ftc: 'https://www.firstinspires.org/robotics/ftc',
};

const DEFAULT_COMPANY_LOGOS: Record<string, string> = {
  berkeley: berkeleyLogoImg,
  'uc berkeley': berkeleyLogoImg,
  'taflab (uc berkeley)': berkeleyLogoImg,
  taflab: berkeleyLogoImg,
  robosub: robosubLogoImg,
  'robosub (uc berkeley)': robosubLogoImg,
  raise: raiseLogoImg,
  'raise robotics': raiseLogoImg,
  tesla: teslaLogoImg,
  inductive: '/images/logos/inductive-robotics-logo.svg',
  'inductive robotics': '/images/logos/inductive-robotics-logo.svg',
  'first tech challenge': ftcLogoImg,
  ftc: ftcLogoImg,
};

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  company,
  logoUrl,
  companyUrl,
  size = 'md',
  className = '',
}) => {
  const [hasImageError, setHasImageError] = useState(false);

  const compLower = (company || '').toLowerCase().trim();
  const isTesla = compLower.includes('tesla');
  const isInductive = compLower.includes('inductive');
  const isSentien = compLower.includes('sentien');
  const isRaise = compLower.includes('raise');
  const isRoboSub = compLower.includes('robosub') || compLower.includes('underwater');
  const isBerkeley = !isRoboSub && (compLower.includes('berkeley') || compLower.includes('cal'));
  const isFTC = compLower.includes('first') || compLower.includes('ftc');

  // Resolve brand logo image URL with direct imported assets guaranteed
  let effectiveLogoUrl = logoUrl;
  if (isTesla) {
    effectiveLogoUrl = teslaLogoImg;
  } else if (isRoboSub) {
    effectiveLogoUrl = robosubLogoImg;
  } else if (isFTC) {
    effectiveLogoUrl = ftcLogoImg;
  } else if (isRaise) {
    effectiveLogoUrl = raiseLogoImg;
  } else if (isBerkeley) {
    effectiveLogoUrl = berkeleyLogoImg;
  } else if (!effectiveLogoUrl) {
    effectiveLogoUrl =
      DEFAULT_COMPANY_LOGOS[compLower] ||
      Object.entries(DEFAULT_COMPANY_LOGOS).find(([key]) => compLower.includes(key))?.[1];
  }

  useEffect(() => {
    setHasImageError(false);
  }, [effectiveLogoUrl, company]);

  if (!company) return null;

  const sizeClasses = {
    sm: 'h-[22px] w-[22px] min-w-[22px] min-h-[22px] text-[11px]',
    md: 'h-[26px] w-[26px] min-w-[26px] min-h-[26px] text-xs',
    lg: 'h-[34px] w-[34px] min-w-[34px] min-h-[34px] text-sm',
  };

  const badgeSizeClasses = {
    sm: 'text-[11px] sm:text-xs pl-1.5 pr-2.5 py-1 gap-2',
    md: 'text-xs sm:text-sm pl-2 pr-3 py-1.5 gap-2.5',
    lg: 'text-sm sm:text-base pl-2.5 pr-4 py-2 gap-3',
  };

  // Resolve company website URL
  const resolvedUrl =
    companyUrl ||
    DEFAULT_COMPANY_URLS[compLower] ||
    Object.entries(DEFAULT_COMPANY_URLS).find(([key]) => compLower.includes(key))?.[1];

  // Render dedicated brand icons & cropped badges
  const renderBrandIcon = () => {
    if (effectiveLogoUrl && !hasImageError) {
      let containerBg = 'bg-white/10 dark:bg-white/10';
      let imgFit = 'object-contain';
      let imgScale = 'scale-100';

      if (isTesla || isInductive || isRaise || isFTC) {
        containerBg = 'bg-white';
        imgFit = 'object-contain';
        imgScale = 'scale-100';
      } else if (isRoboSub) {
        // Deep Berkeley Navy background matching RoboSub logo
        containerBg = 'bg-[#000056]';
        imgFit = 'object-contain';
        imgScale = 'scale-100';
      } else if (isSentien) {
        // Enlarge and crop the Sentien logo to eliminate inner curved corner gaps
        containerBg = 'bg-white';
        imgFit = 'object-cover';
        imgScale = 'scale-[1.35]';
      } else if (isBerkeley) {
        // Berkeley favicon on Berkeley Blue background
        containerBg = 'bg-[#003262]';
        imgFit = 'object-contain';
        imgScale = 'scale-100';
      }

      return (
        <div
          className={`${sizeClasses[size]} ${containerBg} p-0.5 rounded-sm aspect-square overflow-hidden flex items-center justify-center shrink-0`}
        >
          <img
            src={effectiveLogoUrl}
            alt={`${company} logo`}
            className={`w-full h-full ${imgFit} ${imgScale} rounded-sm transition-transform`}
            onError={() => setHasImageError(true)}
            loading="eager"
          />
        </div>
      );
    }

    if (isBerkeley) {
      // UC Berkeley Blue & Gold California script seal
      return (
        <div className={`${sizeClasses[size]} bg-[#003262] rounded-sm aspect-square flex items-center justify-center shrink-0`}>
          <span className="font-serif font-black text-[#FDB515] text-[11px] leading-none select-none tracking-tight">
            Cal
          </span>
        </div>
      );
    }

    if (compLower.includes('sentien')) {
      // Sentien Robotics tech beacon
      return (
        <div className={`${sizeClasses[size]} bg-white rounded-sm p-0.5 aspect-square flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-full h-full text-blue-600 fill-current">
            <polygon points="12 2 2 7 12 12 22 7 12 2" opacity="0.8" />
            <polyline points="2 17 12 22 22 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="2 12 12 17 22 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    }

    if (compLower.includes('raise')) {
      // Raise Robotics heavy construction tech
      return (
        <div className={`${sizeClasses[size]} bg-white rounded-sm p-0.5 aspect-square flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-full h-full text-amber-500 fill-current">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <polyline points="3 17 7 17 7 21" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    if (compLower.includes('taflab')) {
      // TAFLab Wave dynamics
      return (
        <div className={`${sizeClasses[size]} bg-slate-900/40 rounded-sm p-0.5 aspect-square flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-full h-full text-cyan-500 fill-none stroke-current stroke-2">
            <path d="M2 12c3-4 6-4 9 0s6 4 9 0" strokeLinecap="round" />
            <path d="M2 17c3-4 6-4 9 0s6 4 9 0" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
      );
    }

    if (compLower.includes('first') || compLower.includes('ftc')) {
      // FIRST Robotics triangle/circle/square
      return (
        <div className={`${sizeClasses[size]} bg-white rounded-sm p-0.5 aspect-square flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-full h-full text-red-500 fill-current">
            <polygon points="12 3 4 19 20 19" fill="#2563eb" opacity="0.9" />
            <circle cx="12" cy="13" r="3.5" fill="#ef4444" />
          </svg>
        </div>
      );
    }

    if (compLower.includes('robosub') || compLower.includes('underwater')) {
      // RoboSub marine icon
      return (
        <div className={`${sizeClasses[size]} bg-slate-900/40 rounded-sm p-0.5 aspect-square flex items-center justify-center shrink-0`}>
          <svg viewBox="0 0 24 24" className="w-full h-full text-emerald-500 fill-none stroke-current stroke-2">
            <circle cx="12" cy="12" r="8" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </div>
      );
    }

    return <Building2 size={16} className="text-slate-400 shrink-0" />;
  };

  const badgeContent = (
    <>
      {renderBrandIcon()}
      <span className="tracking-tight leading-none transition-colors duration-150 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-active:text-blue-700 dark:group-active:text-blue-300">
        {company}
      </span>
    </>
  );

  if (resolvedUrl) {
    return (
      <a
        href={resolvedUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Visit ${company} website (${resolvedUrl})`}
        className={`group inline-flex items-center font-mono font-medium rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 backdrop-blur transition-colors cursor-pointer select-none ${badgeSizeClasses[size]} ${className}`}
      >
        {badgeContent}
      </a>
    );
  }

  return (
    <div
      className={`inline-flex items-center font-mono font-medium rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 backdrop-blur ${badgeSizeClasses[size]} ${className}`}
    >
      {badgeContent}
    </div>
  );
};
