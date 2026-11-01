import { useEffect, useRef } from 'react';
import { ArrowRight, House } from 'lucide-react';

export function NotFoundView({ title = 'Кажется, мы сбились с пути', description = 'Такой страницы нет. Возможно, ссылка устарела или в адресе опечатка. Но хорошие идеи точно есть — найдём их вместе.' }: { title?: string; description?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const oldTitle = document.title;
    document.title = '404 · Страница не найдена — Первик';
    heading.current?.focus({ preventScroll: true });
    return () => { document.title = oldTitle; };
  }, []);
  return <main className="recovery-page" aria-labelledby="not-found-title">
    <div className="recovery-code" aria-hidden="true">404<span>Дальше — к новым идеям</span></div>
    <div className="recovery-copy"><p className="recovery-label">Страница не найдена</p>
      <h1 id="not-found-title" ref={heading} tabIndex={-1}>{title}</h1>
      <p>{description}</p>
      <div className="recovery-actions"><a className="recovery-primary" href="/"><House size={18} aria-hidden="true" />На главную<ArrowRight size={18} aria-hidden="true" /></a><a href="/?view=initiatives">Смотреть инициативы<ArrowRight size={18} aria-hidden="true" /></a></div>
    </div>
  </main>;
}
