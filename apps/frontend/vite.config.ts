import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import compression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(() => {
  // Carga todas las variables (sin filtrar por VITE_ para debug)
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const pkgPath = resolve(__dirname, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
  const appVersion = pkg.version || '0.0.0'
  const buildDate = new Date().toISOString()

  return {
    plugins: [
      react(),
      tsconfigPaths(),
      compression({ algorithm: "brotliCompress", ext: ".br" }),
      compression({ algorithm: "gzip", ext: ".gz" }),
    ],

    base: "/",   // 👈 muy importante, asegura rutas absolutas en producción
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD_DATE__: JSON.stringify(buildDate),
    },
    server: {
      host: "0.0.0.0",
      port: 3004,
      strictPort: true,
      allowedHosts: ['dev.letsmarter.com'], // 👈 aquí permites tu dominio
      hmr: {
        protocol: "wss",
        host: "dev.letsmarter.com",
        clientPort: 8443
      }
    }

  }
})
