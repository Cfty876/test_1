import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Globe, ShieldCheck, Wrench, X } from 'lucide-react';
import { platformRequest } from '../utils/platformApi.ts';
import { useLiveRefresh } from '../utils/useLiveRefresh.ts';
import { DEFAULT_MAINTENANCE, type MaintenanceSettings } from '../utils/siteStatus.ts';
import { ModalDialog } from './ModalDialog.tsx';

interface Settings extends MaintenanceSettings { history?: { enabled: boolean; at: string; version: number }[] }
export function MaintenanceControl() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MAINTENANCE.message);
  const [editingVersion, setEditingVersion] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => { const value = await platformRequest<Settings>('/maintenance', undefined, signal); if (!signal?.aborted) setSettings(previous => previous && previous.version > value.version ? previous : value); }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(() => { if (!controller.signal.aborted) setError('Не удалось проверить состояние сайта.'); }); return () => controller.abort(); }, [load]);
  useLiveRefresh(load, true);
  function show() { setError(''); setNotice(''); setMessage(settings?.message || DEFAULT_MAINTENANCE.message); setEditingVersion(settings?.version || 0); setConfirm(false); setAcknowledged(false); setOpen(true); }
  async function save(enabled: boolean) {
    if (!settings || busy || (enabled !== settings.enabled && enabled && !acknowledged)) return;
    const validMessage = message.trim().length >= 10 && message.trim().length <= 600;
    if (enabled && !validMessage) { setError('Напишите сообщение от 10 до 600 символов.'); return; }
    const savedMessage = validMessage ? message : settings.message || DEFAULT_MAINTENANCE.message;
    setBusy(true); setError('');
    try {
      const updated = await platformRequest<MaintenanceSettings>('/maintenance', { enabled, message: savedMessage, version: editingVersion });
      setSettings(updated); setMessage(updated.message); setEditingVersion(updated.version); setConfirm(false); setAcknowledged(false);
      setNotice(updated.enabled ? 'Техработы включены. Доступ остался только у администратора.' : 'Сайт открыт. Участники смогут продолжить работу.');
      void load().catch(() => {});
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось изменить режим. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  const changedElsewhere = settings && editingVersion !== settings.version;
  return <section className={`maintenance-control${settings?.enabled ? ' is-active' : ''}`} aria-label="Управление доступом к сайту">
    <span className="maintenance-control-icon">{settings?.enabled ? <Wrench size={20} /> : <Globe size={20} />}</span>
    <div><strong>{settings ? settings.enabled ? 'На сайте идут техработы' : 'Сайт открыт для участников' : 'Проверяем состояние сайта…'}</strong><span>Управление доступно только администратору</span></div>
    <button type="button" onClick={show}>Управление сайтом<ArrowRight size={17} /></button>
    {error && !open && <p className="inline-error" role="alert">{error}</p>}
    {open && <ModalDialog labelledBy="maintenance-control-title" className="cabinet-dialog maintenance-control-dialog" onClose={() => setOpen(false)} busy={busy}><div className="workflow-dialog">
      <div className="workflow-dialog-heading"><h2 id="maintenance-control-title">Доступ к платформе</h2><button type="button" disabled={busy} aria-label="Закрыть" onClick={() => setOpen(false)}><X size={22} /></button></div>
      <div className="maintenance-control-status"><ShieldCheck size={21} /><p>{settings?.enabled ? 'Сейчас платформа закрыта для участников. Вы можете проверять данные и баллы.' : 'Сейчас участники, кураторы и гости пользуются сайтом.'}<br />Администратор сохраняет доступ при техработах.</p></div>
      {changedElsewhere && <div className="inline-error" role="alert">Режим изменён в другом окне. <button type="button" disabled={busy} onClick={() => { setEditingVersion(settings.version); setMessage(settings.message); setConfirm(false); setAcknowledged(false); setError(''); }}>Подгрузить актуальные настройки</button></div>}
      <form onSubmit={event => { event.preventDefault(); if (!settings) return; if (settings.enabled || confirm) void save(!settings.enabled); else setConfirm(true); }}>
        <fieldset disabled={busy || !settings || Boolean(changedElsewhere)}>
          <label htmlFor="maintenance-message">Сообщение для участников</label><textarea id="maintenance-message" className="pervik-input" rows={4} minLength={10} maxLength={600} required value={message} onChange={event => setMessage(event.target.value)} aria-describedby="maintenance-message-hint" />
          <p id="maintenance-message-hint" className="journey-hint">От 10 до 600 символов. Не указывайте личные данные. Изменения появятся после подтверждения.</p>
          <div className="maintenance-preview"><span>Что увидят участники</span><strong>Скоро снова в движении</strong><p>{message || DEFAULT_MAINTENANCE.message}</p></div>
          {confirm && !settings?.enabled && <div className="maintenance-confirm"><h3>Закрыть платформу для участников?</h3><p>Посетители, школьные председатели и кураторы увидят экран технических работ. Их новые действия будут приостановлены. Открытые несохранённые формы могут закрыться. Уже сохранённые данные останутся в базе.</p><label><input type="checkbox" required checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>Подтверждаю включение техработ</span></label></div>}
          <div className="maintenance-actions"><button type="submit" formNoValidate={settings?.enabled === true} className="home-primary">{busy ? 'Сохраняем…' : settings?.enabled ? 'Открыть сайт для участников' : confirm ? 'Подтвердить и включить техработы' : 'Включить технические работы'}</button>{settings?.enabled && <button type="button" className="cabinet-button" disabled={busy} onClick={() => void save(true)}>Обновить только сообщение</button>}{confirm && !settings?.enabled && <button type="button" className="cabinet-button" onClick={() => { setConfirm(false); setAcknowledged(false); }}>Отмена</button>}</div>
        </fieldset>
      </form>
      {!settings && <button className="cabinet-button" type="button" onClick={() => void load().then(() => setError('')).catch(() => setError('Сервер пока недоступен.'))}>Проверить состояние ещё раз</button>}
      {error && <p className="inline-error" role="alert">{error}</p>}{notice && <p className="maintenance-saved" role="status"><CheckCircle2 size={20} />{notice}</p>}
      {!!settings?.history?.length && <details className="maintenance-history"><summary>Последние изменения режима</summary><ol>{settings.history.slice(-5).reverse().map(entry => <li key={entry.version}><span>{entry.enabled ? 'Техработы включены' : 'Сайт открыт'}</span><time dateTime={entry.at}>{new Date(entry.at).toLocaleString('ru-RU')}</time></li>)}</ol></details>}
    </div></ModalDialog>}
  </section>;
}
