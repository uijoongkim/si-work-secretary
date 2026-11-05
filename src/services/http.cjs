function encodeCredentials(config) {
  if (config.authType === 'bearer') return `Bearer ${config.token || config.password || ''}`;
  return `Basic ${Buffer.from(`${config.username || ''}:${config.password || ''}`).toString('base64')}`;
}
async function request(url, config, options = {}) {
  const headers = { Accept: 'application/json', Authorization: encodeCredentials(config), ...(options.headers || {}) };
  const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}
function cleanBaseUrl(value) { return (value || '').trim().replace(/\/$/, ''); }
function safeUrl(value) { try { return new URL(value); } catch { throw new Error('서버 URL을 확인해 주세요.'); } }
function ensureHttp(value) {
  const url = safeUrl(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('HTTP 또는 HTTPS 서버 URL을 입력해 주세요.');
  return cleanBaseUrl(value);
}
module.exports = { request, cleanBaseUrl, ensureHttp };
