import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { initiativeCover } from '../utils/initiativeCovers.ts';

/** One stable thematic illustration in the preview and the full initiative page. */
export function InitiativeArt({ initiative, large = false }: {
  initiative: Pick<PublicInitiative, 'area' | 'coverId'>;
  large?: boolean;
}) {
  const cover = initiativeCover(initiative);
  return <div className={`idea-art idea-art-thematic${large ? ' idea-art-large' : ''}`} data-cover={cover.id} aria-hidden="true">
    <img src={cover.src} alt="" width={900} height={540} loading={large ? 'eager' : 'lazy'} decoding="async" fetchPriority={large ? 'high' : 'auto'} />
  </div>;
}
