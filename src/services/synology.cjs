const { ensureHttp } = require('./http.cjs');
async function synologyRequest(base, config, method, params = {}) {
  const url = new URL(`${base}/webapi/entry.cgi`);
  const body = new URLSearchParams({ api: 'SYNO.Chat.External', method, version: '2', token: config.botToken, ...params });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  if (data.success === false) throw new Error(data.error?.code ? `Synology API error ${data.error.code}` : 'Synology API error');
  return data.data || data;
}
async function fetchSynology(config) {
  const base = ensureHttp(config.baseUrl);
  const channelsData = await synologyRequest(base, config, 'channel_list');
  const channels = channelsData.channels || channelsData;
  const allowed = new Set((config.channels || '').split(',').map(s => s.trim()).filter(Boolean));
  const names = (config.names || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const days = Math.min(90, Math.max(1, Number(config.lookbackDays) || 7));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const items = [];
  for (const channel of Array.isArray(channels) ? channels : []) {
    if (allowed.size && !allowed.has(String(channel.channel_id))) continue;
    const data = await synologyRequest(base, config, 'post_list', { channel_id: String(channel.channel_id), prev_count: '500', next_count: '0' });
    const posts = data.posts || data.messages || [];
    for (const post of posts) {
      const text = String(post.text || post.message || '');
      const time = Number(post.timestamp || post.time || 0);
      const millis = time > 1e12 ? time : time * 1000;
      const matches = /@here\b/i.test(text) || names.some(name => text.toLowerCase().includes(`@${name}`));
      if (!matches || (millis && millis < since)) continue;
      const id = post.post_id || post.id || `${channel.channel_id}-${millis}`;
      items.push({ id: `synology:${id}`, source: 'synology', kind: 'chat', title: `${channel.name || 'Synology Chat'} · ${post.username || '작성자'}`, detail: text.slice(0, 240), url: '', receivedAt: millis ? new Date(millis).toISOString() : null, priority: 'attention' });
    }
  }
  return items;
}
module.exports = { fetchSynology };
