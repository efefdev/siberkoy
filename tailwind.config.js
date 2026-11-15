/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

// Tema D — "Gece moru": lacivert-mor zemin, mor gotik başlıklar, camgöbeği terminal.
// Eski sayfalardaki gray/purple sınıfları da bu paletle otomatik uyumlu olsun diye yeniden eşlenir.
const night = {
  50: '#f4f3fe',
  100: '#ecebfc',
  200: '#e4e2fb', // ana metin
  300: '#c9c7e6',
  400: '#a5a3c9', // ikincil metin
  500: '#7d7aaa',
  600: '#55528a',
  700: '#2e2a6b', // kenarlık
  800: '#1b1738', // yükseltilmiş yüzey
  900: '#120f26', // panel
  950: '#0a0a16', // sayfa zemini
}

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        night,
        gray: night,
        purple: colors.violet,
        indigo: colors.violet,
        // Anlamsal tonlar
        // Değerler globals.css'teki CSS değişkenlerinden gelir: etkinlik teması (ör. Halloween)
        // <html data-theme="halloween"> ile tüm vurgu renklerini tek yerden değiştirir.
        hex: {
          violet: 'rgb(var(--hx-violet) / <alpha-value>)', // başlık / vurgu
          'violet-deep': 'rgb(var(--hx-violet-deep) / <alpha-value>)', // vurgu kenarlığı
          cyan: 'rgb(var(--hx-cyan) / <alpha-value>)', // terminal / birincil eylem
          blood: 'rgb(var(--hx-blood) / <alpha-value>)', // saldırgan, eleme, tehlike
          gold: 'rgb(var(--hx-gold) / <alpha-value>)', // kazanan, bonus
        },
      },
      fontFamily: {
        gothic: ['"Pirata One"', 'Georgia', 'serif'],
        mono: ['"Share Tech Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'caret-blink': { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgb(var(--hx-cyan) / 0.45)' }, '100%': { boxShadow: '0 0 0 10px rgb(var(--hx-cyan) / 0)' } },
        'float-slow': { '0%, 100%': { transform: 'translateY(0) rotate(var(--r, 0deg))' }, '50%': { transform: 'translateY(-10px) rotate(var(--r, 0deg))' } },
        'podium-rise': { from: { opacity: '0', transform: 'translateY(60px) scale(.96)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
      },
      animation: {
        'caret-blink': 'caret-blink 1s steps(1) infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
        'pulse-ring': 'pulse-ring 1.2s ease-out 2',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'podium-rise': 'podium-rise 0.9s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
}
