import { FC, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

const mockIncentivePrograms = [
  {
    id: '1',
    title: 'Creator Boost Program',
    description: '新创作者扶持计划，前30天收益翻倍',
    type: 'creator_boost',
    reward: '双倍收益',
    duration: '30天',
    requirements: ['新注册用户', '发布≥5个内容', '获得≥100个互动'],
    participants: 234,
    totalReward: '50,000 ORA',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
    status: 'active',
    icon: '🚀',
    color: 'from-aura-accent to-aura-accent-hover',
  },
  {
    id: '2',
    title: 'Community Builder',
    description: '社区建设者激励，推广平台获得持续奖励',
    type: 'referral',
    reward: '100 ORA/邀请',
    duration: '长期',
    requirements: ['成功邀请用户', '被邀请用户活跃度≥7天', '推广优质内容'],
    participants: 156,
    totalReward: '无上限',
    startDate: '2024-01-01',
    endDate: '持续进行',
    status: 'active',
    icon: '🤝',
    color: 'from-aura-gold to-yellow-500',
  },
  {
    id: '3',
    title: 'Top Creator Challenge',
    description: '月度顶级创作者挑战，争夺丰厚奖金池',
    type: 'competition',
    reward: '10,000 ORA奖金池',
    duration: '每月',
    requirements: ['月收益排名前10', '内容质量评分≥4.5', '无违规记录'],
    participants: 89,
    totalReward: '10,000 ORA',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
    status: 'active',
    icon: '🏆',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: '4',
    title: 'Beta Tester Rewards',
    description: '参与新功能测试，获得独家奖励',
    type: 'beta',
    reward: '500 ORA + 专属NFT',
    duration: '2周',
    requirements: ['参与功能测试', '提交有效反馈', '报告bug'],
    participants: 45,
    totalReward: '22,500 ORA + NFT',
    startDate: '2024-02-15',
    endDate: '2024-02-28',
    status: 'ended',
    icon: '🧪',
    color: 'from-gray-500 to-gray-400',
  },
]

const mockUserProgress = [
  {
    programId: '1',
    progress: 3,
    target: 5,
    completed: false,
    reward: 0,
    status: 'in_progress',
  },
  {
    programId: '2',
    progress: 8,
    target: 10,
    completed: false,
    reward: 800,
    status: 'in_progress',
  },
]

export const Incentives: FC = () => {
  const { connected } = useWallet()
  const [activeTab, setActiveTab] = useState<'active' | 'ended' | 'my_progress'>('active')
  const [joining, setJoining] = useState<string | null>(null)

  const filteredPrograms = mockIncentivePrograms.filter(program => {
    if (activeTab === 'active') return program.status === 'active'
    if (activeTab === 'ended') return program.status === 'ended'
    return true
  })

  const handleJoinProgram = async (programId: string) => {
    if (!connected) {
      alert('请先连接钱包')
      return
    }

    setJoining(programId)
    try {
      // Mock joining process
      await new Promise(resolve => setTimeout(resolve, 1500))
      alert('成功加入激励计划！')
    } catch (error) {
      alert('加入失败，请重试')
    } finally {
      setJoining(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
            进行中
          </span>
        )
      case 'ended':
        return (
          <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full">
            已结束
          </span>
        )
      default:
        return null
    }
  }

  const getUserProgress = (programId: string) => {
    return mockUserProgress.find(p => p.programId === programId)
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-aura-bg">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-aura-accent to-aura-gold bg-clip-text text-transparent">
              激励计划
            </span>
          </h1>
          <p className="text-aura-text-secondary">
            参与平台激励计划，获得额外收益和专属奖励
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">进行中计划</div>
            <div className="text-2xl font-bold text-aura-text">
              {mockIncentivePrograms.filter(p => p.status === 'active').length}
            </div>
          </div>
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">总参与人数</div>
            <div className="text-2xl font-bold text-aura-text">
              {mockIncentivePrograms.reduce((sum, p) => sum + p.participants, 0)}
            </div>
          </div>
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">我的进行中</div>
            <div className="text-2xl font-bold text-aura-text">
              {mockUserProgress.filter(p => !p.completed).length}
            </div>
          </div>
          <div className="bg-aura-card border border-aura-border rounded-xl p-4">
            <div className="text-aura-text-secondary text-sm mb-1">累计收益</div>
            <div className="text-2xl font-bold text-aura-gold">
              {mockUserProgress.reduce((sum, p) => sum + p.reward, 0)} ORA
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-aura-surface rounded-full p-1 mb-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            🔥 进行中 ({mockIncentivePrograms.filter(p => p.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'ended'
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            📝 已结束 ({mockIncentivePrograms.filter(p => p.status === 'ended').length})
          </button>
          <button
            onClick={() => setActiveTab('my_progress')}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              activeTab === 'my_progress'
                ? 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white'
                : 'text-aura-text-secondary hover:text-aura-text'
            }`}
          >
            📊 我的进度 ({mockUserProgress.length})
          </button>
        </div>

        {/* Programs List */}
        {(activeTab === 'active' || activeTab === 'ended') && (
          <div className="grid gap-6">
            {filteredPrograms.map((program) => {
              const userProgress = getUserProgress(program.id)
              
              return (
                <div
                  key={program.id}
                  className={`bg-aura-card border border-aura-border rounded-2xl p-6 ${
                    program.status === 'ended' ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${program.color} flex items-center justify-center text-3xl`}>
                        {program.icon}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-aura-text">{program.title}</h3>
                          {getStatusBadge(program.status)}
                        </div>
                        
                        <p className="text-aura-text-secondary text-sm mb-4">{program.description}</p>
                        
                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-aura-text-secondary mb-1">奖励</div>
                            <div className="text-aura-text font-semibold">{program.reward}</div>
                          </div>
                          <div>
                            <div className="text-aura-text-secondary mb-1">持续时间</div>
                            <div className="text-aura-text font-semibold">{program.duration}</div>
                          </div>
                          <div>
                            <div className="text-aura-text-secondary mb-1">参与人数</div>
                            <div className="text-aura-text font-semibold">{program.participants} 人</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {program.status === 'active' && (
                      <button
                        onClick={() => handleJoinProgram(program.id)}
                        disabled={joining === program.id || !!userProgress}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                          userProgress
                            ? 'bg-green-500/20 text-green-400 cursor-default'
                            : joining === program.id
                            ? 'bg-aura-text-secondary/30 cursor-not-allowed text-aura-text-secondary'
                            : 'bg-gradient-to-r from-aura-accent to-aura-accent-hover text-white hover:shadow-lg'
                        }`}
                      >
                        {userProgress
                          ? '已参与 ✓'
                          : joining === program.id
                          ? '加入中...'
                          : '🎯 立即参与'}
                      </button>
                    )}
                  </div>

                  {/* Requirements */}
                  <div className="mb-4">
                    <div className="text-sm text-aura-text-secondary mb-2">参与要求：</div>
                    <div className="flex flex-wrap gap-2">
                      {program.requirements.map((req, index) => (
                        <span
                          key={index}
                          className="text-xs bg-aura-surface px-3 py-1 rounded-full text-aura-text"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Progress for joined programs */}
                  {userProgress && (
                    <div className="bg-aura-surface/50 rounded-xl p-4 mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-aura-text-secondary">
                          我的进度: {userProgress.progress}/{userProgress.target}
                        </span>
                        <span className="text-sm text-aura-text-secondary">
                          {Math.round((userProgress.progress / userProgress.target) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-aura-surface rounded-full h-2">
                        <div
                          className="h-2 bg-gradient-to-r from-aura-accent to-aura-gold rounded-full transition-all"
                          style={{ width: `${(userProgress.progress / userProgress.target) * 100}%` }}
                        ></div>
                      </div>
                      {userProgress.reward > 0 && (
                        <div className="text-sm text-aura-gold mt-2">
                          已获得奖励: {userProgress.reward} ORA
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex items-center gap-4 text-xs text-aura-text-secondary mt-4 pt-4 border-t border-aura-border">
                    <span>开始: {program.startDate}</span>
                    <span>结束: {program.endDate}</span>
                    <span>奖池: {program.totalReward}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* My Progress Tab */}
        {activeTab === 'my_progress' && (
          <div className="space-y-6">
            {mockUserProgress.map((progress) => {
              const program = mockIncentivePrograms.find(p => p.id === progress.programId)
              if (!program) return null

              return (
                <div
                  key={progress.programId}
                  className="bg-aura-card border border-aura-border rounded-2xl p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${program.color} flex items-center justify-center text-3xl`}>
                      {program.icon}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-aura-text mb-2">{program.title}</h3>
                      
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-aura-text-secondary">
                            进度: {progress.progress}/{progress.target}
                          </span>
                          <span className="text-sm text-aura-text-secondary">
                            {Math.round((progress.progress / progress.target) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-aura-surface rounded-full h-3">
                          <div
                            className="h-3 bg-gradient-to-r from-aura-accent to-aura-gold rounded-full transition-all"
                            style={{ width: `${(progress.progress / progress.target) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-aura-text-secondary">
                          状态: {progress.completed ? '已完成' : '进行中'}
                        </div>
                        <div className="text-lg font-bold text-aura-gold">
                          {progress.reward > 0 && `已赚取: ${progress.reward} ORA`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info Card */}
        <div className="mt-8 bg-gradient-to-r from-aura-accent/10 to-aura-gold/10 border border-aura-accent/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3 text-aura-text">💡 激励计划说明</h3>
          <div className="text-aura-text-secondary text-sm space-y-2">
            <p>• <strong>Creator Boost</strong>：新创作者扶持，帮助优质创作者快速成长</p>
            <p>• <strong>Community Builder</strong>：推广平台获得持续收益，共建生态</p>
            <p>• <strong>Top Creator Challenge</strong>：顶级创作者竞赛，激励高质量内容</p>
            <p>• <strong>Beta Testing</strong>：参与新功能测试，获得独家奖励</p>
            <p>• 所有奖励自动发放到您的钱包，无需手动领取</p>
          </div>
        </div>
      </div>
    </div>
  )
}