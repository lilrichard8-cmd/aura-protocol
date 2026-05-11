import { FC, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export const WalletInfo: FC = () => {
  const { connected, publicKey, disconnect } = useWallet()
  const [showDropdown, setShowDropdown] = useState(false)

  if (!connected || !publicKey) {
    return null
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could use toast here if available
      alert('地址已复制到剪贴板')
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('地址已复制到剪贴板')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 bg-aura-surface border border-aura-border rounded-lg hover:bg-aura-card transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-aura-accent to-aura-gold flex items-center justify-center">
          <span className="text-white text-sm font-bold">
            {publicKey.toString().charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-aura-text text-sm font-medium">
          {shortenAddress(publicKey.toString())}
        </span>
        <svg 
          className={`w-4 h-4 text-aura-text-secondary transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-aura-card border border-aura-border rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="p-4 border-b border-aura-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-aura-accent to-aura-gold flex items-center justify-center">
                  <span className="text-white font-bold">
                    {publicKey.toString().charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-aura-text font-medium">已连接钱包</div>
                  <div className="text-aura-text-secondary text-xs">Solana 主网</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-aura-surface rounded-lg">
                <code className="text-xs text-aura-text-secondary font-mono flex-1 truncate">
                  {publicKey.toString()}
                </code>
                <button
                  onClick={() => copyToClipboard(publicKey.toString())}
                  className="text-aura-accent hover:text-aura-accent-hover transition-colors text-xs"
                >
                  📋
                </button>
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={disconnect}
                className="w-full text-left px-3 py-2 text-aura-accent hover:bg-aura-accent/10 rounded-lg transition-colors text-sm font-medium"
              >
                🔌 断开连接
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}