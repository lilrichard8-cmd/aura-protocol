// Full staking tab: stake / unstake / claim / role progression / my stakes.
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import {
  Lock,
  Unlock,
  Gift,
  Award,
  X,
  ShieldCheck,
  Vote,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StakingTierSelector, {
  BASE_APY,
  MIN_STAKE,
} from '@/components/wallet/StakingTierSelector';
import { MIN_PROPOSAL_STAKE } from '@/components/governance/ProposalEligibilityBadge';
import { MIN_NOMINATION_STAKE } from '@/components/governance/electionCycle';
import type { StakeEntry } from '@/context/MockChainContext';

export function StakingTab(props: {
  stakedOra: number;
  stakingRewards: number;
  availableOra: number;
  stakes: StakeEntry[];
  showStakeModal: 'stake' | 'unstake' | null;
  setShowStakeModal: (v: 'stake' | 'unstake' | null) => void;
  stakeAmount: string;
  setStakeAmount: (v: string) => void;
  stakeTier: number;
  setStakeTier: (v: number) => void;
  stakeError: string | null;
  setStakeError: (v: string | null) => void;
  stakeOverBalance: boolean;
  stakeBelowMin: boolean;
  stakeAmountNum: number;
  stakingLoading: boolean;
  handleStake: () => Promise<void> | void;
  handleClaim: () => Promise<void> | void;
  lStake: string; lUnstake: string; lClaim: string;
  lStakedOra: string; lPending: string; lAvailableOra: string;
}) {
  const isCurator = props.availableOra >= 100 || props.stakedOra >= 100;
  const TIERS = [
    { name: 'Curator',   threshold: 100,                  icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10', perk: 'Curate posts and earn curation rewards every 24h', met: isCurator },
    { name: 'Proposer',  threshold: MIN_PROPOSAL_STAKE,   icon: Vote,        color: 'text-blue-500',    bg: 'bg-blue-500/10',    perk: 'Submit governance proposals (any committee track)', met: props.stakedOra >= MIN_PROPOSAL_STAKE },
    { name: 'Committee', threshold: MIN_NOMINATION_STAKE, icon: Trophy,      color: 'text-amber-500',   bg: 'bg-amber-500/10',   perk: 'Self-nominate for elected committees (6-month term)', met: props.stakedOra >= MIN_NOMINATION_STAKE },
  ];

  return (
    <div className="space-y-6">
      {/* Top: 3 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200/50 dark:border-blue-800/50 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{props.lStakedOra}</p>
          <div className="text-3xl font-black tabular-nums">{props.stakedOra.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">{BASE_APY}% base APY × lock multiplier</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-200/50 dark:border-green-800/50 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{props.lPending}</p>
          <div className="text-3xl font-black tabular-nums text-green-500">{props.stakingRewards.toFixed(4)}</div>
          <p className="text-xs text-muted-foreground mt-1">Pending rewards — claim anytime</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/50 p-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{props.lAvailableOra}</p>
          <div className="text-3xl font-black tabular-nums">{props.availableOra.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground mt-1">Spendable ORA in your wallet</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => { props.setShowStakeModal('stake'); props.setStakeAmount(''); props.setStakeTier(90); }}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Lock className="w-4 h-4 mr-2" /> {props.lStake} ORA
        </Button>
        <Button
          onClick={() => { props.setShowStakeModal('unstake'); props.setStakeAmount(''); }}
          variant="outline"
        >
          <Unlock className="w-4 h-4 mr-2" /> {props.lUnstake} ORA
        </Button>
        <Button
          onClick={() => props.handleClaim()}
          disabled={props.stakingRewards <= 0}
          className="bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
        >
          <Gift className="w-4 h-4 mr-2" /> {props.lClaim}
        </Button>
      </div>

      {/* Inline stake/unstake form */}
      {props.showStakeModal && (
        <div className="bg-card rounded-xl p-5 border border-border/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">
              {props.showStakeModal === 'stake' ? `${props.lStake} ORA` : `${props.lUnstake} ORA`}
            </h3>
            <button
              onClick={() => { props.setShowStakeModal(null); props.setStakeError(null); }}
              className="p-1 hover:bg-secondary rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {props.showStakeModal === 'stake' && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Choose lock period</p>
              <StakingTierSelector value={props.stakeTier} onChange={props.setStakeTier} />
            </div>
          )}
          <Input
            type="number"
            placeholder={props.showStakeModal === 'stake' ? `Min ${MIN_STAKE} ORA` : 'Amount'}
            value={props.stakeAmount}
            onChange={(e) => { props.setStakeAmount(e.target.value); props.setStakeError(null); }}
            className={`mb-1 ${props.stakeOverBalance || props.stakeBelowMin ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          />
          {(props.stakeError || props.stakeOverBalance || props.stakeBelowMin) && (
            <p className="text-xs text-red-500 mb-3">
              {props.stakeError
                ? props.stakeError
                : props.stakeBelowMin
                  ? `Minimum stake is ${MIN_STAKE} ORA`
                  : props.showStakeModal === 'stake'
                    ? `Insufficient balance (you have ${props.availableOra.toFixed(4)} ORA)`
                    : `Cannot unstake more than staked (${props.stakedOra.toFixed(4)} ORA)`}
            </p>
          )}
          {!props.stakeError && !props.stakeOverBalance && !props.stakeBelowMin && <div className="mb-3" />}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { props.setShowStakeModal(null); props.setStakeError(null); }} className="flex-1">Cancel</Button>
            <Button
              onClick={() => props.handleStake()}
              disabled={props.stakingLoading || props.stakeOverBalance || props.stakeBelowMin || !Number.isFinite(props.stakeAmountNum) || props.stakeAmountNum <= 0}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {props.stakingLoading ? 'Processing...' : props.showStakeModal === 'stake' ? props.lStake : props.lUnstake}
            </Button>
          </div>
        </div>
      )}

      {/* Role progression */}
      <section>
        <h2 className="text-base font-bold inline-flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-amber-500" />
          Role progression
        </h2>
        <div className="space-y-3">
          {TIERS.map(role => {
            const Icon = role.icon;
            const progress = Math.min(100, (props.stakedOra / role.threshold) * 100);
            return (
              <div key={role.name} className="rounded-xl border bg-card p-4 border-border/40">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${role.bg}`}>
                    <Icon className={`w-5 h-5 ${role.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm">{role.name}</h3>
                      {role.met && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${role.color} ${role.bg} px-1.5 py-0.5 rounded`}>Unlocked</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{role.perk}</p>
                  </div>
                  <span className="text-xs font-mono tabular-nums shrink-0 text-muted-foreground">
                    {props.stakedOra.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {role.threshold.toLocaleString()}
                  </span>
                </div>
                {!role.met && (
                  <div className="w-full h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <div className={`h-full transition-all ${role.color.replace('text-', 'bg-')}`} style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* My stakes */}
      <section>
        <h2 className="text-base font-bold inline-flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-blue-500" />
          My stakes ({props.stakes.length})
        </h2>
        {props.stakes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Lock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No stakes yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Stake ORA above to unlock roles and earn rewards.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {props.stakes.map(s => {
              const locked = Date.now() < s.unlocksAt;
              const remaining = Math.max(0, s.unlocksAt - Date.now());
              const days = Math.ceil(remaining / 86400000);
              const elapsed = Math.max(0, Date.now() - s.startedAt);
              const totalDuration = s.unlocksAt - s.startedAt;
              const pct = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 100;
              return (
                <div key={s.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xl font-black tabular-nums">{s.amount.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">ORA</span></span>
                    <span className={`text-xs font-bold ${locked ? 'text-orange-500' : 'text-green-500'}`}>
                      {locked ? `${days}d left` : 'Unlocked ✓'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                    <span>{s.lockDays}-day lock</span>
                    <span>·</span>
                    <span>{s.multiplier}× multiplier</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
                    <div className={`h-full ${locked ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default StakingTab;
