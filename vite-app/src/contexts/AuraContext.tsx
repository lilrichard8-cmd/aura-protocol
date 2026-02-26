import { createContext, ReactNode, FC, useMemo, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'

// Temporary mock AuraClient until SDK bundling is fixed
interface MockAuraClient {
  isConnected: boolean
  publicKey: PublicKey | null
  connection: Connection | null
  content: {
    publish: (params: any) => Promise<any>
    getLicense: (contentId: string) => Promise<any>
  }
  social: {
    follow: (creatorId: string) => Promise<any>
    unfollow: (creatorId: string) => Promise<any>
  }
  creatorCoin: {
    buy: (params: any) => Promise<any>
    sell: (params: any) => Promise<any>
  }
  curation: {
    curate: (params: any) => Promise<any>
    claimReward: (params: any) => Promise<any>
  }
  reputation: {
    get: (address: string) => Promise<any>
  }
}

interface AuraContextType {
  auraClient: MockAuraClient | null
  isReady: boolean
}

export const AuraContext = createContext<AuraContextType | undefined>(undefined)

interface AuraProviderProps {
  children: ReactNode
  network?: 'mainnet' | 'devnet' | 'testnet' | 'localnet'
  rpcUrl?: string
}

const RPC_ENDPOINTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localnet: 'http://localhost:8899',
}

/**
 * Provider component that initializes and provides the AURA SDK client
 * 
 * @example
 * ```tsx
 * <AuraProvider network="devnet">
 *   <App />
 * </AuraProvider>
 * ```
 */
export const AuraProvider: FC<AuraProviderProps> = ({ 
  children, 
  network = 'devnet',
  rpcUrl 
}) => {
  const wallet = useWallet()
  const [isReady, setIsReady] = useState(false)

  // Initialize AURA client when wallet is connected
  const auraClient = useMemo(() => {
    if (!wallet || !wallet.publicKey) {
      setIsReady(false)
      return null
    }

    try {
      const endpoint = rpcUrl || RPC_ENDPOINTS[network]
      const connection = new Connection(endpoint)
      
      // Create mock client
      const client: MockAuraClient = {
        isConnected: true,
        publicKey: wallet.publicKey,
        connection,
        content: {
          publish: async (params: any) => ({ success: true, params }),
          getLicense: async (contentId: string) => ({ contentId, license: 'CC0' }),
        },
        social: {
          follow: async (creatorId: string) => ({ success: true, creatorId }),
          unfollow: async (creatorId: string) => ({ success: true, creatorId }),
        },
        creatorCoin: {
          buy: async (params: any) => ({ success: true, params }),
          sell: async (params: any) => ({ success: true, params }),
        },
        curation: {
          curate: async (params: any) => ({ success: true, params }),
          claimReward: async (params: any) => ({ success: true, params }),
        },
        reputation: {
          get: async (address: string) => ({ 
            address, 
            tier: 'Gold', 
            score: 5000 
          }),
        },
      }
      
      setIsReady(true)
      return client
    } catch (error) {
      console.error('Failed to initialize AURA client:', error)
      setIsReady(false)
      return null
    }
  }, [wallet, wallet.publicKey, network, rpcUrl])

  // Log client status changes
  useEffect(() => {
    if (auraClient) {
      console.log('AURA SDK initialized (mock):', {
        network,
        connected: auraClient.isConnected,
        publicKey: auraClient.publicKey?.toBase58(),
      })
    }
  }, [auraClient, network])

  const value = useMemo(
    () => ({
      auraClient,
      isReady,
    }),
    [auraClient, isReady]
  )

  return (
    <AuraContext.Provider value={value}>
      {children}
    </AuraContext.Provider>
  )
}
