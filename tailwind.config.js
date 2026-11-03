import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [join(racine, 'index.html'), join(racine, 'src/**/*.{ts,tsx}')],
  theme: { extend: {} },
  plugins: [],
};
