import { FC } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const mockMembers = [
  {
    id: '1',
    name: 'Alice Chen',
    username: 'alice.sol',
    address: 'ALice...x7Hq',
    avatar: '👩‍💼',
    role: '主席',
    since: '2026-01-01',
    proposalsHandled: 45,
  },
  {
    id: '2',
    name: 'Bob Johnson',
    username: 'bob.sol',
    address: 'BoB12...9KpL',
    avatar: '🧑‍💼',
    role: '委员',
    since: '2026-01-01',
    proposalsHandled: 38,
  },
  {
    id: '3',
    name: 'Charlie Wang',
    username: 'charlie.sol',
    address: 'ChaR...mN3p',
    avatar: '👨‍💼',
    role: '委员',
    since: '2026-01-01',
    proposalsHandled: 42,
  },
  {
    id: '4',
    name: 'Diana Lee',
    username: 'diana.sol',
    address: 'DiAn...8QwE',
    avatar: '👩‍💼',
    role: '委员',
    since: '2026-01-01',
    proposalsHandled: 35,
  },
  {
    id: '5',
    name: 'Eric Smith',
    username: 'eric.sol',
    address: 'EriC...2Rt5',
    avatar: '🧑‍💼',
    role: '委员',
    since: '2026-01-01',
    proposalsHandled: 40,
  },
]

const mockCommitteeProposals = [
  {
    id: '1',
    title: '提高创作者分成比例至 97%',
    status: 'voting',
    votesFor: 15234,
    votesAgainst: 3421,
    date: '2026-01-28',
  },
  {
    id: '2',
    title: '优化平台手续费结构',
    status: 'passed',
    votesFor: 23456,
    votesAgainst: 1234,
    date: '2026-01-20',
  },
  {
    id: '3',
    title: '调整年度预算分配方案',
    status: 'passed',
    votesFor: 18900,
    votesAgainst: 2100,
    date: '2026-01-15',
  },
  {
    id: '4',
    title: '修改运营规则第三条',
    status: 'failed',
    votesFor: 5678,
    votesAgainst: 12345,
    date: '2026-01-10',
  },
]

export const CommitteeDetail: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const committee = location.state?.committee

  if (!committee) {
    return (
      <div className="min-h-screen pt-20 pb-32 px-4 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold mb-2">委员会未找到</h2>
          <button
            onClick={() => navigate('/governance')}
            className="mt-4 px-6 py-2 bg-gradient-aura rounded-lg text-white font-semibold"
          >
            返回治理
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-5xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        {/* Committee Header */}
        <div className="bg-gradient-aura rounded-2xl p-8 mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-start gap-4 mb-4">
              <div className="text-7xl">{committee.icon}</div>
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-white mb-2">{committee.nameCN}</h1>
                <p className="text-white/80 text-lg">{committee.name} Committee</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div>
                <div className="text-white/70 text-sm">委员人数</div>
                <div className="text-2xl font-bold text-white">{committee.members}</div>
              </div>
              <div>
                <div className="text-white/70 text-sm">处理提案</div>
                <div className="text-2xl font-bold text-white">{committee.proposals}</div>
              </div>
              <div>
                <div className="text-white/70 text-sm">成立日期</div>
                <div className="text-lg font-bold text-white">{committee.established}</div>
              </div>
              <div>
                <div className="text-white/70 text-sm">下届选举</div>
                <div className="text-lg font-bold text-white">{committee.nextElection}</div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-white/10 blur-3xl"></div>
        </div>

        {/* Committee Members */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-6">委员会成员</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockMembers.map((member) => (
              <div
                key={member.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-aura-purple/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-aura rounded-full flex items-center justify-center text-3xl">
                    {member.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{member.name}</h3>
                      {member.role === '主席' && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded font-semibold">
                          👑 {member.role}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">@{member.username}</p>
                    <div className="font-mono text-xs text-gray-500 mb-2">{member.address}</div>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>📅 任职: {member.since}</span>
                      <span>📋 处理: {member.proposalsHandled} 个</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Committee Proposals */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold mb-6">历史提案</h2>
          <div className="space-y-3">
            {mockCommitteeProposals.map((prop) => {
              const percentage = (prop.votesFor / (prop.votesFor + prop.votesAgainst)) * 100
              
              return (
                <div
                  key={prop.id}
                  onClick={() => navigate(`/proposal/${prop.id}`)}
                  className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          prop.status === 'voting'
                            ? 'bg-blue-500/20 text-blue-500'
                            : prop.status === 'passed'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {prop.status === 'voting' ? '投票中' : prop.status === 'passed' ? '已通过' : '未通过'}
                        </span>
                        <span className="text-xs text-gray-400">{prop.date}</span>
                      </div>
                      <h4 className="font-semibold">{prop.title}</h4>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-500">✓ {prop.votesFor.toLocaleString()}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-red-500">✗ {prop.votesAgainst.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
