/** Only invalidation signals cross tabs: no accounts, contacts or personal tracking codes. */
type ChangeKind = 'data' | 'auth';
const EVENT = 'pervik:changed';
const KEY = 'pervik:invalidation:v1';
let channel: BroadcastChannel | undefined;
function getChannel() {
  if (typeof window === 'undefined') return;
  try { return channel ||= new BroadcastChannel(KEY); } catch { return; }
}
export function publishPlatformChange(kind: ChangeKind = 'data') {
  if (typeof window === 'undefined') return;
  const message = { kind, nonce: `${Date.now()}:${Math.random()}` };
  if (kind === 'data') window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
  const transport = getChannel();
  if (transport) { try { transport.postMessage(message); return; } catch { /* Fall back to a storage signal. */ } }
  try { localStorage.setItem(KEY, JSON.stringify(message)); } catch { /* Periodic refresh remains available. */ }
}
export function subscribePlatformChanges(listener: (kind: ChangeKind) => void): () => void {
  const receive = (message: unknown) => {
    if (!message || typeof message !== 'object' || !('kind' in message)) return;
    if (message.kind === 'data' || message.kind === 'auth') listener(message.kind);
  };
  const local = (event: Event) => receive((event as CustomEvent).detail);
  const remote = (event: MessageEvent) => receive(event.data);
  const storage = (event: StorageEvent) => { if (event.key === KEY && event.newValue) try { receive(JSON.parse(event.newValue)); } catch { /* Ignore unrelated or malformed signals. */ } };
  const transport = getChannel();
  window.addEventListener(EVENT, local); window.addEventListener('storage', storage); transport?.addEventListener('message', remote);
  return () => { window.removeEventListener(EVENT, local); window.removeEventListener('storage', storage); transport?.removeEventListener('message', remote); };
}
