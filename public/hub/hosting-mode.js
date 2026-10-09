/** Sites serves browser-local games; the PC host owns real-time rooms. */
export const isBrowserHosted = (doc = globalThis.document) => doc?.querySelector('meta[name="semag-hosting"]')?.content === 'sites';

export function pcHostUrl(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048 || /\s/.test(text)) throw new Error('Enter the PC host address, such as MY-PC:3000.');
  const explicitScheme = /^[a-z][a-z\d+.-]*:/i.test(text) && !/^[^/]+:\d+(?=[/?#]|$)/.test(text);
  let url;
  try { url = new URL(explicitScheme ? text : `http://${text}`); } catch { throw new Error('Enter a valid hostname:port or HTTP invite link.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw new Error('Use an HTTP or HTTPS host address without login details.');
  if (!explicitScheme && !url.port) url.port = '3000';
  return url.href;
}
