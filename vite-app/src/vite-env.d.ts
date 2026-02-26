/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_NETWORK: string
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_CORE_PROGRAM_ID: string
  readonly VITE_VAULT_PROGRAM_ID: string
  readonly VITE_GOVERNANCE_PROGRAM_ID: string
  readonly VITE_MARKET_PROGRAM_ID: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
