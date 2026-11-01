import { Component, Suspense, type ReactNode } from 'react';
import { ModalDialog } from './ModalDialog.tsx';

interface Props { children: ReactNode; label?: string; modal?: boolean; active?: boolean; onClose?: () => void }
export class AsyncScreen extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  renderMessage(failed: boolean) {
    if (this.props.active === false) return null;
    const content = <div className="screen-load-content" role={failed ? 'alert' : 'status'}>
      {!failed && <span className="screen-load-spinner" aria-hidden="true" />}
      <h2 id="async-screen-title">{failed ? 'Не удалось загрузить раздел' : this.props.label || 'Загружаем раздел…'}</h2>
      {failed && <><p>Проверьте соединение и обновите страницу. Сохранённый черновик останется в этой вкладке.</p><button type="button" className="home-primary" onClick={() => window.location.reload()}>Обновить страницу</button></>}
      {this.props.onClose && <button type="button" className="journey-secondary" onClick={this.props.onClose}>Закрыть</button>}
    </div>;
    return this.props.modal ? <ModalDialog labelledBy="async-screen-title" onClose={this.props.onClose || (() => {})}><section className="screen-load-dialog">{content}</section></ModalDialog> : <main className="screen-load-page">{content}</main>;
  }
  render() {
    if (this.state.failed) return this.renderMessage(true);
    return <Suspense fallback={this.renderMessage(false)}>{this.props.children}</Suspense>;
  }
}
