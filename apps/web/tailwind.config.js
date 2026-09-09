/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F3EF',
        surface: '#FFFFFF',
        border: '#E7E1D9',
        'border-hover': '#C9C0B5',
        divider: '#F0EBE4',
        text: '#1A1614',
        muted: '#7D7368',
        'muted-2': '#9A8F82',
        accent: '#E0651B',
        'accent-hover': '#C4530F',
        'accent-soft': '#FDF1E7',
      },
      fontFamily: {
        sans: ['Archivo', 'Helvetica', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
