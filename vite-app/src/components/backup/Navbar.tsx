import { FC } from 'react'
import { Link } from 'react-router-dom'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export const Navbar: FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-aura rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <span className="text-white font-bold text-xl">AURA</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              首页
            </Link>
            <Link
              to="/explore"
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              探索
            </Link>
            <Link
              to="/create"
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              创作
            </Link>
            <a
              href="#governance"
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              治理
            </a>
            <a
              href="#market"
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              市场
            </a>
          </div>

          {/* Wallet Button */}
          <div className="flex items-center">
            <WalletMultiButton className="!bg-gradient-aura hover:opacity-90 transition-opacity" />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden px-4 pb-4 space-y-2">
        <Link
          to="/"
          className="block text-gray-300 hover:text-white transition-colors duration-200 py-2"
        >
          首页
        </Link>
        <Link
          to="/explore"
          className="block text-gray-300 hover:text-white transition-colors duration-200 py-2"
        >
          探索
        </Link>
        <Link
          to="/create"
          className="block text-gray-300 hover:text-white transition-colors duration-200 py-2"
        >
          创作
        </Link>
        <a
          href="#governance"
          className="block text-gray-300 hover:text-white transition-colors duration-200 py-2"
        >
          治理
        </a>
        <a
          href="#market"
          className="block text-gray-300 hover:text-white transition-colors duration-200 py-2"
        >
          市场
        </a>
      </div>
    </nav>
  )
}
