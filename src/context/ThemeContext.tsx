import React, { createContext, useContext, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (event?: React.MouseEvent | MouseEvent | { clientX: number; clientY: number }) => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('cad-theme-v2');
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    
    // Clear inline styles that were set by the FOUC prevention script in index.html
    root.style.backgroundColor = '';
    document.body.style.backgroundColor = '';
    
    localStorage.setItem('cad-theme-v2', theme);
    localStorage.setItem('cad-theme', theme);
  }, [theme]);

  const toggleTheme = (event?: React.MouseEvent | MouseEvent | { clientX: number; clientY: number }) => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    // If View Transitions API is not supported or user prefers reduced motion, switch directly
    if (
      typeof document === 'undefined' ||
      !('startViewTransition' in document) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setTheme(nextTheme);
      return;
    }

    // Determine circular expansion origin (x, y) starting directly from the pressed button
    let x = window.innerWidth - 48;
    let y = 48;

    if (event) {
      if ('currentTarget' in event && event.currentTarget instanceof HTMLElement) {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else if ('clientX' in event && event.clientX !== undefined && event.clientY !== undefined && (event.clientX > 0 || event.clientY > 0)) {
        x = event.clientX;
        y = event.clientY;
      }
    }

    // Calculate maximum radius to furthest screen corner so circle covers the whole viewport
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration: 540,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
