import { defineConfig } from 'vite';

// base: './' … 任意のサブパス（GitHub Pages など）に置いても動くようにする
export default defineConfig({
  base: './',
  server: { host: true },
});
