/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/web/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
