import { FC, useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { storage } from '../utils/storage'
import { useAuth } from '../contexts/AuthContext'

export const Create: FC = () => {
  const { connected, publicKey } = useWallet()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [tags, setTags] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contentType, setContentType] = useState('text')
  const [accessControl, setAccessControl] = useState('public')
  const [price, setPrice] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  
  // Content License fields
  const [licenseType, setLicenseType] = useState<'CC0' | 'CCBY' | 'PayToEmbed' | 'PayToRemix' | 'Exclusive'>('CC0')
  const [embedPrice, setEmbedPrice] = useState('')
  const [remixRoyaltyBps, setRemixRoyaltyBps] = useState('1000') // 10% default
  const [commercialAllowed, setCommercialAllowed] = useState(true)
  const [derivativesAllowed, setDerivativesAllowed] = useState(true)
  const [attributionRequired, setAttributionRequired] = useState(true)

  // 加载草稿（如果从草稿箱进入）
  useEffect(() => {
    const draft = location.state?.draft
    if (draft) {
      setTitle(draft.title || '')
      setDescription(draft.description || '')
      setContentType(draft.contentType || 'text')
      setAccessControl(draft.accessControl || 'public')
      setPrice(draft.price || '')
    }
  }, [location])

  const handleSaveDraft = () => {
    const draft = {
      id: Date.now().toString(),
      title,
      description,
      contentType,
      accessControl,
      price,
      file: file ? { name: file.name, size: file.size } : null,
      updatedAt: Date.now(),
    }
    
    storage.saveDraft(draft)
    alert('📝 草稿已保存！\n\n可以稍后在草稿箱继续编辑')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    
    if (selectedFile) {
      // 生成预览
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setFilePreview(reader.result as string)
        }
        reader.readAsDataURL(selectedFile)
      } else if (selectedFile.type.startsWith('video/')) {
        const url = URL.createObjectURL(selectedFile)
        setFilePreview(url)
      } else {
        setFilePreview(null)
      }
    } else {
      setFilePreview(null)
    }
  }

  const availableTags = ['摄影', '音乐', '艺术', '文学', '技术', '其他']

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) { alert('请输入标题'); return }
    if (!description.trim()) { alert('请输入描述'); return }

    const authorName = user?.username || (connected ? publicKey?.toString().slice(0, 8) + '.sol' : 'Anonymous')
    const authorAvatar = user?.avatar || '👤'

    const colors = [
      'from-purple-500 to-pink-500', 'from-blue-500 to-cyan-500',
      'from-green-500 to-teal-500', 'from-orange-500 to-red-500',
      'from-indigo-500 to-purple-500',
    ]
    const typeEmojis: Record<string, string> = { text: '📝', image: '🎨', video: '🎬', audio: '🎵', mixed: '✨' }

    const newPost = {
      id: `user-post-${Date.now()}`,
      title,
      author: authorName,
      authorAvatar,
      authorEmail: user?.email || '',
      description,
      type: contentType,
      coverImage: filePreview || typeEmojis[contentType] || '📝',
      coverColor: colors[Math.floor(Math.random() * colors.length)],
      price: accessControl === 'paid' ? Number(price) || 0 : 0,
      isPaid: accessControl === 'paid',
      isUnlocked: false,
      likes: 0,
      views: 0,
      comments: 0,
      height: 'medium',
      onMarket: accessControl === 'paid',
      createdAt: Date.now(),
      tags,
      hasImage: !!filePreview,
    }

    storage.savePost(newPost)
    alert('✅ 发布成功！')
    navigate('/explore')
  }

  return (
    <div className="min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">
          <span className="bg-gradient-aura bg-clip-text text-transparent">
            创作内容
          </span>
        </h1>
        <p className="text-gray-400 mb-12">
          发布你的作品到 Arweave，永久存储，真正拥有
        </p>

        {/* 测试模式提示 */}
        {!connected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-semibold text-yellow-500 mb-1">测试模式</h3>
              <p className="text-sm text-gray-300">
                你现在处于测试模式，可以试用所有功能。真实发布内容需要连接 Solana 钱包。
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                placeholder="输入标题..."
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white resize-none"
                placeholder="输入描述..."
                required
              />
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium mb-2">内容类型</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
              >
                <option value="text">文本</option>
                <option value="image">图片</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
                <option value="mixed">混合</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium mb-2">标签/分类</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      tags.includes(tag)
                        ? 'bg-gradient-aura text-white'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">上传文件（可选）</label>
              <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:border-aura-purple/50 transition-colors">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept="image/*,video/*,audio/*"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  {file ? (
                    <div>
                      {/* File Preview */}
                      {filePreview && (
                        <div className="mb-4">
                          {file.type.startsWith('image/') && (
                            <img 
                              src={filePreview} 
                              alt="Preview" 
                              className="max-h-64 mx-auto rounded-lg"
                            />
                          )}
                          {file.type.startsWith('video/') && (
                            <video 
                              src={filePreview} 
                              controls 
                              className="max-h-64 mx-auto rounded-lg"
                            />
                          )}
                        </div>
                      )}
                      <div className="text-4xl mb-2">📄</div>
                      <p className="text-white">{file.name}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setFile(null)
                          setFilePreview(null)
                        }}
                        className="mt-2 text-sm text-red-400 hover:text-red-300"
                      >
                        移除文件
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-2">📁</div>
                      <p className="text-white mb-1">点击上传文件</p>
                      <p className="text-sm text-gray-400">
                        支持图片、视频、音频等多种格式
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Access Control */}
            <div>
              <label className="block text-sm font-medium mb-2">访问控制</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  accessControl === 'public'
                    ? 'border-aura-purple bg-aura-purple/10'
                    : 'border-white/10 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="access"
                    value="public"
                    checked={accessControl === 'public'}
                    onChange={(e) => setAccessControl(e.target.value)}
                    className="hidden"
                  />
                  <div className="text-center">
                    <div className="text-2xl mb-2">🌍</div>
                    <div className="font-semibold">公开</div>
                    <div className="text-sm text-gray-400 mt-1">所有人可见</div>
                  </div>
                </label>

                <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  accessControl === 'paid'
                    ? 'border-aura-pink bg-aura-pink/10'
                    : 'border-white/10 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="access"
                    value="paid"
                    checked={accessControl === 'paid'}
                    onChange={(e) => setAccessControl(e.target.value)}
                    className="hidden"
                  />
                  <div className="text-center">
                    <div className="text-2xl mb-2">💰</div>
                    <div className="font-semibold">付费查看</div>
                    <div className="text-sm text-gray-400 mt-1">需要付费</div>
                  </div>
                </label>

                <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  accessControl === 'burn'
                    ? 'border-aura-orange bg-aura-orange/10'
                    : 'border-white/10 hover:border-white/20'
                }`}>
                  <input
                    type="radio"
                    name="access"
                    value="burn"
                    checked={accessControl === 'burn'}
                    onChange={(e) => setAccessControl(e.target.value)}
                    className="hidden"
                  />
                  <div className="text-center">
                    <div className="text-2xl mb-2">🔥</div>
                    <div className="font-semibold">阅后即焚</div>
                    <div className="text-sm text-gray-400 mt-1">一次性查看</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Price (if paid access) */}
            {accessControl === 'paid' && (
              <div>
                <label className="block text-sm font-medium mb-2">价格 ($ORA)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                  placeholder="输入价格..."
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            )}

            {/* Content License */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-lg font-semibold mb-4">📜 内容许可</h3>
              
              {/* License Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">许可类型</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    licenseType === 'CC0'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}>
                    <input
                      type="radio"
                      name="license"
                      value="CC0"
                      checked={licenseType === 'CC0'}
                      onChange={(e) => setLicenseType(e.target.value as any)}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="text-2xl mb-2">🌐</div>
                      <div className="font-semibold">CC0</div>
                      <div className="text-xs text-gray-400 mt-1">完全开放</div>
                    </div>
                  </label>

                  <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    licenseType === 'CCBY'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}>
                    <input
                      type="radio"
                      name="license"
                      value="CCBY"
                      checked={licenseType === 'CCBY'}
                      onChange={(e) => setLicenseType(e.target.value as any)}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="text-2xl mb-2">📝</div>
                      <div className="font-semibold">CC BY</div>
                      <div className="text-xs text-gray-400 mt-1">需要署名</div>
                    </div>
                  </label>

                  <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    licenseType === 'PayToEmbed'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}>
                    <input
                      type="radio"
                      name="license"
                      value="PayToEmbed"
                      checked={licenseType === 'PayToEmbed'}
                      onChange={(e) => setLicenseType(e.target.value as any)}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="text-2xl mb-2">💰</div>
                      <div className="font-semibold">付费嵌入</div>
                      <div className="text-xs text-gray-400 mt-1">嵌入需付费</div>
                    </div>
                  </label>

                  <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    licenseType === 'PayToRemix'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}>
                    <input
                      type="radio"
                      name="license"
                      value="PayToRemix"
                      checked={licenseType === 'PayToRemix'}
                      onChange={(e) => setLicenseType(e.target.value as any)}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="text-2xl mb-2">🎨</div>
                      <div className="font-semibold">付费二创</div>
                      <div className="text-xs text-gray-400 mt-1">二创需付费</div>
                    </div>
                  </label>

                  <label className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    licenseType === 'Exclusive'
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}>
                    <input
                      type="radio"
                      name="license"
                      value="Exclusive"
                      checked={licenseType === 'Exclusive'}
                      onChange={(e) => setLicenseType(e.target.value as any)}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="text-2xl mb-2">🔒</div>
                      <div className="font-semibold">独占许可</div>
                      <div className="text-xs text-gray-400 mt-1">完全独占</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Embed Price (if PayToEmbed or PayToRemix) */}
              {(licenseType === 'PayToEmbed' || licenseType === 'PayToRemix') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    {licenseType === 'PayToEmbed' ? '嵌入价格' : '二创价格'} ($ORA)
                  </label>
                  <input
                    type="number"
                    value={embedPrice}
                    onChange={(e) => setEmbedPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                    placeholder="输入价格..."
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {licenseType === 'PayToEmbed' 
                      ? '其他创作者嵌入你的内容时需要支付的费用' 
                      : '其他创作者基于你的内容进行二次创作时需要支付的费用'}
                  </p>
                </div>
              )}

              {/* Remix Royalty (if derivatives allowed) */}
              {(licenseType === 'PayToRemix' || derivativesAllowed) && licenseType !== 'Exclusive' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">二创分成比例 (%)</label>
                  <input
                    type="number"
                    value={Number(remixRoyaltyBps) / 100}
                    onChange={(e) => setRemixRoyaltyBps(String(Number(e.target.value) * 100))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                    placeholder="输入分成比例..."
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    基于你内容的二创作品获得收益时，你将自动获得此比例的分成
                  </p>
                </div>
              )}

              {/* License Options */}
              {licenseType !== 'Exclusive' && licenseType !== 'CC0' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={commercialAllowed}
                      onChange={(e) => setCommercialAllowed(e.target.checked)}
                      className="w-5 h-5 rounded border-white/20 bg-white/5 text-aura-purple focus:ring-aura-purple"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">允许商业使用</div>
                      <div className="text-xs text-gray-400">允许他人将你的内容用于商业目的</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={derivativesAllowed}
                      onChange={(e) => setDerivativesAllowed(e.target.checked)}
                      className="w-5 h-5 rounded border-white/20 bg-white/5 text-aura-purple focus:ring-aura-purple"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">允许衍生作品</div>
                      <div className="text-xs text-gray-400">允许他人基于你的内容进行二次创作</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={attributionRequired}
                      onChange={(e) => setAttributionRequired(e.target.checked)}
                      className="w-5 h-5 rounded border-white/20 bg-white/5 text-aura-purple focus:ring-aura-purple"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">要求署名</div>
                      <div className="text-xs text-gray-400">使用你的内容时必须注明原作者</div>
                    </div>
                  </label>
                </div>
              )}

              {/* License Summary */}
              <div className="mt-4 bg-aura-purple/10 border border-aura-purple/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2">📋 许可总结</h4>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>• 许可类型: <span className="text-white font-semibold">{licenseType}</span></p>
                  {(licenseType === 'PayToEmbed' || licenseType === 'PayToRemix') && embedPrice && (
                    <p>• {licenseType === 'PayToEmbed' ? '嵌入' : '二创'}价格: <span className="text-white font-semibold">{embedPrice} $ORA</span></p>
                  )}
                  {derivativesAllowed && licenseType !== 'CC0' && (
                    <p>• 二创分成: <span className="text-white font-semibold">{Number(remixRoyaltyBps) / 100}%</span></p>
                  )}
                  {licenseType !== 'CC0' && licenseType !== 'Exclusive' && (
                    <>
                      <p>• 商业使用: <span className="text-white font-semibold">{commercialAllowed ? '允许' : '禁止'}</span></p>
                      <p>• 衍生作品: <span className="text-white font-semibold">{derivativesAllowed ? '允许' : '禁止'}</span></p>
                      <p>• 署名要求: <span className="text-white font-semibold">{attributionRequired ? '必须' : '可选'}</span></p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 px-6 py-4 bg-gradient-aura rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
              >
                {connected ? '发布到 Arweave' : '测试发布'}
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-6 py-4 bg-white/10 rounded-lg text-white font-semibold hover:bg-white/20 transition-colors border border-white/20"
              >
                保存草稿
              </button>
            </div>

            {/* Info */}
            <div className="bg-aura-purple/10 border border-aura-purple/30 rounded-lg p-4 text-sm text-gray-300">
              <p className="mb-2">📝 <strong>提示：</strong></p>
              <ul className="space-y-1 ml-4">
                <li>• 内容将永久存储在 Arweave，无法删除</li>
                <li>• NFT 铸造费用：50 $ORA（100% 销毁）</li>
                <li>• 创作者收益：95%（5% 平台手续费）</li>
                <li>• 收益锁定：7 天（争议追回窗口）</li>
              </ul>
            </div>
          </form>
      </div>
    </div>
  )
}
