function demoSummary() {
  const today = new Date();
  const date = d => { const x = new Date(today); x.setDate(x.getDate() + d); return x.toISOString().slice(0,10); };
  return {
    generatedAt: today.toISOString(), headline: '오늘 확인할 항목 6개를 모았습니다. 일정·멘션·리뷰를 한 곳에 모았습니다.',
    items: [
      { id:'jira:due:OPS-241', source:'jira', kind:'due', title:'OPS-241', detail:'월간 관제 리포트 검토 · 진행 중', dueDate:date(0), url:'#', priority:'urgent' },
      { id:'jira:due:FE-128', source:'jira', kind:'due', title:'FE-128', detail:'로그 필터 화면 반영 · 진행 중', dueDate:date(1), url:'#', priority:'normal' },
      { id:'jira:worklog:OPS-241:민지', source:'jira', kind:'worklog', title:'OPS-241 · 민지', detail:'오늘 Worklog 미등록', url:'#', priority:'attention' },
      { id:'confluence:page-7342', source:'confluence', kind:'mention', title:'배포 체크리스트 v2', detail:'@나를 확인자로 지정했습니다 · 24분 전', url:'#', priority:'attention' },
      { id:'bitbucket:pr:91', source:'bitbucket', kind:'review', title:'PR #91 · 알림 요약 API 연결', detail:'feature/summary → develop · 승인 대기', url:'#', priority:'attention' },
      { id:'synology:post-7768', source:'synology', kind:'chat', title:'운영 공지 · 김도현', detail:'@here 오늘 16시 점검 전 배포 이력 확인 부탁드립니다.', url:'#', receivedAt:today.toISOString(), priority:'attention' }
    ]
  };
}
module.exports = { demoSummary };
