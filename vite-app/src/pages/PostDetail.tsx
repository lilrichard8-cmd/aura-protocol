import { FC, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { storage } from '../utils/storage'

const mockComments = [
  { id: '1', author: 'User1.sol', avatar: '😊', content: '太棒了！', likes: 12, time: '2小时前' },
  { id: '2', author: 'User2.sol', avatar: '🎉', content: '非常有创意的作品！', likes: 8, time: '5小时前' },
  { id: '3', author: 'User3.sol', avatar: '👍', content: '支持！继续加油', likes: 15, time: '1天前' },
]

const mockRecommended = [
  { id: '101', title: '类似作品1', author: 'Creator1.sol', thumbnail: '🎨', likes: 234 },
  { id: '102', title: '类似作品2', author: 'Creator2.sol', thumbnail: '🎨', likes: 189 },
  { id: '103', title: '类似作品3', author: 'Creator3.sol', thumbnail: '🎨', likes: 156 },
  { id: '104', title: '类似作品4', author: 'Creator4.sol', thumbnail: '🎨', likes: 123 },
]

export const PostDetail: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const post = location.state?.post

  const [comment, setComment] = useState('')
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState(mockComments)
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState('')

  // 从localStorage恢复点赞状态
  useEffect(() => {
    if (post?.id) {
      setLiked(storage.isPostLiked(post.id))
      // 添加到浏览历史
      storage.addToHistory({ id: post.id, title: post.title, type: 'post' })
    }
  }, [post])

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

  const handleLike = () => {
    if (!post) return
    
    if (liked) {
      storage.removeLikedPost(post.id)
      setLiked(false)
      alert('取消点赞')
    } else {
      storage.addLikedPost(post.id)
      setLiked(true)
      alert('点赞成功！')
    }
  }

  const handleComment = () => {
    if (!comment.trim()) return
    
    const newComment = {
      id: Date.now().toString(),
      author: 'You.sol',
      avatar: '😎',
      content: comment,
      likes: 0,
      time: '刚刚',
    }
    
    setComments([newComment, ...comments])
    setComment('')
    alert('评论发布成功！')
  }

  const handleTip = () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) return
    
    alert(`✅ 打赏成功！\n\n💰 打赏金额：${tipAmount} $ORA\n👤 创作者：@${post.author}\n\n创作者将收到 ${tipAmount} $ORA（100%，无手续费）\n\n（测试模式）`)
    
    setShowTipModal(false)
    setTipAmount('')
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

        {/* Content area */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-6">
          {/* Main content */}
          <div className={`bg-gradient-to-br ${post.coverColor} ${post.type === 'text' ? 'p-8' : 'aspect-video'} flex items-center justify-center`}>
            {post.type === 'text' ? (
              <div className="max-w-2xl">
                <h1 className="text-3xl font-bold text-white mb-4">{post.title}</h1>
                <p className="text-white/90 text-lg leading-relaxed">{post.description}</p>
              </div>
            ) : (
              <div className="text-9xl">{post.coverImage}</div>
            )}
          </div>

          {/* Info section */}
          <div className="p-6">
            {/* Author and title */}
            <div className="flex items-start justify-between mb-4">
              <div 
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate(`/user/${post.author}`)}
              >
                <div className="w-12 h-12 bg-gradient-aura rounded-full flex items-center justify-center text-2xl">
                  {post.authorAvatar}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{post.title}</h2>
                  <p className="text-gray-400 text-sm">@{post.author}</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-gradient-aura rounded-lg text-white text-sm font-semibold hover:opacity-90">
                + 关注
              </button>
            </div>

            {/* Description (for non-text) */}
            {post.type !== 'text' && (
              <p className="text-gray-300 mb-4">{post.description}</p>
            )}

            {/* Stats and actions */}
            <div className="flex items-center justify-between py-4 border-y border-white/10">
              <div className="flex items-center gap-6 text-gray-400">
                <button
                  onClick={handleLike}
                  className="flex items-center gap-2 hover:text-red-500 transition-colors"
                >
                  <span>{liked ? '❤️' : '🤍'}</span>
                  <span>{post.likes + (liked ? 1 : 0)}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span>💬</span>
                  <span>{comments.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>👁️</span>
                  <span>{post.views}</span>
                </div>
                <button
                  onClick={() => setShowTipModal(true)}
                  className="flex items-center gap-2 hover:text-yellow-500 transition-colors"
                >
                  <span>💰</span>
                  <span>打赏</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                  🔗
                </button>
                <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                  ⭐
                </button>
                <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                  ⚠️
                </button>
              </div>
            </div>

            {/* Purchase section */}
            {post.onMarket && post.price > 0 && (
              <div className="mt-4 p-4 bg-gradient-aura/20 border border-aura-purple/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400">价格</div>
                    <div className="text-2xl font-bold text-white">{post.price} $ORA</div>
                  </div>
                  <button className="px-6 py-3 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90">
                    立即购买
                  </button>
                </div>
              </div>
            )}

            {!post.onMarket && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-yellow-500 font-semibold">未在售</div>
                    <div className="text-xs text-gray-400">可以向创作者发起求购</div>
                  </div>
                  <button 
                    onClick={() => navigate('/make-offer', { state: { post } })}
                    className="px-6 py-3 bg-yellow-500 rounded-lg text-white font-semibold hover:bg-yellow-600 transition-colors">
                    💡 发起求购
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comments section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-4">评论 ({comments.length})</h3>

          {/* Comment input */}
          <div className="mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="说点什么..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleComment}
                disabled={!comment.trim()}
                className="px-6 py-2 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                发送
              </button>
            </div>
          </div>

          {/* Comments list */}
          <div className="space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-10 h-10 bg-gradient-aura rounded-full flex items-center justify-center flex-shrink-0">
                  {c.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="font-semibold text-sm cursor-pointer hover:text-aura-purple transition-colors"
                      onClick={() => navigate(`/user/${c.author}`)}
                    >
                      @{c.author}
                    </span>
                    <span className="text-xs text-gray-500">{c.time}</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{c.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <button className="hover:text-red-500 transition-colors">
                      ❤️ {c.likes}
                    </button>
                    <button className="hover:text-white transition-colors">
                      回复
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Content */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-6">
          <h3 className="text-xl font-bold mb-4">💡 推荐内容</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mockRecommended.map((rec) => (
              <div
                key={rec.id}
                onClick={() => navigate(`/post/${rec.id}`)}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-aura-purple/50 transition-all cursor-pointer hover:scale-105"
              >
                <div className="aspect-square bg-gradient-to-br from-aura-purple/20 to-aura-pink/20 flex items-center justify-center text-5xl">
                  {rec.thumbnail}
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-sm mb-1 line-clamp-1">{rec.title}</h4>
                  <p 
                    className="text-xs text-gray-400 mb-2 cursor-pointer hover:text-aura-purple"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/user/${rec.author}`)
                    }}
                  >
                    @{rec.author}
                  </p>
                  <div className="text-xs text-gray-400">
                    ❤️ {rec.likes}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tip Modal */}
        {showTipModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
              <h2 className="text-2xl font-bold mb-4">💰 打赏创作者</h2>
              
              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-2">创作者：</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{post.authorAvatar}</span>
                  <span className="font-semibold">@{post.author}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">打赏金额 ($ORA)</label>
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                  placeholder="输入金额..."
                  min="1"
                  step="1"
                />
                <div className="flex gap-2 mt-3">
                  {[10, 50, 100, 500].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTipAmount(amount.toString())}
                      className="flex-1 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors"
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-6 text-sm">
                <p className="text-green-500 font-semibold mb-2">💡 打赏说明：</p>
                <ul className="text-gray-300 space-y-1 text-xs">
                  <li>• 100%金额归创作者（无手续费）</li>
                  <li>• 立即到账创作者金库</li>
                  <li>• 7天后可提现</li>
                  <li>• 你的支持是最大的鼓励</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTipModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 rounded-lg text-white font-semibold hover:bg-white/20 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleTip}
                  disabled={!tipAmount || parseFloat(tipAmount) <= 0}
                  className="flex-1 px-4 py-3 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认打赏
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
