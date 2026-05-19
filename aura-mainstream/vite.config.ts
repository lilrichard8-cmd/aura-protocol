import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import auraDevMintPlugin from './scripts/dev-mint-plugin.mjs'

export default defineConfig(({ mode }) => {
  // Make VITE_* env vars visible to the dev-mint plugin (which doesn't see
  // them via import.meta.env at config-load time).
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v
  }
  return {
  plugins: [
    react(),
    tailwindcss(),
    // Localnet-only: exposes POST /__dev/mint-ora?addr=<base58>&amount=<n>
    auraDevMintPlugin({
      oraMint: env.VITE_ORA_MINT,
      rpcUrl: env.VITE_RPC_URL,
    }),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  define: {
    global: 'globalThis',
  },
  // 预构建 buffer/process (原始包是 CJS, vite 会转成 ESM)。
  optimizeDeps: {
    include: ['buffer', 'process'],
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
  }
})
