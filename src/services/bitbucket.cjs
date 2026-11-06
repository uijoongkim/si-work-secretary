const { request, ensureHttp } = require('./http.cjs');
async function fetchBitbucket(config) {
  const base = ensureHttp(config.baseUrl);
  const data = await request(`${base}/rest/api/1.0/dashboard/pull-requests?role=REVIEWER&state=OPEN&limit=100`, config);
  const days = Math.min(90, Math.max(1, Number(config.lookbackDays) || 7));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const projectKeys = new Set((config.projectKeys || '').split(',').map(value => value.trim().toUpperCase()).filter(Boolean));
  const repositorySlugs = new Set((config.repositorySlugs || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
  return (data.values || []).filter(pr => {
    if (pr.state !== 'OPEN' || Number(pr.updatedDate || pr.createdDate || 0) < since) return false;
    const repository = pr.toRef?.repository || {};
    const projectKey = repository.project?.key || repository.projectKey || '';
    const slug = repository.slug || repository.name || '';
    if (projectKeys.size && !projectKeys.has(String(projectKey).toUpperCase())) return false;
    if (repositorySlugs.size && !repositorySlugs.has(String(slug).toLowerCase())) return false;
    return true;
  }).map(pr => {
    const self = pr.toRef?.repository?.links?.self?.[0]?.href || '';
    const repoPath = self.replace(base, '').replace('/browse', '');
    const url = pr.links?.self?.[0]?.href || (repoPath ? `${base}${repoPath}/pull-requests/${pr.id}` : base);
    return { id: `bitbucket:pr:${pr.id}`, source: 'bitbucket', kind: 'review', title: `PR #${pr.id} · ${pr.title}`, detail: `${pr.fromRef?.displayId || ''} → ${pr.toRef?.displayId || ''} · ${pr.author?.user?.displayName || '작성자 미상'}`, url, priority: 'attention' };
  });
}
module.exports = { fetchBitbucket };
