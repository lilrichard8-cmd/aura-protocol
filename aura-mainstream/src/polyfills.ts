// Browser polyfills for Solana/Privy: Buffer + process. Loaded as a side-effect
// import at the very top of main.tsx. Pre-bundled by Vite into ESM via optimizeDeps.
import { Buffer } from 'buffer'

if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer
  if (typeof (globalThis as any).process === 'undefined') {
    ;(globalThis as any).process = { env: {}, browser: true, version: '' }
  }
  if (typeof (globalThis as any).global === 'undefined') {
    ;(globalThis as any).global = globalThis
  }
}
