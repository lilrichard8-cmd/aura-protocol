import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, User, Shield, Bell, Wallet, Palette, ChevronRight, Moon, Sun, Code, LogOut, Camera, Check } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useMockChain } from '@/context/MockChainContext';
import { useAuth } from '@/context/AuthContext';

interface SettingSection {
  id: string;
  icon: typeof User;
  label: string;
  desc: string;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const mockChain = useMockChain();
  const { logout, user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ---------- Account section: live edit state ----------
  // Initialised from the current user so the form always reflects what's saved.
  // We don't write back to AuthContext on every keystroke — only when the user
  // hits "Save changes" (or for avatar, immediately on file pick).
  const [accountDraft, setAccountDraft] = useState({
    avatar: user?.avatar ?? '',
    displayName: user?.displayName ?? '',
    username: user?.username ?? '',
    bio: user?.bio ?? '',
  });
  const [accountSaved, setAccountSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync if the underlying user changes (e.g. after login/register).
  useEffect(() => {
    setAccountDraft({
      avatar: user?.avatar ?? '',
      displayName: user?.displayName ?? '',
      username: user?.username ?? '',
      bio: user?.bio ?? '',
    });
  }, [user?.id]); // re-sync only when the identity changes, not on every keystroke

  // Handle avatar file pick: read as data URL and persist immediately so the new
  // image is visible across the app (Profile page, header, sidebar) without a save click.
  /** Downscale an image File to fit within a max bounding box and JPEG-compress it.
   *  Returns a data URL. Used for avatars so localStorage doesn't blow its quota
   *  with a 5MB photo (a 256×256 JPEG@0.85 is ~30KB — fits easily). */
  const compressImageToDataUrl = (file: File, maxSize = 512, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image decode failed'));
        img.onload = () => {
          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas unsupported')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          // PNG for files that started transparent (less than 32KB original),
          // JPEG otherwise. Avatar use case prefers JPEG.
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please pick an image file.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Source image must be smaller than 10MB. It will be downscaled to 512px before saving.');
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file, 512, 0.85);
      setAccountDraft(d => ({ ...d, avatar: dataUrl }));
      // Avatar is the kind of change users expect to be "instant" — propagate now
      // so the rest of the UI updates without waiting for a Save click.
      updateProfile({ avatar: dataUrl });
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 1800);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Avatar processing failed:', err);
      alert('Could not process image. Try a different file.');
    }
    // Reset the input so picking the same file twice still fires onChange.
    e.target.value = '';
  };

  const handleSaveAccount = () => {
    // Trim & sanity-check before pushing to AuthContext.
    const username = accountDraft.username.replace(/^@/, '').trim();
    const displayName = accountDraft.displayName.trim();
    if (!displayName) {
      alert('Display name cannot be empty.');
      return;
    }
    if (!username || !/^[a-zA-Z0-9_]{2,30}$/.test(username)) {
      alert('Username must be 2–30 characters, letters/numbers/underscore only.');
      return;
    }
    updateProfile({
      avatar: accountDraft.avatar,
      displayName,
      username,
      bio: accountDraft.bio.trim().slice(0, 200),
    });
    setAccountSaved(true);
    setTimeout(() => setAccountSaved(false), 1800);
  };

  const handleLogout = () => {
    logout();
    // Also clear mock chain so next login starts clean.
    localStorage.removeItem('aura_mock_chain');
    navigate('/login', { replace: true });
  };
  
  const sections: SettingSection[] = [
    { id: 'account', icon: User, label: t.settings.sections.account.title, desc: t.settings.sections.account.desc },
    { id: 'privacy', icon: Shield, label: t.settings.sections.privacy.title, desc: t.settings.sections.privacy.desc },
    { id: 'notification', icon: Bell, label: t.settings.sections.notification.title, desc: t.settings.sections.notification.desc },
    { id: 'wallet', icon: Wallet, label: t.settings.sections.wallet.title, desc: t.settings.sections.wallet.desc },
    { id: 'appearance', icon: Palette, label: t.settings.sections.appearance.title, desc: t.settings.sections.appearance.desc },
    // 2026-05-11: language section removed — app is English-only for the demo.
  ];

