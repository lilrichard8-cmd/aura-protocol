import { FC } from 'react'
import { useNavigate } from 'react-router-dom'

interface MessageButtonProps {
  unreadCount?: number
}

export const MessageButton: FC<MessageButtonProps> = ({ unreadCount = 2 }) => {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/messages')}
      className="fixed top-6 right-6 z-40 w-14 h-14 bg-gradient-aura rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300 group"
    >
      <span className="text-2xl">💬</span>
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-black animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
      
      {/* Tooltip */}
      <div className="absolute right-full mr-3 px-3 py-2 bg-black border border-white/10 rounded-lg text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        消息中心
        {unreadCount > 0 && (
          <span className="ml-2 text-red-500">({unreadCount} 条未读)</span>
        )}
      </div>
    </button>
  )
}
