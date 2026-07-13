/** Tailwind configurado con los tokens del Design System NodeKeeper.
 *  Las clases utilitarias (p. ej. bg-navy-900, text-blue-600) quedan disponibles,
 *  pero el sistema visual se aplica principalmente vía las clases .nk-* de
 *  src/styles/global.css para no desviarse del Design System.  */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#0F1F4F', 900: '#17307A', 800: '#2A4185', 700: '#415592', 600: '#6172A5', 500: '#8B97BD' },
        blue: { 800: '#173E86', 700: '#1B4FA8', 600: '#2563C9', 500: '#3B7DE0', 400: '#6BA0EC', 200: '#BCD4F7', 100: '#DCE8FB', 50: '#EEF4FE' },
        gray: { 950: '#0D141C', 900: '#111A24', 800: '#1F2A36', 700: '#33404E', 600: '#4B5969', 500: '#67768A', 400: '#97A4B2', 300: '#C7D0DA', 200: '#DDE3EA', 150: '#E6EBF0', 100: '#EDF1F5', 50: '#F6F8FA' },
        green: { 700: '#0E7A41', 600: '#15924F', 500: '#22A862', 100: '#DBF1E4', 50: '#ECF8F1' },
        amber: { 700: '#A8650A', 600: '#C77A0A', 500: '#E2941C', 100: '#FBEAD0', 50: '#FCF4E5' },
        red: { 700: '#B22B2B', 600: '#D23B3B', 500: '#E45A5A', 100: '#FAE0E0', 50: '#FCEDED' },
      },
      fontFamily: {
        display: ['Homepage Baukasten', 'Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', pill: '999px' },
    },
  },
  plugins: [],
};
