/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Electric Violet theme - Premium music archiver
        primary: {
          DEFAULT: '#8B5CF6',
          dark: '#7C3AED',
          light: '#A78BFA',
        },
        accent: {
          DEFAULT: '#F472B6',
          dark: '#EC4899',
        },
        background: {
          DEFAULT: '#0A0A0B',
          card: '#1E1E24',
          elevated: '#2A2A32',
        },
        surface: {
          DEFAULT: '#121214',
          light: '#1E1E24',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#A1A1AA',
          muted: '#71717A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
