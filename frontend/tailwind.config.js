/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f0ff',
          100: '#e3e3ff',
          200: '#c9c9ff',
          300: '#a8a4ff',
          400: '#8b7bff',
          500: '#6f5cf5',
          600: '#5a3fe0',
          700: '#4a30c2',
          800: '#3c2899',
          900: '#2c1e6e',
        },
        accent: {
          pink: '#ff5fa2',
          orange: '#ff9f5a',
          teal: '#14c8b0',
          blue: '#3aa0ff',
          yellow: '#ffc94d',
          green: '#34d399',
        },
        zoho: {
          nav: '#1a1233',
          sidebar: '#1f1547',
          border: '#e7e5fb',
          text: '#2c2a3a',
          muted: '#7c7a93',
        },
      },
      fontFamily: {
        sans: ['Zoho_Puvi', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6f5cf5 0%, #9b5cf5 50%, #ff5fa2 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #f0f0ff 0%, #ffeef7 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, #241a4f 0%, #1a1233 100%)',
        'mesh-bg': 'radial-gradient(at 0% 0%, rgba(111,92,245,0.08) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(255,95,162,0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(20,200,176,0.06) 0px, transparent 50%)',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(60, 40, 150, 0.06)',
        card: '0 4px 20px rgba(60, 40, 150, 0.08)',
        'card-hover': '0 8px 30px rgba(60, 40, 150, 0.14)',
        glow: '0 0 0 4px rgba(111, 92, 245, 0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: 0, transform: 'scale(0.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(111,92,245,0.3)' }, '50%': { boxShadow: '0 0 0 6px rgba(111,92,245,0)' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.25s ease-out',
        scaleIn: 'scaleIn 0.18s ease-out',
        shimmer: 'shimmer 1.6s infinite linear',
        pulseGlow: 'pulseGlow 2s infinite',
      },
    },
  },
  plugins: [],
};
