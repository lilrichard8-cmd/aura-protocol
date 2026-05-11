import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export const EmailAuth: FC = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) { setError('请填写所有字段'); return }
    if (mode === 'register' && !username) { setError('请输入用户名'); return }
    if (password.length < 6) { setError('密码至少6位'); return }

    setLoading(true)
    
    try {
      // Mock authentication
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      if (mode === 'login') {
        // Mock login success
        localStorage.setItem('aura_auth', JSON.stringify({
          email,
          username: email.split('@')[0],
          authenticated: true,
          timestamp: Date.now()
        }))
        navigate('/home')
      } else {
        // Mock registration success
        localStorage.setItem('aura_auth', JSON.stringify({
          email,
          username,
          authenticated: true,
          timestamp: Date.now()
        }))
        navigate('/home')
      }
    } catch (err) {
      setError(mode === 'login' ? '登录失败，请重试' : '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-aura-bg px-4">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-aura-accent/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-aura-gold/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="w-full max-w-md">
        {/* Back button */}
        <button 
          onClick={() => navigate('/')} 
          className="mb-8 text-aura-text-secondary hover:text-aura-text transition-colors flex items-center gap-2"
        >
          ← 返回首页
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-aura-accent to-aura-gold rounded-2xl flex items-center justify-center shadow-xl">
            <span className="text-white font-bold text-4xl">A</span>
          </div>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-aura-accent to-aura-gold bg-clip-text text-transparent">
              {mode === 'login' ? '登录 AURA After Dark' : '注册 AURA After Dark'}
            </span>
          </h1>
          <p className="text-aura-text-secondary text-sm mt-2">
            {mode === 'login' ? '欢迎回到成人创作者平台' : '加入专属的成人内容创作者社区'}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex bg-aura-surface rounded-full p-1 mb-8">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${
              mode === 'login' 
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white' 
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${
              mode === 'register' 
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white' 
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            注册
          </button>
        </div>

        {error && (
          <div className="bg-aura-accent/10 border border-aura-accent/30 rounded-lg p-3 mb-4 text-aura-accent text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-aura-text-secondary mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-xl focus:outline-none focus:border-aura-accent transition-colors text-aura-text placeholder-aura-text-secondary"
                placeholder="你的昵称"
                disabled={loading}
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-aura-text-secondary mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-xl focus:outline-none focus:border-aura-accent transition-colors text-aura-text placeholder-aura-text-secondary"
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-aura-text-secondary mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-xl focus:outline-none focus:border-aura-accent transition-colors text-aura-text placeholder-aura-text-secondary"
              placeholder="至少6位"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl text-white text-lg font-bold transition-all mt-2 ${
              loading 
                ? 'bg-aura-text-secondary/30 cursor-not-allowed' 
                : 'bg-gradient-to-r from-aura-accent to-aura-accent-hover hover:shadow-lg hover:shadow-aura-accent/25'
            }`}
          >
            {loading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
          </button>
        </form>

        {/* Age Verification Note */}
        <div className="mt-6 p-4 bg-aura-gold/10 border border-aura-gold/20 rounded-xl">
          <p className="text-center text-aura-gold text-xs">
            <span className="font-semibold">⚠️ 年龄确认：</span><br/>
            {mode === 'login' 
              ? '登录即确认您已满18岁，并同意查看成人内容' 
              : '注册即确认您已满18岁，同意 AURA After Dark 用户协议和隐私政策'
            }
          </p>
        </div>

        <p className="text-center text-aura-text-secondary text-xs mt-4">
          {mode === 'login' 
            ? '注册后会自动生成一个托管钱包地址' 
            : '专为成人内容创作者设计的区块链平台'
          }
        </p>
      </div>
    </div>
  )
}