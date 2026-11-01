/** Return only an HTTPS link on a VK host; never pass arbitrary user URLs to href. */
export function normalizeVkUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return '';
  if (raw.length > 500) return null;
  try {
    const url = new URL(/^(?:www\.|m\.)?vk\.(?:com|ru)\//i.test(raw) ? `https://${raw}` : raw);
    if (url.protocol !== 'https:' || !/^(?:www\.|m\.)?vk\.(?:com|ru)$/i.test(url.hostname) || url.username || url.password || url.port || url.pathname === '/') return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function russianPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (value.startsWith('+7') || (digits.length >= 11 && /^[78]/.test(digits))) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function formatRussianPhone(value: string): string {
  const digits = russianPhoneDigits(value);
  if (!digits) return '+7';
  let result = `+7 (${digits.slice(0, 3)}`;
  if (digits.length >= 3) result += ')';
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`;
  return result;
}
