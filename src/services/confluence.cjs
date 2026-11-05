const { request, ensureHttp } = require('./http.cjs');
async function fetchConfluence(config) {
  const base = ensureHttp(config.baseUrl);
  const query = new URLSearchParams({ cql: 'mention = currentUser() AND lastmodified >= startOfDay("-7d")', limit: '50', expand: 'content.space' });
  const data = await request(`${base}/rest/api/search?${query}`, config);
  return (data.results || []).map(result => {
    const content = result.content || result;
    const relative = result.url || content._links?.webui || '';
    return { id: `confluence:${content.id || result.id}`, source: 'confluence', kind: 'mention', title: content.title || result.title || 'Confluence 멘션', detail: result.excerpt || content.space?.name || '나를 언급한 페이지/댓글', url: relative.startsWith('http') ? relative : `${base}${relative}`, priority: 'attention' };
  });
}
module.exports = { fetchConfluence };
