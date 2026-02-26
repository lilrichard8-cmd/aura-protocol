import { FC, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const MakeOffer: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const post = location.state?.post

  const [offerAmount, setOfferAmount] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // 模拟提交
    setTimeout(() => {
      setIsSubmitting(false)
      navigate('/offer-success', { 
        state: { 
          post,
          offerAmount,
          message 
        } 
      })
    }, 1500)
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-500/30 p-8 text-center">
            <div className="text-7xl mb-4">💡</div>
            <h1 className="text-4xl font-bold text-white mb-3">发起求购</h1>
            <p className="text-gray-300 text-lg">向创作者表达你的购买意愿</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {/* Content Preview */}
            <div className="mb-8 bg-white/5 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 text-lg">内容信息</h3>
              <div className="flex items-start gap-4">
                <div className={`w-24 h-24 bg-gradient-to-br ${post.coverColor} rounded-xl flex items-center justify-center text-5xl flex-shrink-0`}>
                  {post.coverImage}
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold mb-2">{post.title}</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{post.authorAvatar}</span>
                    <span className="text-gray-400">@{post.author}</span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{post.description}</p>
                </div>
              </div>
            </div>

            {/* Offer Amount */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                出价金额 ($ORA) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-aura-purple transition-colors text-white text-2xl font-bold"
                placeholder="输入你的出价..."
                min="1"
                step="1"
                required
              />
              <div className="flex gap-2 mt-3">
                {[10, 50, 100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setOfferAmount(amount.toString())}
                    className="flex-1 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors"
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Message to Creator */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                给创作者的留言（可选）
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-aura-purple transition-colors text-white resize-none"
                placeholder="说明你的购买意愿、用途等..."
              />
              <div className="text-xs text-gray-400 text-right mt-1">
                {message.length} / 500
              </div>
            </div>

            {/* Rules */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 mb-6">
              <h3 className="text-yellow-500 font-semibold mb-3 flex items-center gap-2">
                <span>📝</span>
                <span>求购规则</span>
              </h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>你的出价金额将托管在AURA国库智能合约</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>创作者有24小时时间响应你的求购</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>创作者可以选择：接受、还价、或拒绝</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>如果接受，内容立即解锁，金额转给创作者</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  <span>如果24小时无响应，金额自动退回你的钱包</span>
                </li>
              </ul>
            </div>

            {/* Cost Breakdown */}
            {offerAmount && (
              <div className="bg-white/5 rounded-xl p-6 mb-6">
                <h3 className="font-semibold mb-4">费用明细</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">出价金额</span>
                    <span className="text-xl font-bold">{offerAmount} $ORA</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">托管费用</span>
                    <span className="text-green-500">免费</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">若接受，创作者收益</span>
                    <span>{(parseFloat(offerAmount) * 0.95).toFixed(2)} $ORA (95%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">若接受，平台手续费</span>
                    <span>{(parseFloat(offerAmount) * 0.05).toFixed(2)} $ORA (5%)</span>
                  </div>
                  <div className="border-t border-white/20 pt-3 flex justify-between">
                    <span className="font-bold">你需要支付</span>
                    <span className="text-2xl font-bold text-yellow-500">{offerAmount} $ORA</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-4 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!offerAmount || parseFloat(offerAmount) <= 0 || isSubmitting}
                className="flex-1 py-4 bg-gradient-aura rounded-xl text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '提交中...' : '发送求购'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
