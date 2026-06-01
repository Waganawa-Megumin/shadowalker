import { defineConfig } from 'vitest/config';

// GitHub Pages のサブパス（/shadowalker/）でも localhost でも動くよう相対パス。
export default defineConfig({
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2021',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
