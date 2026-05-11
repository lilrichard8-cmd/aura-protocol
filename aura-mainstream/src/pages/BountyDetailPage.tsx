/**
 * BountyDetailPage — real bounty detail view.
 *
 * 2026-05-11 R14 — completely rewritten. The previous version had a wall
 * of hard-coded mock data: a fake "AURA Platform UI/UX Design Concept"
 * bounty with a 5000 ORA reward, three fake submissions ("Alex Design",
 * "Luna Creative", "Design Studio X"), invented requirements lists and
 * skill chips. None of that came from the chain.
 *
 * Now: we read the bounty exclusively from `mockChain.bounties` (the same
 * source the Studio Bounties tab and Marketplace use). If the id doesn't
 * resolve we show a friendly 404. Submissions come from
 * `mockChain.mySubmissions` — the local user's own submissions to this
 * bounty (the protocol doesn't surface other users' work-in-flight, just
 * the winning submission once decided).
 */

import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Users, Upload, Coins, Clock,
  Briefcase, AlertCircle, Send, FileText, CheckCircle2, XCircle,
} from 'lucide-react';
import { useMockChain } from '@/context/MockChainContext';
import { useGoBack } from '@/hooks/useGoBack';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/context/ToastContext';

function formatDeadline(deadline?: string): { text: string; expired: boolean; soon: boolean } {
  if (!deadline) return { text: 'No deadline set', expired: false, soon: false };
  const now = Date.now();
  const target = new Date(deadline).getTime();
  if (!Number.isFinite(target)) return { text: deadline, expired: false, soon: false };
  const diff = target - now;
  if (diff <= 0) return { text: 'Closed', expired: true, soon: false };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const soon = diff < 86_400_000 * 2;
  if (days > 0) return { text: `${days}d ${hours}h left`, expired: false, soon };
  return { text: `${hours}h left`, expired: false, soon };
}

