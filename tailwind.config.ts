import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        oliva: {
          50: '#f6f7f0',
          100: '#e9ecd9',
          200: '#d4dab6',
          300: '#b7c28c',
          400: '#9caa68',
          500: '#7f8f4b',
          600: '#65783e',
          700: '#4d5c31',
          800: '#3f4a2b',
          900: '#363f27',
        },
        // Neutros cálidos: pegan con el aceite, el gris azulado no.
        piedra: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
        exito: '#15803d',
        aviso: '#b45309',
        error: '#b91c1c',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        suave: '0 1px 2px rgb(28 25 23 / 0.04), 0 2px 8px rgb(28 25 23 / 0.04)',
        media: '0 2px 4px rgb(28 25 23 / 0.05), 0 8px 24px rgb(28 25 23 / 0.07)',
      },
    },
  },
  plugins: [],
}

export default config
