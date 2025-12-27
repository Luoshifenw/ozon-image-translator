/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        aether: {
          main: '#ffffff',
          accent: '#FCCD2A', // Vivid Yellow
          dark: '#0F172A',   // Deep Blue/Slate
          text: '#334155',   // Slate 700
          light: '#F8FAFC',
        }
      },
      boxShadow: {
        'blueprint': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'blueprint-lg': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'float': '0 20px 40px -10px rgba(0, 0, 0, 0.05)',
        'float-lg': '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 20px rgba(252, 205, 42, 0.3)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
