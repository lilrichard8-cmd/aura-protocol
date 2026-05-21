import { useState } from 'react';
import { ArrowRight, ArrowLeft, Loader2, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface ProfileDraft {
  username: string;
  displayName: string;
  bio: string;
  avatar?: string;
}

interface Props {
  walletLabel: string;
  defaultAvatar: string;
  initial?: Partial<ProfileDraft>;
  onBack: () => void;
  onNext: (draft: ProfileDraft) => void;
}

/**
 * Step 2 — Profile basics.
 * Keeps the same validation rules the original single-step OnboardingPage had,
 * plus an optional avatar upload (falls back to dicebear seed by wallet address).
 */
export default function Step2Profile({ walletLabel, defaultAvatar, initial, onBack, onNext }: Props) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [avatar, setAvatar] = useState<string | undefined>(initial?.avatar);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

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

  const handlePickAvatar = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setErrors(e => ({ ...e, avatar: 'Max 2MB' }));
      return;
    }
    setErrors(e => { const { avatar: _drop, ...rest } = e; return rest; });
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') setAvatar(reader.result); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    // Tiny feel-good delay so the spinner is visible.
    await new Promise(r => setTimeout(r, 200));
    setBusy(false);
    onNext({
      username: username.trim(),
      displayName: displayName.trim(),
      bio: bio.trim(),
      avatar: avatar ?? defaultAvatar,
    });
  };

  const previewAvatar = avatar ?? defaultAvatar;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">这是你 — 怎么称呼你？</h2>
        <p className="text-sm text-muted-foreground">
          钱包: <span className="font-mono">{walletLabel}</span>
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-aura/40 via-ora/40 to-aura/40 p-0.5 shrink-0">
            <img src={previewAvatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
          </div>
          <div className="flex-1">
            <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer text-aura hover:text-aura-dark">
              <ImageIcon className="w-4 h-4" />
              Upload avatar
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handlePickAvatar(e.target.files[0]); }}
              />
            </label>
            <p className="text-xs text-muted-foreground mt-1">Optional · PNG/JPG · max 2MB</p>
            {errors.avatar && <p className="text-xs text-destructive mt-1">{errors.avatar}</p>}
          </div>
        </div>

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
      </div>

      <div className="flex items-center gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onBack} className="h-12 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-aura to-ora hover:opacity-90 text-white font-medium text-base"
        >
          {busy ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </form>
  );
}
