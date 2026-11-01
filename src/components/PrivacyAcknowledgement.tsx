import { LEGAL_DOCUMENTS_PATH } from '../utils/legal.ts';
import './privacy-acknowledgement.css';

export function PrivacyAcknowledgement({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <div className="privacy-acknowledgement">
    <label className="privacy-acknowledgement-check">
      <input type="checkbox" name="privacyAcknowledged" required disabled={disabled} checked={checked} onChange={event => onChange(event.target.checked)} />
      <span>Я ознакомился с <a href={`${LEGAL_DOCUMENTS_PATH}/privacy.html`} target="_blank" rel="noopener noreferrer">политикой конфиденциальности</a> (тестовая редакция).</span>
    </label>
    <p>Документы — проекты для утверждения. Подтверждение ознакомления не заменяет отдельное согласие на обработку персональных данных.</p>
    <a className="privacy-documents-link" href={`${LEGAL_DOCUMENTS_PATH}/index.html`} target="_blank" rel="noopener noreferrer">Все документы и положение о рейтинге ↗</a>
  </div>;
}
