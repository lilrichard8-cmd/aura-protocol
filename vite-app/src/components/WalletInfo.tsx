import { FC } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export const WalletInfo: FC = () => {
  const { connected } = useWallet()

  // 模拟余额（实际应从链上读取）
  const mockBalance = {
    ora: 1234,
    sol: 2.5,
    pending: 567,
  }

  return (
    <div className="fixed top-6 right-24 z-40 flex items-center gap-3">
      {/* Balance Display (if connected) */}
      {connected && (
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-5 py-2 flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-400">$ORA</div>
            <div className="text-lg font-bold text-green-400">{mockBalance.ora.toLocaleString()}</div>
          </div>
          <div className="w-px h-8 bg-white/20"></div>
          <div className="text-right">
            <div className="text-xs text-gray-400">SOL</div>
            <div className="text-lg font-bold text-purple-400">{mockBalance.sol}</div>
          </div>
          {mockBalance.pending > 0 && (
            <>
              <div className="w-px h-8 bg-white/20"></div>
              <div className="text-right">
                <div className="text-xs text-yellow-500">锁定中</div>
                <div className="text-sm font-bold text-yellow-500">{mockBalance.pending}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Wallet Button */}
      <div className="wallet-button-custom">
        <WalletMultiButton style={{
          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
          borderRadius: '9999px',
          height: '48px',
          fontSize: '14px',
          fontWeight: '600',
        }} />
      </div>
    </div>
  )
}
