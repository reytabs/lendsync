/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          border: 'hsl(var(--sidebar-border))',
          foreground: 'hsl(var(--sidebar-foreground))',
        },
        chart: {
          gold: '#D4A53C',
          teal: '#2DD4BF',
          purple: '#A78BFA',
          green: '#4ADE80',
          red: '#F87171',
          orange: '#F97316',
        },
      },
      fontFamily: {
        // Outfit is used for both display (headings) and body text; DM Mono for
        // numerics/tabular. Glyphs missing from these faces — e.g. the peso sign
        // ₱ (U+20B1) — fall back to system-ui, and are size-normalized via the
        // `.money-symbol` rule in globals.css.
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
