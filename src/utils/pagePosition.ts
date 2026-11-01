interface PagePosition { scrollY: number; viewportHeight: number; documentHeight: number; layoutChanged: boolean }
type Listener = (position: PagePosition) => void;
const listeners = new Set<Listener>();
let frame = 0;
let layoutChanged = true;
let documentHeight = 0;
let observer: ResizeObserver | undefined;

/** Share one passive scroll listener and one animation frame across navigation. */
function deliver() {
  frame = 0;
  if (layoutChanged) documentHeight = document.documentElement.scrollHeight;
  const position = { scrollY: Math.max(0, window.scrollY), viewportHeight: window.innerHeight, documentHeight, layoutChanged };
  layoutChanged = false;
  listeners.forEach(listener => listener(position));
}
export function requestPagePositionUpdate() { if (!frame) frame = requestAnimationFrame(deliver); }
function resize() { layoutChanged = true; requestPagePositionUpdate(); }
export function subscribePagePosition(listener: Listener) {
  if (!listeners.size) {
    window.addEventListener('scroll', requestPagePositionUpdate, { passive: true });
    window.addEventListener('resize', resize);
    observer = new ResizeObserver(resize);
    observer.observe(document.body);
    observer.observe(document.documentElement);
  }
  listeners.add(listener);
  resize();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener('scroll', requestPagePositionUpdate);
      window.removeEventListener('resize', resize);
      observer?.disconnect(); observer = undefined;
      cancelAnimationFrame(frame); frame = 0;
    }
  };
}
