/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f4f6fb',
          100: '#e8edf7',
          200: '#ccd9f0',
          300: '#a3bce4',
          400: '#7a9bd6',
          500: '#5779c4',
          600: '#4561a8',
          700: '#394f8a',
          800: '#2f4070',
          900: '#28365c',
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
          nav: '#1f2330',
          sidebar: '#232838',
          border: '#e6e8ee',
          text: '#262b38',
          muted: '#8990a3',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #5779c4 0%, #7a9bd6 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #f4f6fb 0%, #eef1f8 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, #262c3d 0%, #1c2130 100%)',
        'mesh-bg': 'radial-gradient(at 0% 0%, rgba(87,121,196,0.05) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(126,179,163,0.04) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(87,121,196,0.04) 0px, transparent 50%)',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(38, 43, 56, 0.05)',
        card: '0 2px 12px rgba(38, 43, 56, 0.06)',
        'card-hover': '0 6px 20px rgba(38, 43, 56, 0.10)',
        glow: '0 0 0 3px rgba(87, 121, 196, 0.12)',
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
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(111,92,245,0.3)' }, '50%': { boxShadow: '0 0 0 6px rgba(111,92,245,0)' } },
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
