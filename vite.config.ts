import { defineConfig } from 'vitest/config';
import { readFileSync, writeFileSync } from 'node:fs';

// ビルド毎に dist/sw.js の __BUILD_ID__ を置換し、Service Worker を必ず更新扱いにする
// （バイト列が変わる＝ブラウザが新SWを検知→install/activate→自動リロード）。
function stampServiceWorker() {
  return {
    name: 'stamp-sw-build-id',
    closeBundle() {
      const p = 'dist/sw.js';
      try {
        const s = readFileSync(p, 'utf8').replace(/__BUILD_ID__/g, Date.now().toString(36));
        writeFileSync(p, s);
      } catch { /* dist/sw.js が無い場合は無視 */ }
    },
  };
}

// GitHub Pages のサブパス（/shadowalker/）でも localhost でも動くよう相対パス。
export default defineConfig({
  base: './',
  plugins: [stampServiceWorker()],
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
