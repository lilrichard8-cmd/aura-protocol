import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const mockProposals = [
  {
    id: '1',
    title: '提高创作者分成比例至 97%',
    description: '为了更好地支持创作者，建议将创作者分成比例从95%提高到97%，平台手续费从5%降至3%。',
    committee: 'Operations',
    status: 'voting',
    votesFor: 15234,
    votesAgainst: 3421,
    totalVotes: 18655,
    endsIn: '2天',
    proposer: 'Community.sol',
    createdAt: '2026-01-28',
  },
  {
    id: '2',
    title: '增加新的内容分类：教育类',
    description: '随着平台教育内容增多，建议增加专门的教育分类，便于用户发现和学习。',
    committee: 'Content',
    status: 'passed',
    votesFor: 25678,
    votesAgainst: 1234,
    totalVotes: 26912,
    endsIn: '已结束',
    proposer: 'Educator.sol',
    createdAt: '2026-01-20',
  },
  {
    id: '3',
    title: '调整 NFT 铸造费用至 30 $ORA',
    description: '考虑到当前市场情况和Gas费用，建议将NFT铸造费用从50 $ORA调整至30 $ORA。',
    committee: 'Technical',
    status: 'voting',
    votesFor: 8934,
    votesAgainst: 12456,
    totalVotes: 21390,
    endsIn: '5天',
    proposer: 'Dev.sol',
    createdAt: '2026-01-25',
  },
]

const committees = [
  { 
    id: 'development',
    name: 'Development',
    nameCN: '发展委员会',
    icon: '🏗️',
    members: 5,
    proposals: 12,
    established: '2026-01-01',
    nextElection: '2027-01-01',
  },
  {
    id: 'content',
    name: 'Content',
    nameCN: '内容委员会',
    icon: '📝',
    members: 7,
    proposals: 23,
    established: '2026-01-01',
    nextElection: '2027-01-01',
  },
  {
    id: 'operations',
    name: 'Operations',
    nameCN: '运营委员会',
    icon: '⚙️',
    members: 5,
    proposals: 18,
    established: '2026-01-01',
    nextElection: '2027-01-01',
  },
  {
    id: 'arbitration',
    name: 'Arbitration',
    nameCN: '仲裁委员会',
    icon: '⚖️',
    members: 7,
    proposals: 8,
    established: '2026-01-01',
    nextElection: '2027-01-01',
  },
  {
    id: 'technical',
    name: 'Technical',
    nameCN: '技术委员会',
    icon: '🔧',
    members: 5,
    proposals: 15,
    established: '2026-01-01',
    nextElection: '2027-01-01',
  },
]

