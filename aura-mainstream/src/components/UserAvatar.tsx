// UserAvatar — single source of truth for clickable user-avatar rendering.
//
// Wraps `<img>` in a button when the user has a `username`, navigating
// to `/u/:username` on click. Falls back to a plain `<img>` when there
// is no resolvable username (e.g. system actors), or when the caller
// explicitly passes `linkable={false}` (e.g. inside a composer or
// dialog where we don't want bubble-up navigation).
//
// Sizing convention:
//   - The size + rounding classes (e.g. `w-8 h-8 rounded-full`) live on
//     the *outer* element — same as the original `<img>` site we're
//     replacing — so existing layouts keep their dimensions.
//   - The internal <img> always fills its container with `w-full h-full`.

import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface UserAvatarProps {
  /** Image URL — required. */
  src: string;
  /** Display name — used as alt text. */
  displayName?: string;
  /** Username — when present, the avatar becomes a link to /u/:username.
   *  Pass undefined / empty for system actors (e.g. "AURA Protocol")
   *  where there's no profile to view. */
  username?: string;
  /** Override the default click target. When provided AND linkable, runs
   *  in preference to /u/:username. */
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Wrapper className — match the original `<img>` className you had
   *  (size, rounding, border, ring). The internal <img> fills it. */
  className?: string;
  /** Force-disable the link wrapper. */
  linkable?: boolean;
  /** alt text override; defaults to displayName. */
  alt?: string;
  /** Title attribute override; defaults to "View {displayName}'s profile" */
  title?: string;
  /** When true, stops the click from bubbling — recommended when the
   *  avatar is rendered inside a parent button/card that has its own
   *  onClick (e.g. a clickable comment row). Defaults to true. */
  stopPropagation?: boolean;
}

export default function UserAvatar({
  src,
  displayName,
  username,
  onClick,
  className,
  linkable = true,
  alt,
  title,
  stopPropagation = true,
}: UserAvatarProps) {
  const navigate = useNavigate();
  const altText = alt ?? displayName ?? '';
  const canLink = linkable && (!!username || !!onClick);

  if (!canLink) {
    return (
      <img
        src={src}
        alt={altText}
        className={cn('object-cover', className)}
        draggable={false}
      />
    );
  }

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (stopPropagation) e.stopPropagation();
    if (onClick) {
      onClick(e);
      return;
    }
    if (username) navigate(`/u/${username}`);
  };

  // Render as a `<button>` so it's keyboard-accessible. We strip default
  // button styling and let the className carry the visual.
  return (
    <button
      type="button"
      onClick={handleClick}
      title={title ?? (displayName ? `View ${displayName}'s profile` : 'View profile')}
      aria-label={altText ? `Open profile of ${altText}` : 'Open profile'}
      className={cn(
        'p-0 m-0 bg-transparent border-0 overflow-hidden cursor-pointer',
        'transition-shadow hover:ring-2 hover:ring-aura/50',
        className,
      )}
    >
      <img
        src={src}
        alt={altText}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </button>
  );
}
