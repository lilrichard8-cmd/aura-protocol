import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';

/**
 * First-time wallet onboarding.
 * Shown right after a real Phantom/Solflare wallet connects for the first time.
 * Lets the user pick a username + display name + short bio before entering the
 * main app. Without this step, ProfilePage would show only a truncated address.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user: ctxUser, updateProfile } = useAuth();

  // Fallback: when AuthPage navigates here right after connectWallet, the
  // AuthContext setState hasn't been flushed yet, so ctxUser may briefly be
  // null. Read directly from localStorage as a safety net so we don't bounce
  // back to /auth on the first render.
  const lsUser: User | null = (() => {
    try {
      const raw = localStorage.getItem('aura_auth');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const user = ctxUser || lsUser;

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Bounce back to /auth only if neither React state nor localStorage has a
  // user after a brief grace period (handles direct /onboarding visits).
  useEffect(() => {
    if (user) return;
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem('aura_auth');
        if (!raw) navigate('/auth', { replace: true });
      } catch { navigate('/auth', { replace: true }); }
    }, 600);
    return () => clearTimeout(id);
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const truncated = user.walletAddress
    ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`
    : user.username;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      errs.username = '3–20 characters, letters / numbers / underscore only';
    }
    if (!displayName.trim()) errs.displayName = 'Display name is required';
    else if (displayName.trim().length > 40) errs.displayName = 'Max 40 characters';
    if (bio.length > 160) errs.bio = 'Max 160 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      // Simulate a tiny round-trip so the button feels responsive.
      await new Promise(r => setTimeout(r, 400));
      updateProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim(),
        isNewWallet: false,
      });
      navigate('/feed');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Skipping still clears the new-wallet flag so we don't keep showing onboarding.
    updateProfile({ isNewWallet: false });
    navigate('/feed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-aura/5 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-aura to-ora mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to AURA</h1>
          <p className="text-muted-foreground text-sm">
            Set up your creator profile. You can edit it any time later.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Wallet: <span className="font-mono">{truncated}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-2xl p-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Username</label>
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. neon_wave"
              autoFocus
            />
            {errors.username && <p className="text-xs text-destructive mt-1">{errors.username}</p>}
            <p className="text-xs text-muted-foreground mt-1">This is your @handle on AURA.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Display name</label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Neon Wave"
            />
            {errors.displayName && <p className="text-xs text-destructive mt-1">{errors.displayName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Bio <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people what you create."
              rows={3}
              maxLength={160}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <div className="flex justify-between mt-1">
              {errors.bio
                ? <p className="text-xs text-destructive">{errors.bio}</p>
                : <span className="text-xs text-muted-foreground">Visible on your profile.</span>}
              <span className="text-xs text-muted-foreground">{bio.length}/160</span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium text-base"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating profile…
              </>
            ) : (
              <>
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
