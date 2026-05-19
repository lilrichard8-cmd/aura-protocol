/**
 * BountyCreatePage — full-page bounty composer.
 *
 * Mirrors CreateProposalView's two-column Studio layout:
 *   ┌──────────────────────┬──────────────────────┐
 *   │ Left: editor card    │ Right: meta sidebar  │
 *   │  • Title             │  • Reward (ORA)      │
 *   │  • Brief             │  • Category          │
 *   │  • Tags              │  • Deadline          │
 *   │  • Attachments       │  • Rules checklist   │
 *   │                      │  • Submit button     │
 *   └──────────────────────┴──────────────────────┘
 *
 * Replaces the old modal that lived inside StudioHubPage. The "publish flow"
 * still calls mockChain.createBounty(title, description, reward) — the
 * additional metadata (category/deadline/tags/files) is collected for
 * future use and currently rolled into the description body.
 *
 * 2026-05-11 R13 — first cut.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Hash, Plus, Upload, FileText, Trash2, X, ChevronRight,
  AlertCircle, Coins, Calendar, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { useMockChain } from '@/context/MockChainContext';
import { useBountyContract } from '@/hooks/useBountyContract';
import { useOraContract } from '@/hooks/useOraContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';

type UploadedFile = { id: string; name: string; size: string };

const CATEGORIES = [
  { id: 'design', label: 'Design', emoji: '🎨', desc: 'Logo, illustration, branding' },
  { id: 'writing', label: 'Writing', emoji: '✍️', desc: 'Copy, articles, scripts' },
  { id: 'video', label: 'Video', emoji: '🎬', desc: 'Edit, motion graphics' },
  { id: 'audio', label: 'Audio', emoji: '🎧', desc: 'Music, voice-over, podcast' },
  { id: 'code', label: 'Code', emoji: '⚙️', desc: 'Tools, integrations, scripts' },
  { id: 'research', label: 'Research', emoji: '🔬', desc: 'Data, analysis, reports' },
  { id: 'other', label: 'Other', emoji: '💡', desc: 'Anything else' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

const TITLE_MAX = 80;
const DESC_MAX = 4000;
const MIN_REWARD = 10;
// H-2 — The on-chain Bounty V2 metadata URI field is capped at 200 chars
// (BOUNTY_V2_LIMITS.URI_MAX). After `data:text/plain;base64,` (23 chars)
// + base64 expansion (~4 chars per 3 input bytes), a safe budget is
// roughly 80 plain-text chars. Anything longer is rejected up-front
// rather than silently truncated to garbage.
const BRIEF_CHAIN_MAX_CHARS = 80;

export default function BountyCreatePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const mockChain = useMockChain();
  const onChain = useBountyContract();
  const oraOnChain = useOraContract();
  const uw = useUnifiedWallet();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [category, setCategory] = useState<CategoryId>('design');
  const [deadlineDays, setDeadlineDays] = useState<number>(14);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // C-1 — Read the real on-chain ORA balance when bounty real-chain mode
  // is enabled. The mockChain balance was a placeholder (newAccountStarter
  // = 10 ORA) that didn't match the user's actual on-chain holdings, which
  // blocked the most common demo flow ("I have 1000 ORA, why can't I post
  // a 50 ORA bounty?"). We fall back to mockChain only when:
  //   • real-chain mode is off, OR
  //   • the wallet hasn't synced yet (chainOraBalance === null), OR
  //   • the RPC read failed (handled by leaving null).
  const [chainOraBalance, setChainOraBalance] = useState<number | null>(null);
  const [chainBalanceLoading, setChainBalanceLoading] = useState(false);
  useEffect(() => {
    if (!onChain.enabled || !oraOnChain.enabled || !uw.publicKey) {
      setChainOraBalance(null);
      setChainBalanceLoading(false);
      return;
    }
    let cancelled = false;
    setChainBalanceLoading(true);
    const owner = uw.publicKey;
    (async () => {
      try {
        const raw = await oraOnChain.getBalance(owner);
        if (!cancelled) {
          setChainOraBalance(Number(raw) / Math.pow(10, oraOnChain.decimals));
        }
      } catch {
        if (!cancelled) setChainOraBalance(null);
      } finally {
        if (!cancelled) setChainBalanceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [onChain.enabled, oraOnChain.enabled, oraOnChain, uw.publicKey]);

  const liveBalanceMode = onChain.enabled && oraOnChain.enabled && uw.publicKey !== null;
  const effectiveOraBalance = liveBalanceMode && chainOraBalance !== null
    ? chainOraBalance
    : mockChain.oraBalance;

  const titleLen = title.trim().length;
  const descLen = description.trim().length;
  const rewardNum = Number(reward);
  // M-1 — In Privy read-only mode, publicKey is non-null but `source`
  // remains null until the wallets hook syncs. We can't sign yet, so the
  // Submit button is disabled with a " wallet syncing " hint instead of
  // throwing a confusing "No wallet connected" error mid-tx.
  const walletSyncing = onChain.enabled && uw.publicKey !== null && uw.source === null;
  // H-2 — We need to pre-validate brief length for the on-chain path
  // because the V2 metadataUri field is capped at 200 chars. See comment
  // on BRIEF_CHAIN_MAX_CHARS above.
  const briefTooLongForChain = onChain.enabled && descLen > BRIEF_CHAIN_MAX_CHARS;

  // C-1 — Balance check now uses `effectiveOraBalance`. While the chain
  // balance is still loading we deliberately treat the row as indeterminate
  // (passes the gate) so the user isn't blocked by a transient null read.
  const balanceCheck = chainBalanceLoading
    ? true
    : effectiveOraBalance >= rewardNum;

  const checks = useMemo(() => ({
    title: titleLen >= 4 && titleLen <= TITLE_MAX,
    description: descLen >= 30 && descLen <= DESC_MAX && !briefTooLongForChain,
    reward: Number.isFinite(rewardNum) && rewardNum >= MIN_REWARD,
    balance: balanceCheck,
  }), [titleLen, descLen, rewardNum, balanceCheck, briefTooLongForChain]);

  const canSubmit =
    checks.title
    && checks.description
    && checks.reward
    && checks.balance
    && !walletSyncing;

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (!v || tags.includes(v) || tags.length >= 6) return;
    setTags([...tags, v]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(tags.filter(x => x !== t));

  const handleFileUpload = (files: FileList | File[]) => {
    const incoming = Array.from(files).map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
    }));
    setUploaded(prev => [...prev, ...incoming]);
  };
  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) handleFileUpload(e.dataTransfer.files);
  };
  const removeFile = (id: string) => setUploaded(prev => prev.filter(f => f.id !== id));

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      // Compose enriched description so additional metadata makes it onto
      // the bounty record even though createBounty's API only takes title /
      // description / reward today.
      const cat = CATEGORIES.find(c => c.id === category);
      const meta: string[] = [];
      if (cat) meta.push(`Category: ${cat.emoji} ${cat.label}`);
      meta.push(`Deadline: ${deadlineDays} days from acceptance`);
      if (tags.length) meta.push(`Tags: ${tags.map(t => '#' + t).join(' ')}`);
      if (uploaded.length) meta.push(`Reference files: ${uploaded.map(f => f.name).join(', ')}`);
      const enrichedDesc = description.trim() + '\n\n— — —\n' + meta.join('\n');

      if (onChain.enabled && onChain.module) {
        // Real on-chain path. The wallet adapter must be connected.
        const sponsor = (onChain.module as any).wallet?.publicKey;
        if (!sponsor) throw new Error('Connect a Solana wallet first.');
        // Ensure the per-sponsor bounty counter PDA exists. Idempotent.
        try {
          await onChain.module.ensureBountyCounter();
        } catch (counterErr) {
          // Most likely "already exists" — fetchBounty later confirms id alignment.
          // eslint-disable-next-line no-console
          console.info('[BountyCreate] ensureBountyCounter:', counterErr);
        }
        const bountyId = await onChain.module.nextBountyId(sponsor);
        const deadline = Math.floor(Date.now() / 1000) + deadlineDays * 86400;
        // H-2 — Compress brief to a length we know base64+prefix fits in
        // BOUNTY_V2_LIMITS.URI_MAX (200 chars). We use the *trimmed user
        // brief only* for the on-chain URI (no metadata footer) so the
        // detail page decodes back into something the creator typed.
        // The full enriched description still lives off-chain (we'll move
        // it to IPFS later); for now it's lost on-chain by design.
        const briefForChain = description.trim().slice(0, BRIEF_CHAIN_MAX_CHARS);
        const metadataUri = `data:text/plain;base64,${btoa(unescape(encodeURIComponent(briefForChain)))}`;
        if (metadataUri.length > 200) {
          throw new Error(
            `Brief too long for on-chain URI (${metadataUri.length}/200). ` +
            `Please shorten the brief to ≤ ${BRIEF_CHAIN_MAX_CHARS} chars.`,
          );
        }
        const res = await onChain.module.createBounty({
          bountyId,
          totalReward: BigInt(rewardNum) * 1_000_000_000n, // assume 9 decimals
          maxWinners: 1, // UI currently doesn't surface this; default 1
          deadline,
          title: title.trim().slice(0, 80),
          metadataUri,
          paymentMint: onChain.oraMint,
          isOfficial: false,
        });
        if (!res.success) throw new Error(res.error || 'on-chain create failed');
        const bountyPda = (res as { bounty?: { toBase58: () => string } }).bounty?.toBase58();
        showToast('success', 'Bounty posted on-chain', `${rewardNum} ORA escrowed. tx: ${res.signature.slice(0, 8)}…`);
        // Redirect to the detail page with the on-chain PDA so the creator
        // can immediately share the link with submitters.
        if (bountyPda) {
          navigate(`/marketplace/bounty/${bountyPda}?pda=${bountyPda}`);
          return;
        }
      } else {
        await mockChain.createBounty(title.trim(), enrichedDesc, rewardNum);
        showToast('success', `Bounty posted`, `${rewardNum} ORA escrowed. Open it in Studio → Bounties.`);
      }
      navigate('/studio?tab=bounties');
    } catch (e: any) {
      showToast('error', 'Failed to post bounty', e?.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="-mx-4 md:-mx-6 -mt-6 -mb-12">
      {/* Sticky top bar — back + title + submit. Matches CreatePage pattern. */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 lg:px-8 py-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/studio?tab=bounties')}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              aria-label="Back to Studio"
            >
              ← <span className="hidden sm:inline">Cancel</span>
            </button>
            <div className="h-5 w-px bg-border/60 hidden sm:block" />
            <h2 className="font-semibold truncate inline-flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-green-500" />
              Post a bounty
            </h2>
          </div>
          <Button
            size="sm"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
          >
            {submitting ? 'Posting…' : `Escrow ${reward || '0'} ORA & post`}
          </Button>
        </div>
      </div>

      {/* Desktop two-column grid */}
      <div className="hidden lg:grid lg:grid-cols-[3fr_2fr] lg:gap-5 px-6 lg:px-8 pt-6 pb-12">
        <EditorPane
          title={title} setTitle={setTitle}
          description={description} setDescription={setDescription}
          tags={tags} tagInput={tagInput} setTagInput={setTagInput}
          addTag={addTag} removeTag={removeTag}
          uploaded={uploaded}
          handleDrop={handleDrop} handleFileUpload={handleFileUpload}
          removeFile={removeFile}
          titleLen={titleLen} descLen={descLen}
        />
        <SidebarPane
          reward={reward} setReward={setReward}
          category={category} setCategory={setCategory}
          deadlineDays={deadlineDays} setDeadlineDays={setDeadlineDays}
          checks={checks}
          canSubmit={canSubmit}
          submitting={submitting}
          handleSubmit={handleSubmit}
          oraBalance={effectiveOraBalance}
          balanceLoading={chainBalanceLoading}
          walletSyncing={walletSyncing}
          briefTooLongForChain={briefTooLongForChain}
        />
      </div>

      {/* Mobile single column */}
      <div className="lg:hidden px-4 pt-4 pb-24 space-y-4">
        <EditorPane
          title={title} setTitle={setTitle}
          description={description} setDescription={setDescription}
          tags={tags} tagInput={tagInput} setTagInput={setTagInput}
          addTag={addTag} removeTag={removeTag}
          uploaded={uploaded}
          handleDrop={handleDrop} handleFileUpload={handleFileUpload}
          removeFile={removeFile}
          titleLen={titleLen} descLen={descLen}
        />
        <SidebarPane
          reward={reward} setReward={setReward}
          category={category} setCategory={setCategory}
          deadlineDays={deadlineDays} setDeadlineDays={setDeadlineDays}
          checks={checks}
          canSubmit={canSubmit}
          submitting={submitting}
          handleSubmit={handleSubmit}
          oraBalance={effectiveOraBalance}
          balanceLoading={chainBalanceLoading}
          walletSyncing={walletSyncing}
          briefTooLongForChain={briefTooLongForChain}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Left column: editor
