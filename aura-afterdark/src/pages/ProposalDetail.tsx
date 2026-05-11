import { FC, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const mockDiscussions = [
  { id: '1', author: 'User1.sol', avatar: '👤', content: '非常支持这个提案！', vote: 'for', time: '2小时前', likes: 23 },
  { id: '2', author: 'User2.sol', avatar: '😊', content: '我有一些疑虑，希望能详细讨论...', vote: 'against', time: '5小时前', likes: 12 },
  { id: '3', author: 'User3.sol', avatar: '🎯', content: '建议加入更多细节', vote: 'for', time: '1天前', likes: 34 },
]

const mockVoteHistory = [
  { id: '1', voter: 'Community.sol', avatar: '🎯', votingPower: 2156, vote: 'for', time: '1小时前' },
  { id: '2', voter: 'Whale.sol', avatar: '🐋', votingPower: 4567, vote: 'for', time: '3小时前' },
  { id: '3', voter: 'Builder.sol', avatar: '🔨', votingPower: 891, vote: 'against', time: '5小时前' },
  { id: '4', voter: 'Artist.sol', avatar: '🎨', votingPower: 1234, vote: 'for', time: '8小时前' },
  { id: '5', voter: 'Trader.sol', avatar: '💰', votingPower: 2890, vote: 'against', time: '12小时前' },
]

export const ProposalDetailPage: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const proposal = location.state?.proposal

  const [showVoteModal, setShowVoteModal] = useState(false)
  const [voteChoice, setVoteChoice] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'votes' | 'discussion'>('details')
  const [isVoting, setIsVoting] = useState(false)

  if (!proposal) {
    return (
      <div className="min-h-screen pt-20 pb-32 px-4 bg-aura-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold mb-2">提案未找到</h2>
          <button
            onClick={() => navigate('/governance')}
            className="mt-4 px-6 py-2 bg-gradient-aura rounded-lg text-aura-text font-semibold"
          >
            返回治理
          </button>
        </div>
      </div>
    )
  }

  const votePercentage = (proposal.votesFor / proposal.totalVotes) * 100

  const handleVote = (voteFor: boolean) => {
    setVoteChoice(voteFor)
    setShowVoteModal(true)
  }

  const confirmVote = () => {
    setIsVoting(true)
    const oraBalance = 1234
    const votingPower = Math.min(Math.floor(Math.sqrt(oraBalance)), 10000)
    
    // 模拟上链延迟
    setTimeout(() => {
      alert(`✅ 投票成功！\n\n提案：${proposal.title}\n你的选择：${voteChoice ? '✓ 支持' : '✗ 反对'}\n投票权重：${votingPower} 票\nORA余额：${oraBalance} $ORA\n\n交易已上链确认！\n\n（测试模式）`)
      setShowVoteModal(false)
      setVoteChoice(null)
      setIsVoting(false)
    }, 2000)
  }

  const postComment = () => {
    if (!comment.trim()) return
    alert(`评论已发布：\n\n${comment}\n\n（测试模式）`)
    setComment('')
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-aura-bg">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-aura-text-secondary hover:text-aura-text transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        {/* Proposal header */}
        <div className="bg-aura-surface/5 border border-aura-border rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  proposal.status === 'voting'
                    ? 'bg-aura-accent/20 text-aura-accent'
                    : proposal.status === 'passed'
                    ? 'bg-success/20 text-success'
                    : 'bg-error/20 text-error'
                }`}>
                  {proposal.status === 'voting' ? '⏳ 投票中' : proposal.status === 'passed' ? '✅ 已通过' : '❌ 未通过'}
                </span>
                <span className="px-3 py-1 bg-aura-surface/10 rounded-full text-sm">{proposal.committee}</span>
              </div>
              <h1 className="text-3xl font-bold mb-4">{proposal.title}</h1>
              <div className="flex items-center gap-4 text-sm text-aura-text-secondary">
                <span>👤 @{proposal.proposer}</span>
                <span>📅 {proposal.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="prose prose-invert max-w-none mb-6">
            <h3 className="text-lg font-semibold mb-3">提案说明</h3>
            <p className="text-aura-text-secondary leading-relaxed">{proposal.description}</p>
          </div>

          {/* Vote stats */}
          <div className="bg-aura-surface/5 rounded-xl p-6 mb-6">
            <h3 className="font-semibold mb-4">投票统计</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-success font-semibold">✓ 支持</span>
                  <span className="text-aura-text">{proposal.votesFor.toLocaleString()} 票</span>
                </div>
                <div className="h-3 bg-aura-surface/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success"
                    style={{ width: `${votePercentage}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-error font-semibold">✗ 反对</span>
                  <span className="text-aura-text">{proposal.votesAgainst.toLocaleString()} 票</span>
                </div>
                <div className="h-3 bg-aura-surface/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-error"
                    style={{ width: `${100 - votePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-3 border-t border-aura-border flex justify-between">
                <span className="text-aura-text-secondary">总投票数</span>
                <span className="font-bold">{proposal.totalVotes.toLocaleString()} 票</span>
              </div>
              
              {proposal.status === 'voting' && (
                <div className="pt-3 border-t border-aura-border flex justify-between">
                  <span className="text-aura-text-secondary">投票结束</span>
                  <span className="font-semibold text-aura-gold">{proposal.endsIn}</span>
                </div>
              )}
            </div>
          </div>

          {/* Vote buttons */}
          {proposal.status === 'voting' && (
            <div className="flex gap-4">
              <button
                onClick={() => handleVote(true)}
                className="flex-1 py-4 bg-success/20 border-2 border-green-500/50 rounded-xl text-success font-bold text-lg hover:bg-success/30 transition-colors"
              >
                ✓ 支持提案
              </button>
              <button
                onClick={() => handleVote(false)}
                className="flex-1 py-4 bg-error/20 border-2 border-red-500/50 rounded-xl text-error font-bold text-lg hover:bg-error/30 transition-colors"
              >
                ✗ 反对提案
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'details'
                ? 'bg-gradient-aura text-aura-text'
                : 'bg-aura-surface/5 text-aura-text-secondary hover:bg-aura-surface/10'
            }`}
          >
            📋 详情
          </button>
          <button
            onClick={() => setActiveTab('votes')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'votes'
                ? 'bg-gradient-aura text-aura-text'
                : 'bg-aura-surface/5 text-aura-text-secondary hover:bg-aura-surface/10'
            }`}
          >
            🗳️ 投票记录
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'discussion'
                ? 'bg-gradient-aura text-aura-text'
                : 'bg-aura-surface/5 text-aura-text-secondary hover:bg-aura-surface/10'
            }`}
          >
            💬 讨论
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="bg-aura-surface/5 border border-aura-border rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">提案详细信息</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">提案内容</h4>
                <p className="text-aura-text-secondary leading-relaxed">{proposal.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-aura-surface/5 rounded-lg p-4">
                  <div className="text-sm text-aura-text-secondary mb-1">提案人</div>
                  <div className="font-semibold">@{proposal.proposer}</div>
                </div>
                <div className="bg-aura-surface/5 rounded-lg p-4">
                  <div className="text-sm text-aura-text-secondary mb-1">委员会</div>
                  <div className="font-semibold">{proposal.committee}</div>
                </div>
                <div className="bg-aura-surface/5 rounded-lg p-4">
                  <div className="text-sm text-aura-text-secondary mb-1">创建时间</div>
                  <div className="font-semibold">{proposal.createdAt}</div>
                </div>
                <div className="bg-aura-surface/5 rounded-lg p-4">
                  <div className="text-sm text-aura-text-secondary mb-1">
                    {proposal.status === 'voting' ? '剩余时间' : '投票结束'}
                  </div>
                  <div className="font-semibold">{proposal.endsIn}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'votes' && (
          <div className="bg-aura-surface/5 border border-aura-border rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">投票历史 ({mockVoteHistory.length})</h3>
            <div className="space-y-3">
              {mockVoteHistory.map((vote) => (
                <div key={vote.id} className="flex items-center gap-3 p-3 bg-aura-surface/5 rounded-lg border border-aura-border">
                  <div className="w-10 h-10 bg-gradient-aura rounded-full flex items-center justify-center flex-shrink-0">
                    {vote.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">@{vote.voter}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        vote.vote === 'for'
                          ? 'bg-success/20 text-success'
                          : 'bg-error/20 text-error'
                      }`}>
                        {vote.vote === 'for' ? '✓ 支持' : '✗ 反对'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-aura-text-secondary">
                      <span>权重：{vote.votingPower.toLocaleString()} 票</span>
                      <span>{vote.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'discussion' && (
          <div className="bg-aura-surface/5 border border-aura-border rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">讨论 ({mockDiscussions.length})</h3>

          {/* Comment input */}
          <div className="mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="发表你的看法..."
              className="w-full px-4 py-3 bg-aura-surface/5 border border-aura-border rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-aura-text resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={postComment}
                disabled={!comment.trim()}
                className="px-6 py-2 bg-gradient-aura rounded-lg text-aura-text font-semibold hover:opacity-90 disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-4">
            {mockDiscussions.map((disc) => (
              <div key={disc.id} className="flex gap-3">
                <div className="w-10 h-10 bg-gradient-aura rounded-full flex items-center justify-center flex-shrink-0">
                  {disc.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">@{disc.author}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      disc.vote === 'for'
                        ? 'bg-success/20 text-success'
                        : 'bg-error/20 text-error'
                    }`}>
                      {disc.vote === 'for' ? '支持' : '反对'}
                    </span>
                    <span className="text-xs text-aura-text-secondary">{disc.time}</span>
                  </div>
                  <p className="text-aura-text-secondary text-sm mb-2">{disc.content}</p>
                  <button className="text-xs text-aura-text-secondary hover:text-aura-text">
                    ❤️ {disc.likes}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* Vote Modal */}
      {showVoteModal && voteChoice !== null && (
        <div className="fixed inset-0 bg-aura-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-aura-card rounded-2xl p-6 max-w-md w-full border border-aura-border">
            <h2 className="text-2xl font-bold mb-4">确认投票</h2>
            
            <div className="mb-6">
              <div className={`p-4 rounded-xl text-center ${
                voteChoice
                  ? 'bg-success/20 border border-green-500/50'
                  : 'bg-error/20 border border-red-500/50'
              }`}>
                <div className="text-4xl mb-2">{voteChoice ? '✓' : '✗'}</div>
                <div className={`text-xl font-bold ${voteChoice ? 'text-success' : 'text-error'}`}>
                  {voteChoice ? '支持此提案' : '反对此提案'}
                </div>
                <div className="text-sm text-aura-text-secondary mt-1">你的ORA余额：1,234 $ORA</div>
                <div className="text-2xl font-bold text-aura-text mt-2">{Math.floor(Math.sqrt(1234))} 票</div>
                <div className="text-xs text-aura-text-secondary mt-1">权重计算：√1234 = {Math.floor(Math.sqrt(1234))}</div>
              </div>
            </div>

            <div className="bg-aura-gold/10 border border-aura-gold/30 rounded-lg p-3 mb-6 text-xs text-aura-text-secondary">
              <p className="text-aura-gold font-semibold mb-2">⚠️ 投票须知：</p>
              <ul className="space-y-1">
                <li>• 投票后无法更改或撤回</li>
                <li>• 投票权重将被锁定至投票结束</li>
                <li>• 你的选择将公开显示</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowVoteModal(false)}
                className="flex-1 px-4 py-3 bg-aura-surface/10 rounded-lg text-aura-text font-semibold hover:bg-aura-surface/20"
              >
                取消
              </button>
              <button
                onClick={confirmVote}
                disabled={isVoting}
                className={`flex-1 px-4 py-3 rounded-lg text-aura-text font-bold ${
                  voteChoice ? 'bg-success' : 'bg-error'
                } hover:opacity-90 disabled:opacity-50`}
              >
                {isVoting ? '提交中...' : '确认投票'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}