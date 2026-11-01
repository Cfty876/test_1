import { directionLabel } from '../utils/initiativeDirections.ts';
import type { MouseEvent } from 'react';
import { ArrowUpRight, Heart, Users } from 'lucide-react';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { initiativeHref, authorInitials, initiativeStage } from '../utils/initiativePresentation.ts';
import { recruitmentSummary } from '../utils/implementations.ts';
import { InitiativeArt } from './InitiativeArt.tsx';

interface Props {
  initiative: PublicInitiative; onOpen: (initiative: PublicInitiative) => void;
  liked: boolean; liking: boolean; onLike: (id: string) => Promise<void>;
  editorial?: boolean; helpNeeded?: string;
}
export function InitiativeCard({ initiative, onOpen, liked, liking, onLike, editorial = false, helpNeeded }: Props) {
  const need = helpNeeded || recruitmentSummary(initiative.implementations);
  const linkProps = {
    href: initiativeHref(initiative.id),
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); onOpen(initiative);
    },
  };
  return <article className={`idea-card${editorial ? ' idea-card-editorial' : ''}`}>
    {editorial && <a {...linkProps} className="idea-cover-link" aria-label={`Открыть инициативу «${initiative.title}»`} tabIndex={-1}><InitiativeArt initiative={initiative} /><span><ArrowUpRight size={21} /></span></a>}
    <div className="idea-card-body">
      <div className="idea-card-meta"><span className="idea-category">{directionLabel(initiative)}</span><button type="button" className="idea-heart" aria-label={`Нравится инициатива «${initiative.title}»`} aria-pressed={liked} disabled={liking} onClick={() => void onLike(initiative.id)}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /><span>{initiative.likeCount || 0}</span></button></div>
      <h3><a {...linkProps}>{initiative.title}</a></h3>
      <p className="idea-description">{initiative.description}</p>
      <div className="idea-need"><Users size={16} aria-hidden="true" /><span>{need ? `${helpNeeded ? '' : 'Нужны '}${need}` : initiativeStage(initiative)}</span></div>
      <div className="idea-card-bottom"><span className="idea-author"><span className="idea-avatar" aria-hidden="true">{authorInitials(initiative.author)}</span><span>{initiative.author}</span></span><a {...linkProps} className="idea-open" aria-label={`Подробнее об инициативе «${initiative.title}»`}><ArrowUpRight size={19} /></a></div>
    </div>
  </article>;
}
