import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { reportReasons, type ReportReason } from '@/data/mockP1';
import { useToast } from '@/context/ToastContext';
import { useI18n } from '@/context/I18nContext';

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  postId?: string;
}

export default function ReportDialog({ open, onClose }: ReportDialogProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!selected) return;
    showToast('success', t.report.submitted, t.report.reviewMessage);
    setSelected(null);
    setDetail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl w-[90%] max-w-md p-6 shadow-xl border border-border/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold">Report Content</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">Select a reason for reporting</p>

        <div className="space-y-2 mb-4">
          {reportReasons.map(r => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selected === r.value ? 'border-aura bg-aura/5' : 'border-border/40 hover:bg-secondary/50'
              }`}
            >
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </button>
          ))}
        </div>

        {selected === 'other' && (
          <textarea
            placeholder="Describe the issue..."
            value={detail}
            onChange={e => setDetail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm resize-none h-20 mb-4"
          />
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}
