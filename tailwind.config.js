/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        darkBg: '#050810',
        emeraldAccent: '#00C853',
        goldAccent: '#FFAA00',
        cyanAccent: '#22D3EE',
        panelBg: 'rgba(10, 15, 26, 0.75)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}