import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

import Step1Welcome from './OnboardingPage/components/Step1Welcome';
import Step2Profile, { type ProfileDraft } from './OnboardingPage/components/Step2Profile';
import Step3Pillars from './OnboardingPage/components/Step3Pillars';
import Step4Tasks from './OnboardingPage/components/Step4Tasks';
import Step5Ready from './OnboardingPage/components/Step5Ready';

/**
 * Multi-step first-time wallet onboarding.
 *
 *   1. Welcome — set the narrative (you own everything, 0.5% fees)
 *   2. Profile — username + display name + bio + avatar
 *   3. Pillars — Creator Coin / Curation Mining / Social Graph / ORA / Storage
 *   4. Tasks  — newbie quest list, "Complete profile" is auto-checked
 *   5. Ready  — three quick-entry tiles
 *
 * Profile is committed to AuthContext only when the user advances past
 * Step 2; Steps 3-5 are inert "intro" pages so a user can navigate back
 * without losing data. We clear `isNewWallet` only at the final "Finish"
 * (or when the user explicitly opts out via the early-exit Skip).
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

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

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

  const walletLabel = user.walletAddress
    ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`
    : user.username;

  const defaultAvatar =
    user.avatar ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${user.walletAddress || user.username || 'aura'}`;

  // Step 2 → commit profile to AuthContext.
  const handleStep2Next = (d: ProfileDraft) => {
    setDraft(d);
    updateProfile({
      username: d.username,
      displayName: d.displayName,
      bio: d.bio,
      avatar: d.avatar,
      // Keep isNewWallet=true until Step 5 (finish) so a refresh resumes onboarding.
    });
    setStep(3);
  };

  const handleFinish = (destination: string) => {
    updateProfile({ isNewWallet: false });
    // Mark onboarding as complete for the post-onboarding tooltip gating.
    try { localStorage.setItem('aura_onboarding_complete', '1'); } catch { /* ignore */ }
    navigate(destination);
  };

  const handleEarlyExit = () => {
    // "Skip tour" from inside the pillars step — bail to /feed but keep
    // the user's profile data.
    updateProfile({ isNewWallet: false });
    try { localStorage.setItem('aura_onboarding_complete', '1'); } catch { /* ignore */ }
    navigate('/feed');
  };

  const totalSteps = 5;
  const pct = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-aura/5 flex flex-col">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Step {step} of {totalSteps}</span>
            {step > 1 && step < totalSteps && (
              <button
                onClick={handleEarlyExit}
                className="hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full bg-gradient-to-r from-aura to-ora transition-all duration-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-2xl">
          {step === 1 && <Step1Welcome onNext={() => setStep(2)} />}
          {step === 2 && (
            <Step2Profile
              walletLabel={walletLabel}
              defaultAvatar={defaultAvatar}
              initial={draft ?? {
                username: user.username && user.username.length <= 20 ? user.username : '',
                displayName: user.displayName ?? '',
                bio: user.bio ?? '',
                avatar: user.avatar,
              }}
              onBack={() => setStep(1)}
              onNext={handleStep2Next}
            />
          )}
          {step === 3 && (
            <Step3Pillars
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              onSkip={handleEarlyExit}
            />
          )}
          {step === 4 && (
            <Step4Tasks
              onBack={() => setStep(3)}
              onNext={() => setStep(5)}
            />
          )}
          {step === 5 && (
            <Step5Ready
              onBack={() => setStep(4)}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}
