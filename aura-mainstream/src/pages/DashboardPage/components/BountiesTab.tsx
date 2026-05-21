// Dashboard Bounties tab — bounties you posted & participated in.
// Extracted from DashboardPage.tsx 2026-05-20 P-1 split.
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, CheckCircle, Coins, MessageCircle,
  Plus, Target, Trophy,
} from 'lucide-react';
import { KpiTile, BountyRow } from './dashboardRows';

export function BountiesTab({
  myBounties, submittedBounties, navigate,
}: {
  myBounties: any[];
  submittedBounties: any[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const totalRewardLocked = myBounties
    .filter(b => b.status === 'active')
    .reduce((s, b) => s + b.reward, 0);
  const totalAwarded = myBounties
    .filter(b => b.status === 'completed')
    .reduce((s, b) => s + b.reward, 0);
  const totalSubmissions = myBounties.reduce((s, b) => s + b.submissionCount, 0);

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile icon={<Trophy className="w-4 h-4" />} label="Active bounties" value={myBounties.filter(b => b.status === 'active').length.toString()} unit="open for submissions" tone="aura" />
        <KpiTile icon={<Coins className="w-4 h-4" />} label="Reward locked" value={totalRewardLocked.toLocaleString()} unit="ORA in escrow" tone="amber" />
        <KpiTile icon={<CheckCircle className="w-4 h-4" />} label="Awarded" value={totalAwarded.toLocaleString()} unit="ORA distributed" tone="emerald" />
        <KpiTile icon={<MessageCircle className="w-4 h-4" />} label="Submissions" value={totalSubmissions.toString()} unit="received total" tone="purple" />
      </div>

      {/* Posted bounties */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-aura" />
            Bounties you posted ({myBounties.length})
          </h2>
          <button
            onClick={() => navigate('/create?mode=bounty')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-aura text-white text-xs font-bold hover:bg-aura-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New bounty
          </button>
        </div>
        {myBounties.length === 0 ? (
          <div className="p-10 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No bounties posted yet</p>
            <p className="text-xs text-muted-foreground">
              Crowdsource work from creators by offering ORA rewards.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {myBounties.map(b => (
              <BountyRow key={b.id} bounty={b} role="poster" navigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* Bounties you participated in */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/30">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Target className="w-4 h-4 text-aura" />
            Bounties you submitted to ({submittedBounties.length})
          </h2>
        </div>
        {submittedBounties.length === 0 ? (
          <div className="p-10 text-center">
            <Target className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">No submissions yet</p>
            <p className="text-xs text-muted-foreground mb-3">
              Browse open bounties and submit your work to earn ORA.
            </p>
            <button
              onClick={() => navigate('/explore')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/70 transition-colors"
            >
              Browse bounties
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {submittedBounties.map(b => (
              <BountyRow key={b.id} bounty={b} role="submitter" navigate={navigate} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab 4: Earnings
// ═══════════════════════════════════════════════════════════════════════
export default BountiesTab;
