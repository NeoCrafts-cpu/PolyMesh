/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_WS_URL: string
  readonly VITE_AGENT_EXECUTOR_ADDRESS: string
  readonly VITE_TOKEN_WRAPPER_ADDRESS: string
  readonly VITE_ZKML_VERIFIER_ADDRESS: string
  readonly VITE_DEFAULT_CHAIN_ID: string
  readonly VITE_POLYGON_RPC_URL: string
  readonly VITE_AMOY_RPC_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
