import { FC, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const PaidContentConfirm: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const post = location.state?.post

  const [isProcessing, setIsProcessing] = useState(false)

  if (!post) {
    return (
      <div className="min-h-screen pt-20 pb-32 px-4 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold mb-2">内容未找到</h2>
          <button
            onClick={() => navigate('/explore')}
            className="mt-4 px-6 py-2 bg-gradient-aura rounded-lg text-white font-semibold"
          >
            返回探索
          </button>
        </div>
      </div>
    )
  }

  const handlePurchase = () => {
    setIsProcessing(true)
    
    setTimeout(() => {
      alert(`✅ 购买成功！

📄 内容：${post.title}
💰 支付：${post.price} $ORA
👤 创作者：@${post.author}

内容已解锁，现在可以查看完整内容！

创作者将收到 ${post.price * 0.95} $ORA（95%）
平台手续费：${post.price * 0.05} $ORA（5%）
收益锁定期：7 天

（测试模式）`)
      
      setIsProcessing(false)
      // 解锁后跳转到详情页
      navigate(`/post/${post.id}`, { state: { post: { ...post, isUnlocked: true } } })
    }, 1500)
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black flex items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        {/* Main content */}
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          {/* Lock icon header */}
          <div className="bg-gradient-aura p-12 text-center relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-8xl mb-6 animate-bounce">🔒</div>
              <h1 className="text-4xl font-bold text-white mb-3">付费内容</h1>
              <p className="text-white/80 text-lg">解锁后即可永久查看</p>
            </div>
            <div className="absolute inset-0 bg-white/10 blur-3xl"></div>
          </div>

          <div className="p-8">
            {/* Content preview */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{post.title}</h2>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-aura rounded-full flex items-center justify-center text-2xl">
                  {post.authorAvatar}
                </div>
                <div>
                  <div className="font-semibold">@{post.author}</div>
                  <div className="text-sm text-gray-400">{post.type === 'image' ? '图片' : post.type === 'video' ? '视频' : post.type === 'audio' ? '音频' : '文本'}</div>
                </div>
              </div>

              <p className="text-gray-300 mb-6">{post.description}</p>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <span>❤️</span>
                  <span>{post.likes} 人喜欢</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>👁️</span>
                  <span>{post.views} 次浏览</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💬</span>
                  <span>{post.comments} 条评论</span>
                </div>
              </div>
            </div>

            {/* Price card */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-2xl p-8 mb-6">
              <div className="text-center">
                <div className="text-sm text-yellow-500 font-semibold mb-2">解锁价格</div>
                <div className="text-6xl font-bold text-white mb-4">{post.price}</div>
                <div className="text-2xl text-yellow-500 font-semibold">$ORA</div>
              </div>
            </div>

            {/* What you get */}
            <div className="bg-white/5 rounded-2xl p-6 mb-6">
              <h3 className="font-semibold mb-4 text-lg">解锁后你将获得：</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <span>完整的高清内容（永久访问）</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <span>所有评论和互动功能</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <span>支持创作者，鼓励优质内容</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl">✓</span>
                  <span>内容永久存储在 Arweave</span>
                </li>
              </ul>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6 text-sm">
              <p className="text-blue-500 font-semibold mb-2">💡 付费说明：</p>
              <ul className="text-gray-300 space-y-1">
                <li>• 创作者收益：{(post.price * 0.95).toFixed(1)} $ORA（95%）</li>
                <li>• 平台手续费：{(post.price * 0.05).toFixed(1)} $ORA（5%）</li>
                <li>• 创作者收益锁定：7 天（争议追回窗口）</li>
                <li>• 支付后内容永久解锁</li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex-1 py-4 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="flex-1 py-4 bg-gradient-aura rounded-xl text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? '处理中...' : `支付 ${post.price} $ORA`}
              </button>
            </div>

            {/* Security notice */}
            <div className="mt-6 text-center text-xs text-gray-500">
              🔐 由智能合约保护的安全交易
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
