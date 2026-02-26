import { FC } from 'react'
import { useNavigate } from 'react-router-dom'

export const Rewards: FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-aura bg-clip-text text-transparent">
              激励中心
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            AURA 史上最大创作者激励计划 - 1.1亿 $ORA 等你来拿
          </p>
        </div>

        {/* Hero Banner */}
        <div className="bg-gradient-aura rounded-3xl p-8 mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-center">
              <div className="text-6xl mb-4">🎁</div>
              <h2 className="text-4xl font-bold text-white mb-4">
                冷启动激励计划
              </h2>
              <p className="text-white/90 text-xl mb-6">
                3大策略 × 7个收入来源 × 持续12个月
              </p>
              <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold mb-1">1.1亿</div>
                  <div className="text-sm opacity-90">$ORA总预算</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold mb-1">5.5%</div>
                  <div className="text-sm opacity-90">代币总量</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold mb-1">85-90%</div>
                  <div className="text-sm opacity-90">成功概率</div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-white/10 blur-3xl"></div>
        </div>

        {/* Three Strategies */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Strategy 1 */}
          <div
            onClick={() => navigate('/creator-migration')}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-aura-purple/50 transition-all cursor-pointer hover:scale-105"
          >
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-2xl font-bold mb-3">粉丝迁移计划</h3>
            <p className="text-gray-400 mb-4">
              带粉丝来AURA，1粉丝=1 $ORA
            </p>
            <div className="space-y-2 text-sm text-gray-300 mb-6">
              <div className="flex justify-between">
                <span>预算</span>
                <span className="font-bold text-aura-purple">5000万 $ORA</span>
              </div>
              <div className="flex justify-between">
                <span>上限</span>
                <span className="font-bold">50万/人</span>
              </div>
              <div className="flex justify-between">
                <span>周期</span>
                <span className="font-bold">12个月</span>
              </div>
            </div>
            <button className="w-full py-3 bg-gradient-aura rounded-xl text-white font-semibold hover:opacity-90">
              立即申请
            </button>
          </div>

          {/* Strategy 2 */}
          <div
            onClick={() => navigate('/mining')}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-aura-pink/50 transition-all cursor-pointer hover:scale-105"
          >
            <div className="text-5xl mb-4">🤝</div>
            <h3 className="text-2xl font-bold mb-3">邀请计划</h3>
            <p className="text-gray-400 mb-4">
              邀请好友加入AURA，每日分享3000万奖励池
            </p>
            <div className="space-y-2 text-sm text-gray-300 mb-6">
              <div className="flex justify-between">
                <span>每日释放</span>
                <span className="font-bold text-aura-pink">82,191 $ORA</span>
              </div>
              <div className="flex justify-between">
                <span>持续</span>
                <span className="font-bold">365天</span>
              </div>
              <div className="flex justify-between">
                <span>月收入</span>
                <span className="font-bold">5万-20万</span>
              </div>
            </div>
            <button className="w-full py-3 bg-gradient-aura rounded-xl text-white font-semibold hover:opacity-90">
              开始挖矿
            </button>
          </div>

          {/* Strategy 3 */}
          <div
            onClick={() => navigate('/rankings')}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-aura-orange/50 transition-all cursor-pointer hover:scale-105"
          >
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold mb-3">周度排行榜</h3>
            <p className="text-gray-400 mb-4">
              优质内容上榜，每周11万$ORA奖励
            </p>
            <div className="space-y-2 text-sm text-gray-300 mb-6">
              <div className="flex justify-between">
                <span>榜单数</span>
                <span className="font-bold text-aura-orange">5个</span>
              </div>
              <div className="flex justify-between">
                <span>周奖励</span>
                <span className="font-bold">11万 $ORA</span>
              </div>
              <div className="flex justify-between">
                <span>Top 1</span>
                <span className="font-bold">1.5万 $ORA</span>
              </div>
            </div>
            <button className="w-full py-3 bg-gradient-aura rounded-xl text-white font-semibold hover:opacity-90">
              查看榜单
            </button>
          </div>
        </div>

        {/* Your Potential Earnings */}
        <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 border border-green-500/30 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center">💰 你的潜在收益（示例）</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-green-400">场景A：中等创作者</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">粉丝迁移（5万粉丝）</span>
                  <span className="font-bold">5万 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">推广挖矿（月均）</span>
                  <span className="font-bold">3万 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">周榜（月均1次）</span>
                  <span className="font-bold">3万 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">内容销售（95%）</span>
                  <span className="font-bold">2万 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">代币分发</span>
                  <span className="font-bold">1万 $ORA</span>
                </div>
                <div className="border-t border-white/20 pt-3 mt-3 flex justify-between">
                  <span className="font-bold text-lg">月收入</span>
                  <span className="font-bold text-2xl text-green-400">14万 $ORA</span>
                </div>
                <div className="text-center text-xs text-gray-400 mt-2">
                  假设$ORA=$1，约$140K/月，$1.68M/年
                </div>
              </div>
            </div>

            <div className="bg-black/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-blue-400">场景B：新人创作者</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">粉丝迁移（1000粉丝）</span>
                  <span className="font-bold">1000 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">推广挖矿（月均）</span>
                  <span className="font-bold">5000 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">新人榜（月均1次）</span>
                  <span className="font-bold">5000 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">内容销售（95%）</span>
                  <span className="font-bold">3000 $ORA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">代币分发</span>
                  <span className="font-bold">2000 $ORA</span>
                </div>
                <div className="border-t border-white/20 pt-3 mt-3 flex justify-between">
                  <span className="font-bold text-lg">月收入</span>
                  <span className="font-bold text-2xl text-blue-400">1.6万 $ORA</span>
                </div>
                <div className="text-center text-xs text-gray-400 mt-2">
                  假设$ORA=$1，约$16K/月，$192K/年
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-300">
            💡 这仅是示例，实际收益取决于你的努力程度和内容质量
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-gray-400 mb-1">总预算</div>
            <div className="text-2xl font-bold text-aura-purple">1.1亿</div>
            <div className="text-xs text-gray-400">$ORA</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-gray-400 mb-1">预期用户</div>
            <div className="text-2xl font-bold text-aura-pink">100-200万</div>
            <div className="text-xs text-gray-400">Year 1</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-gray-400 mb-1">获客成本</div>
            <div className="text-2xl font-bold text-aura-orange">$55-110</div>
            <div className="text-xs text-gray-400">每用户</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-xs text-gray-400 mb-1">执行周期</div>
            <div className="text-2xl font-bold text-green-500">12个月</div>
            <div className="text-xs text-gray-400">Year 1</div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4">💡 常见问题</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Q: 我能赚多少钱？</h4>
              <p className="text-gray-400 text-sm">
                取决于你的粉丝数、推广能力和内容质量。新人创作者月收入可达$16K+，中等创作者可达$140K+（假设$ORA=$1）
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Q: 如何参与？</h4>
              <p className="text-gray-400 text-sm">
                点击上方三个策略卡片，选择适合你的方式。可以同时参与多个计划，收益叠加。
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Q: 有什么限制吗？</h4>
              <p className="text-gray-400 text-sm">
                需要真实创作和推广。我们有严格的防刷机制，作弊者将被永久封禁。
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Q: Token什么时候到账？</h4>
              <p className="text-gray-400 text-sm">
                推广挖矿和周榜：每日/每周自动发放。粉丝迁移：阶梯式5次发放（12个月）。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
