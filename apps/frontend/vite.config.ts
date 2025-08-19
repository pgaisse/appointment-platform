import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga todas las variables (sin filtrar por VITE_ para debug)
  const env = loadEnv(mode, process.cwd(), '')

  console.log('🔍 Variables cargadas en build:', env)

  return {
    plugins: [react(), tsconfigPaths()],
    base: "/",   // 👈 muy importante, asegura rutas absolutas en producción
    server: {
      host: "0.0.0.0",
      port: 3004,
      strictPort: true,
      hmr: {
        protocol: "wss",
        host: "dev.letsmarter.com",
        clientPort: 443
      }
    }

  }
})
