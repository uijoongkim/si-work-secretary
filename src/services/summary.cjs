const { demoSummary } = require('./demo.cjs');
const { fetchJira } = require('./jira.cjs');
const { fetchConfluence } = require('./confluence.cjs');
const { fetchBitbucket } = require('./bitbucket.cjs');
const { fetchSynology } = require('./synology.cjs');

async function collectSummary(config, completed = {}) {
  if (!Object.values(config).some(value => value && typeof value === 'object' && value.enabled)) {
    return { ...applyCompleted(demoSummary(), completed), demo: true };
  }
  const sources = [
    ['jira', fetchJira], ['confluence', fetchConfluence], ['bitbucket', fetchBitbucket], ['synology', fetchSynology]
  ];
  const results = await Promise.all(sources.map(async ([key, fetcher]) => {
    if (!config[key]?.enabled) return [];
    try { return await fetcher({ ...config[key], lookbackDays: config.historyDays || 7 }); }
    catch (error) { return [{ id: `${key}:error`, source: key, kind: 'error', title: `${keyLabel(key)} 연결 확인 필요`, detail: error.message, url: config[key].baseUrl, priority: 'attention' }]; }
  }));
  return applyCompleted({ generatedAt: new Date().toISOString(), headline: '연결된 업무 도구에서 확인이 필요한 항목을 모았습니다.', items: results.flat() }, completed);
}
function keyLabel(key) { return ({ jira: 'Jira', confluence: 'Confluence', bitbucket: 'Bitbucket', synology: 'Synology Chat' })[key] || key; }
function applyCompleted(summary, completed) {
  const items = (summary.items || []).map(item => ({ ...item, done: Boolean(completed[item.id]) }));
  const count = items.filter(item => !item.done).length;
  return { ...summary, items, headline: items.length ? `${count}개 항목을 확인해 주세요. 일정·멘션·리뷰를 한 곳에 모았습니다.` : summary.headline };
}
module.exports = { collectSummary };
