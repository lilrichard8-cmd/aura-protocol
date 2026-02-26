import { FC } from 'react'
import { useNavigate } from 'react-router-dom'

export const RewardsButton: FC = () => {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/rewards')}
      className="fixed bottom-32 right-6 z-40 group"
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-aura rounded-full blur-xl opacity-60 animate-pulse"></div>
      
      {/* Main button */}
      <div className="relative w-16 h-16 bg-gradient-aura rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300">
        <span className="text-3xl">🎁</span>
      </div>
      
      {/* HOT badge */}
      <div className="absolute -top-1 -right-1 px-2 py-1 bg-red-500 rounded-full text-xs font-bold text-white animate-pulse">
        HOT
      </div>
      
      {/* Tooltip */}
      <div className="absolute right-full mr-3 px-4 py-2 bg-black border border-white/10 rounded-lg text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        激励中心
        <div className="text-xs text-gray-400 mt-1">1.1亿$ORA等你拿</div>
      </div>
    </button>
  )
}
