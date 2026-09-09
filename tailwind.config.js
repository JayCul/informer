/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0D0E',
        surface: '#131617',
        line: 'rgba(255,255,255,0.10)',
        bone: '#F5F5F0',
        muted: '#8F9496',
        volt: '#C7FF3D',
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      letterSpacing: { tightest: '-0.045em' },
      maxWidth: { canvas: '1440px' },
    },
  },
  plugins: [],
};
