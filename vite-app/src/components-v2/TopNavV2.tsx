import { FC } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export const TopNavV2: FC = () => {
  const location = useLocation()
  const { connected } = useWallet()

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Main Nav */}
          <div className="flex items-center gap-8">
            <Link to="/v2" className="text-2xl font-bold text-gray-900">
              AURA
            </Link>
            <div className="hidden md:flex gap-6">
              <Link
                to="/v2/explore"
                className={`font-semibold transition-colors ${
                  isActive('/v2/explore') ? 'text-[#FF424D]' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                探索
              </Link>
              <Link
                to="/v2/create"
                className={`font-semibold transition-colors ${
                  isActive('/v2/create') ? 'text-[#FF424D]' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                创作
              </Link>
              <Link
                to="/v2/market"
                className={`font-semibold transition-colors ${
                  isActive('/v2/market') ? 'text-[#FF424D]' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                市场
              </Link>
              <Link
                to="/v2/governance"
                className={`font-semibold transition-colors ${
                  isActive('/v2/governance') ? 'text-[#FF424D]' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                治理
              </Link>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <Link
              to="/v2/rewards"
              className="px-4 py-2 bg-yellow-50 text-yellow-700 font-semibold rounded-full hover:bg-yellow-100 transition-colors flex items-center gap-2"
            >
              <span>🎁</span>
              <span>激励</span>
            </Link>
            
            {connected ? (
              <Link
                to="/v2/profile"
                className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 transition-colors"
              >
                我的
              </Link>
            ) : (
              <WalletMultiButton style={{
                background: '#FF424D',
                borderRadius: '9999px',
                height: '40px',
                fontWeight: '600',
              }} />
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
