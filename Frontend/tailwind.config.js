/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#0a0a0a',
          100: '#1a1a1a',
          200: '#272727',
        },
        brand: {
          orange: '#FF6B35',
          burgundy: '#5D1725',
        },
      },
      boxShadow: {
        'orange-sm': '0 0 10px rgba(255, 107, 53, 0.15)',
        'orange-md': '0 0 20px rgba(255, 107, 53, 0.25)',
        'orange-lg': '0 0 40px rgba(255, 107, 53, 0.4)',
        'orange-xl': '0 0 60px rgba(255, 107, 53, 0.5)',
      },
      fontFamily: {
        // Clash Display — editorial, geometric, jaw-dropping headlines
        display: ['"Clash Display"', 'system-ui', 'sans-serif'],
        // Cabinet Grotesk — personality-rich sub-heads & labels
        heading: ['"Cabinet Grotesk"', 'system-ui', 'sans-serif'],
        // Satoshi — refined, readable body copy
        body: ['Satoshi', 'system-ui', 'sans-serif'],
        // DM Mono — crisp mono for ticket numbers, counters, timestamps
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
        // Legacy alias kept so any font-display classes still work
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.02em',
        wide: '0.08em',
        wider: '0.15em',
        widest: '0.35em',
        'ultra-wide': '0.6em',
      },
    },
  },
  plugins: [],
};
