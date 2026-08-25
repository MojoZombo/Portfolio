/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cad: {
          bg: '#0A0E14',
          surface: '#111722',
          card: '#161F2E',
          border: '#1E293B',
          line: '#334155',
          accent: '#38BDF8',
          orange: '#F97316',
          green: '#22C55E',
          red: '#EF4444',
          yellow: '#EAB308',
        },
        paper: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          card: '#F1F5F9',
          border: '#E2E8F0',
          line: '#CBD5E1',
          accent: '#0284C7',
          orange: '#EA580C',
          green: '#16A34A',
          red: '#DC2626',
          yellow: '#CA8A04',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Roboto Mono', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
