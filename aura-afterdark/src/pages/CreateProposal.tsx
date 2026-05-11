import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const committees = [
  { id: 'development', name: '发展委员会', icon: '🏗️', description: '外部合作与战略发展' },
  { id: 'content', name: '内容委员会', icon: '📝', description: '内容政策与规范制定' },
  { id: 'operations', name: '运营委员会', icon: '⚙️', description: '平台运营与预算管理' },
  { id: 'arbitration', name: '仲裁委员会', icon: '⚖️', description: '争议解决与仲裁' },
  { id: 'technical', name: '技术委员会', icon: '🔧', description: '代码审计与技术升级' },
]

const proposalTiers = [
  { 
    id: 'tier1', 
    name: 'Tier I - 核心治理', 
    icon: '👑', 
    description: '协议核心参数变更、重大升级',
    threshold: '95%',
    minStake: 10000,
    examples: '分成比例、核心算法、治理规则'
  },
  { 
    id: 'tier2', 
    name: 'Tier II - 重要决策', 
    icon: '⚖️', 
    description: '平台重要功能、合作关系',
    threshold: '75%',
    minStake: 5000,
    examples: '新功能开发、重要合作、预算分配'
  },
  { 
    id: 'tier3', 
    name: 'Tier III - 日常运营', 
    icon: '⚙️', 
    description: '日常运营决策、小型改进',
    threshold: '50%',
    minStake: 1000,
    examples: '界面优化、小功能、运营活动'
  },
  { 
    id: 'tier4', 
    name: 'Tier IV - 委员会决策', 
    icon: '🏛️', 
    description: '委员会内部决策事项',
    threshold: '委员会投票',
    minStake: 100,
    examples: '委员会内部流程、技术细节'
  },
]

const proposalTypes = [
  { id: 'policy', name: '政策变更', icon: '📋', description: '修改平台规则或政策' },
  { id: 'budget', name: '预算分配', icon: '💰', description: '年度预算或资金分配' },
  { id: 'partnership', name: '合作批准', icon: '🤝', description: '外部合作伙伴关系' },
  { id: 'upgrade', name: '技术升级', icon: '🔧', description: '代码升级或新功能' },
  { id: 'other', name: '其他', icon: '📌', description: '其他类型的提案' },
]