// ──────────────────────────────────────────────────────────────────────

function EditorPane(props: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  tags: string[]; tagInput: string; setTagInput: (v: string) => void;
  addTag: () => void; removeTag: (t: string) => void;
  uploaded: UploadedFile[];
  handleDrop: React.DragEventHandler<HTMLDivElement>;
  handleFileUpload: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  titleLen: number; descLen: number;
}) {
  const {
    title, setTitle, description, setDescription,
    tags, tagInput, setTagInput, addTag, removeTag,
    uploaded, handleDrop, handleFileUpload, removeFile,
    titleLen, descLen,
  } = props;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border shadow-sm p-5 lg:p-6 space-y-5">
        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
            <span className={`text-[11px] ${titleLen > TITLE_MAX ? 'text-red-500' : 'text-muted-foreground'}`}>
              {titleLen}/{TITLE_MAX}
            </span>
          </div>
          <Input
            placeholder="e.g. Cover art for my next EP"
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX + 20))}
            className="text-base"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            One clear sentence. What needs to get made.
          </p>
        </div>

        {/* Brief */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brief</label>
            <span className={`text-[11px] ${descLen > DESC_MAX ? 'text-red-500' : 'text-muted-foreground'}`}>
              {descLen}/{DESC_MAX}
            </span>
          </div>
          <textarea
            rows={9}
            placeholder={`Be specific. Cover:
• Goal & target audience
• Style, tone, mood references
• Deliverable format (e.g. PNG 4000px, MP4 1080p, 800-word article)
• Hard requirements vs. nice-to-haves
• Any brand/voice rules to follow`}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border bg-background text-sm resize-y leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            The clearer the brief, the better the submissions. Aim for 100+ words.
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            Tags ({tags.length}/6)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => (
              <Badge key={t} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive/20" onClick={() => removeTag(t)}>
                #{t} <X className="w-2.5 h-2.5 ml-0.5" />
              </Badge>
            ))}
          </div>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Add a tag, press Enter"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              disabled={tags.length >= 6}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* References / attachments */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
            Reference files (optional)
          </label>
          <div
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={handleDrop}
            className="rounded-xl border-2 border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center hover:border-green-500/40 hover:bg-green-500/5 transition-colors cursor-pointer"
            onClick={() => document.getElementById('bounty-file-input')?.click()}
          >
            <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Drop reference images, mood boards, brand guidelines, or click to browse
            </p>
            <input
              id="bounty-file-input"
              type="file"
              multiple
              className="hidden"
              onChange={e => e.target.files && handleFileUpload(e.target.files)}
            />
          </div>
          {uploaded.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {uploaded.map(f => (
                <li key={f.id} className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-1.5 text-xs">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted-foreground/70 flex-shrink-0">{f.size}</span>
                  </span>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                    aria-label="Remove file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Right column: sidebar — reward, category, deadline, rules
// ──────────────────────────────────────────────────────────────────────

function SidebarPane(props: {
  reward: string; setReward: (v: string) => void;
  category: CategoryId; setCategory: (id: CategoryId) => void;
  deadlineDays: number; setDeadlineDays: (n: number) => void;
  checks: { title: boolean; description: boolean; reward: boolean; balance: boolean };
  canSubmit: boolean;
  submitting: boolean;
  handleSubmit: () => void;
  oraBalance: number;
  balanceLoading?: boolean;
  walletSyncing?: boolean;
  briefTooLongForChain?: boolean;
}) {
  const {
    reward, setReward, category, setCategory, deadlineDays, setDeadlineDays,
    checks, canSubmit, submitting, handleSubmit, oraBalance,
    balanceLoading, walletSyncing, briefTooLongForChain,
  } = props;

  const rewardNum = Number(reward);
  const validReward = Number.isFinite(rewardNum) && rewardNum > 0;
  const cat = CATEGORIES.find(c => c.id === category);

  return (
    <div className="space-y-4">
      {/* Reward */}
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
            <Coins className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold">Reward</h3>
        </div>
        <div>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="100"
              value={reward}
              onChange={e => setReward(e.target.value)}
              className="text-xl font-bold h-12 pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">ORA</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Min {MIN_REWARD} ORA</span>
            {balanceLoading ? (
              <span className="text-muted-foreground italic">Checking balance…</span>
            ) : (
              <span className={oraBalance < rewardNum ? 'text-red-500' : 'text-muted-foreground'}>
                Balance: {oraBalance.toFixed(2)} ORA
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2.5 leading-relaxed">
          Funds are escrowed on-chain when you post. Released to the chosen submission, or refunded after the deadline if no winner is picked.
        </div>
      </div>

      {/* Category */}
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold">Category</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(c => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={
                  'rounded-xl border text-left px-3 py-2.5 transition-colors ' +
                  (active
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-border/60 hover:bg-muted/40')
                }
              >
                <div className="text-base">{c.emoji}</div>
                <div className="text-xs font-semibold mt-0.5">{c.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{c.desc}</div>
              </button>
            );
          })}
        </div>
        {cat && (
          <p className="text-[11px] text-muted-foreground">
            Filed under <span className="font-semibold">{cat.emoji} {cat.label}</span>.
          </p>
        )}
      </div>

      {/* Deadline */}
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold">Deadline</h3>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[3, 7, 14, 30].map(d => {
            const active = deadlineDays === d;
            return (
              <button
                key={d}
                onClick={() => setDeadlineDays(d)}
                className={
                  'rounded-lg border text-center py-2 transition-colors ' +
                  (active
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border/60 hover:bg-muted/40')
                }
              >
                <div className="text-sm font-bold">{d}d</div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Submissions close after {deadlineDays} day{deadlineDays === 1 ? '' : 's'}. Pick a winner any time before then.
        </p>
      </div>

      {/* Submit checks */}
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold">Before posting</h3>
        <ul className="space-y-1.5 text-xs">
          <Check ok={checks.title}>Title is 4–{TITLE_MAX} chars</Check>
          <Check ok={checks.description}>
            Brief is 30–{briefTooLongForChain ? 80 : DESC_MAX} chars
            {briefTooLongForChain && ' (on-chain limit)'}
          </Check>
          <Check ok={checks.reward}>Reward ≥ {MIN_REWARD} ORA</Check>
          <Check ok={checks.balance}>
            {balanceLoading ? 'Checking balance…' : 'Wallet has enough ORA to escrow'}
          </Check>
        </ul>
        <Button
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="w-full bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
        >
          {submitting
            ? 'Posting…'
            : walletSyncing
              ? 'Wallet syncing…'
              : validReward
                ? `Escrow ${rewardNum} ORA & post`
                : 'Post bounty'}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        {!checks.balance && validReward && !balanceLoading && (
          <p className="text-[11px] text-red-500 inline-flex items-start gap-1 leading-tight">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Not enough ORA. Top up before posting.
          </p>
        )}
        {walletSyncing && (
          <p className="text-[11px] text-amber-500 inline-flex items-start gap-1 leading-tight">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Wallet still syncing. One moment…
          </p>
        )}
        {briefTooLongForChain && (
          <p className="text-[11px] text-red-500 inline-flex items-start gap-1 leading-tight">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            On-chain mode caps the brief at {BRIEF_CHAIN_MAX_CHARS} chars. Move the rest into a reference link.
          </p>
        )}
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={'inline-flex items-center gap-2 w-full ' + (ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
      <span className={'w-3.5 h-3.5 inline-flex items-center justify-center rounded-full text-[10px] flex-shrink-0 ' + (ok ? 'bg-emerald-500/15' : 'bg-muted')}>
        {ok ? '✓' : <Plus className="w-2.5 h-2.5 opacity-50" />}
      </span>
      <span>{children}</span>
    </li>
  );
}
