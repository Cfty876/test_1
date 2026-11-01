// This identifies an acknowledgement of the published draft, not a separate consent.
export const PRIVACY_VERSION = 'privacy-test-2026-11-01-v1';
export const LEGAL_DOCUMENTS_PATH = '/documents/2026-11-01';
export const PRIVACY_ACKNOWLEDGEMENT_ERROR = 'Подтвердите ознакомление с тестовой редакцией политики конфиденциальности.';

export function hasPrivacyAcknowledgement(body: Record<string, unknown>): boolean {
  return body.privacyAcknowledged === true && body.privacyVersion === PRIVACY_VERSION;
}
