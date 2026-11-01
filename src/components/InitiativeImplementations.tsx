import { Building2, MapPin, Users } from 'lucide-react';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import type { PublicImplementation } from '../utils/implementations.ts';

export function InitiativeImplementations({ initiative, onJoin }: { initiative: PublicInitiative; onJoin: (implementation: PublicImplementation) => void }) {
  if (!initiative.implementations?.length) return null;
  return <section className="public-implementations" aria-labelledby="public-implementations-title"><h3 id="public-implementations-title">Где реализуют инициативу</h3><div>{initiative.implementations.map((item) => {
    const activists = Math.max(0, item.activistSlots - item.activistsAccepted), volunteers = Math.max(0, item.volunteerSlots - item.volunteersAccepted);
    return <article className="public-implementation" key={item.id}><div className="public-implementation-place">{item.scope === 'city' ? <MapPin size={16} /> : <Building2 size={16} />}<strong>{item.organization}</strong></div><p>Ответственный: {item.ownerName}</p><span className={`implementation-status implementation-${item.status}`}>{item.status === 'completed' ? 'Реализована · результат подтверждён' : item.status === 'proposed' ? 'Предложена реализация' : item.status === 'report_pending' ? 'Проведена · итоги на проверке' : item.status === 'changes_requested' ? 'Итоги готовятся' : 'Реализуется'}</span>{item.status === 'active' && (activists > 0 || volunteers > 0) && <><div className="public-recruitment"><Users size={16} /><span>Нужны {activists > 0 ? `активисты: ${activists}` : ''}{activists > 0 && volunteers > 0 ? ' · ' : ''}{volunteers > 0 ? `волонтёры: ${volunteers}` : ''}</span></div><button type="button" className="journey-secondary" onClick={() => onJoin(item)}>Откликнуться на мероприятие →</button></>}{item.status === 'active' && activists === 0 && volunteers === 0 && <p className="journey-hint">Набор команды закрыт</p>}</article>;
  })}</div></section>;
}
