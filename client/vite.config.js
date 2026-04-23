import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0", // ← essa linha é essencial
  }
  //server: { port: 3000, historyApiFallback: true }
})