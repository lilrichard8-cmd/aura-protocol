import { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { storage } from '../utils/storage'

export const Drafts: FC = () => {
  const navigate = useNavigate()
  const drafts = storage.getDrafts()

  const handleEdit = (draft: any) => {
    navigate('/create', { state: { draft } })
  }

  const handleDelete = (draftId: string) => {
    if (confirm('确定删除这个草稿吗？')) {
      storage.deleteDraft(draftId)
      window.location.reload() // 刷新页面
    }
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        <h1 className="text-4xl font-bold mb-6">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            草稿箱
          </span>
        </h1>

        {drafts.length > 0 ? (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-aura-purple/50 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{draft.title || '未命名草稿'}</h3>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                      {draft.description || '暂无描述'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>📁 {draft.contentType || '文本'}</span>
                      <span>⏰ {new Date(draft.updatedAt || Date.now()).toLocaleString('zh-CN')}</span>
                      {draft.file && <span>📎 {draft.file.name}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(draft)}
                      className="px-4 py-2 bg-gradient-aura rounded-lg text-white text-sm font-semibold hover:opacity-90"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      className="px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-500 text-sm font-semibold hover:bg-red-500/30"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-bold mb-2">暂无草稿</h2>
            <p className="text-gray-400 mb-6">创作内容时点击"保存草稿"即可保存</p>
            <button
              onClick={() => navigate('/create')}
              className="px-6 py-3 bg-gradient-aura rounded-xl text-white font-semibold hover:opacity-90"
            >
              开始创作
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