export const Governance: FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'proposals' | 'committees'>('proposals')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showVoteConfirm, setShowVoteConfirm] = useState(false)
  const [voteData, setVoteData] = useState<any>(null)

  const filteredProposals = mockProposals.filter(p => {
    if (filterStatus === 'all') return true
    return p.status === filterStatus
  })

  const handleVoteClick = (proposal: any, voteFor: boolean) => {
    setVoteData({ proposal, voteFor })
    setShowVoteConfirm(true)
  }

  const confirmVote = () => {
    const { proposal, voteFor } = voteData
    alert(`✅ 投票${voteFor ? '支持' : '反对'}：${proposal.title}\n\n你的投票权重：1,234 票\n投票类型：${voteFor ? '✓ 支持' : '✗ 反对'}\n\n投票已提交！\n\n（测试模式）`)
    setShowVoteConfirm(false)
    setVoteData(null)
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-2">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            DAO 治理
          </span>
        </h1>
        <p className="text-gray-400 mb-6">社区共同决定平台未来</p>

        {/* User Voting Power */}
        <div className="bg-gradient-aura rounded-xl p-6 mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/80 text-sm mb-1">你的投票权重</div>
                <div className="text-4xl font-bold text-white">1,234 票</div>
              </div>
              <div className="text-right">
                <div className="text-white/80 text-sm mb-1">持有 $ORA</div>
                <div className="text-2xl font-bold text-white">1,234 $ORA</div>
              </div>
            </div>
            <div className="mt-4 text-white/80 text-sm">
              💡 1 $ORA = 1 票 · 最低 100 $ORA 可参与治理
            </div>
          </div>
          <div className="absolute inset-0 bg-white/10 blur-3xl"></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('proposals')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'proposals'
                ? 'bg-gradient-aura text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            📋 提案
          </button>
          <button
            onClick={() => setActiveTab('committees')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'committees'
                ? 'bg-gradient-aura text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            🏛️ 委员会
          </button>
        </div>

        {/* Proposals Tab */}
        {activeTab === 'proposals' && (
          <div>
            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${
                  filterStatus === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilterStatus('voting')}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${
                  filterStatus === 'voting' ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'
                }`}
              >
                投票中
              </button>
              <button
                onClick={() => setFilterStatus('passed')}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${
                  filterStatus === 'passed' ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'
                }`}
              >
                已通过
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${
                  filterStatus === 'failed' ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'
                }`}
              >
                未通过
              </button>
            </div>

            {/* Proposals List */}
            <div className="space-y-4">
              {filteredProposals.map((proposal) => {
                const votePercentage = (proposal.votesFor / proposal.totalVotes) * 100

                return (
                  <div
                    key={proposal.id}
                    onClick={() => navigate(`/proposal/${proposal.id}`, { state: { proposal } })}
                    className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-aura-purple/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            proposal.status === 'voting'
                              ? 'bg-blue-500/20 text-blue-500'
                              : proposal.status === 'passed'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-red-500/20 text-red-500'
                          }`}>
                            {proposal.status === 'voting' ? '投票中' : proposal.status === 'passed' ? '已通过' : '未通过'}
                          </span>
                          <span className="text-xs text-gray-400">{proposal.committee}</span>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">{proposal.title}</h3>
                        <div className="text-sm text-gray-400">
                          提案人：@{proposal.proposer}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-xs text-gray-400 mb-1">
                          {proposal.status === 'voting' ? '结束' : '已结束'}
                        </div>
                        <div className="text-sm font-semibold">{proposal.endsIn}</div>
                      </div>
                    </div>

                    {/* Vote Progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-green-500">✓ 支持 {proposal.votesFor.toLocaleString()}</span>
                        <span className="text-red-500">✗ 反对 {proposal.votesAgainst.toLocaleString()}</span>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600"
                          style={{ width: `${votePercentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 text-right">
                        {votePercentage.toFixed(1)}% 支持
                      </div>
                    </div>

                    {/* Actions */}
                    {proposal.status === 'voting' && (
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleVoteClick(proposal, true)
                          }}
                          className="flex-1 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-500 font-semibold hover:bg-green-500/30 transition-colors"
                        >
                          ✓ 支持
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleVoteClick(proposal, false)
                          }}
                          className="flex-1 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-500 font-semibold hover:bg-red-500/30 transition-colors"
                        >
                          ✗ 反对
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Create Proposal Button */}
            <div className="mt-8 text-center">
              <button
                onClick={() => navigate('/create-proposal')}
                className="px-8 py-4 bg-gradient-aura rounded-2xl text-white font-bold text-lg hover:opacity-90 transition-opacity shadow-xl"
              >
                + 创建新提案
              </button>
            </div>
          </div>
        )}

        {/* Committees Tab */}
        {activeTab === 'committees' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {committees.map((committee) => (
                <div
                  key={committee.id}
                  onClick={() => navigate(`/committee/${committee.id}`, { state: { committee } })}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-aura-purple/50 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-5xl">{committee.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{committee.nameCN}</h3>
                      <p className="text-sm text-gray-400 mb-3">{committee.name}</p>
                      <div className="space-y-1 text-sm text-gray-400">
                        <div>👥 {committee.members} 位委员</div>
                        <div>📋 {committee.proposals} 个提案</div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        点击查看详情 →
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-3 text-yellow-500">📜 治理规则</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• 持有 100+ $ORA 即可参与治理投票</li>
                <li>• 1 $ORA = 1 票投票权</li>
                <li>• 提案需要获得 50% 以上支持才能通过</li>
                <li>• 投票期限为 7 天</li>
                <li>• 通过的提案奖励 10,000 $ORA</li>
                <li>• 未通过的提案也有 1,000 $ORA 参与奖励</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Vote Confirmation Modal */}
      {showVoteConfirm && voteData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-4">确认投票</h2>
            
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-2">提案：</p>
              <p className="font-semibold">{voteData.proposal.title}</p>
            </div>

            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-2">你的选择：</p>
              <div className={`px-4 py-3 rounded-lg font-bold ${
                voteData.voteFor
                  ? 'bg-green-500/20 text-green-500 border border-green-500/50'
                  : 'bg-red-500/20 text-red-500 border border-red-500/50'
              }`}>
                {voteData.voteFor ? '✓ 支持' : '✗ 反对'}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-2">投票权重：</p>
              <p className="text-2xl font-bold">1,234 票</p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6 text-sm">
              <p className="text-yellow-500 font-semibold mb-2">⚠️ 注意：</p>
              <ul className="text-gray-300 space-y-1 text-xs">
                <li>• 投票一经提交无法撤回</li>
                <li>• 你的投票权重将被锁定直到投票结束</li>
                <li>• 投票结果会影响提案是否通过</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowVoteConfirm(false)
                  setVoteData(null)
                }}
                className="flex-1 px-4 py-3 bg-white/10 rounded-lg text-white font-semibold hover:bg-white/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmVote}
                className={`flex-1 px-4 py-3 rounded-lg text-white font-semibold transition-opacity ${
                  voteData.voteFor
                    ? 'bg-green-500 hover:opacity-90'
                    : 'bg-red-500 hover:opacity-90'
                }`}
              >
                确认投票
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
