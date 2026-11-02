/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#E53935',
          600: '#d32f2f',
          700: '#c62828',
          800: '#b71c1c',
          900: '#7f0000',
        },
        accent: {
          pink: '#d9799f',
          orange: '#e3995e',
          teal: '#3eb3a3',
          blue: '#5e93d6',
          yellow: '#e3bb5e',
          green: '#5cb583',
        },
        zoho: {
          nav: '#000000',
          sidebar: '#000000',
          border: '#e0e0e0',
          text: '#000000',
          muted: '#616161',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #E53935 0%, #c62828 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #ffebee 0%, #ffffff 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, #111111 0%, #000000 100%)',
        'mesh-bg': 'radial-gradient(at 0% 0%, rgba(229,57,53,0.05) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(0,0,0,0.03) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(229,57,53,0.04) 0px, transparent 50%)',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0, 0, 0, 0.06)',
        card: '0 2px 12px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 6px 20px rgba(0, 0, 0, 0.12)',
        glow: '0 0 0 3px rgba(229, 57, 53, 0.18)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: 0, transform: 'scale(0.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        slideInRight: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(229,57,53,0.25)' }, '50%': { boxShadow: '0 0 0 6px rgba(229,57,53,0)' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.25s ease-out',
        scaleIn: 'scaleIn 0.18s ease-out',
        slideInRight: 'slideInRight 0.25s ease-out',
        shimmer: 'shimmer 1.6s infinite linear',
        pulseGlow: 'pulseGlow 2s infinite',
      },
    },
  },
  plugins: [],
};
