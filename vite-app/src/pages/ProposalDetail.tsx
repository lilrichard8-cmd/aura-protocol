import { FC, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const mockDiscussions = [
  { id: '1', author: 'User1.sol', avatar: '👤', content: '非常支持这个提案！', vote: 'for', time: '2小时前', likes: 23 },
  { id: '2', author: 'User2.sol', avatar: '😊', content: '我有一些疑虑，希望能详细讨论...', vote: 'against', time: '5小时前', likes: 12 },
  { id: '3', author: 'User3.sol', avatar: '🎯', content: '建议加入更多细节', vote: 'for', time: '1天前', likes: 34 },
]

export const ProposalDetail: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const proposal = location.state?.proposal

  const [showVoteModal, setShowVoteModal] = useState(false)
  const [voteChoice, setVoteChoice] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')

  if (!proposal) {
    return (
      <div className="min-h-screen pt-20 pb-32 px-4 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold mb-2">提案未找到</h2>
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

  const votePercentage = (proposal.votesFor / proposal.totalVotes) * 100

  const handleVote = (voteFor: boolean) => {
    setVoteChoice(voteFor)
    setShowVoteModal(true)
  }

  const confirmVote = () => {
    alert(`✅ 投票成功！\n\n提案：${proposal.title}\n你的选择：${voteChoice ? '✓ 支持' : '✗ 反对'}\n投票权重：1,234 票\n\n（测试模式）`)
    setShowVoteModal(false)
    setVoteChoice(null)
  }

  const postComment = () => {
    if (!comment.trim()) return
    alert(`评论已发布：\n\n${comment}\n\n（测试模式）`)
    setComment('')
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        {/* Proposal header */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  proposal.status === 'voting'
                    ? 'bg-blue-500/20 text-blue-500'
                    : proposal.status === 'passed'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}>
                  {proposal.status === 'voting' ? '⏳ 投票中' : proposal.status === 'passed' ? '✅ 已通过' : '❌ 未通过'}
                </span>
                <span className="px-3 py-1 bg-white/10 rounded-full text-sm">{proposal.committee}</span>
              </div>
              <h1 className="text-3xl font-bold mb-4">{proposal.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>👤 @{proposal.proposer}</span>
                <span>📅 {proposal.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="prose prose-invert max-w-none mb-6">
            <h3 className="text-lg font-semibold mb-3">提案说明</h3>
            <p className="text-gray-300 leading-relaxed">{proposal.description}</p>
          </div>

          {/* Vote stats */}
          <div className="bg-white/5 rounded-xl p-6 mb-6">
            <h3 className="font-semibold mb-4">投票统计</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-500 font-semibold">✓ 支持</span>
                  <span className="text-white">{proposal.votesFor.toLocaleString()} 票</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${votePercentage}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-red-500 font-semibold">✗ 反对</span>
                  <span className="text-white">{proposal.votesAgainst.toLocaleString()} 票</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${100 - votePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-between">
                <span className="text-gray-400">总投票数</span>
                <span className="font-bold">{proposal.totalVotes.toLocaleString()} 票</span>
              </div>
              
              {proposal.status === 'voting' && (
                <div className="pt-3 border-t border-white/10 flex justify-between">
                  <span className="text-gray-400">投票结束</span>
                  <span className="font-semibold text-yellow-500">{proposal.endsIn}</span>
                </div>
              )}
            </div>
          </div>

          {/* Vote buttons */}
          {proposal.status === 'voting' && (
            <div className="flex gap-4">
              <button
                onClick={() => handleVote(true)}
                className="flex-1 py-4 bg-green-500/20 border-2 border-green-500/50 rounded-xl text-green-500 font-bold text-lg hover:bg-green-500/30 transition-colors"
              >
                ✓ 支持提案
              </button>
              <button
                onClick={() => handleVote(false)}
                className="flex-1 py-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl text-red-500 font-bold text-lg hover:bg-red-500/30 transition-colors"
              >
                ✗ 反对提案
              </button>
            </div>
          )}
        </div>

        {/* Discussion */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4">讨论 ({mockDiscussions.length})</h3>

          {/* Comment input */}
          <div className="mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="发表你的看法..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={postComment}
                disabled={!comment.trim()}
                className="px-6 py-2 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90 disabled:opacity-50"
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
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {disc.vote === 'for' ? '支持' : '反对'}
                    </span>
                    <span className="text-xs text-gray-500">{disc.time}</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{disc.content}</p>
                  <button className="text-xs text-gray-400 hover:text-white">
                    ❤️ {disc.likes}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vote Modal */}
      {showVoteModal && voteChoice !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-4">确认投票</h2>
            
            <div className="mb-6">
              <div className={`p-4 rounded-xl text-center ${
                voteChoice
                  ? 'bg-green-500/20 border border-green-500/50'
                  : 'bg-red-500/20 border border-red-500/50'
              }`}>
                <div className="text-4xl mb-2">{voteChoice ? '✓' : '✗'}</div>
                <div className={`text-xl font-bold ${voteChoice ? 'text-green-500' : 'text-red-500'}`}>
                  {voteChoice ? '支持此提案' : '反对此提案'}
                </div>
                <div className="text-2xl font-bold text-white mt-2">1,234 票</div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6 text-xs text-gray-300">
              <p className="text-yellow-500 font-semibold mb-2">⚠️ 投票须知：</p>
              <ul className="space-y-1">
                <li>• 投票后无法更改或撤回</li>
                <li>• 投票权重将被锁定至投票结束</li>
                <li>• 你的选择将公开显示</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowVoteModal(false)}
                className="flex-1 px-4 py-3 bg-white/10 rounded-lg text-white font-semibold hover:bg-white/20"
              >
                取消
              </button>
              <button
                onClick={confirmVote}
                className={`flex-1 px-4 py-3 rounded-lg text-white font-bold ${
                  voteChoice ? 'bg-green-500' : 'bg-red-500'
                } hover:opacity-90`}
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
