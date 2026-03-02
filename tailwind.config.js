/** @type {import('tailwindcss').Config} */
export default {
  // Включаем ручное управление тёмной темой
  darkMode: 'class', 
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}