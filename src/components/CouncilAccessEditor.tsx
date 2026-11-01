import { useState } from 'react';
import type { AccessUser } from './DashboardView.tsx';
import { COUNCIL_STATUSES, type CouncilStatus } from '../utils/implementations.ts';
import { ModalDialog } from './ModalDialog.tsx';
import { platformRequest } from '../utils/platformApi.ts';

export function CouncilAccessEditor({ user, onSaved }: { user: AccessUser; onSaved: () => Promise<void> }) {
  const [editingVersion, setEditingVersion] = useState(user.accessVersion || 1);
  const [open, setOpen] = useState(false); const [status, setStatus] = useState<CouncilStatus | ''>(user.councilStatus || '');
  const [branch, setBranch] = useState(user.branch || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await platformRequest('/council-access', { id: user.id, version: editingVersion, councilStatus: status || null, branch }); await onSaved(); setOpen(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось сохранить доступ.'); }
    finally { setBusy(false); }
  }
  return <><div className="council-account-status"><span>{user.councilStatus || 'Участник · проекты, рейтинг, календарь'}</span><button type="button" className="journey-secondary" onClick={() => { setEditingVersion(user.accessVersion || 1); setStatus(user.councilStatus || ''); setBranch(user.branch || ''); setError(''); setOpen(true); }}>Изменить школу и права</button></div>
    {open && <ModalDialog className="cabinet-dialog" labelledBy={`council-${user.id}`} onClose={() => setOpen(false)} busy={busy}><form className="workflow-dialog" onSubmit={(event) => { event.preventDefault(); void save(); }}><h2 id={`council-${user.id}`}>Школа и права сотрудника</h2><p>{user.name}</p><label htmlFor="council-school">Школа / гимназия</label><input id="council-school" className="pervik-input" maxLength={160} value={branch} disabled={busy} onChange={(event) => setBranch(event.target.value)} placeholder="Например: Гимназия № 39" /><label htmlFor="council-status">Должность в городском Совете</label><select id="council-status" className="pervik-input" value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as CouncilStatus | '')}><option value="">Участник без должности в городском Совете</option>{COUNCIL_STATUSES.map((item) => <option value={item} key={item}>{item === 'Председатель Екатеринбурга' ? 'Председатель Совета Первых Екатеринбурга' : item}</option>)}</select><p className="journey-hint">Школа указывается в проектах и рейтинге. Участник может предложить проект в школе, районе или городе. Председатель Екатеринбурга согласует запуск, проверяет отчёты, выставляет баллы и добавляет события. Заместитель выставляет баллы. Куратор рассматривает общие заявки, выставляет баллы и добавляет события. Остальные должности сохраняют кабинет участника. Все настройки доступны администратору.</p>{error && <p className="inline-error" role="alert">{error}</p>}<div className="journey-actions"><button type="button" disabled={busy} className="journey-secondary" onClick={() => setOpen(false)}>Отмена</button><button type="submit" disabled={busy} className="home-primary">{busy ? 'Сохраняем…' : 'Сохранить права'}</button></div></form></ModalDialog>}
  </>;
}
