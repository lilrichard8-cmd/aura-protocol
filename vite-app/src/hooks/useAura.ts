import { useContext } from 'react'
import { AuraContext } from '../contexts/AuraContext'

/**
 * Hook to access the AURA SDK client instance
 * 
 * @example
 * ```tsx
 * const { auraClient, isReady } = useAura()
 * 
 * // Publish content
 * await auraClient?.content.publish({
 *   arweaveTxId: 'xxx...',
 *   contentType: ContentType.Image,
 *   license: LicenseType.CCBY,
 *   price: 0,
 * })
 * ```
 */
export const useAura = () => {
  const context = useContext(AuraContext)
  
  if (!context) {
    throw new Error('useAura must be used within AuraProvider')
  }
  
  return context
}
