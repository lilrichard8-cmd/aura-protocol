import { createContext, useContext, useEffect, ReactNode, FC } from 'react'
import { useLocation } from 'react-router-dom'

interface ThemeContextType {
  isV2: boolean
}

const ThemeContext = createContext<ThemeContextType>({ isV2: false })

export const useTheme = () => useContext(ThemeContext)

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation()
  const isV2 = location.pathname.startsWith('/v2')

  useEffect(() => {
    if (isV2) {
      document.body.setAttribute('data-theme', 'v2')
      document.body.style.background = '#F9FAFB'
    } else {
      document.body.removeAttribute('data-theme')
      document.body.style.background = '#000000'
    }
  }, [isV2])

  return (
    <ThemeContext.Provider value={{ isV2 }}>
      {children}
    </ThemeContext.Provider>
  )
}