function formatDate(d: string | number | undefined): string {
  if (d === undefined || d === null) return '—';
  const t = typeof d === 'number' ? d : Date.parse(d);
  if (!Number.isFinite(t)) return String(d);
  return new Date(t).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BountyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/studio?tab=bounties');
  const mockChain = useMockChain();
  const { showToast } = useToast();

  const bounty = useMemo(
    () => mockChain.bounties.find(b => b.id === id),
    [mockChain.bounties, id],
  );

  // The current user's submissions to this bounty (if any). The chain
  // doesn't expose other users' submissions for in-flight bounties —
  // that's by design (sealed-bid auction model).
  const mySubmissions = useMemo(
    () => bounty
      ? mockChain.mySubmissions
          .filter(s => s.bountyId === bounty.id)
          .sort((a, b) => b.submittedAt - a.submittedAt)
      : [],
    [mockChain.mySubmissions, bounty],
  );

  const [workUrl, setWorkUrl] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 404 — bounty doesn't exist (probably stale link or already deleted).
  if (!bounty) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">Bounty not found</h1>
        <p className="text-sm text-muted-foreground">
          This bounty doesn't exist (or was removed). It may have been deleted by its creator
          or you may be following a stale link.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={() => navigate('/studio?tab=bounties')} className="bg-green-500 hover:bg-green-600 text-white">
            <Briefcase className="w-4 h-4 mr-1.5" /> Browse bounties
          </Button>
        </div>
      </div>
    );
  }

  const deadlineInfo = formatDeadline(bounty.deadline);
  const isCreator = bounty.creator === mockChain.publicKey;
  const canSubmit =
    !isCreator
    && bounty.status === 'active'
    && !deadlineInfo.expired;

  const handleSubmission = async () => {
    if (!workUrl.trim()) {
      showToast('error', 'Add a link to your work', 'Paste a Figma / GitHub / portfolio URL.');
      return;
    }
    setIsSubmitting(true);
    try {
      await mockChain.submitBountyWork(bounty.id, workUrl.trim(), note.trim() || undefined);
      showToast('success', 'Submission sent', 'The bounty creator can now review it.');
      setWorkUrl('');
      setNote('');
    } catch (e: any) {
      showToast('error', 'Submission failed', e?.message || 'Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusChip = (() => {
    switch (bounty.status) {
      case 'active':
        return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">Active</Badge>;
      case 'completed':
        return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">Completed</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
      default:
        return <Badge variant="outline">{bounty.status}</Badge>;
    }
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Title card */}
      <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-600 dark:text-green-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">{bounty.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                {statusChip}
                <span className="text-[11px] text-muted-foreground">
                  ID {bounty.id.slice(0, 10)}…
                </span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Reward</p>
            <p className="text-2xl font-bold text-amber-500 inline-flex items-center gap-1">
              <Coins className="w-4 h-4" />
              {bounty.reward.toLocaleString()} <span className="text-base font-medium">ORA</span>
            </p>
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Meta icon={<Clock className="w-3.5 h-3.5" />} label="Deadline">
            <span className={deadlineInfo.expired ? 'text-muted-foreground' : deadlineInfo.soon ? 'text-amber-500' : ''}>
              {deadlineInfo.text}
            </span>
          </Meta>
          <Meta icon={<Calendar className="w-3.5 h-3.5" />} label="Closes">
            {bounty.deadline ? formatDate(bounty.deadline) : '—'}
          </Meta>
          <Meta icon={<Users className="w-3.5 h-3.5" />} label="Submissions">
            {bounty.submissionCount}
          </Meta>
          <Meta icon={<Briefcase className="w-3.5 h-3.5" />} label="Creator">
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar src={undefined} displayName={bounty.creator} username={bounty.creator} className="w-4 h-4 rounded-full" />
              <span className="truncate">{bounty.creator || 'Unknown'}</span>
            </span>
          </Meta>
        </div>
      </div>

      {/* Brief */}
      <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Brief
        </h2>
        {bounty.description ? (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-sm">
            {bounty.description}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            The creator didn't add a description.
          </p>
        )}
      </div>

      {/* My submissions to this bounty */}
      {mySubmissions.length > 0 && (
        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your submissions ({mySubmissions.length})
          </h2>
          <ul className="space-y-2">
            {mySubmissions.map(s => (
              <li
                key={s.id}
                className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <a
                      href={s.workUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-aura hover:underline truncate"
                    >
                      {s.workUrl}
                    </a>
                  </div>
                  {s.note && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {s.note}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Submitted {formatDate(s.submittedAt)} · Reward snapshot {s.rewardSnapshot} ORA
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {s.status === 'pending' && (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">
                      <Clock className="w-3 h-3 mr-1" /> Pending
                    </Badge>
                  )}
                  {s.status === 'won' && (
                    <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Won
                    </Badge>
                  )}
                  {s.status === 'lost' && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <XCircle className="w-3 h-3 mr-1" /> Lost
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit work form (other users only, while active) */}
      {canSubmit && (
        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-aura/15 text-aura flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold">Submit your work</h2>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1 block">
              Work link
            </label>
            <Input
              placeholder="https://figma.com/file/... or https://github.com/..."
              value={workUrl}
              onChange={e => setWorkUrl(e.target.value)}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Public link to your deliverable. Figma, GitHub, Notion, IPFS, anywhere accessible.
            </p>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1 block">
              Note (optional)
            </label>
            <Textarea
              placeholder="One paragraph: what you delivered, how it meets the brief, anything the creator should know."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="text-sm resize-y"
            />
          </div>
          <Button
            onClick={handleSubmission}
            disabled={isSubmitting || !workUrl.trim()}
            className="w-full bg-aura hover:bg-aura-dark text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : (
              <>
                <Send className="w-4 h-4 mr-1.5" />
                Send submission
              </>
            )}
          </Button>
        </div>
      )}

      {/* States the user can't submit: not creator + not active */}
      {!canSubmit && !isCreator && (
        <div className="bg-muted/40 rounded-2xl border border-border/60 p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {deadlineInfo.expired
              ? 'This bounty has closed.'
              : bounty.status === 'completed'
                ? 'A winner has already been selected.'
                : 'Submissions are not open for this bounty.'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            You can still browse the brief above.
          </p>
        </div>
      )}

      {/* Creator-only note */}
      {isCreator && (
        <div className="bg-aura/5 border border-aura/30 rounded-2xl p-6 space-y-2">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-aura" />
            You posted this bounty
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Submissions arrive sealed — only you (the creator) can see them once decided.
            Manage incoming work and pick a winner from <span className="font-semibold">Studio → Bounties</span>.
          </p>
          <Button
            size="sm"
            onClick={() => navigate('/studio?tab=bounties')}
            className="bg-aura hover:bg-aura-dark text-white mt-2"
          >
            Manage in Studio
          </Button>
        </div>
      )}
    </div>
  );
}

function Meta({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground inline-flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}
