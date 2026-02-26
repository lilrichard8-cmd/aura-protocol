import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const EmailAuth: FC = () => {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) { setError('请填写所有字段'); return }
    if (mode === 'register' && !username) { setError('请输入用户名'); return }
    if (password.length < 6) { setError('密码至少6位'); return }

    if (mode === 'login') {
      const result = login(email, password)
      if (result.success) navigate('/explore')
      else setError(result.error || '登录失败')
    } else {
      const result = register(email, password, username)
      if (result.success) navigate('/explore')
      else setError(result.error || '注册失败')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black px-4">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-aura-purple/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-aura-pink/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="w-full max-w-md">
        {/* Back button */}
        <button onClick={() => navigate('/')} className="mb-8 text-gray-400 hover:text-white transition-colors flex items-center gap-2">
          ← 返回首页
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-aura rounded-2xl flex items-center justify-center shadow-xl">
            <span className="text-white font-bold text-4xl">A</span>
          </div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-aura bg-clip-text text-transparent">
              {mode === 'login' ? '登录 AURA' : '注册 AURA'}
            </span>
          </h1>
        </div>

        {/* Toggle */}
        <div className="flex bg-white/5 rounded-full p-1 mb-8">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${mode === 'login' ? 'bg-gradient-aura text-white' : 'text-gray-400'}`}
          >
            登录
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${mode === 'register' ? 'bg-gradient-aura text-white' : 'text-gray-400'}`}
          >
            注册
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-aura-purple transition-colors text-white"
                placeholder="你的昵称"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-aura-purple transition-colors text-white"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-aura-purple transition-colors text-white"
              placeholder="至少6位"
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-gradient-aura rounded-xl text-white text-lg font-bold hover:opacity-90 transition-opacity mt-2"
          >
            {mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-6">
          {mode === 'login' ? '注册后会自动生成一个托管钱包地址' : '注册即同意 AURA 用户协议'}
        </p>
      </div>
    </div>
  )
}
