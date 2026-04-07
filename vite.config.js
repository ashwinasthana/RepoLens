import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/RepoLens/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
