/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 基础色板（Stone 暖灰）
        surface:        '#ffffff',            // 卡片、侧栏、按钮背景
        canvas:         '#f5f5f4',            // 预览区主背景（近白，参考 Copicseal）
        'canvas-soft':  '#fafaf9',            // 画布浅色层
        border:         '#e7e5e4',            // 普通边框
        'border-strong':'#d6d3d1',            // 强调边框
        // 文字层级
        text:           '#1c1917',            // 主文字
        'text-2':       '#78716c',            // 次文字
        'text-3':       '#6d6b68',            // 弱文字 / caption（WCAG AA 4.5:1+）
        // 强调色（统一中性黑）
        accent:         '#18181b',
        'accent-hover': '#27272a',
        // 遮罩
        overlay:        'rgba(28, 25, 23, 0.05)',   // 浅色压暗层
        'overlay-dark': 'rgba(28, 25, 23, 0.55)',   // 深色遮罩
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
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
        'card': '0 1px 2px rgba(28,25,23,0.06), 0 1px 3px rgba(28,25,23,0.08)',
        'elev': '0 4px 16px rgba(28,25,23,0.10), 0 1px 3px rgba(28,25,23,0.06)',
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
