import { defineConfig } from 'vite'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import { execSync } from 'child_process'
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

  // Intentamos extraer información de git para que la versión cambie en cada commit sin tener que modificar package.json.
  // Esto hace que el mostrador del Header sea "v{pkg.version}+{commit}" (o solo commit si la version es 0.0.0) y se regenere en cada build.
  let gitCommit = 'unknown'
  let gitTag = ''
  // Helper: attempt several strategies to discover git metadata even in CI containers
  const tryGit = () => {
    try {
      const c = execSync('git rev-parse --short HEAD').toString().trim()
      if (c) gitCommit = c
    } catch {}
    try {
      const t = execSync('git describe --tags --abbrev=0').toString().trim()
      if (t) gitTag = t
    } catch {}
  }
  tryGit()

  // If git commands failed (e.g., no .git), attempt to read .git/HEAD manually walking up
  const findGitHeadManual = () => {
    if (gitCommit !== 'unknown') return
    let current: string | null = __dirname
    while (current) {
      const gitDir = join(current, '.git')
      if (existsSync(gitDir)) {
        try {
          const headContent = readFileSync(join(gitDir, 'HEAD'), 'utf-8').trim()
          if (headContent.startsWith('ref:')) {
            const refPath = headContent.replace('ref: ', '').trim()
            const refFile = join(gitDir, refPath)
            if (existsSync(refFile)) {
              const fullCommit = readFileSync(refFile, 'utf-8').trim()
              gitCommit = fullCommit.slice(0, 7)
              return
            }
          } else if (/^[0-9a-f]{40}$/i.test(headContent)) {
            gitCommit = headContent.slice(0,7)
            return
          }
        } catch {}
      }
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  findGitHeadManual()

  // Support common CI env vars if still unknown
  if (gitCommit === 'unknown') {
    const envCommit = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.CI_COMMIT_SHA || process.env.COMMIT_SHA || ''
    if (envCommit) gitCommit = envCommit.slice(0,7)
  }

  const baseVersion = pkg.version && pkg.version !== '0.0.0' ? pkg.version : ''
  // Si hay tag y la version de package.json está en 0.0.0 usamos el tag como base, sino mantenemos package.json.
  const effectiveBase = baseVersion || gitTag
  // If still unknown, use time-based stamp for uniqueness
  if (gitCommit === 'unknown') {
    const ts = new Date().toISOString().replace(/[-:TZ]/g,'').slice(0,12) // YYYYMMDDHHMM
    gitCommit = ts
  }
  const composedVersion = [effectiveBase, gitCommit].filter(Boolean).join('+') || gitCommit || '0.0.0'

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
      __APP_VERSION__: JSON.stringify(composedVersion),
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
