import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const committees = [
  { id: 'development', name: '发展委员会', icon: '🏗️', description: '外部合作与战略发展' },
  { id: 'content', name: '内容委员会', icon: '📝', description: '内容政策与规范制定' },
  { id: 'operations', name: '运营委员会', icon: '⚙️', description: '平台运营与预算管理' },
  { id: 'arbitration', name: '仲裁委员会', icon: '⚖️', description: '争议解决与仲裁' },
  { id: 'technical', name: '技术委员会', icon: '🔧', description: '代码审计与技术升级' },
]

const proposalTypes = [
  { id: 'policy', name: '政策变更', icon: '📋', description: '修改平台规则或政策' },
  { id: 'budget', name: '预算分配', icon: '💰', description: '年度预算或资金分配' },
  { id: 'partnership', name: '合作批准', icon: '🤝', description: '外部合作伙伴关系' },
  { id: 'upgrade', name: '技术升级', icon: '🔧', description: '代码升级或新功能' },
  { id: 'other', name: '其他', icon: '📌', description: '其他类型的提案' },
]

export const CreateProposal: FC = () => {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCommittee, setSelectedCommittee] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [stakeAmount, setStakeAmount] = useState('100')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCommittee || !selectedType) {
      alert('请选择委员会和提案类型')
      return
    }

    const message = `✅ 提案创建成功！

📋 提案信息：
━━━━━━━━━━━━━━━━
📌 标题：${title}
📝 说明：${description.substring(0, 50)}...
🏛️ 委员会：${committees.find(c => c.id === selectedCommittee)?.name}
📂 类型：${proposalTypes.find(t => t.id === selectedType)?.name}
💰 质押：${stakeAmount} $ORA

📅 投票时间：7 天
⏰ 结束时间：${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN')}

🎁 奖励：
• 提案通过：10,000 $ORA
• 提案失败：1,000 $ORA

提案已提交，等待社区投票！

（测试模式）`

    alert(message)
    navigate('/governance')
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        <h1 className="text-4xl font-bold mb-4">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            创建提案
          </span>
        </h1>
        <p className="text-gray-400 mb-8">
          向社区提交你的想法，共同决定平台未来
        </p>

        {/* Requirements banner */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-3 text-blue-500">📝 提案要求</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• 持有至少 100 $ORA（用于质押）</li>
            <li>• 标题不超过 100 字符</li>
            <li>• 详细说明不超过 5000 字符</li>
            <li>• 选择合适的委员会处理</li>
            <li>• 投票期限为 7 天</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              提案标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
              placeholder="简明扼要地描述你的提案..."
              required
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {title.length} / 100
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              详细说明 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={8}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white resize-none"
              placeholder="详细描述你的提案内容、原因、预期效果等..."
              required
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {description.length} / 5000
            </div>
          </div>

          {/* Committee selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              选择委员会 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {committees.map((committee) => (
                <label
                  key={committee.id}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedCommittee === committee.id
                      ? 'border-aura-purple bg-aura-purple/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="committee"
                    value={committee.id}
                    checked={selectedCommittee === committee.id}
                    onChange={(e) => setSelectedCommittee(e.target.value)}
                    className="hidden"
                  />
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{committee.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold mb-1">{committee.name}</div>
                      <div className="text-xs text-gray-400">{committee.description}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Proposal type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              提案类型 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {proposalTypes.map((type) => (
                <label
                  key={type.id}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedType === type.id
                      ? 'border-aura-pink bg-aura-pink/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={type.id}
                    checked={selectedType === type.id}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="hidden"
                  />
                  <div className="text-center">
                    <div className="text-3xl mb-2">{type.icon}</div>
                    <div className="font-semibold text-sm mb-1">{type.name}</div>
                    <div className="text-xs text-gray-400">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Stake amount */}
          <div>
            <label className="block text-sm font-medium mb-2">
              质押金额 ($ORA) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              min="100"
              step="1"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
              placeholder="最低 100 $ORA"
              required
            />
            <div className="text-xs text-gray-400 mt-1">
              💡 质押金额越高，提案可信度越高（最低 100 $ORA）
            </div>
          </div>

          {/* Rewards info */}
          <div className="bg-gradient-aura/20 border border-aura-purple/30 rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>🎁</span>
              <span>提案奖励</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                <div className="text-3xl font-bold text-green-500 mb-1">10,000</div>
                <div className="text-xs text-gray-400 mb-2">$ORA</div>
                <div className="text-sm text-green-500 font-semibold">提案通过</div>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                <div className="text-3xl font-bold text-blue-500 mb-1">1,000</div>
                <div className="text-xs text-gray-400 mb-2">$ORA</div>
                <div className="text-sm text-blue-500 font-semibold">提案失败</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 text-center mt-3">
              质押金额将在投票结束后返还
            </div>
          </div>

          {/* Submit button */}
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
              className="flex-1 py-4 bg-gradient-aura rounded-xl text-white font-bold text-lg hover:opacity-90 transition-opacity"
            >
              提交提案
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
