import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'

const CURVE_TYPES = [
  {
    value: 'Linear',
    name: '线性曲线',
    description: '价格随供应量线性增长，适合稳定发展',
    formula: 'Price = k × Supply',
    emoji: '📈',
  },
  {
    value: 'Quadratic',
    name: '二次曲线',
    description: '价格增长逐渐加快，适合中长期投资',
    formula: 'Price = k × Supply²',
    emoji: '📊',
  },
  {
    value: 'Cubic',
    name: '三次曲线',
    description: '价格增长最快，高风险高回报',
    formula: 'Price = k × Supply³',
    emoji: '🚀',
  },
]

export const CreateCreatorCoin: FC = () => {
  const navigate = useNavigate()
  const { connected } = useWallet()

  const [formData, setFormData] = useState({
    symbol: '',
    curveType: 'Linear',
    curveParamK: '1000',
    curveParamN: '1',
    creatorFeeBps: '500', // 5%
  })

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Symbol validation
    if (!formData.symbol) {
      newErrors.symbol = '请输入代币符号'
    } else if (formData.symbol.length > 10) {
      newErrors.symbol = '代币符号不能超过10个字符'
    } else if (!/^[A-Z0-9]+$/.test(formData.symbol)) {
      newErrors.symbol = '代币符号只能包含大写字母和数字'
    }

    // Curve param K validation
    const k = Number(formData.curveParamK)
    if (!formData.curveParamK || isNaN(k) || k <= 0) {
      newErrors.curveParamK = '请输入有效的曲线参数 K'
    }

    // Creator fee validation
    const fee = Number(formData.creatorFeeBps)
    if (!formData.creatorFeeBps || isNaN(fee) || fee < 0 || fee > 1000) {
      newErrors.creatorFeeBps = '创作者费用必须在 0-10% 之间'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!connected) {
      alert('请先连接钱包')
      return
    }

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      // In production, call SDK to create creator coin
      // This requires burning 1000 ORA tokens
      // await sdk.creatorCoin.create({
      //   symbol: formData.symbol,
      //   curveType: CURVE_TYPES.findIndex(c => c.value === formData.curveType),
      //   curveParamK: Number(formData.curveParamK),
      //   curveParamN: Number(formData.curveParamN),
      //   creatorFeeBps: Number(formData.creatorFeeBps),
      // })

      // Mock success
      await new Promise((resolve) => setTimeout(resolve, 2000))
      alert('Creator Coin 创建成功！')
      navigate('/creator-coin')
    } catch (error) {
      console.error('Create error:', error)
      alert('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const getCurveParamN = () => {
    switch (formData.curveType) {
      case 'Linear':
        return '1'
      case 'Quadratic':
        return '2'
      case 'Cubic':
        return '3'
      default:
        return '1'
    }
  }

  return (
    <div className="min-h-screen pt-6 pb-32 px-4 bg-black">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/creator-coin')}
          className="mb-6 px-4 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          ← 返回
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-aura bg-clip-text text-transparent">创建 Creator Coin</span>
          </h1>
          <p className="text-gray-400">
            发行你自己的创作者代币，让粉丝投资支持你的创作
          </p>
        </div>

        {/* Info Card */}
        <div className="mb-8 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span>⚠️</span>
            <span>重要提示</span>
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>• 创建 Creator Coin 需要燃烧 <strong className="text-yellow-400">1000 $ORA</strong> 代币</p>
            <p>• 一个钱包地址只能创建一个 Creator Coin</p>
            <p>• 创建后无法修改参数，请谨慎设置</p>
            <p>• 代币基于联合曲线（Bonding Curve）机制，价格由数学公式决定</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
          {/* Symbol */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              代币符号 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
              placeholder="例如: ART, MUSIC, WRITE"
              maxLength={10}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white placeholder-gray-500"
            />
            {errors.symbol && <p className="mt-2 text-sm text-red-400">{errors.symbol}</p>}
            <p className="mt-2 text-xs text-gray-400">最多10个字符，仅支持大写字母和数字</p>
          </div>

          {/* Curve Type */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              联合曲线类型 <span className="text-red-400">*</span>
            </label>
            <div className="grid gap-4">
              {CURVE_TYPES.map((curve) => (
                <div
                  key={curve.value}
                  onClick={() => {
                    handleChange('curveType', curve.value)
                    handleChange('curveParamN', curve.value === 'Linear' ? '1' : curve.value === 'Quadratic' ? '2' : '3')
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.curveType === curve.value
                      ? 'border-aura-purple bg-aura-purple/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{curve.emoji}</div>
                    <div className="flex-1">
                      <h4 className="font-bold mb-1">{curve.name}</h4>
                      <p className="text-sm text-gray-400 mb-2">{curve.description}</p>
                      <code className="text-xs bg-black/30 px-2 py-1 rounded">{curve.formula}</code>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        formData.curveType === curve.value
                          ? 'border-aura-purple bg-aura-purple'
                          : 'border-white/30'
                      }`}
                    >
                      {formData.curveType === curve.value && (
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Curve Parameter K */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              曲线参数 K <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={formData.curveParamK}
              onChange={(e) => handleChange('curveParamK', e.target.value)}
              placeholder="1000"
              min="1"
              step="1"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-aura-purple transition-colors text-white placeholder-gray-500"
            />
            {errors.curveParamK && <p className="mt-2 text-sm text-red-400">{errors.curveParamK}</p>}
            <p className="mt-2 text-xs text-gray-400">
              控制价格增长速度，数值越大初始价格越高。建议: 1000-10000
            </p>
          </div>

          {/* Creator Fee */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              创作者费用 <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                value={formData.creatorFeeBps}
                onChange={(e) => handleChange('creatorFeeBps', e.target.value)}
                min="0"
                max="1000"
                step="50"
                className="flex-1"
              />
              <div className="w-24 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-center font-bold">
                {(Number(formData.creatorFeeBps) / 100).toFixed(1)}%
              </div>
            </div>
            {errors.creatorFeeBps && <p className="mt-2 text-sm text-red-400">{errors.creatorFeeBps}</p>}
            <p className="mt-2 text-xs text-gray-400">
              每笔买卖交易你将获得的手续费比例，最高 10%
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gradient-to-r from-aura-purple/10 to-aura-pink/10 border border-aura-purple/20 rounded-xl p-4">
            <h4 className="font-bold mb-3">预览</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">代币符号</span>
                <span className="font-semibold">${formData.symbol || '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">曲线类型</span>
                <span className="font-semibold">{formData.curveType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">曲线参数</span>
                <span className="font-semibold">
                  K={formData.curveParamK}, N={getCurveParamN()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">创作者费用</span>
                <span className="font-semibold">{(Number(formData.creatorFeeBps) / 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between pt-2 mt-2 border-t border-white/10">
                <span className="text-gray-400">创建成本</span>
                <span className="font-bold text-yellow-400">1000 $ORA</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!connected || loading}
            className={`w-full py-4 rounded-lg font-bold text-white transition-all ${
              !connected || loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-aura hover:opacity-90'
            }`}
          >
            {!connected
              ? '请先连接钱包'
              : loading
              ? '创建中...'
              : '创建 Creator Coin (燃烧 1000 $ORA)'}
          </button>
        </form>

        {/* Additional Info */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">💡 如何选择参数？</h3>
          <div className="space-y-3 text-sm text-gray-300">
            <div>
              <strong className="text-white">曲线类型：</strong>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• <strong>线性</strong>：适合稳定增长，风险较低</li>
                <li>• <strong>二次</strong>：平衡型，适合大多数创作者</li>
                <li>• <strong>三次</strong>：早期投资者回报高，但风险也大</li>
              </ul>
            </div>
            <div>
              <strong className="text-white">参数 K：</strong>
              <p className="mt-1">控制初始价格和增长速度。建议根据你的粉丝基础和预期市值设置。</p>
            </div>
            <div>
              <strong className="text-white">创作者费用：</strong>
              <p className="mt-1">
                你的主要收入来源。设置太高可能影响交易活跃度，建议 3-5%。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
