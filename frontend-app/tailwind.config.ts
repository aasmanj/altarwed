import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FDFAF5',
        gold: {
          DEFAULT: '#C9A84C',
          dark: '#A8893A',
          light: '#E8D5A3',
        },
        brown: {
          DEFAULT: '#3D2B1F',
          light: '#6B4C3B',
        },
        sage: '#7A9E7E',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
