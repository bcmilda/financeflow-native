import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const verze = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string;

export default defineConfig({
  plugins: [react()],
  define: { __VERZE__: JSON.stringify(verze) },
  build: { outDir: 'dist', sourcemap: true },
  server: { host: true },
});
