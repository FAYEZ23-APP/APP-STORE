import { create } from 'twrnc';

/**
 * Centralized twrnc instance synchronized 1:1 with admin-web/src/index.css.
 *
 * Brand Palette:
 * - Primary Deep Egyptian Red: #C8102E (replaces legacy orange-500/600)
 * - Secondary Dark Charcoal:   #1F2329 (replaces legacy slate-900)
 * - Warm Surface Background:   #FAF8F5 (replaces legacy slate-50)
 * - Calm Gold Accent:          #D6A33A (replaces legacy amber-500)
 * - Warm Neutral Borders:      #ECE9E6 / #D8D4CF (replaces legacy slate-200/300)
 */
const tw = create({
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#C8102E',
          hover: '#A80D26',
          soft: '#FDF2F4',
          border: '#F8CAD1',
        },
        secondary: {
          DEFAULT: '#1F2329',
          hover: '#14171B',
          light: '#2D323B',
          border: '#3A3F4A',
        },
        'brand-bg': '#FAF8F5',
        'brand-card': '#FFFFFF',
        accent: {
          DEFAULT: '#D6A33A',
          hover: '#C08F2D',
          soft: '#FBF6EC',
          border: '#EBD6A7',
          text: '#8A5A00',
        },
        neutral: {
          DEFAULT: '#ECE9E6',
          dark: '#D8D4CF',
          text: '#595F69',
        },
        orange: {
          50: '#FDF2F4',
          100: '#FBE4E8',
          200: '#F8CAD1',
          300: '#F099A7',
          400: '#E24863',
          500: '#C8102E',
          600: '#A80D26',
          700: '#8D0A1F',
          800: '#750A1B',
          900: '#620A17',
          950: '#3B030D',
        },
        amber: {
          50: '#FBF6EC',
          100: '#F6EAD0',
          200: '#EBD6A7',
          300: '#E5B44E',
          400: '#E5B44E',
          500: '#D6A33A',
          600: '#C08F2D',
          700: '#8A5A00',
          800: '#714800',
          900: '#5C3A00',
        },
        slate: {
          50: '#FAF8F5',
          100: '#F3F0EC',
          200: '#ECE9E6',
          300: '#D8D4CF',
          400: '#8C929B',
          500: '#595F69',
          600: '#454B54',
          700: '#2D323B',
          800: '#252A32',
          900: '#1F2329',
          950: '#14171B',
        },
      },
    },
  },
});

export default tw;
