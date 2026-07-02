/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:             '#fafaf9',
        surface:        '#ffffff',
        canvas:         '#a8a39d',
        border:         '#e7e5e4',
        'border-strong':'#d6d3d1',
        text:           '#1c1917',
        'text-2':       '#78716c',
        'text-3':       '#a8a29e',
        accent:         '#18181b',
        'accent-hover': '#27272a',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'PingFang SC', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs':   ['10px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'sm':   ['12px', { lineHeight: '1.5' }],
        'base': ['13px', { lineHeight: '1.5' }],
        'lg':   ['14px', { lineHeight: '1.4' }],
        'xl':   ['16px', { lineHeight: '1.3' }],
        '2xl':  ['20px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        '3xl':  ['24px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        '4xl':  ['32px', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
      },
      boxShadow: {
        'card': '0 1px 2px rgba(28,25,23,0.04), 0 1px 3px rgba(28,25,23,0.06)',
        'elev': '0 4px 12px rgba(28,25,23,0.08), 0 1px 3px rgba(28,25,23,0.04)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        'fast': '150ms',
      },
    },
  },
  plugins: [],
}