  // Default to the first section so the right pane is always populated
  // (NotificationsPage-style master-detail layout, requested 2026-05-10).
  const [activeSection, setActiveSection] = useState<string>('account');
  const [darkMode, setDarkMode] = useState(false);
  // language state removed — app is English-only (2026-05-11).
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [notifRewards, setNotifRewards] = useState(true);
  const [privacyProfile, setPrivacyProfile] = useState('public');

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-aura' : 'bg-border'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-[2px] transition-all duration-200 ${checked ? 'left-[24px]' : 'left-[2px]'}`} />
    </button>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'account':
        return (
          <div className="space-y-4">
            {/* Avatar + change button — fully wired: file picker writes a data URL
                straight into AuthContext so all consumers (Profile, SideNav, etc.) update. */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0 group">
                {accountDraft.avatar ? (
                  <img
                    src={accountDraft.avatar}
                    alt={accountDraft.displayName || 'avatar'}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-aura/40"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-aura via-ora to-aura-light flex items-center justify-center text-white text-2xl font-bold">
                    {(accountDraft.displayName || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white opacity-0 group-hover:opacity-100"
                  title="Change avatar"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-aura font-medium hover:underline"
                >
                  {t.settings.account.changeAvatar}
                </button>
                <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPick}
                className="hidden"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t.settings.account.nickname}</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-aura focus:outline-none"
                value={accountDraft.displayName}
                onChange={e => setAccountDraft(d => ({ ...d, displayName: e.target.value }))}
                maxLength={40}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t.settings.account.username}</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <input
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-aura focus:outline-none"
                  value={accountDraft.username}
                  onChange={e => setAccountDraft(d => ({ ...d, username: e.target.value.replace(/^@/, '') }))}
                  maxLength={30}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">{t.settings.account.bio}</label>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border-0 text-sm resize-none h-20 focus:ring-2 focus:ring-aura focus:outline-none"
                value={accountDraft.bio}
                onChange={e => setAccountDraft(d => ({ ...d, bio: e.target.value }))}
                maxLength={200}
                placeholder="Tell the world what you create…"
              />
              <p className="text-[10px] text-muted-foreground text-right mt-1">{accountDraft.bio.length}/200</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveAccount}
                className="px-4 py-2 rounded-lg bg-aura text-white text-sm font-medium hover:bg-aura-dark transition-colors"
              >
                Save changes
              </button>
              {accountSaved && (
                <span className="inline-flex items-center gap-1 text-sm text-green-500">
                  <Check className="w-4 h-4" /> Saved
                </span>
              )}
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t.settings.privacy.profileVisibility}</label>
              {['public', 'followers', 'private'].map(v => (
                <button key={v} onClick={() => setPrivacyProfile(v)} className={`block w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${privacyProfile === v ? 'bg-aura/10 text-aura' : 'hover:bg-secondary'}`}>
                  {v === 'public' ? t.settings.privacy.public : v === 'followers' ? t.settings.privacy.followers : t.settings.privacy.private}
                </button>
              ))}
            </div>
          </div>
        );
      case 'notification':
        return (
          <div className="space-y-4">
            {[
              { label: t.settings.notification.likes, checked: notifLikes, set: setNotifLikes },
              { label: t.settings.notification.comments, checked: notifComments, set: setNotifComments },
              { label: t.settings.notification.follows, checked: notifFollows, set: setNotifFollows },
              { label: t.settings.notification.rewards, checked: notifRewards, set: setNotifRewards },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <span className="text-sm">{item.label}</span>
                <Toggle checked={item.checked} onChange={item.set} />
              </div>
            ))}
          </div>
        );
      case 'wallet':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-secondary/50 border border-border/40">
              <p className="text-sm text-muted-foreground">{t.settings.wallet.connected}</p>
              <p className="text-sm font-mono mt-1">0x1234...5678</p>
            </div>
            <button className="w-full py-2.5 rounded-xl bg-aura text-white text-sm font-medium hover:bg-aura/90 transition-colors">
              {t.settings.wallet.changeWallet}
            </button>
          </div>
        );
      case 'appearance':
        return (
          <div className="space-y-4">
            <div className="flex gap-3">
              {[false, true].map(isDark => (
                <button
                  key={String(isDark)}
                  onClick={() => setDarkMode(isDark)}
                  className={`flex-1 p-4 rounded-xl border-2 transition-colors text-center ${
                    darkMode === isDark ? 'border-aura bg-aura/5' : 'border-border'
                  }`}
                >
                  {isDark ? <Moon className="w-6 h-6 mx-auto mb-2" /> : <Sun className="w-6 h-6 mx-auto mb-2" />}
                  <p className="text-sm font-medium">{isDark ? t.settings.appearance.dark : t.settings.appearance.light}</p>
                </button>
              ))}
            </div>
          </div>
        );
      // 2026-05-11: language case removed — app is English-only for the demo.
      default:
        return null;
    }
  };

  const activeSectionMeta = sections.find(s => s.id === activeSection);

  // Reusable nav rail rendered both as the desktop left column and the
  // mobile top stack. It encapsulates section list + Account/Logout
  // block + Developer mode toggle so the master-detail layout stays in
  // sync between viewports.
  const SidebarRail = (
    <div className="space-y-4">
      {/* Settings sections */}
      <div className="rounded-2xl bg-card border overflow-hidden">
        <div className="px-4 py-3 border-b text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
          {t.settings.title}
        </div>
        <div className="py-2">
          {sections.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                  isActive
                    ? 'bg-aura/10 text-aura border-r-2 border-aura'
                    : 'hover:bg-secondary/40 text-foreground'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-aura/20' : 'bg-secondary/50'
                }`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-aura' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? 'text-aura' : ''}`}>{s.label}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{s.desc}</p>
                </div>
                {!isActive && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Account / Logout */}
      <div className="p-4 rounded-2xl border border-border/60 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.displayName || user?.username || 'Signed in'}</p>
                  <p className="text-xs text-muted-foreground">@{user?.username}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>

      {/* Developer Mode */}
      <div className="p-4 rounded-2xl border border-dashed border-border/60 bg-secondary/20">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-[#14C8A8]" />
              <h3 className="font-semibold text-sm">Developer Mode</h3>
            </div>
            
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Chain Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {mockChain.mode === 'mock' ? 'Mock mode uses simulated data' : 'Localnet connects to local Solana validator'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${mockChain.mode === 'mock' ? 'text-[#14C8A8] font-medium' : 'text-muted-foreground'}`}>Mock</span>
                  <button
                    onClick={() => mockChain.setMode(mockChain.mode === 'mock' ? 'localnet' : 'mock')}
                    className={`w-11 h-6 rounded-full transition-colors relative ${mockChain.mode === 'localnet' ? 'bg-[#14C8A8]' : 'bg-border'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-[2px] transition-all duration-200 ${mockChain.mode === 'localnet' ? 'left-[24px]' : 'left-[2px]'}`} />
                  </button>
                  <span className={`text-xs ${mockChain.mode === 'localnet' ? 'text-[#14C8A8] font-medium' : 'text-muted-foreground'}`}>Localnet</span>
                </div>
              </div>

              {/* RPC URL (only for localnet) */}
              {mockChain.mode === 'localnet' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">RPC URL</label>
                  <input
                    type="text"
                    value={mockChain.rpcUrl}
                    onChange={(e) => mockChain.setRpcUrl(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono"
                    placeholder="http://localhost:8899"
                  />
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                Mock mode uses simulated data for demo purposes. Localnet connects to a local Solana validator for integration testing.
              </p>
            </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Sticky page header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="px-4 md:px-6 lg:px-8 py-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-aura" />
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold">{t.settings.title}</h1>
        </div>
      </div>

      {/* Master-detail (NotificationsPage-style):
       *   Desktop: 1/3 left rail + 2/3 right pane
       *   Mobile:  vertical stack — nav on top, active section below */}
      <div className="px-4 md:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left rail — sticky on desktop */}
          <aside className="lg:col-span-1 lg:sticky lg:top-24 lg:self-start">
            {SidebarRail}
          </aside>

          {/* Right pane — the active section's content */}
          <main className="lg:col-span-2">
            <div className="rounded-2xl bg-card border p-5 md:p-6">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b">
                {activeSectionMeta && (
                  <div className="w-10 h-10 rounded-xl bg-aura/15 flex items-center justify-center">
                    <activeSectionMeta.icon className="w-5 h-5 text-aura" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold">{activeSectionMeta?.label}</h2>
                  <p className="text-xs text-muted-foreground">{activeSectionMeta?.desc}</p>
                </div>
              </div>
              {renderSection()}
            </div>
          </main>
        </div>
      </div>

      {/* Logout confirm modal (rendered at root so backdrop is full-page) */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl p-6 max-w-sm w-full border shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold">Log out?</h3>
                <p className="text-xs text-muted-foreground">You'll need to sign in again to access your account.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleLogout} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
