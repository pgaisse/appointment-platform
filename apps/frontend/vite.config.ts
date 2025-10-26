import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import compression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga todas las variables (sin filtrar por VITE_ para debug)

  return {
    plugins: [
      react(),
      tsconfigPaths(),
      compression({ algorithm: "brotliCompress", ext: ".br" }),
      compression({ algorithm: "gzip", ext: ".gz" }),
    ],

    base: "/",   // 👈 muy importante, asegura rutas absolutas en producción
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
