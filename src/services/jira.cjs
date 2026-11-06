const { request, ensureHttp } = require('./http.cjs');

async function jiraSearch(base, config, jql, fields) {
  return request(`${base}/rest/api/2/search`, config, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jql, fields, maxResults: 100 }) });
}
async function fetchJira(config) {
  const base = ensureHttp(config.baseUrl);
  const jql = `((assignee = currentUser() OR reporter = currentUser() OR creator = currentUser()) ${config.additionalJql ? `OR (${config.additionalJql})` : ''}) AND statusCategory != Done ORDER BY duedate ASC`;
  const data = await jiraSearch(base, config, jql, ['summary','status','assignee','reporter','duedate','issuetype','priority']);
  const items = [];
  const days = Math.min(90, Math.max(1, Number(config.lookbackDays) || 7));
  const dueCutoff = new Date(); dueCutoff.setHours(0, 0, 0, 0); dueCutoff.setDate(dueCutoff.getDate() - days);
  for (const issue of data.issues || []) {
    const f = issue.fields || {};
    const due = f.duedate;
    if (due && new Date(`${due}T00:00:00`) >= dueCutoff) items.push({ id: `jira:due:${issue.key}`, source: 'jira', kind: 'due', title: issue.key, detail: `${f.summary || '제목 없음'} · ${f.status?.name || ''}`, dueDate: due, url: `${base}/browse/${issue.key}`, priority: new Date(`${due}T23:59:59`) < new Date() ? 'urgent' : 'normal' });
    const people = [f.assignee, f.reporter].filter(Boolean);
    if (!people.length) continue;
    try {
      const logs = await request(`${base}/rest/api/2/issue/${encodeURIComponent(issue.key)}/worklog?startAt=0&maxResults=1000`, config);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const logged = new Set((logs.worklogs || []).filter(w => (w.started || '').slice(0,10) === today).map(w => w.author?.name || w.author?.key || w.author?.displayName));
      for (const person of people) {
        const name = person.name || person.key || person.displayName;
        if (name && !logged.has(name)) items.push({ id: `jira:worklog:${issue.key}:${name}`, source: 'jira', kind: 'worklog', title: `${issue.key} · ${name}`, detail: `${f.summary || '작업'} · 오늘 Worklog 미등록`, url: `${base}/browse/${issue.key}`, priority: 'attention' });
      }
    } catch { /* Worklog read permission may differ from issue search permission. */ }
  }
  return unique(items);
}
function unique(items) { return [...new Map(items.map(x => [x.id,x])).values()]; }
module.exports = { fetchJira };
