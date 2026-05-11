import { FC, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { createBlockchainService } from '../services/auraSDK'

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
  const wallet = useWallet()
  const { connected, publicKey } = wallet

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

    if (!connected || !publicKey) {
      alert('请先连接钱包')
      return
    }

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      // 创建区块链服务
      const blockchainService = createBlockchainService(wallet)
      
      // TODO: 真实SDK中还没有createCreatorCoin方法，这里模拟调用
      // 实际实现应该是:
      // const result = await sdk.creatorCoin.create({
      //   symbol: formData.symbol,
      //   curveType: CURVE_TYPES.findIndex(c => c.value === formData.curveType),
      //   curveParamK: BigInt(formData.curveParamK),
      //   curveParamN: Number(getCurveParamN()),
      //   creatorFeeBps: Number(formData.creatorFeeBps),
      // })
      
      // 检查余额（需要1000 ORA）
      const balance = await blockchainService.getBalance(publicKey.toString())
      if (balance.ora < 1000) {
        throw new Error(`余额不足！需要 1000 $ORA，当前仅有 ${balance.ora} $ORA`)
      }

      // 模拟创建过程
      await new Promise((resolve) => setTimeout(resolve, 2000))
      
      // TODO: 替换为真实SDK调用
      const result = {
        success: true,
        txHash: `TX${Date.now()}`,
        coinSymbol: formData.symbol,
        mintAddress: `mint-${Date.now()}`,
        burnedORA: 1000,
      }

      if (result.success) {
        alert(`✅ Creator Coin 创建成功！
        
代币符号: $${formData.symbol}
交易哈希: ${result.txHash}
燃烧 $ORA: ${result.burnedORA}

你的粉丝现在可以购买 $${formData.symbol} 来支持你的创作！`)
        
        // 可以保存到本地存储用于UI显示
        const creatorCoinData = {
          symbol: formData.symbol,
          creator: publicKey.toString(),
          curveType: formData.curveType,
          curveParamK: formData.curveParamK,
          curveParamN: getCurveParamN(),
          creatorFeeBps: formData.creatorFeeBps,
          totalSupply: 0,
          reserveBalance: 0,
          createdAt: Date.now(),
          txHash: result.txHash,
        }
        
        localStorage.setItem('creatorCoin', JSON.stringify(creatorCoinData))
        
        navigate('/creator-coin')
      } else {
        throw new Error('创建失败，请重试')
      }
    } catch (error) {
      console.error('Create error:', error)
      alert(`❌ 创建失败: ${error instanceof Error ? error.message : '未知错误'}`)
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
    <div className="min-h-screen pt-6 pb-32 px-4 bg-aura-bg">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/creator-coin')}
          className="mb-6 px-4 py-2 bg-aura-card/30 border border-aura-border rounded-lg hover:bg-aura-card/50 transition-colors"
        >
          ← 返回
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-aura-accent to-aura-gold bg-clip-text text-transparent">创建 Creator Coin</span>
          </h1>
          <p className="text-aura-text-secondary">
            发行你自己的创作者代币，让粉丝投资支持你的专属内容
          </p>
        </div>

        {/* Info Card */}
        <div className="mb-8 bg-gradient-to-r from-aura-gold/10 to-aura-accent/10 border border-aura-gold/20 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span>⚠️</span>
            <span>重要提示</span>
          </h3>
          <div className="space-y-2 text-sm text-aura-text-secondary">
            <p>• 创建 Creator Coin 需要燃烧 <strong className="text-aura-gold">1000 $ORA</strong> 代币</p>
            <p>• 一个钱包地址只能创建一个 Creator Coin</p>
            <p>• 创建后无法修改参数，请谨慎设置</p>
            <p>• 代币基于联合曲线（Bonding Curve）机制，价格由数学公式决定</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-aura-card border border-aura-border rounded-2xl p-6 space-y-6">
          {/* Symbol */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-aura-text">
              代币符号 <span className="text-aura-accent">*</span>
            </label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
              placeholder="例如: ART, MUSIC, WRITE"
              maxLength={10}
              className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent transition-colors text-aura-text placeholder-aura-text-secondary"
            />
            {errors.symbol && <p className="mt-2 text-sm text-aura-accent">{errors.symbol}</p>}
            <p className="mt-2 text-xs text-aura-text-secondary">最多10个字符，仅支持大写字母和数字</p>
          </div>

          {/* Curve Type */}
          <div>
            <label className="block text-sm font-semibold mb-3 text-aura-text">
              联合曲线类型 <span className="text-aura-accent">*</span>
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
                      ? 'border-aura-accent bg-aura-accent/10'
                      : 'border-aura-border bg-aura-surface hover:border-aura-accent/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{curve.emoji}</div>
                    <div className="flex-1">
                      <h4 className="font-bold mb-1 text-aura-text">{curve.name}</h4>
                      <p className="text-sm text-aura-text-secondary mb-2">{curve.description}</p>
                      <code className="text-xs bg-aura-bg/50 px-2 py-1 rounded text-aura-accent">{curve.formula}</code>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        formData.curveType === curve.value
                          ? 'border-aura-accent bg-aura-accent'
                          : 'border-aura-border'
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
            <label className="block text-sm font-semibold mb-2 text-aura-text">
              曲线参数 K <span className="text-aura-accent">*</span>
            </label>
            <input
              type="number"
              value={formData.curveParamK}
              onChange={(e) => handleChange('curveParamK', e.target.value)}
              placeholder="1000"
              min="1"
              step="1"
              className="w-full px-4 py-3 bg-aura-surface border border-aura-border rounded-lg focus:outline-none focus:border-aura-accent transition-colors text-aura-text placeholder-aura-text-secondary"
            />
            {errors.curveParamK && <p className="mt-2 text-sm text-aura-accent">{errors.curveParamK}</p>}
            <p className="mt-2 text-xs text-aura-text-secondary">
              控制价格增长速度，数值越大初始价格越高。建议: 1000-10000
            </p>
          </div>

          {/* Creator Fee */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-aura-text">
              创作者费用 <span className="text-aura-accent">*</span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                value={formData.creatorFeeBps}
                onChange={(e) => handleChange('creatorFeeBps', e.target.value)}
                min="0"
                max="1000"
                step="50"
                className="flex-1 accent-aura-accent"
              />
              <div className="w-24 px-4 py-3 bg-aura-surface border border-aura-border rounded-lg text-center font-bold text-aura-text">
                {(Number(formData.creatorFeeBps) / 100).toFixed(1)}%
              </div>
            </div>
            {errors.creatorFeeBps && <p className="mt-2 text-sm text-aura-accent">{errors.creatorFeeBps}</p>}
            <p className="mt-2 text-xs text-aura-text-secondary">
              每笔买卖交易你将获得的手续费比例，最高 10%
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gradient-to-r from-aura-accent/10 to-aura-gold/10 border border-aura-accent/20 rounded-xl p-4">
            <h4 className="font-bold mb-3 text-aura-text">预览</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">代币符号</span>
                <span className="font-semibold text-aura-text">${formData.symbol || '---'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">曲线类型</span>
                <span className="font-semibold text-aura-text">{formData.curveType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">曲线参数</span>
                <span className="font-semibold text-aura-text">
                  K={formData.curveParamK}, N={getCurveParamN()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-aura-text-secondary">创作者费用</span>
                <span className="font-semibold text-aura-text">{(Number(formData.creatorFeeBps) / 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between pt-2 mt-2 border-t border-aura-border">
                <span className="text-aura-text-secondary">创建成本</span>
                <span className="font-bold text-aura-gold">1000 $ORA</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!connected || loading}
            className={`w-full py-4 rounded-lg font-bold text-white transition-all ${
              !connected || loading
                ? 'bg-aura-text-secondary/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-aura-accent to-aura-accent-hover hover:shadow-lg hover:shadow-aura-accent/25'
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
        <div className="mt-8 bg-aura-card border border-aura-border rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 text-aura-text">💡 如何选择参数？</h3>
          <div className="space-y-3 text-sm text-aura-text-secondary">
            <div>
              <strong className="text-aura-text">曲线类型：</strong>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• <strong>线性</strong>：适合稳定增长，风险较低</li>
                <li>• <strong>二次</strong>：平衡型，适合大多数创作者</li>
                <li>• <strong>三次</strong>：早期投资者回报高，但风险也大</li>
              </ul>
            </div>
            <div>
              <strong className="text-aura-text">参数 K：</strong>
              <p className="mt-1">控制初始价格和增长速度。建议根据你的粉丝基础和预期市值设置。</p>
            </div>
            <div>
              <strong className="text-aura-text">创作者费用：</strong>
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