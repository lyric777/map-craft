/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        panel: 'var(--color-panel)',
        panelAlt: 'var(--color-panel-alt)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        subtle: 'var(--color-subtle)',
        danger: 'var(--color-danger)',
        dangerSoft: 'var(--color-danger-soft)',
        dangerBorder: 'var(--color-danger-border)',
        overlay: 'var(--color-overlay)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
      },
    },
  },
  plugins: [],
};
