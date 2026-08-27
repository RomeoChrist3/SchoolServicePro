import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    (mode !== 'web' && !process.env.RAILWAY_STATIC_URL) && electron([
      {
        // Main process entry file
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'mysql2', 
                'mysql2/promise', 
                'sqlite3', 
                'mssql', 
                'tedious', 
                'msnodesqlv8',
                'nodemailer'
              ]
            }
          }
        }
      },
      {
        // Preload script entry file
        entry: 'electron/preload.ts',
      }
    ]),
  ].filter(Boolean),
}))
