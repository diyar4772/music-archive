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
        // Spotify-inspired dark theme
        primary: {
          DEFAULT: '#1DB954',
          dark: '#1AA34A',
          light: '#1ED760',
        },
        background: {
          DEFAULT: '#121212',
          card: '#181818',
          elevated: '#282828',
        },
        surface: {
          DEFAULT: '#282828',
          light: '#3E3E3E',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#B3B3B3',
          muted: '#727272',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
