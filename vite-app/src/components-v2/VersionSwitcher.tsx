import { FC } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export const VersionSwitcher: FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isV2 = location.pathname.startsWith('/v2')

  const switchVersion = () => {
    if (isV2) {
      // V2 → V1
      const newPath = location.pathname.replace('/v2', '') || '/'
      navigate(newPath)
    } else {
      // V1 → V2
      const newPath = location.pathname === '/' ? '/v2' : `/v2${location.pathname}`
      navigate(newPath)
    }
  }

  return (
    <button
      onClick={switchVersion}
      className="fixed bottom-24 left-6 z-50 px-6 py-3 bg-white border-2 border-gray-300 rounded-full shadow-2xl hover:shadow-3xl transition-all font-semibold text-gray-700 hover:scale-105 flex items-center gap-2"
    >
      <span className="text-xl">🎨</span>
      <span>{isV2 ? '切换到暗色版' : '切换到Patreon风格'}</span>
    </button>
  )
}
