import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Wallet, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth, WalletConnectError } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';

export default function AuthPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [walletError, setWalletError] = useState<{ provider: string; reason: string; message: string } | null>(null);
  const { login, register, connectWallet } = useAuth();
  const navigate = useNavigate();

  const isJudgeLogin = email === '123' && password === '321';

  const validate = () => {
    // Skip validation for judge quick-access
    if (isJudgeLogin) return true;
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = t.auth.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t.auth.emailInvalid;
    if (!password) errs.password = t.auth.passwordRequired;
    else if (password.length < 6) errs.password = t.auth.passwordTooShort;
    if (mode === 'register' && !username.trim()) errs.username = t.auth.usernameRequired;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleJudgeQuickLogin = async () => {
    setEmail('123');
    setPassword('321');
    setMode('login');
    setLoading(true);
    try {
      await login('123', '321');
      navigate('/feed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, username);
      navigate('/feed');
    } finally {
      setLoading(false);
    }
  };

  const [showWelcome, setShowWelcome] = useState(false);

  const handleWallet = async (provider: 'phantom' | 'solflare') => {
    setWalletError(null);
    setWalletLoading(provider);
    try {
      const result = await connectWallet(provider);
      if (result.isFirstTime) {
        // First-time wallet — go straight to onboarding so the user can pick
        // a username + bio before seeing their profile. The 10 ORA airdrop
        // is already credited; we surface it inside onboarding/feed instead
        // of a blocking modal.
        navigate('/onboarding');
      } else {
        navigate('/feed');
      }
    } catch (err) {
      if (err instanceof WalletConnectError) {
        let message = '';
        const name = provider === 'phantom' ? 'Phantom' : 'Solflare';
        if (err.reason === 'not_installed') {
          message = `${name} extension not detected. Install it from ${provider === 'phantom' ? 'phantom.com' : 'solflare.com'}, or use the 123 / 321 judge quick-access above.`;
        } else if (err.reason === 'user_rejected') {
          message = `Connection cancelled. Click ${name} again to retry.`;
        } else {
          message = `Could not connect to ${name}: ${err.message}`;
        }
        setWalletError({ provider, reason: err.reason, message });
      } else {
        setWalletError({
          provider,
          reason: 'unknown',
          message: `Unexpected error: ${(err as Error)?.message ?? 'unknown'}`,
        });
      }
    } finally {
      setWalletLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-aura/5 px-4">
      <div className="w-full max-w-md">
        {/* Logo — 2026-05-11 R21: real AURA mark replaces the placeholder
           circle-in-gradient. The PNG ships from /public/aura-logo.png. */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-3">
            <img
              src="/aura-logo.png"
              alt="AURA"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-aura to-ora bg-clip-text text-transparent">
            AURA
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t.auth.subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-secondary/50 rounded-xl p-1">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setErrors({}); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'login' ? t.auth.login : t.auth.register}
            </button>
          ))}
        </div>

        {/* Form */}
        {/* noValidate disables HTML5 browser-native validation tooltips (which
           are localised to OS language — macOS Chinese was leaking Chinese popups).
           Our own validate() in handleSubmit covers the same rules with English
           messages. */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t.auth.usernamePlaceholder}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
              {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
            </div>
          )}

          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder={t.auth.emailPlaceholder}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t.auth.passwordPlaceholder}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium text-base"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                {mode === 'login' ? t.auth.login : t.auth.createAccount}
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>

        {/* Judge Quick Access */}
        <div className="mt-4 p-3 rounded-xl border border-aura/30 bg-aura/5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">🏆</span>
            <span className="text-xs font-semibold text-aura">Hackathon Judge?</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Enter <span className="font-mono font-medium text-foreground">123</span> / <span className="font-mono font-medium text-foreground">321</span> to access a pre-loaded demo account, or:
          </p>
          <button
            type="button"
            onClick={handleJudgeQuickLogin}
            disabled={loading}
            className="w-full py-2 rounded-lg text-xs font-medium bg-aura/10 hover:bg-aura/20 text-aura transition-all"
          >
            ⚡ One-Click Judge Access
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">{t.auth.orUseWallet}</span>
          </div>
        </div>

        {/* Wallet error notice (not installed / rejected / unknown) */}
        {walletError && (
          <div className="mb-3 p-3 rounded-xl border border-orange-500/40 bg-orange-500/10 text-xs text-orange-700 dark:text-orange-300">
            <div className="font-medium mb-1">⚠️ Wallet not connected</div>
            <div>{walletError.message}</div>
            {walletError.reason === 'not_installed' && (
              <a
                href={walletError.provider === 'phantom' ? 'https://phantom.com/download' : 'https://solflare.com/download'}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-orange-600 dark:text-orange-400 underline hover:no-underline"
              >
                Get {walletError.provider === 'phantom' ? 'Phantom' : 'Solflare'} →
              </a>
            )}
          </div>
        )}

        {/* Wallet Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleWallet('phantom')}
            disabled={!!walletLoading}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border/60 bg-card hover:bg-accent/50 transition-all text-sm font-medium disabled:opacity-50"
          >
            {walletLoading === 'phantom' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4 text-purple-500" />
            )}
            {t.auth.phantomWallet}
          </button>
          {/* 2026-05-11 R20: Solflare wallet sign-in temporarily removed.
             handleWallet('solflare') hook + i18n strings retained for when
             we wire the real adapter post-hackathon. */}
        </div>
      </div>

      {/* Welcome Airdrop Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl max-w-sm w-full p-8 text-center relative overflow-hidden">
            {/* Falling coins animation */}
            <style>{`
              @keyframes coinFall {
                0% { transform: translateY(-100px) rotate(0deg); opacity: 0; }
                20% { opacity: 1; }
                100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
              }
              .coin-fall { animation: coinFall 2.5s ease-in forwards; }
              .coin-fall-1 { animation-delay: 0s; left: 15%; }
              .coin-fall-2 { animation-delay: 0.3s; left: 35%; }
              .coin-fall-3 { animation-delay: 0.1s; left: 55%; }
              .coin-fall-4 { animation-delay: 0.5s; left: 75%; }
              .coin-fall-5 { animation-delay: 0.2s; left: 45%; }
              @keyframes scaleIn {
                0% { transform: scale(0.5); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
              }
              .scale-in { animation: scaleIn 0.5s ease-out 0.3s both; }
            `}</style>
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`absolute top-0 coin-fall coin-fall-${i} text-2xl pointer-events-none`}>🪙</div>
            ))}
            
            <div className="scale-in">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">Welcome to AURA!</h2>
              <p className="text-muted-foreground mb-6">You've received <span className="text-[#F59E0B] font-bold text-lg">10 ORA</span> to get started</p>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center shadow-lg shadow-[#F59E0B]/30">
                <span className="text-white text-2xl font-bold">10</span>
              </div>
              <Button
                onClick={() => navigate('/feed')}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium text-base"
              >
                Start Creating →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
