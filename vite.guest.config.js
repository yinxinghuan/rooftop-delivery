import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  root: resolve(__dirname, 'crazygames'),
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'dist/crazygames'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