export const CreateProposalPage: FC = () => {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCommittee, setSelectedCommittee] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedTier, setSelectedTier] = useState('')
  const [stakeAmount, setStakeAmount] = useState('1000')
  const [showPreview, setShowPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCommittee || !selectedType || !selectedTier) {
      alert('请选择委员会、提案类型和治理层级')
      return
    }

    const selectedTierData = proposalTiers.find(t => t.id === selectedTier)
    if (!selectedTierData) return

    const requiredStake = selectedTierData.minStake
    if (parseInt(stakeAmount) < requiredStake) {
      alert(`${selectedTierData.name} 最低需要质押 ${requiredStake} $ORA`)
      return
    }

    setIsSubmitting(true)

    // 模拟提交上链
    setTimeout(() => {
      const message = `✅ 提案创建成功！

📋 提案信息：
━━━━━━━━━━━━━━━━
📌 标题：${title}
📝 说明：${description.substring(0, 50)}...
🏛️ 委员会：${committees.find(c => c.id === selectedCommittee)?.name}
🏅 治理层级：${selectedTierData.name}
📊 通过门槛：${selectedTierData.threshold}
📂 类型：${proposalTypes.find(t => t.id === selectedType)?.name}
💰 质押：${stakeAmount} $ORA

📅 投票时间：7 天
⏰ 结束时间：${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN')}

🎁 奖励：
• 提案通过：10,000 $ORA
• 提案失败：1,000 $ORA

✅ 上链成功！交易已确认
提案已提交，等待社区投票！

（测试模式）`

      alert(message)
      navigate('/governance')
    }, 2000)
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-aura-bg">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-aura-text-secondary hover:text-aura-text transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        <h1 className="text-4xl font-bold mb-4">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            创建提案
          </span>
        </h1>
        <p className="text-aura-text-secondary mb-8">
          向社区提交你的想法，共同决定平台未来
        </p>

        {/* Requirements banner */}
        <div className="bg-aura-accent/10 border border-aura-accent/30 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-3 text-aura-accent">📝 提案要求</h3>
          <ul className="space-y-2 text-sm text-aura-text-secondary">
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
              提案标题 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full px-4 py-3 bg-aura-surface/5 border border-aura-border rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-aura-text"
              placeholder="简明扼要地描述你的提案..."
              required
            />
            <div className="text-xs text-aura-text-secondary mt-1 text-right">
              {title.length} / 100
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              详细说明 <span className="text-error">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={8}
              className="w-full px-4 py-3 bg-aura-surface/5 border border-aura-border rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-aura-text resize-none"
              placeholder="详细描述你的提案内容、原因、预期效果等..."
              required
            />
            <div className="text-xs text-aura-text-secondary mt-1 text-right">
              {description.length} / 5000
            </div>
          </div>

          {/* Committee selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              选择委员会 <span className="text-error">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {committees.map((committee) => (
                <label
                  key={committee.id}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedCommittee === committee.id
                      ? 'border-aura-purple bg-aura-purple/10'
                      : 'border-aura-border hover:border-aura-border/50'
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
                      <div className="text-xs text-aura-text-secondary">{committee.description}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Proposal Tier */}
          <div>
            <label className="block text-sm font-medium mb-2">
              治理层级 <span className="text-error">*</span>
            </label>
            <div className="space-y-3">
              {proposalTiers.map((tier) => (
                <label
                  key={tier.id}
                  className={`block p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedTier === tier.id
                      ? 'border-aura-purple bg-aura-purple/10'
                      : 'border-aura-border hover:border-aura-border/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier.id}
                    checked={selectedTier === tier.id}
                    onChange={(e) => setSelectedTier(e.target.value)}
                    className="hidden"
                  />
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{tier.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="font-semibold">{tier.name}</div>
                        <div className="px-3 py-1 bg-aura-accent/20 text-aura-accent rounded-full text-xs font-semibold">
                          通过: {tier.threshold}
                        </div>
                        <div className="px-3 py-1 bg-aura-gold/20 text-aura-gold rounded-full text-xs font-semibold">
                          最低质押: {tier.minStake} $ORA
                        </div>
                      </div>
                      <div className="text-sm text-aura-text-secondary mb-2">{tier.description}</div>
                      <div className="text-xs text-aura-text-secondary">示例：{tier.examples}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Proposal type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              提案类型 <span className="text-error">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {proposalTypes.map((type) => (
                <label
                  key={type.id}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedType === type.id
                      ? 'border-aura-pink bg-aura-pink/10'
                      : 'border-aura-border hover:border-aura-border/50'
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
                    <div className="text-xs text-aura-text-secondary">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Stake amount */}
          <div>
            <label className="block text-sm font-medium mb-2">
              质押金额 ($ORA) <span className="text-error">*</span>
            </label>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              min={selectedTier ? proposalTiers.find(t => t.id === selectedTier)?.minStake || 100 : 100}
              step="1"
              className="w-full px-4 py-3 bg-aura-surface/5 border border-aura-border rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-aura-text"
              placeholder={selectedTier ? `最低 ${proposalTiers.find(t => t.id === selectedTier)?.minStake || 100} $ORA` : "选择治理层级后显示要求"}
              required
            />
            <div className="text-xs text-aura-text-secondary mt-1">
              💡 {selectedTier 
                ? `${proposalTiers.find(t => t.id === selectedTier)?.name} 最低需要质押 ${proposalTiers.find(t => t.id === selectedTier)?.minStake} $ORA`
                : '质押金额根据治理层级要求而定，质押金额越高提案可信度越高'
              }
            </div>
          </div>

          {/* Rewards info */}
          <div className="bg-gradient-aura/20 border border-aura-purple/30 rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>🎁</span>
              <span>提案奖励</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-success/10 rounded-xl border border-green-500/30">
                <div className="text-3xl font-bold text-success mb-1">10,000</div>
                <div className="text-xs text-aura-text-secondary mb-2">$ORA</div>
                <div className="text-sm text-success font-semibold">提案通过</div>
              </div>
              <div className="text-center p-4 bg-aura-accent/10 rounded-xl border border-aura-accent/30">
                <div className="text-3xl font-bold text-aura-accent mb-1">1,000</div>
                <div className="text-xs text-aura-text-secondary mb-2">$ORA</div>
                <div className="text-sm text-aura-accent font-semibold">提案失败</div>
              </div>
            </div>
            <div className="text-xs text-aura-text-secondary text-center mt-3">
              质押金额将在投票结束后返还
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-4 bg-aura-surface/10 border border-aura-border rounded-xl text-aura-text font-semibold hover:bg-aura-surface/20 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={!title || !description || !selectedTier || !selectedCommittee || !selectedType}
              className="flex-1 py-4 bg-aura-accent/20 border border-aura-accent/50 rounded-xl text-aura-accent font-semibold hover:bg-aura-accent/30 transition-colors disabled:opacity-50"
            >
              预览提案
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 bg-gradient-aura rounded-xl text-aura-text font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? '提交中...' : '提交提案'}
            </button>
          </div>
        </form>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-aura-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-aura-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-aura-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">提案预览</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="w-8 h-8 bg-aura-surface/10 rounded-lg flex items-center justify-center hover:bg-aura-surface/20 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Preview Header */}
              <div className="bg-aura-surface/5 border border-aura-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-aura-accent/20 text-aura-accent rounded-full text-sm font-semibold">
                    ⏳ 预览模式
                  </span>
                  <span className="px-3 py-1 bg-aura-surface/10 rounded-full text-sm">
                    {committees.find(c => c.id === selectedCommittee)?.name}
                  </span>
                </div>
                
                <h3 className="text-2xl font-bold mb-3">{title}</h3>
                
                <div className="flex items-center gap-4 text-sm text-aura-text-secondary mb-4">
                  <span>👤 @你的用户名</span>
                  <span>📅 {new Date().toLocaleDateString('zh-CN')}</span>
                </div>

                {selectedTier && (
                  <div className={`p-4 rounded-xl mb-4 ${
                    selectedTier === 'tier1' ? 'bg-aura-gold/10 border border-aura-gold/30' :
                    selectedTier === 'tier2' ? 'bg-orange-500/10 border border-orange-500/30' :
                    selectedTier === 'tier3' ? 'bg-blue-500/10 border border-blue-500/30' :
                    'bg-purple-500/10 border border-purple-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{proposalTiers.find(t => t.id === selectedTier)?.icon}</span>
                      <div>
                        <div className="font-semibold">
                          {proposalTiers.find(t => t.id === selectedTier)?.name}
                        </div>
                        <div className="text-sm text-aura-text-secondary">
                          通过门槛：{proposalTiers.find(t => t.id === selectedTier)?.threshold}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Content */}
              <div className="bg-aura-surface/5 border border-aura-border rounded-xl p-6">
                <h4 className="font-semibold mb-3">提案说明</h4>
                <div className="text-aura-text-secondary leading-relaxed whitespace-pre-wrap">
                  {description}
                </div>
              </div>

              {/* Preview Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-aura-surface/5 border border-aura-border rounded-xl p-4">
                  <div className="text-sm text-aura-text-secondary mb-1">提案类型</div>
                  <div className="font-semibold">
                    {proposalTypes.find(t => t.id === selectedType)?.name}
                  </div>
                </div>
                <div className="bg-aura-surface/5 border border-aura-border rounded-xl p-4">
                  <div className="text-sm text-aura-text-secondary mb-1">质押金额</div>
                  <div className="font-semibold text-aura-gold">{stakeAmount} $ORA</div>
                </div>
              </div>

              <div className="bg-aura-gold/10 border border-aura-gold/30 rounded-xl p-4 text-sm text-aura-text-secondary">
                <p className="font-semibold text-aura-gold mb-2">⚠️ 提交前确认：</p>
                <ul className="space-y-1">
                  <li>• 提案内容准确无误</li>
                  <li>• 质押金额将被锁定至投票结束</li>
                  <li>• 提案一经提交无法修改</li>
                  <li>• 投票期限为7天</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-3 bg-aura-surface/10 rounded-lg text-aura-text font-semibold hover:bg-aura-surface/20 transition-colors"
                >
                  继续编辑
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false)
                    handleSubmit(new Event('submit') as any)
                  }}
                  className="flex-1 py-3 bg-gradient-aura rounded-lg text-aura-text font-bold hover:opacity-90 transition-opacity"
                >
                  确认提交
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}