import { FC } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const OfferSuccess: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { post, offerAmount, message } = location.state || {}

  if (!post) {
    navigate('/explore')
    return null
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-aura p-12 text-center relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-8xl mb-6 animate-bounce">✅</div>
              <h1 className="text-4xl font-bold text-white mb-3">求购请求已发送！</h1>
              <p className="text-white/80 text-lg">创作者会在24小时内响应</p>
            </div>
            <div className="absolute inset-0 bg-white/10 blur-3xl"></div>
          </div>

          <div className="p-8">
            {/* Offer Details */}
            <div className="bg-white/5 rounded-2xl p-6 mb-6">
              <h3 className="text-xl font-bold mb-4">求购详情</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-gray-400">内容</span>
                  <span className="font-semibold">{post.title}</span>
                </div>
                
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-gray-400">创作者</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{post.authorAvatar}</span>
                    <span className="font-semibold">@{post.author}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-gray-400">出价金额</span>
                  <span className="text-2xl font-bold text-yellow-500">{offerAmount} $ORA</span>
                </div>

                {message && (
                  <div className="pb-3 border-b border-white/10">
                    <div className="text-gray-400 mb-2">留言</div>
                    <p className="text-white bg-white/5 rounded-lg p-3">{message}</p>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">托管状态</span>
                  <span className="px-3 py-1 bg-green-500/20 text-green-500 rounded-full text-sm font-semibold">
                    ✓ 已托管
                  </span>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-6">
              <h3 className="text-blue-400 font-semibold mb-3">📌 接下来会发生什么？</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-bold">1</span>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">创作者收到通知</div>
                    <p className="text-sm text-gray-400">@{post.author} 会收到你的求购请求和留言</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-bold">2</span>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">创作者响应（24小时内）</div>
                    <p className="text-sm text-gray-400">
                      可以选择：✓ 接受、💬 还价、或 ✗ 拒绝
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-bold">3</span>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">你会收到通知</div>
                    <p className="text-sm text-gray-400">
                      无论接受、还价还是拒绝，你都会收到站内消息通知
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-bold">4</span>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">自动处理</div>
                    <p className="text-sm text-gray-400">
                      接受 → 内容解锁，金额转给创作者<br/>
                      超时 → 金额自动退回你的钱包
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Escrow Info */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-6">
              <h3 className="text-green-500 font-semibold mb-3">🔒 资金安全保障</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• 你的{offerAmount} $ORA已托管在AURA国库智能合约</li>
                <li>• 智能合约保证资金安全，无人可以挪用</li>
                <li>• 只有接受或超时两种情况会释放资金</li>
                <li>• 整个过程完全透明，链上可查</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/explore')}
                className="flex-1 py-4 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-colors"
              >
                返回探索
              </button>
              <button
                type="button"
                onClick={() => navigate('/messages')}
                className="flex-1 py-4 bg-gradient-aura rounded-xl text-white font-bold hover:opacity-90 transition-opacity"
              >
                查看消息
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-400">
              你可以在消息中心追踪求购进度
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
