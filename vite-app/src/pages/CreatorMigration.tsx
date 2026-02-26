import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const platforms = [
  { id: 'youtube', name: 'YouTube', icon: '📺', color: 'from-red-500 to-red-600' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: 'from-black to-cyan-500' },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: 'from-purple-500 to-pink-500' },
  { id: 'twitter', name: 'Twitter', icon: '🐦', color: 'from-blue-400 to-blue-600' },
  { id: 'xiaohongshu', name: '小红书', icon: '📕', color: 'from-red-600 to-pink-500' },
  { id: 'bilibili', name: 'B站', icon: '📺', color: 'from-blue-400 to-pink-400' },
]

export const CreatorMigration: FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: 填写信息, 2: 身份验证
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [username, setUsername] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [followerCount, setFollowerCount] = useState('')
  const [contentType, setContentType] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 生成验证码
    const code = `AURA-VERIFY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    setGeneratedCode(code)
    setStep(2)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (verificationCode !== generatedCode) {
      alert('⚠️ 验证码错误\n\n请确保在你的账号主页或最新视频中包含验证码')
      return
    }

    const estimatedReward = parseInt(followerCount) || 0
    const cappedReward = Math.min(estimatedReward, 500000)

    alert(`✅ 申请已提交！

📋 申请信息：
━━━━━━━━━━━━━━━━
🌐 平台：${platforms.find(p => p.id === selectedPlatform)?.name}
👤 用户名：${username}
👥 粉丝数：${followerCount}
📁 类型：${contentType}
✅ 身份验证：已通过

💰 预估奖励（需审核）：
━━━━━━━━━━━━━━━━
基础奖励：${cappedReward.toLocaleString()} $ORA

📅 审核流程：
1. 我们会验证你的账号真实性
2. 检查粉丝活跃度
3. 评估内容质量
4. 3-7个工作日内通过邮件通知结果

⚠️ 防重复申请：
系统已记录你的申请。同一创作者只能以粉丝数最高的平台申请一次。

（测试模式）`)
    
    setStep(1)
    setVerificationCode('')
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

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-aura bg-clip-text text-transparent">
              创作者迁移申请
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            带你的粉丝来AURA，1粉丝=1 $ORA，上限50万
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-white' : 'text-gray-500'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= 1 ? 'bg-gradient-aura' : 'bg-white/10'
            }`}>
              1
            </div>
            <span>填写信息</span>
          </div>
          <div className="w-16 h-1 bg-white/20"></div>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-white' : 'text-gray-500'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= 2 ? 'bg-gradient-aura' : 'bg-white/10'
            }`}>
              2
            </div>
            <span>身份验证</span>
          </div>
        </div>

        {/* Step 1: Application Form */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
              <p className="text-blue-400 font-semibold mb-2">⚠️ 重要提示：</p>
              <p className="text-sm text-gray-300">
                • 同一创作者只能申请一次，请选择粉丝数最多的平台<br/>
                • 我们会验证你的账号真实性和粉丝活跃度<br/>
                • 需要完成身份验证才能提交申请
              </p>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">
                选择平台 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {platforms.map((platform) => (
                  <label
                    key={platform.id}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${
                      selectedPlatform === platform.id
                        ? 'border-aura-purple bg-aura-purple/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="platform"
                      value={platform.id}
                      checked={selectedPlatform === platform.id}
                      onChange={(e) => setSelectedPlatform(e.target.value)}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="text-3xl mb-2">{platform.icon}</div>
                      <div className="font-semibold text-sm">{platform.name}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                💡 请选择你粉丝数最多的平台（原则上不可重复申请）
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2">
                用户名/频道名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                placeholder="你在该平台的用户名"
                required
              />
            </div>

            {/* Profile URL */}
            <div>
              <label className="block text-sm font-medium mb-2">
                主页链接 <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                placeholder="https://youtube.com/@yourname"
                required
              />
            </div>

            {/* Follower Count */}
            <div>
              <label className="block text-sm font-medium mb-2">
                粉丝/订阅数 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                placeholder="请如实填写"
                min="100"
                required
              />
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium mb-2">
                内容类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                required
              >
                <option value="">请选择</option>
                <option value="education">教育/教程</option>
                <option value="art">数字艺术</option>
                <option value="music">音乐</option>
                <option value="video">视频/Vlog</option>
                <option value="photography">摄影</option>
                <option value="writing">写作/文章</option>
                <option value="other">其他</option>
              </select>
            </div>

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
                下一步：身份验证
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Verification */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-yellow-500">🔐 身份验证</h3>
              <p className="text-gray-300 mb-4">
                为了验证你是账号的真实拥有者，请完成以下步骤：
              </p>
              
              <div className="bg-black/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-400 mb-2">你的验证码：</p>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <code className="text-xl font-bold text-green-400">{generatedCode}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCode)
                      alert('✅ 验证码已复制')
                    }}
                    className="px-3 py-1 bg-white/10 rounded text-sm hover:bg-white/20"
                  >
                    复制
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-sm text-gray-300">
                <p className="font-semibold text-white">请选择以下任一方式验证：</p>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="font-semibold mb-2">方式1：发布内容验证（推荐）</p>
                  <ul className="space-y-1 text-xs ml-4">
                    <li>• 在你的平台发布新内容（视频/帖子）</li>
                    <li>• 在标题或描述中包含验证码</li>
                    <li>• 内容可以是AURA介绍或任何其他主题</li>
                  </ul>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <p className="font-semibold mb-2">方式2：个人简介验证</p>
                  <ul className="space-y-1 text-xs ml-4">
                    <li>• 在你的账号个人简介/Bio中添加验证码</li>
                    <li>• 保持至少24小时</li>
                  </ul>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <p className="font-semibold mb-2">方式3：置顶评论验证</p>
                  <ul className="space-y-1 text-xs ml-4">
                    <li>• 在你的任一视频/帖子下发布评论</li>
                    <li>• 评论内容包含验证码</li>
                    <li>• 将评论置顶</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                确认验证 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white"
                placeholder="完成验证后，输入验证码确认"
                required
              />
              <p className="text-xs text-gray-400 mt-2">
                💡 我们会在3个工作日内人工检查验证码，请确保验证码可见
              </p>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <p className="text-purple-400 font-semibold mb-2">📋 提交后我们会：</p>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• 验证你的账号真实性</li>
                <li>• 检查粉丝活跃度（AI分析）</li>
                <li>• 评估内容质量</li>
                <li>• 检查是否重复申请（同一人不同平台）</li>
                <li>• 3-7个工作日通过邮件/Discord通知结果</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-4 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-colors"
              >
                上一步
              </button>
              <button
                onClick={handleSubmit}
                disabled={!verificationCode}
                className="flex-1 py-4 bg-gradient-aura rounded-xl text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                提交申请
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
