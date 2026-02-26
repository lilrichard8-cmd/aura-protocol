import { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react'

export interface AuthUser {
  email: string
  username: string
  bio: string
  avatar: string // base64 or emoji
  walletAddress: string
  followers: number
  following: number
  createdAt: number
}

interface AuthContextType {
  user: AuthUser | null
  isLoggedIn: boolean
  login: (email: string, password: string) => { success: boolean; error?: string }
  register: (email: string, password: string, username: string) => { success: boolean; error?: string }
  logout: () => void
  updateProfile: (updates: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  login: () => ({ success: false }),
  register: () => ({ success: false }),
  logout: () => {},
  updateProfile: () => {},
})

export const useAuth = () => useContext(AuthContext)

// Generate a mock Solana-like wallet address
function generateMockWallet(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('aura_current_user')
    if (saved) {
      try { setUser(JSON.parse(saved)) } catch {}
    }
  }, [])

  const login = (email: string, password: string) => {
    const usersRaw = localStorage.getItem('aura_users')
    const users: Record<string, { password: string; user: AuthUser }> = usersRaw ? JSON.parse(usersRaw) : {}
    const entry = users[email.toLowerCase()]
    if (!entry) return { success: false, error: '账号不存在' }
    if (entry.password !== password) return { success: false, error: '密码错误' }
    setUser(entry.user)
    localStorage.setItem('aura_current_user', JSON.stringify(entry.user))
    return { success: true }
  }

  const register = (email: string, password: string, username: string) => {
    const usersRaw = localStorage.getItem('aura_users')
    const users: Record<string, { password: string; user: AuthUser }> = usersRaw ? JSON.parse(usersRaw) : {}
    if (users[email.toLowerCase()]) return { success: false, error: '该邮箱已注册' }
    const newUser: AuthUser = {
      email: email.toLowerCase(),
      username,
      bio: '',
      avatar: '👤',
      walletAddress: generateMockWallet(),
      followers: Math.floor(Math.random() * 100),
      following: Math.floor(Math.random() * 50),
      createdAt: Date.now(),
    }
    users[email.toLowerCase()] = { password, user: newUser }
    localStorage.setItem('aura_users', JSON.stringify(users))
    setUser(newUser)
    localStorage.setItem('aura_current_user', JSON.stringify(newUser))
    return { success: true }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('aura_current_user')
  }

  const updateProfile = (updates: Partial<AuthUser>) => {
    if (!user) return
    const updated = { ...user, ...updates }
    setUser(updated)
    localStorage.setItem('aura_current_user', JSON.stringify(updated))
    // Also update in users store
    const usersRaw = localStorage.getItem('aura_users')
    const users: Record<string, { password: string; user: AuthUser }> = usersRaw ? JSON.parse(usersRaw) : {}
    if (users[user.email]) {
      users[user.email].user = updated
      localStorage.setItem('aura_users', JSON.stringify(users))
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
