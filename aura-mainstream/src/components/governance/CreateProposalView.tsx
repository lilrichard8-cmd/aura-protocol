/**
 * CreateProposalView — Studio-style two-column layout for /governance/create.
 *
 * Mirrors `CreatePage`'s [3fr_2fr] desktop grid:
 *   ┌──────────────────────┬──────────────────────┐
 *   │ Left: editor card    │ Right: meta sidebar  │
 *   │  • Title input       │  • Committee picker  │
 *   │  • Description       │  • Tier selector     │
 *   │    (immersive ▶)     │  • Attachments       │
 *   │  • Tags + chrome     │  • Rules checklist   │
 *   │                      │  • Submit button     │
 *   └──────────────────────┴──────────────────────┘
 *
 * On mobile, falls back to a single column with a sticky bottom action bar
 * (same approach as Studio).
 *
 * The "publish flow" stays exactly as before — we still call
 * `mockChain.createProposal(title, description, { committee, tier })`.
 * Only the layout changes; no new mutations.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Hash, Plus, Shield, Upload, FileText, Trash2, X, ChevronRight,
  Sparkles, Users as UsersIcon, AlertCircle, Save, Vote as VoteIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { useI18n } from '@/context/I18nContext';
import { useMockChain, type Proposal } from '@/context/MockChainContext';
import {
  COMMITTEE_META,
  committeeI18nKey,
  TIER_META,
  type ProposalTier,
} from './proposalHelpers';

const COMMITTEE_ORDER = [
  'development-committee',
  'operations-committee',
  'tech-committee',
  'content-committee',
  'arbitration-committee',
];

// User-selectable tiers. Tier-1 is immutable (cannot be created via this form);
// Tier-4 is committee-only. We expose Tier-2 / Tier-3 to community proposers.
const SELECTABLE_TIERS: ProposalTier[] = ['tier-3', 'tier-2'];

interface UploadedFile {
  id: string;
  name: string;
  size: string;
}

export default function CreateProposalView() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showToast } = useToast();
  const mockChain = useMockChain();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [committeeId, setCommitteeId] = useState<string>('development-committee');
  const [tier, setTier] = useState<ProposalTier>('tier-3');
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const stakedOra = mockChain.stakedOra ?? 0;
  const STAKE_REQUIRED = 1_000;
  const stakeMet = stakedOra >= STAKE_REQUIRED;

  const charCount = description.length;
  const titleLen = title.trim().length;
  const titleOk = titleLen >= 8 && titleLen <= 120;
  const descOk = description.trim().length >= 50;

  // Validation gate — shown as a checklist on the right and gates the submit button.
  const checks = useMemo(() => [
    { label: 'Title 8–120 chars',           ok: titleOk },
    { label: 'Description ≥ 50 chars',      ok: descOk },
    { label: 'Committee selected',          ok: !!committeeId },
    { label: `≥ ${STAKE_REQUIRED.toLocaleString()} ORA staked`, ok: stakeMet },
  ], [titleOk, descOk, committeeId, stakeMet]);
  const canSubmit = checks.every(c => c.ok);

  const addTag = () => {
    const v = tagInput.trim().toLowerCase().replace(/^#+/, '');
    if (!v) return;
    if (tags.includes(v)) { setTagInput(''); return; }
    if (tags.length >= 6) {
      showToast('error', 'Tag limit', 'Up to 6 tags per proposal.');
      return;
    }
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
      const opts: { committee?: string; tier?: Proposal['tier'] } = { committee: committeeId, tier };
      await mockChain.createProposal(title.trim(), description.trim(), opts);
      showToast('success', 'Proposal submitted', 'Voters will see it in Active proposals.');
      navigate('/governance/active');
    } catch (e: any) {
      showToast('error', 'Submit failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const i18nKey = committeeI18nKey(committeeId);
  const committeeMeta = COMMITTEE_META[committeeId];
  const localizedCommittee = i18nKey ? t.governance.committees[i18nKey] : committeeMeta?.name ?? committeeId;

  return (
    <div className="-mx-4 md:-mx-6 -mt-6 -mb-12">
      {/* Mobile sticky action bar — matches Studio mobile pattern */}
      <div className="lg:hidden sticky top-[73px] z-30 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between p-3 px-4">
          <button onClick={() => navigate('/governance/active')} className="text-sm text-muted-foreground hover:text-foreground">
            ← Cancel
          </button>
          <h2 className="font-semibold text-sm">New proposal</h2>
          <Button
            size="sm"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </div>

      {/* Desktop: 3fr / 2fr two-column grid (mirrors Studio) */}
      <div className="hidden lg:grid lg:grid-cols-[3fr_2fr] lg:gap-5 px-6 lg:px-8 pt-6 pb-12">
        <EditorPane
          title={title} setTitle={setTitle}
          description={description} setDescription={setDescription}
          tags={tags} tagInput={tagInput} setTagInput={setTagInput}
          addTag={addTag} removeTag={removeTag}
          uploaded={uploaded} setUploaded={setUploaded}
          handleDrop={handleDrop} handleFileUpload={handleFileUpload}
          removeFile={removeFile}
          charCount={charCount}
          titleLen={titleLen}
          desktop
        />
        <SidebarPane
          committeeId={committeeId} setCommitteeId={setCommitteeId}
          tier={tier} setTier={setTier}
          checks={checks}
          canSubmit={canSubmit}
          submitting={submitting}
          handleSubmit={handleSubmit}
          stakedOra={stakedOra}
          stakeRequired={STAKE_REQUIRED}
          localizedCommittee={localizedCommittee}
        />
      </div>

      {/* Mobile: stacked single column */}
      <div className="lg:hidden px-4 pt-4 pb-24 space-y-4">
        <EditorPane
          title={title} setTitle={setTitle}
          description={description} setDescription={setDescription}
          tags={tags} tagInput={tagInput} setTagInput={setTagInput}
          addTag={addTag} removeTag={removeTag}
          uploaded={uploaded} setUploaded={setUploaded}
          handleDrop={handleDrop} handleFileUpload={handleFileUpload}
          removeFile={removeFile}
          charCount={charCount}
          titleLen={titleLen}
          desktop={false}
        />
        <SidebarPane
          committeeId={committeeId} setCommitteeId={setCommitteeId}
          tier={tier} setTier={setTier}
          checks={checks}
          canSubmit={canSubmit}
          submitting={submitting}
          handleSubmit={handleSubmit}
          stakedOra={stakedOra}
          stakeRequired={STAKE_REQUIRED}
          localizedCommittee={localizedCommittee}
        />
      </div>
    </div>
  );
}

