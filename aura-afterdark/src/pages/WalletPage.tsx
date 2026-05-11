import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, Coins, ExternalLink, Copy, Check, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'swap' | 'tip' | 'staking' | 'reward';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  txHash: string;
}

const mockBalances = {
  SOL: 8.25,
  ORA: 2580,
  USDC: 450.75,
  creatorCoins: 12,
};

const mockTransactions: Transaction[] = [
  { id: '1', type: 'reward', amount: 125.5, currency: 'ORA', status: 'completed', timestamp: '2024-03-13 15:30', txHash: '5KJp89d...xR7mQ' },
  { id: '2', type: 'swap', amount: 100, currency: 'USDC → ORA', status: 'completed', timestamp: '2024-03-13 14:15', txHash: '8HgT23k...yP9mN' },
  { id: '3', type: 'tip', amount: 50, currency: 'ORA', status: 'completed', timestamp: '2024-03-13 12:45', txHash: '2LmV67h...qW5sK' },
  { id: '4', type: 'deposit', amount: 1.2, currency: 'SOL', status: 'completed', timestamp: '2024-03-12 18:20', txHash: '9XnB45f...tE8dL' },
];

export default function WalletPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [copied, setCopied] = useState(false);
  const [swapAmount, setSwapAmount] = useState('');
  const [swapFrom, setSwapFrom] = useState<'ORA' | 'USDC'>('USDC');
  const [slippage, setSlippage] = useState('0.5');
  const [showExportModal, setShowExportModal] = useState(false);

  const copyAddress = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculateSwap = () => {
    if (!swapAmount) return { output: 0, rate: 0 };
    const amount = parseFloat(swapAmount);
    const rate = swapFrom === 'USDC' ? 2.35 : 0.42;
    return { output: amount * rate, rate };
  };

  const handleSwap = () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) {
      alert('Please enter a valid swap amount');
      return;
    }
    alert(`Swap submitted: ${swapAmount} ${swapFrom} → ${calculateSwap().output.toFixed(2)} ${swapFrom === 'USDC' ? 'ORA' : 'USDC'}`);
    setSwapAmount('');
  };

  const txTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Deposit';
      case 'withdrawal': return 'Withdrawal';
      case 'swap': return 'Swap';
      case 'tip': return 'Tip';
      case 'staking': return 'Staking';
      case 'reward': return 'Reward';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-aura-bg/90 backdrop-blur-md border-b border-aura-border/50">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 h-14 md:ml-64">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-aura-surface/50 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-aura-text" />
          </button>
          <h1 className="text-lg font-bold text-aura-text flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Wallet
          </h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-4 space-y-6 md:ml-64">
        {/* Balances */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-4">
            <p className="text-xs text-aura-text-secondary mb-1">SOL</p>
            <p className="text-2xl font-bold text-aura-text">{mockBalances.SOL.toFixed(2)}</p>
            <p className="text-xs text-aura-text-secondary mt-1">Solana</p>
          </div>
          <div className="bg-gradient-to-br from-aura-accent/20 to-aura-card border border-aura-accent/20 rounded-2xl p-4">
            <p className="text-xs text-aura-text-secondary mb-1">ORA</p>
            <p className="text-2xl font-bold text-aura-text">{mockBalances.ORA.toLocaleString()}</p>
            <p className="text-xs text-aura-gold mt-1 flex items-center gap-1">
              <Coins className="w-3 h-3" /> ORA
            </p>
          </div>
          <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-4">
            <p className="text-xs text-aura-text-secondary mb-1">USDC</p>
            <p className="text-2xl font-bold text-aura-text">${mockBalances.USDC.toFixed(2)}</p>
            <p className="text-xs text-aura-text-secondary mt-1">Stablecoin</p>
          </div>
          <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-4">
            <p className="text-xs text-aura-text-secondary mb-1">Creator Coins</p>
            <p className="text-2xl font-bold text-aura-text">{mockBalances.creatorCoins}</p>
            <p className="text-xs text-aura-text-secondary mt-1">Holdings</p>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="bg-aura-surface/30 rounded-xl p-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-aura-text-secondary mb-0.5">Embedded Wallet</p>
            <p className="text-xs text-aura-text font-mono truncate">0xAuR4...d4Rk...7FbE</p>
          </div>
          <button onClick={copyAddress} className="w-8 h-8 rounded-lg bg-aura-surface/50 flex items-center justify-center text-aura-text-secondary hover:text-aura-text">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button className="w-8 h-8 rounded-lg bg-aura-surface/50 flex items-center justify-center text-aura-text-secondary hover:text-aura-text">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Deposit/Withdraw Tabs */}
        <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl">
          <div className="border-b border-aura-border/50 flex">
            <button
              onClick={() => setActiveTab('deposit')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${activeTab === 'deposit' ? 'text-aura-accent border-b-2 border-aura-accent' : 'text-aura-text-secondary hover:text-aura-text'}`}
            >
              <ArrowDownLeft className="w-4 h-4 inline mr-2" /> Deposit
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${activeTab === 'withdraw' ? 'text-aura-accent border-b-2 border-aura-accent' : 'text-aura-text-secondary hover:text-aura-text'}`}
            >
              <ArrowUpRight className="w-4 h-4 inline mr-2" /> Withdraw
            </button>
          </div>
          <div className="p-6">
            {activeTab === 'deposit' ? (
              <div className="text-center space-y-4">
                <div className="w-32 h-32 bg-white rounded-lg mx-auto flex items-center justify-center text-6xl">📱</div>
                <h3 className="text-lg font-bold text-aura-text">Deposit to Wallet</h3>
                <p className="text-aura-text-secondary text-sm">Scan QR code or copy address</p>
                <div className="bg-aura-surface/20 rounded-lg p-3">
                  <div className="text-xs text-aura-text-secondary mb-1">Deposit Address</div>
                  <div className="text-xs font-mono text-aura-text">0xAuR4...d4Rk...7FbE</div>
                </div>
                <p className="text-xs text-aura-text-secondary">⚠️ Solana network only</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-aura-text mb-2">Amount</label>
                  <div className="flex gap-2">
                    <select className="px-3 py-2 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text">
                      <option>SOL</option>
                      <option>ORA</option>
                      <option>USDC</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Enter amount..."
                      className="flex-1 px-4 py-2 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-aura-text mb-2">Withdraw Address</label>
                  <input
                    type="text"
                    placeholder="Enter Solana address..."
                    className="w-full px-4 py-2 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text"
                  />
                </div>
                <div className="bg-aura-gold/10 border border-aura-gold/20 rounded-lg p-3">
                  <p className="text-aura-gold text-sm">⚠️ Network fee: 0.01 SOL</p>
                  <p className="text-aura-gold/70 text-xs">Estimated arrival: 1-5 minutes</p>
                </div>
                <Button className="w-full bg-aura-accent hover:bg-aura-accent-hover">Confirm Withdraw</Button>
              </div>
            )}
          </div>
        </div>

        {/* Swap */}
        <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-aura-text mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-aura-accent" /> ORA ↔ USDC Swap
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-aura-text mb-2">From</label>
              <div className="flex gap-2">
                <select
                  value={swapFrom}
                  onChange={(e) => setSwapFrom(e.target.value as 'ORA' | 'USDC')}
                  className="px-3 py-2 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text"
                >
                  <option value="USDC">USDC</option>
                  <option value="ORA">ORA</option>
                </select>
                <input
                  type="number"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  placeholder="Enter amount..."
                  className="flex-1 px-4 py-2 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text"
                />
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => setSwapFrom(swapFrom === 'ORA' ? 'USDC' : 'ORA')}
                className="w-10 h-10 rounded-full bg-aura-surface/30 border border-aura-border text-aura-text"
              >
                ⇅
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-aura-text mb-2">To</label>
              <div className="px-4 py-3 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text">
                {swapAmount ? calculateSwap().output.toFixed(2) : '0.00'} {swapFrom === 'USDC' ? 'ORA' : 'USDC'}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-aura-text-secondary">
              <span>Rate</span>
              <span>1 {swapFrom} = {calculateSwap().rate.toFixed(2)} {swapFrom === 'USDC' ? 'ORA' : 'USDC'}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-aura-text mb-2">Slippage</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="w-20 px-3 py-2 bg-aura-surface/30 border border-aura-border rounded-lg text-aura-text"
                  step="0.1"
                />
                <span className="text-aura-text">%</span>
                <div className="flex gap-2 ml-auto">
                  {['0.1', '0.5', '1.0'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSlippage(val)}
                      className={`px-3 py-2 rounded-lg text-sm ${slippage === val ? 'bg-aura-accent text-white' : 'bg-aura-surface/30 border border-aura-border text-aura-text'}`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button
              onClick={handleSwap}
              disabled={!swapAmount || parseFloat(swapAmount) <= 0}
              className="w-full bg-aura-accent hover:bg-aura-accent-hover"
            >
              Swap
            </Button>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-aura-card/30 border border-aura-border/50 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-aura-text mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {mockTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-aura-surface/20 rounded-xl border border-aura-border/30">
                <div>
                  <div className="font-semibold text-aura-text">{txTypeLabel(tx.type)}</div>
                  <div className="text-xs text-aura-text-secondary">{tx.timestamp}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-aura-accent">{tx.amount} {tx.currency}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] border-aura-border/50 text-aura-text-secondary">
                      {tx.status}
                    </Badge>
                    <button className="text-xs text-aura-accent hover:text-aura-accent-hover underline">
                      {tx.txHash}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Private Key */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Advanced
          </h3>
          <p className="text-aura-text-secondary text-sm mb-4">
            Exporting your private key can be risky. Proceed only in a secure environment.
          </p>
          <Button
            onClick={() => setShowExportModal(true)}
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            Export Private Key
          </Button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-aura-card rounded-2xl p-6 max-w-md w-full border border-red-500/30">
            <h2 className="text-2xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" />
              Export Private Key
            </h2>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <div className="text-red-400 font-semibold mb-2">Security Warning</div>
              <ul className="text-red-400/80 text-sm space-y-1">
                <li>• Your assets can be stolen if this key is exposed</li>
                <li>• Make sure you are in a private environment</li>
                <li>• Never share your private key</li>
              </ul>
            </div>
            <p className="text-aura-text-secondary text-sm mb-6">
              Are you sure you want to export your private key?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowExportModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  alert('Private key copied (mock)');
                  setShowExportModal(false);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirm Export
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}