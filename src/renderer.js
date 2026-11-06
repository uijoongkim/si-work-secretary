const $ = selector => document.querySelector(selector);
const SOURCE = { jira:{label:'Jira',mark:'J',className:'source-jira'},confluence:{label:'Confluence',mark:'C',className:'source-confluence'},bitbucket:{label:'Bitbucket',mark:'B',className:'source-bitbucket'},synology:{label:'Synology Chat',mark:'S',className:'source-synology'} };
const SERVICE_FIELDS = {
  jira:{title:'Jira',mark:'J',className:'source-jira',subtitle:'Jira 9.12.4 · Server / Data Center',fields:[['baseUrl','서버 주소','https://jira.company.local'],['username','사용자명','사내 계정'],['authType','인증 방식',''],['password','비밀번호 또는 PAT','저장된 값은 암호화되어 유지'],['additionalJql','추가 JQL · 선택','예: reviewer = currentUser()']]},
  confluence:{title:'Confluence',mark:'C',className:'source-confluence',subtitle:'Confluence 8.5.0 · Server / Data Center',fields:[['baseUrl','서버 주소','https://wiki.company.local'],['username','사용자명','사내 계정'],['authType','인증 방식',''],['password','비밀번호 또는 PAT','저장된 값은 암호화되어 유지']]},
  bitbucket:{title:'Bitbucket',mark:'B',className:'source-bitbucket',subtitle:'Bitbucket 8.9.10 · Server / Data Center',fields:[['baseUrl','서버 주소','https://git.company.local'],['username','사용자명','사내 계정'],['authType','인증 방식',''],['password','비밀번호 또는 PAT','저장된 값은 암호화되어 유지']]},
  synology:{title:'Synology Chat',mark:'S',className:'source-synology',subtitle:'Synology Chat Server Bot API',fields:[['baseUrl','Chat 서버 주소','https://chat.company.local'],['botToken','Bot Token','저장된 값은 암호화되어 유지'],['channels','채널 ID (쉼표 구분, 선택)','예: 2, 5'],['names','내 이름/별칭 (쉼표 구분)','예: uijoong, 의중']]}
};
let config = {};
let items = [];
let activeFilter = 'all';
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)}
function prettyDate(date){if(!date)return '';const d=new Date(`${date}T00:00:00`);const today=new Date();const diff=Math.round((d.setHours(0,0,0,0)-new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime())/86400000);return diff===0?'오늘 마감':diff===1?'내일 마감':diff<0?`${Math.abs(diff)}일 지남`:date}
function renderItems(){
  const visible=items.filter(item=>!item.done&&(activeFilter==='all'||item.source===activeFilter));
  $('#items-list').innerHTML=visible.length?visible.map(item=>{
    const source=SOURCE[item.source]||{label:'연결',mark:'!',className:'source-error'};
    const date=item.dueDate?`<span class="due-pill ${prettyDate(item.dueDate)==='오늘 마감'?'today':''}">${prettyDate(item.dueDate)}</span>`:'';
    const label=item.kind==='worklog'?'Worklog':source.label;
    return `<div class="item-row ${item.done?'done':''}"><input class="check" type="checkbox" data-id="${esc(item.id)}" ${item.done?'checked':''}><div class="source-mark ${source.className}">${source.mark}</div><div class="item-copy"><div class="item-title">${esc(item.title)}</div><div class="item-detail">${esc(item.detail||'')}</div></div><div class="item-meta"><span class="source-label">${label}</span>${date}<span class="priority-pill">${item.kind==='review'?'리뷰 요청':item.kind==='worklog'?'확인 필요':item.kind==='error'?'연결 오류':item.kind==='mention'?'멘션':item.kind==='chat'?'Chat 멘션':''}</span><a class="open-link" href="${esc(item.url||'#')}" title="원문 열기" data-url="${esc(item.url||'')}">↗</a></div></div>`;
  }).join(''):'<div class="empty-state">조건에 맞는 미완료 항목이 없습니다.</div>';
  const open=items.filter(x=>!x.done).length;
  $('#nav-count').textContent=open;$('#stat-open').innerHTML=`${open}<span>건</span>`;
  $('#stat-due').innerHTML=`${items.filter(x=>x.dueDate&&!x.done).length}<span>건</span>`;
  $('#stat-mention').innerHTML=`${items.filter(x=>['mention','review','chat'].includes(x.kind)&&!x.done).length}<span>건</span>`;
  $('#stat-worklog').innerHTML=`${items.filter(x=>x.kind==='worklog'&&!x.done).length}<span>건</span>`;
  $('#filter-all').textContent=open;
  document.querySelectorAll('.check').forEach(el=>el.addEventListener('change',async()=>{await window.secretary.toggleItem(el.dataset.id,el.checked);items=items.map(x=>x.id===el.dataset.id?{...x,done:el.checked}:x);renderItems()}));
  document.querySelectorAll('.open-link').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();if(el.dataset.url&&el.dataset.url!=='#')window.open(el.dataset.url)}));
}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderSummary(summary){if(!summary)return;items=summary.items||[];$('#summary-headline').textContent=summary.demo?'샘플 데이터입니다. 연동 설정에서 사내 서버를 연결하세요.':(summary.headline||'');renderItems()}
function renderSettings(){
  $('#settings-grid').innerHTML=Object.entries(SERVICE_FIELDS).map(([key,service])=>{
    const data=config[key]||{};
    const fields=service.fields.map(([name,label,placeholder])=>{
      if(name==='authType')return `<label class="field"><span>${label}</span><select data-service="${key}" data-key="authType"><option value="basic" ${data.authType!=='bearer'?'selected':''}>Basic (사용자명 / 비밀번호)</option><option value="bearer" ${data.authType==='bearer'?'selected':''}>Bearer Token (PAT)</option></select></label>`;
      const type=['password','botToken'].includes(name)?'password':'text';
      return `<label class="field ${name==='baseUrl'?'full':''}"><span>${label}</span><input type="${type}" data-service="${key}" data-key="${name}" value="${esc(data[name]||'')}" placeholder="${placeholder}"></label>`;
    }).join('');
    return `<article class="service-card"><div class="service-head"><div class="service-icon ${service.className}">${service.mark}</div><div><strong>${service.title}</strong><small>${service.subtitle}</small></div><button class="toggle ${data.enabled?'on':''}" role="switch" aria-checked="${Boolean(data.enabled)}" aria-label="${service.title} 사용" data-toggle="${key}"></button></div><div class="fields">${fields}</div></article>`;
  }).join('');
  document.querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('click',()=>{config[el.dataset.toggle].enabled=!config[el.dataset.toggle].enabled;el.classList.toggle('on',config[el.dataset.toggle].enabled);el.setAttribute('aria-checked',config[el.dataset.toggle].enabled)}));
}
function readSettings(){
  const next=structuredClone(config);
  document.querySelectorAll('[data-service][data-key]').forEach(el=>{const {service,key}=el.dataset;next[service][key]=el.value});
  next.schedule=[$('#time-1').value,$('#time-2').value,$('#time-3').value];
  next.historyDays=Math.min(90,Math.max(1,Number.parseInt($('#history-days').value,10)||7));
  return next;
}
async function init(){
  config=await window.secretary.getConfig();
  if(!config.jira)config.jira={};if(!config.confluence)config.confluence={};if(!config.bitbucket)config.bitbucket={};if(!config.synology)config.synology={};
  for(const key of ['jira','confluence','bitbucket','synology'])config[key]={authType:'basic',...config[key]};
  config.schedule=config.schedule||['08:30','12:30','18:00'];
  config.historyDays=Number(config.historyDays)||7;
  $('#history-days').value=config.historyDays;
  config.schedule.forEach((t,i)=>{const el=$(`#time-${i+1}`);if(el)el.value=t});
  renderSettings();renderSummary(await window.secretary.getSummary());
  const now=new Date();$('#today-date').textContent=new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(now);
  window.secretary.onSummaryUpdated(renderSummary);
}
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{
  const settings=button.dataset.view==='settings';$('#today-view').classList.toggle('hidden',settings);$('#settings-view').classList.toggle('hidden',!settings);$('#top-title').textContent=settings?'연동 설정':'오늘의 요약';document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b===button));
}));
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===button));renderItems()}));
$('#refresh').addEventListener('click',async()=>{renderSummary(await window.secretary.refresh());toast('업무 도구를 동기화했습니다.')});
$('#sync-now').addEventListener('click',async()=>{renderSummary(await window.secretary.refresh());toast('요약을 새로 만들었습니다.')});
$('#notify').addEventListener('click',async()=>{await window.secretary.notifyNow();toast('Windows 알림을 보냈습니다.')});
$('#save-config').addEventListener('click',async()=>{try{config=await window.secretary.saveConfig(readSettings());renderSettings();toast('설정을 저장했습니다. 다음 요약부터 적용됩니다.')}catch(error){toast(error.message||'설정을 저장하지 못했습니다.')}});
init();
