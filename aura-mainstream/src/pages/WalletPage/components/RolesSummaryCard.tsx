// Roles & Stake summary card (Curator / Proposer / Committee tiers).
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import { Lock, ShieldCheck, Vote, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MIN_PROPOSAL_STAKE } from '@/components/governance/ProposalEligibilityBadge';
import { MIN_NOMINATION_STAKE } from '@/components/governance/electionCycle';

export function RolesSummaryCard(props: {
  stakedOra: number;
  availableOra: number;
  stakingRewards: number;
  onManage: () => void;
}) {
  // Three role tiers gated by stake/hold. The Curator threshold is satisfied by
  // either holding OR staking >= 100 ORA — the rest are stake-only.
  const isCurator = props.availableOra >= 100 || props.stakedOra >= 100;
  const TIERS = [
    { name: 'Curator',   threshold: 100,                  icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/15', desc: 'Curate posts & earn rewards', met: isCurator },
    { name: 'Proposer',  threshold: MIN_PROPOSAL_STAKE,   icon: Vote,        color: 'text-blue-500',    bg: 'bg-blue-500/15',    desc: 'Submit governance proposals', met: props.stakedOra >= MIN_PROPOSAL_STAKE },
    { name: 'Committee', threshold: MIN_NOMINATION_STAKE, icon: Trophy,      color: 'text-amber-500',   bg: 'bg-amber-500/15',   desc: 'Self-nominate to committee', met: props.stakedOra >= MIN_NOMINATION_STAKE },
  ];
  const unlockedCount = TIERS.filter(t => t.met).length;

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold">Roles & Stake</h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">{unlockedCount}/3 unlocked</span>
      </div>

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Total staked</p>
        <div className="text-4xl font-black tabular-nums leading-none">
          {props.stakedOra.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <span className="text-base font-normal text-muted-foreground ml-1">ORA</span>
        </div>
        {props.stakingRewards > 0 && (
          <p className="text-xs text-green-500 mt-1">+{props.stakingRewards.toFixed(4)} ORA pending</p>
        )}
      </div>

      <div className="space-y-2 mb-4 flex-1">
        {TIERS.map(role => {
          const Icon = role.icon;
          return (
            <div
              key={role.name}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${role.met ? role.bg : 'bg-secondary/30 opacity-70'}`}
              title={role.desc}
            >
              <Icon className={`w-4 h-4 shrink-0 ${role.met ? role.color : 'text-muted-foreground/50'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${role.met ? '' : 'text-muted-foreground'}`}>{role.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{role.desc}</p>
              </div>
              <span className={`text-[10px] font-mono shrink-0 ${role.met ? role.color : 'text-muted-foreground/60'}`}>
                {role.met ? '✓' : `≥ ${role.threshold.toLocaleString()}`}
              </span>
            </div>
          );
        })}
      </div>

      <Button onClick={props.onManage} className="w-full bg-blue-500 hover:bg-blue-600 text-white">
        Manage staking <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </div>
  );
}

export default RolesSummaryCard;
