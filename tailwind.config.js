/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        ink: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        volt: 'rgb(var(--accent) / <alpha-value>)',
        'volt-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
      },
      borderColor: { DEFAULT: 'rgb(var(--line))', line: 'rgb(var(--line))' },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      letterSpacing: { tightest: '-0.045em' },
      maxWidth: { canvas: '1200px' },
    },
  },
  plugins: [],
};
