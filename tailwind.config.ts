import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'ap-blue': '#1E7AB8',
        'ap-blue-dark': '#155a8a',
        'ap-blue-light': '#e8f4fd',
        'ap-green': '#27ae60',
        'ap-green-light': '#e8f8ef',
        'ap-amber': '#f39c12',
        'ap-amber-light': '#fef8e7',
        'ap-red': '#e74c3c',
        'ap-red-light': '#fef0f0',
        'ap-gray': '#f7f8fa',
        'ap-border': '#e2e8f0',
        'ap-text': '#1a202c',
        'ap-muted': '#718096',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