// ── Left column: editor ──────────────────────────────────────────────────
function EditorPane({
  title, setTitle,
  description, setDescription,
  tags, tagInput, setTagInput, addTag, removeTag,
  uploaded, handleDrop, handleFileUpload, removeFile,
  titleLen,
  desktop,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  tags: string[]; tagInput: string; setTagInput: (v: string) => void;
  addTag: () => void; removeTag: (t: string) => void;
  uploaded: UploadedFile[]; setUploaded: (fn: (prev: UploadedFile[]) => UploadedFile[]) => void;
  handleDrop: React.DragEventHandler<HTMLDivElement>;
  handleFileUpload: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  charCount: number;
  titleLen: number;
  desktop: boolean;
}) {
  const navigate = useNavigate();
  const heightClass = desktop ? 'h-[calc(100vh-140px)]' : '';
  return (
    <div className={`flex flex-col gap-4 ${heightClass}`}>
      {desktop && (
        <div className="flex items-center gap-4 mb-1">
          <button onClick={() => navigate('/governance/active')} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
          <h2 className="text-lg font-semibold">New proposal</h2>
          <span className="ml-auto text-[11px] text-muted-foreground/70 italic">
            Be specific. Voters skim — clear titles get attention.
          </span>
        </div>
      )}

      {/* Combined editor card — title at top, description fills remaining space */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 flex flex-col p-5 space-y-3 min-h-0">
          {/* Title — prominent, like Studio's text mode */}
          <input
            type="text"
            placeholder="Proposal title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            className="w-full text-2xl font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/30"
          />
          <div className="text-[10px] text-right text-muted-foreground/60 tabular-nums -mt-2">
            {titleLen}/120
          </div>

          {/* Description — the star, fills available space */}
          <textarea
            placeholder={`Describe your proposal in detail.\n\n• What does it do?\n• Why is it needed?\n• What's the impact + cost?\n• Implementation plan + timeline.`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full flex-1 min-h-[260px] bg-transparent border-0 outline-none resize-none text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:text-foreground"
          />

          {/* Attachments */}
          <div className="border-t border-border/20 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Supporting documents (optional)</p>
              <label className="text-xs text-aura hover:text-aura-dark font-medium cursor-pointer">
                + Upload
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />
              </label>
            </div>
            {uploaded.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="rounded-xl border-2 border-dashed border-border/60 px-4 py-3 text-center text-[11px] text-muted-foreground/70 hover:border-aura/50 transition-colors"
              >
                <Upload className="w-4 h-4 mx-auto mb-1 opacity-50" />
                Drop PDF / DOC / sheets here
              </div>
            ) : (
              <div className="space-y-1.5">
                {uploaded.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-lg border border-border/30 group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{f.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 border-t border-border/20 pt-2">
            <Hash className="w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Add tags (press Enter)…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground/30"
            />
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeTag(tag)}
                >
                  #{tag} <X className="w-2.5 h-2.5 ml-0.5" />
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Right column: settings sidebar ───────────────────────────────────────
function SidebarPane({
  committeeId, setCommitteeId,
  tier, setTier,
  checks, canSubmit, submitting, handleSubmit,
  stakedOra, stakeRequired,
  localizedCommittee,
}: {
  committeeId: string; setCommitteeId: (v: string) => void;
  tier: ProposalTier; setTier: (v: ProposalTier) => void;
  checks: Array<{ label: string; ok: boolean }>;
  canSubmit: boolean;
  submitting: boolean;
  handleSubmit: () => void;
  stakedOra: number;
  stakeRequired: number;
  localizedCommittee: string;
}) {
  const { t } = useI18n();
  const tierMeta = TIER_META[tier];

  return (
    <aside className="space-y-4 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-1">
      {/* Committee picker */}
      <SidebarCard icon={<UsersIcon className="w-3.5 h-3.5" />} title="Reviewing committee">
        <div className="space-y-1.5">
          {COMMITTEE_ORDER.map(id => {
            const c = COMMITTEE_META[id];
            const key = committeeI18nKey(id);
            const label = key ? t.governance.committees[key] : c.name;
            const active = committeeId === id;
            const isArb = c.selection === 'random-selection';
            return (
              <button
                key={id}
                type="button"
                onClick={() => !isArb && setCommitteeId(id)}
                disabled={isArb}
                title={isArb ? 'Arbitration handles disputes — proposals go to other committees.' : ''}
                className={`w-full text-left rounded-xl border px-3 py-2 transition-all ${
                  active
                    ? 'border-aura bg-aura/10 ring-1 ring-aura/40'
                    : isArb
                      ? 'border-border/40 bg-secondary/20 opacity-50 cursor-not-allowed'
                      : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold leading-tight truncate">{label}</div>
                    <div className="text-[10px] text-muted-foreground/80 truncate">
                      {isArb ? 'Disputes only' : c.scopeChips.slice(0, 2).join(' · ')}
                    </div>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-aura shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </SidebarCard>

      {/* Tier picker */}
      <SidebarCard icon={<VoteIcon className="w-3.5 h-3.5" />} title="Proposal tier">
        <div className="grid grid-cols-2 gap-2 mb-2">
          {SELECTABLE_TIERS.map(tk => {
            const meta = TIER_META[tk];
            const active = tier === tk;
            return (
              <button
                key={tk}
                type="button"
                onClick={() => setTier(tk)}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-aura bg-aura/10 ring-1 ring-aura/40'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide leading-tight">
                  {meta.shortLabel}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {meta.approval}% · {meta.quorum}% quorum
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{tierMeta.summary}</p>
      </SidebarCard>

      {/* Eligibility checklist */}
      <SidebarCard icon={<Shield className="w-3.5 h-3.5" />} title="Submission checks">
        <ul className="space-y-1.5">
          {checks.map(c => (
            <li key={c.label} className={`flex items-center gap-2 text-[12px] ${c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                c.ok ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40'
              }`}>
                {c.ok ? '✓' : ''}
              </span>
              <span className={c.ok ? 'line-through opacity-70' : ''}>{c.label}</span>
            </li>
          ))}
        </ul>
        {!checks[3].ok && (
          <div className="mt-3 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 leading-relaxed flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              You have <span className="font-bold tabular-nums">{stakedOra.toLocaleString()}</span> ORA staked.
              Need <span className="font-bold tabular-nums">{stakeRequired.toLocaleString()}</span> to submit a proposal.
            </span>
          </div>
        )}
      </SidebarCard>

      {/* Rules */}
      <SidebarCard icon={<Sparkles className="w-3.5 h-3.5" />} title="Lifecycle">
        <ul className="text-[11px] space-y-1 text-muted-foreground list-disc list-inside">
          <li><span className="text-foreground/80 font-medium">Submission</span> — committee reviews for fit + safety</li>
          <li><span className="text-foreground/80 font-medium">Discussion</span> — 3-week public comment window</li>
          <li><span className="text-foreground/80 font-medium">Voting</span> — 1 week, quadratic √(staked ORA)</li>
          <li><span className="text-foreground/80 font-medium">Outcome</span> — passes if approval + quorum hit</li>
        </ul>
      </SidebarCard>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50"
        >
          <Plus className="w-4 h-4 mr-2" />
          {submitting ? 'Submitting…' : `Submit to ${localizedCommittee}`}
        </Button>
        <Button variant="outline" className="w-full" disabled>
          <Save className="w-4 h-4 mr-2" /> Save draft <span className="ml-2 text-[10px] opacity-60">(soon)</span>
        </Button>
      </div>
    </aside>
  );
}

// ── Sidebar card wrapper ─────────────────────────────────────────────────
function SidebarCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}
