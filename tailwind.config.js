/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#101317',
        panel: '#171c22',
        panelAlt: '#1d242d',
        border: '#2d3744',
        accent: '#45c4ff',
      },
      boxShadow: {
        panel: '0 8px 24px rgba(0, 0, 0, 0.24)',
      },
    },
  },
  plugins: [],
};
