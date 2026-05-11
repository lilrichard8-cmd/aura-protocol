import { useState } from 'react';
import { MoreHorizontal, Flag } from 'lucide-react';
import type { Post } from '@/types';
import PhotoCard from './PhotoCard';
import VideoCard from './VideoCard';
import TextCard from './TextCard';
import LiveCard from './LiveCard';
import AdCard from './AdCard';
import AudioCard from './AudioCard';
import ReportDialog from '@/components/common/ReportDialog';

export default function FeedCard({ post }: { post: Post }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // If it's an ad, use AdCard regardless of type
  if (post.isAd) {
    return <AdCard post={post} />;
  }

  let card: React.ReactNode = null;
  switch (post.type) {
    case 'photo':
      card = <PhotoCard post={post} />;
      break;
    case 'video':
      card = <VideoCard post={post} />;
      break;
    case 'text':
      card = <TextCard post={post} />;
      break;
    case 'live':
      card = <LiveCard post={post} />;
      break;
    case 'audio':
      card = <AudioCard post={post} />;
      break;
    default:
      return null;
  }

  return (
    <div className="relative group break-inside-avoid">
      {card}
      {/* Report menu trigger */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-1 bg-background rounded-lg shadow-lg border border-border/40 py-1 min-w-[120px]">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowReport(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-secondary/50 transition-colors"
            >
              <Flag className="w-4 h-4" />
              Report
            </button>
          </div>
        )}
      </div>
      <ReportDialog open={showReport} onClose={() => setShowReport(false)} postId={post.id} />
    </div>
  );
}
