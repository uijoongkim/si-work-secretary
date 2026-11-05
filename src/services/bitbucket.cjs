const { request, ensureHttp } = require('./http.cjs');
async function fetchBitbucket(config) {
  const base = ensureHttp(config.baseUrl);
  const data = await request(`${base}/rest/api/1.0/dashboard/pull-requests?role=REVIEWER&state=OPEN&limit=100`, config);
  return (data.values || []).filter(pr => pr.state === 'OPEN').map(pr => {
    const self = pr.toRef?.repository?.links?.self?.[0]?.href || '';
    const repoPath = self.replace(base, '').replace('/browse', '');
    const url = pr.links?.self?.[0]?.href || (repoPath ? `${base}${repoPath}/pull-requests/${pr.id}` : base);
    return { id: `bitbucket:pr:${pr.id}`, source: 'bitbucket', kind: 'review', title: `PR #${pr.id} · ${pr.title}`, detail: `${pr.fromRef?.displayId || ''} → ${pr.toRef?.displayId || ''} · ${pr.author?.user?.displayName || '작성자 미상'}`, url, priority: 'attention' };
  });
}
module.exports = { fetchBitbucket };
