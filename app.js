const APP_KEY='draftforge-v8-6-live-state'; // keep the V8.6 key so existing live-draft memory survives the upgrade
const LEGACY_APP_KEY='draftforge-v8-5-turn-aware-state';
const MODE_KEY='draftforge-v8-6-mode';
const PROFILE_KEY='draftforge-v8-5-profile';
const BOARD_META_KEY='draftforge-v8-12-results-meta';
let engine;
let draftMode='mock';
let filter='ALL';
let screenshotFiles=[];
let reviewPicks=[];
let resultsSnapshot=null;
let boardMeta={teamNames:[],lastSync:null};
let ocrWorkerPromise=null;
const NFL_TEAMS=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];

function clone(x){return JSON.parse(JSON.stringify(x))}
function qs(id){return document.getElementById(id)}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showToast(msg){const t=qs('toast');t.textContent=msg;t.classList.add('show');clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.remove('show'),2600)}
function save(){localStorage.setItem(APP_KEY,JSON.stringify(engine.serialize()));localStorage.setItem(BOARD_META_KEY,JSON.stringify(boardMeta))}
function boot(){
  const league=clone(DRAFTFORGE_PRESETS['User Yahoo League']);
  engine=new DraftForgeEngine(DRAFTFORGE_PLAYERS,league);
  try{const saved=JSON.parse(localStorage.getItem(APP_KEY)||localStorage.getItem(LEGACY_APP_KEY)||'null');if(saved)engine.hydrate(saved)}catch{}
  try{const meta=JSON.parse(localStorage.getItem(BOARD_META_KEY)||'null');if(meta)boardMeta={...boardMeta,...meta}}catch{}
  draftMode=localStorage.getItem(MODE_KEY)||'mock';
  if(qs('modeSelect'))qs('modeSelect').value=draftMode;
  rebuildSlotSelect();rebuildFilters();rebuildPresetSelect();rebuildWeekSelect();rebuildPlayerNames();render();
  const dz=qs('dropzone');if(dz){dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragging')});dz.addEventListener('dragleave',()=>dz.classList.remove('dragging'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragging');handleScreenshotFiles(e.dataTransfer.files)})}

  if('serviceWorker'in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
function rebuildSlotSelect(){const el=qs('slotSelect'),tc=engine.teamCount(),cur=engine.slot||'';el.innerHTML='<option value="">Choose…</option>'+Array.from({length:tc},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');el.value=cur}
function rebuildFilters(){const arr=['ALL','QB','RB','WR','TE','DST','K','FAV'];qs('positionFilters').innerHTML=arr.map(x=>`<button class="filter ${x===filter?'active':''}" onclick="setFilter('${x}')">${x}</button>`).join('')}
function setFilter(x){filter=x;rebuildFilters();renderBoard()}
function rebuildPresetSelect(){qs('presetSelect').innerHTML=Object.keys(DRAFTFORGE_PRESETS).map(k=>`<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
function rebuildWeekSelect(){qs('weekSelect').innerHTML=Array.from({length:18},(_,i)=>`<option value="${i+1}">Week ${i+1}</option>`).join('')}
function rebuildPlayerNames(){const el=qs('playerNames');if(el)el.innerHTML=DRAFTFORGE_PLAYERS.map(p=>`<option value="${escapeHtml(p.name)}"></option>`).join('')}
function switchView(view){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===view));const titles={draft:'Draft Room',team:'My Team',lineup:'Lineup Optimizer',analytics:'Draft Analytics'};qs('viewTitle').textContent=titles[view]||'DraftForge';if(view==='team')renderTeam();if(view==='lineup')renderLineup();if(view==='analytics')renderAnalytics();scrollTo({top:0,behavior:'smooth'})}
function setSlot(){engine.slot=+qs('slotSelect').value||null;save();render()}
function setDraftMode(){
  draftMode=qs('modeSelect').value==='live'?'live':'mock';
  localStorage.setItem(MODE_KEY,draftMode);
  render();
  showToast(draftMode==='live'?'LIVE mode: DraftForge will wait for real Yahoo picks.':'MOCK mode: opponent picks will be simulated.');
}
function startDraft(){
  if(!engine.slot)return showToast('Choose your draft slot first.');
  engine.reset();
  if(draftMode==='mock')engine.autoToMyPick();
  screenshotFiles=[];reviewPicks=[];resultsSnapshot=null;boardMeta={teamNames:[],lastSync:null};save();render();
  showToast(draftMode==='live'?`Live draft reset. Waiting for Yahoo pick 1.`:`Mock started from slot ${engine.slot}.`);
}
function startMock(){draftMode='mock';localStorage.setItem(MODE_KEY,draftMode);if(qs('modeSelect'))qs('modeSelect').value='mock';startDraft()}

function undoDraft(){if(!engine.undo())return showToast('Nothing to undo.');save();render()}
function afterMyPick(){if(draftMode==='mock')engine.autoToMyPick();save();render()}
function takeRecommended(){const a=engine.recs(1)[0];if(!a)return;if(engine.teamForOverall(engine.overall)!==engine.slot)return showToast('It is not your pick yet.');if(!engine.myChoose(a.p.id))return;afterMyPick()}
function takePlayer(id){if(!engine.slot)return showToast('Choose a draft slot first.');if(engine.teamForOverall(engine.overall)!==engine.slot)return showToast('It is not your pick yet.');if(!engine.myChoose(id))return;afterMyPick()}
function markDrafted(id){if(!engine.slot)return showToast('Choose a draft slot first.');const team=engine.teamForOverall(engine.overall),mine=team===engine.slot;if(mine&&draftMode==='live')return showToast('Yahoo says this is your pick. Use Draft, not Gone.');if(!engine.choose(id,team,mine))return;save();render()}

function toggleFav(id){engine.favorites[id]=!engine.favorites[id];save();render()}
function render(){renderHeader();renderLiveStatus();renderRecommendations();renderRoster();renderOpponentIntel();renderLeagueRosters();renderDraftTracker();renderBoard();renderTeam();renderAnalytics();renderBoardSyncSummary()}
function teamLabel(teamNo){return boardMeta.teamNames?.[teamNo-1]||`Team ${teamNo}`}
function renderBoardSyncSummary(){const el=qs('boardSyncSummary');if(!el)return;const s=boardMeta.lastSync;if(!s){el.innerHTML=`<strong>No Results sync yet</strong><small>Paste a Yahoo Results screenshot every few picks. DraftForge will add only new rows and keep the tracker editable.</small>`;return}const mine=engine.myPlayers().length;el.innerHTML=`<strong>Synced through pick ${Math.max(0,s.throughPick||engine.overall-1)}</strong><small>${engine.picks.length} drafted • ${engine.avail().length} available • your roster ${mine} • tracker is editable</small>`}
function renderLeagueRosters(){const el=qs('leagueRosters');if(!el)return;el.innerHTML=Array.from({length:engine.teamCount()},(_,i)=>{const n=i+1,list=engine.teamRoster(n),mine=n===engine.slot;return `<div class="league-roster ${mine?'mine':''}"><div><strong>${escapeHtml(teamLabel(n))}</strong>${mine?'<span>YOU</span>':''}<small>${list.length} pick${list.length===1?'':'s'}</small></div><p>${list.length?list.map(p=>`${escapeHtml(p.name)} <em>${p.pos}</em>`).join(' · '):'No picks yet'}</p></div>`}).join('')}
function renderHeader(){
  const league=engine.league,round=engine.roundFor(engine.overall),total=engine.totalRosterSize(),team=engine.teamForOverall(engine.overall),nx=engine.nextMine(),away=nx?Math.max(0,nx-engine.overall):null;
  qs('leagueTitle').textContent=league.name||'Fantasy Draft';qs('leagueSubtitle').textContent=`${engine.teamCount()}-Team ${(+league.scoring?.rec||0)===1?'PPR':(+league.scoring?.rec||0)===.5?'Half PPR':'Custom'} Snake Draft`;
  qs('roundStat').textContent=`${Math.min(round,total)} / ${total}`;qs('overallStat').textContent=`Pick ${Math.min(engine.overall,engine.maxPicks())}`;
  qs('clockOwner').textContent=engine.isComplete()?'Draft complete':!engine.slot?'Choose slot':team===engine.slot?'YOU':teamLabel(team);qs('clockPick').textContent=engine.isComplete()?'Final roster locked':`Overall ${engine.overall}`;
  const after=engine.forecastMine();qs('picksAway').textContent=away===null?'—':away;qs('nextMineStat').textContent=nx?(team===engine.slot&&after?`After this: ${after}`:`Next: ${nx}`):'No remaining picks';
}
function renderLiveStatus(){
  const el=qs('liveStatusBanner');if(!el)return;
  const mine=engine.slot&&engine.teamForOverall(engine.overall)===engine.slot;
  const btn=qs('startDraftButton');if(btn)btn.textContent=draftMode==='live'?'Reset Live Draft':'Start / Restart Mock';
  if(qs('modeSelect'))qs('modeSelect').value=draftMode;
  el.className=`live-status ${draftMode}${mine?' my-clock':''}`;
  if(draftMode==='live'){
    const memory=`Board memory: ${engine.picks.length} pick${engine.picks.length===1?'':'s'} • ${engine.avail().length} available.`;
    el.innerHTML=mine
      ? `<div><span class="pulse-dot"></span><strong>YOU'RE ON THE CLOCK — PICK ${engine.overall}</strong><small>Paste a Yahoo Results screenshot every 3–5 picks. Review any low-confidence row, apply it, and DraftForge updates instantly. ${memory}</small></div><div class="live-actions"><button class="button primary compact" onclick="openScreenshotSync()">Paste Yahoo Results</button></div>`
      : `<div><span class="pulse-dot"></span><strong>LIVE — ${teamLabel(engine.teamForOverall(engine.overall))} ON PICK ${engine.overall}</strong><small>Paste Yahoo Results every few picks, especially when you are 3–5 picks away. ${memory}</small></div><div class="live-actions"><button class="button primary compact" onclick="openScreenshotSync()">Paste Yahoo Results</button></div>`;
  }else{
    el.innerHTML=`<div><strong>MOCK MODE</strong><small>Opponent selections are simulated automatically after each of your picks.</small></div>`;
  }
}
function renderRecommendations(){
  const recs=engine.recs(5);if(!recs.length){qs('recommendations').innerHTML='<div class="subtle">No recommendations available.</div>';return}
  qs('recommendations').innerHTML=recs.map(({p,s},i)=>{const sv=engine.nextPickSurvival(p),d=engine.turnDecision(p),tp=engine.playerTurnPressure(p),bf=engine.byeFit(p);return `<div class="rec"><div class="rec-rank">${i+1}</div><div><div class="player-name">${escapeHtml(p.name)}</div><div class="player-meta">${p.team} • ${p.pos}${p.posRank} • Rank ${p.rank} • Bye ${bf.week||'—'}${p.news?` • ${escapeHtml(p.trend||'NEWS')}`:''}</div><div class="bye-note ${bf.cls}" title="${escapeHtml(bf.text)}">${bf.label}${bf.adjustment?` ${bf.adjustment>0?'+':''}${bf.adjustment.toFixed(1)}`:''}</div></div><div class="rec-extra"><div class="label">Score</div><div class="score-pill">${s.toFixed(1)}</div></div><div class="rec-extra"><div class="label">Survive</div><strong>${sv===null?'—':Math.round(sv*100)+'%'}</strong></div><div class="rec-extra"><div class="label">Pressure</div><strong class="risk-${tp.label}">${tp.label}</strong></div><div><span class="turn-badge ${d.cls}" title="${escapeHtml(d.text)}">${d.label}</span>${engine.teamForOverall(engine.overall)===engine.slot?`<button class="button compact" style="margin-top:5px;width:100%" onclick="takePlayer('${p.id}')">Draft</button>`:''}</div></div>`}).join('')
}
function positionStrength(pos){const list=engine.myPlayers().filter(p=>p.pos===pos);if(!list.length)return 0;const avg=list.reduce((a,p)=>a+Math.max(0,110-p.rank),0)/list.length;return Math.max(5,Math.min(100,Math.round(avg)))}
function renderRoster(){
  const list=engine.myPlayers(),c=engine.counts(list),defs=[['QB',engine.requiredQB()],['RB',engine.requiredRB()],['WR',engine.requiredWR()],['TE',engine.requiredTE()],['DST',+engine.league.slots?.DST||0]];
  qs('positionStrengths').innerHTML=defs.filter(x=>x[1]>0).map(([p,n])=>{const st=positionStrength(p);return `<div class="strength-row"><b>${p}</b><div class="bar"><i style="width:${st}%"></i></div><span>${c[p]||0}</span></div>`}).join('');
  const needs=defs.filter(([p,n])=>(c[p]||0)<n).map(([p,n])=>p);qs('teamNeeds').innerHTML=needs.length?needs.map(p=>`<span class="chip hot">${p}</span>`).join(''):'<span class="chip">Core starters covered</span>';
  qs('rosterPeek').innerHTML=list.length?list.slice(-8).reverse().map(p=>`<div class="roster-mini"><span><b class="pos ${p.pos}">${p.pos}</b> ${escapeHtml(p.name)}</span><small>Bye ${engine.byeWeek(p)||'—'} • #${p.rank}</small></div>`).join(''):'<div class="subtle">No players drafted yet.</div>';
  const bye=engine.byeExposure(list),byeRows=Object.values(bye).sort((a,b)=>a.week-b.week);qs('byeLoad').innerHTML=byeRows.length?byeRows.map(x=>`<span class="bye-chip ${x.core>=3?'hot':x.core===2?'warm':''}">W${x.week}: ${x.total}${x.core>=2?` • ${x.core} core`:''}</span>`).join(''):'<span class="subtle">No bye exposure yet.</span>';
  const required=defs.filter(x=>x[1]>0),coverage=required.reduce((a,[p,n])=>a+Math.min(c[p]||0,n)/n,0)/Math.max(1,required.length),value=list.length?list.reduce((a,p)=>a+Math.max(0,100-p.rank)/100,0)/list.length:0;const total=Math.round((coverage*.72+value*.28)*100);qs('rosterGrade').textContent=total>=90?'A':total>=80?'B+':total>=70?'B':total>=58?'C':'—';
}
function renderOpponentIntel(){
  const seq=engine.interveningPickSequence();if(!seq.length){qs('opponentIntel').innerHTML='<div class="subtle">Choose a slot or make your pick to see who is between your turns.</div>';return}
  const seen=[];for(const q of seq){if(!seen.includes(q.team))seen.push(q.team)}
  qs('opponentIntel').innerHTML=seen.slice(0,12).map(team=>{const c=engine.counts(engine.teamRoster(team)),needs=[];if(c.QB<engine.requiredQB())needs.push('QB');if(c.RB<engine.requiredRB()+1)needs.push('RB');if(c.WR<engine.requiredWR()+1)needs.push('WR');if(c.TE<engine.requiredTE())needs.push('TE');const picks=seq.filter(q=>q.team===team).map(q=>q.overall).join(', ');return `<div class="opp"><small>${escapeHtml(teamLabel(team))} • picks ${picks}</small><strong>${needs.length?needs.join(' / '):'Bench value'}</strong><small>${c.QB} QB • ${c.RB} RB • ${c.WR} WR • ${c.TE} TE</small></div>`}).join('')
}
function renderBoard(){
  const q=(qs('search')?.value||'').trim().toLowerCase();let arr=engine.avail().filter(p=>(filter==='ALL'||p.pos===filter||(filter==='FAV'&&engine.favBonus(p)>0))&&(!q||p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q))).sort((a,b)=>a.rank-b.rank);qs('boardCount').textContent=`${arr.length} available`;
  qs('boardBody').innerHTML=arr.slice(0,292).map(p=>{const sv=engine.nextPickSurvival(p),d=engine.turnDecision(p),allowed=engine.candidateAllowed(p),score=allowed?engine.score(p):null,bf=engine.byeFit(p);return `<tr><td><button class="fav ${engine.favorites[p.id]?'on':''}" onclick="toggleFav('${p.id}')">★</button> ${p.rank}</td><td><b>${escapeHtml(p.name)}</b><div class="player-meta">${p.team} • Bye ${bf.week||'—'}${p.news?` • ${escapeHtml(p.news)}`:''}</div></td><td><span class="pos ${p.pos}">${p.pos}${p.posRank}</span></td><td>T${p.tier}</td><td>${score===null?'—':score.toFixed(1)}${allowed&&bf.adjustment?`<div class="bye-adjust ${bf.cls}">bye ${bf.adjustment>0?'+':''}${bf.adjustment.toFixed(1)}</div>`:''}</td><td>${sv===null?'—':Math.round(sv*100)+'%'}</td><td><span class="turn-badge ${d.cls}">${d.label}</span></td><td>${engine.teamForOverall(engine.overall)===engine.slot?`<button class="button compact primary" onclick="takePlayer('${p.id}')">Draft</button>`:`<button class="button compact" onclick="markDrafted('${p.id}')">Gone</button>`}</td></tr>`}).join('')
}
function renderTeam(){
  const list=engine.myPlayers(),c=engine.counts(list);qs('fullRoster').innerHTML=list.length?`<div class="roster-table">${list.map((p,i)=>`<div class="roster-line"><b>${p.pos}</b><span>${escapeHtml(p.name)}</span><span>${p.team} • W${engine.byeWeek(p)||'—'}</span><small>R${engine.picks.find(x=>x.id===p.id)?.overall||'—'}</small></div>`).join('')}</div>`:'<div class="subtle">No roster yet.</div>';
  const all=['QB','RB','WR','TE','DST','K'];qs('teamCounts').innerHTML=all.map(pos=>`<div class="count-card"><b>${pos}</b><div class="bar"><i style="width:${Math.min(100,(c[pos]||0)*22)}%"></i></div><strong>${c[pos]||0}</strong></div>`).join('')
}
function stableHash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function pseudoOpponent(p,week){const idx=(stableHash(p.team+week)+week*7)%NFL_TEAMS.length;let opp=NFL_TEAMS[idx];if(opp===p.team)opp=NFL_TEAMS[(idx+3)%NFL_TEAMS.length];return opp}
function baseWeeklyProjection(p){const r=p.posRank||p.rank||99;if(p.pos==='QB')return Math.max(8,24.5-(r-1)*.45);if(p.pos==='RB')return Math.max(4,19-(r-1)*.31);if(p.pos==='WR')return Math.max(4,18.5-(r-1)*.27);if(p.pos==='TE')return Math.max(3,15-(r-1)*.32);if(p.pos==='DST')return Math.max(4,9.5-(r-1)*.18);if(p.pos==='K')return Math.max(4,9-(r-1)*.15);return 5}
function weeklyData(p,week){if(engine.byeWeek(p)===week)return{projection:0,floor:0,ceiling:0,opponent:'BYE',status:'BYE'};let variance=((stableHash(p.id+':'+week)%1000)/1000-.5)*4.4,projection=baseWeeklyProjection(p)+variance+engine.scoringMods(p)*.45,status=p.news?'Questionable':'Active';if(status==='Questionable')projection*=.90;return{projection:Math.max(0,projection),floor:Math.max(0,projection*.70),ceiling:projection*1.36,opponent:pseudoOpponent(p,week),status}}
function lineupSlots(){const s=engine.league.slots||{},out=[];const add=(label,n,eligible)=>{for(let i=0;i<n;i++)out.push({label: n>1?`${label}${i+1}`:label,eligible})};add('QB',+s.QB||0,['QB']);add('RB',+s.RB||0,['RB']);add('WR',+s.WR||0,['WR']);add('TE',+s.TE||0,['TE']);add('FLEX',+s.FLEX||0,['RB','WR','TE']);add('SF',+s.SUPERFLEX||0,['QB','RB','WR','TE']);add('DST',+s.DST||0,['DST']);add('K',+s.K||0,['K']);return out}
function renderLineup(){const list=engine.myPlayers(),week=+qs('weekSelect').value||1,mode=qs('lineupMode').value||'balanced',used=new Set(),cards=[];for(const slot of lineupSlots()){const candidates=list.filter(p=>slot.eligible.includes(p.pos)&&!used.has(p.id)).map(p=>{const d=weeklyData(p,week),v=mode==='floor'?d.floor*.72+d.projection*.28:mode==='ceiling'?d.ceiling*.70+d.projection*.30:d.projection;return{p,d,v}}).sort((a,b)=>b.v-a.v);const a=candidates[0];if(a)used.add(a.p.id);cards.push(`<div class="lineup-slot"><span>${slot.label}</span><strong>${a?escapeHtml(a.p.name):'Open slot'}</strong><small>${a?`${a.p.team} vs ${a.d.opponent} • ${a.d.projection.toFixed(1)} proj`:'Draft a player'}</small></div>`)}qs('lineupOutput').innerHTML=list.length?`<div class="lineup-grid">${cards.join('')}</div>`:'<div class="subtle">Draft a roster first.</div>'}
function renderAnalytics(){const drafted=engine.picks.map(x=>engine.pby(x.id)).filter(Boolean),c=engine.counts(drafted),mx=Math.max(1,...['QB','RB','WR','TE','DST','K'].map(p=>c[p]||0));qs('positionAnalytics').innerHTML=['QB','RB','WR','TE','DST','K'].map(p=>`<div class="analytics-bar"><b>${p}</b><div class="bar"><i style="width:${(c[p]||0)/mx*100}%"></i></div><span>${c[p]||0}</span></div>`).join('');const mine=engine.myPlayers();if(!mine.length){qs('valueAnalytics').innerHTML='<div class="subtle">No picks yet.</div>';return}const rows=mine.map(p=>{const pick=engine.picks.find(x=>x.id===p.id)?.overall||0,value=pick-p.rank;return{p,pick,value}}).sort((a,b)=>b.value-a.value);qs('valueAnalytics').innerHTML=rows.map(x=>`<div class="roster-mini"><span>${escapeHtml(x.p.name)} <small>pick ${x.pick}</small></span><b style="color:${x.value>=0?'var(--green)':'var(--red)'}">${x.value>=0?'+':''}${x.value}</b></div>`).join('')}
function openModal(id){qs(id).classList.add('open');qs(id).setAttribute('aria-hidden','false')}
function closeModal(id){qs(id).classList.remove('open');qs(id).setAttribute('aria-hidden','true')}
function openLeagueSetup(){openModal('leagueModal');loadLeagueToForm(engine.league)}
function loadPresetIntoForm(){loadLeagueToForm(DRAFTFORGE_PRESETS[qs('presetSelect').value])}
function loadLeagueToForm(l){qs('leagueTeams').value=l.teams;qs('slotQB').value=l.slots.QB||0;qs('slotSF').value=l.slots.SUPERFLEX||0;qs('slotRB').value=l.slots.RB||0;qs('slotWR').value=l.slots.WR||0;qs('slotTE').value=l.slots.TE||0;qs('slotFlex').value=l.slots.FLEX||0;qs('slotDST').value=l.slots.DST||0;qs('slotK').value=l.slots.K||0;qs('slotBench').value=l.bench||0;qs('scoringRec').value=l.scoring?.rec??1}
function applyLeagueForm(){const l=clone(engine.league);l.teams=+qs('leagueTeams').value||12;l.slots={...l.slots,QB:+qs('slotQB').value||0,SUPERFLEX:+qs('slotSF').value||0,RB:+qs('slotRB').value||0,WR:+qs('slotWR').value||0,TE:+qs('slotTE').value||0,FLEX:+qs('slotFlex').value||0,DST:+qs('slotDST').value||0,K:+qs('slotK').value||0};l.bench=+qs('slotBench').value||0;l.scoring={...l.scoring,rec:+qs('scoringRec').value||0};engine.league=l;engine.ensureTeams();engine.reset();rebuildSlotSelect();save();closeModal('leagueModal');render();showToast('League settings applied; draft reset.')}
function openScreenshotSync(){openModal('screenshotModal');renderScreenshotReview()}
function latestImageFile(files){const arr=[...(files||[])].filter(f=>f.type&&f.type.startsWith('image/'));return arr[arr.length-1]||null}
function handleScreenshotFiles(files,autoAnalyze=true){
  const f=latestImageFile(files);if(!f)return;
  if(screenshotFiles[0]?._previewUrl)URL.revokeObjectURL(screenshotFiles[0]._previewUrl);
  f._previewUrl=URL.createObjectURL(f);screenshotFiles=[f];reviewPicks=[];resultsSnapshot=null;renderScreenshotReview();
  if(autoAnalyze)setTimeout(()=>analyzeScreenshots(),80);
}
function handleScreenshotPaste(e){
  const files=[];for(const item of e.clipboardData?.items||[]){if(item.type?.startsWith('image/')){const f=item.getAsFile();if(f)files.push(f)}}
  if(!files.length)return;
  e.preventDefault();if(!qs('screenshotModal')?.classList.contains('open'))openScreenshotSync();
  handleScreenshotFiles(files,true);showToast('Yahoo Results pasted — reading recent picks.');
}
function reviewMatchedPlayer(x){return x.matched||x.player||x.suggested||null}
function updateReviewPlayer(i,value){const row=reviewPicks[i];if(!row)return;const p=fuzzyPlayer(value);row.name=value;row.matched=p||null;row.player=p||null;row.manual=!!p;row.confidence=p?1:0;renderScreenshotReview()}
function renderScreenshotReview(){
  const f=screenshotFiles[0];
  qs('screenshotQueue').innerHTML=f?`<div class="preview-item screenshot-preview"><img src="${f._previewUrl||''}" alt="Yahoo Results screenshot preview"><span>${escapeHtml(f.name||'Pasted Yahoo Results')}</span><button class="icon" onclick="removeScreenshot(0)">✕</button></div>`:'<div class="subtle">No screenshot queued. Press Ctrl+V after snipping Yahoo Results → Round by Round.</div>';
  const summary=qs('snapshotSummary');
  if(summary){
    if(resultsSnapshot){
      const rec=reconcileReviewRows();
      summary.innerHTML=`<div class="snapshot-kpis"><div><b>${resultsSnapshot.rows.length}</b><span>result rows</span></div><div><b>${rec.newRows.length}</b><span>new picks</span></div><div><b>${resultsSnapshot.throughPick||'—'}</b><span>through pick</span></div><div><b>${rec.unresolved.length}</b><span>needs review</span></div></div>${rec.conflicts.length?`<div class="sync-warning">${rec.conflicts.length} conflict${rec.conflicts.length===1?'':'s'} detected. Correct the highlighted player before applying.</div>`:''}${rec.unresolved.length?`<div class="sync-warning">Resolve pick${rec.unresolved.length===1?'':'s'} ${rec.unresolved.join(', ')} in the editable rows below. DraftForge will not guess.</div>`:''}`;
    }else summary.innerHTML='<div class="subtle">Paste Yahoo Results → Round by Round. Overlap a few already-known picks when possible; DraftForge will ignore confirmed rows and add only the new ones.</div>';
  }
  reviewPicks.sort((a,b)=>a.pick-b.pick);
  qs('reviewPicks').innerHTML=reviewPicks.length?reviewPicks.map((x,i)=>{const p=reviewMatchedPlayer(x),known=engine.picks.some(v=>v.overall===x.pick&&p&&v.id===p.id),bad=!p;return `<div class="review-item ${known?'known-row':''} ${bad?'needs-review':''}"><input class="review-pick-number" type="number" min="1" value="${x.pick}" disabled><span class="review-player"><input class="review-player-input" list="playerNames" value="${escapeHtml(p?.name||x.name||'')}" placeholder="Type player name" onchange="updateReviewPlayer(${i},this.value)"><small>${escapeHtml(teamLabel(engine.teamForOverall(x.pick)))} • ${known?'confirmed':p?'NEW / REVIEW':'UNRESOLVED'}${x.fantasyTeam?` • Yahoo: ${escapeHtml(x.fantasyTeam)}`:''}${x.manual?' • manual':` • ${Math.round((x.confidence||0)*100)}% OCR`}</small></span><span class="sync-status ${known?'known':bad?'warn':'new'}">${known?'KNOWN':bad?'FIX':'NEW'}</span></div>`}).join(''):'<div class="subtle">No Results rows analyzed yet.</div>';
  if(qs('screenshotStatus'))qs('screenshotStatus').textContent=resultsSnapshot?`Results detected • ${resultsSnapshot.rows.length} rows • through pick ${resultsSnapshot.throughPick||'unknown'} • ${engine.picks.length} picks already stored.`:`${engine.picks.length} picks currently stored in DraftForge memory.`;
}
function removeScreenshot(i){const f=screenshotFiles[i];if(f?._previewUrl)URL.revokeObjectURL(f._previewUrl);screenshotFiles.splice(i,1);reviewPicks=[];resultsSnapshot=null;renderScreenshotReview()}
function normalizeName(s=''){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function fuzzyPlayer(name){const n=normalizeName(name);if(!n)return null;let exact=DRAFTFORGE_PLAYERS.find(p=>normalizeName(p.name)===n);if(exact)return exact;const candidates=DRAFTFORGE_PLAYERS.filter(p=>normalizeName(p.name).includes(n)||n.includes(normalizeName(p.name)));return candidates.length===1?candidates[0]:null}
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(loadTesseract._promise)return loadTesseract._promise;
  loadTesseract._promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.async=true;script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library unavailable'));script.onerror=()=>reject(new Error('OCR library failed to load'));document.head.appendChild(script)});
  return loadTesseract._promise;
}
async function getOcrWorker(){
  await loadTesseract();
  if(!ocrWorkerPromise)ocrWorkerPromise=(async()=>{const worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text'&&qs('screenshotStatus'))qs('screenshotStatus').textContent=`Reading Yahoo Results… ${Math.round((m.progress||0)*100)}%`}});await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});return worker})();
  return ocrWorkerPromise;
}
function wordsFromTsv(tsv=''){
  const lines=String(tsv||'').split(/\r?\n/);if(lines.length<2)return[];const hdr=lines.shift().split('\t'),idx=Object.fromEntries(hdr.map((x,i)=>[x,i])),out=[];
  for(const line of lines){if(!line)continue;const a=line.split('\t'),text=String(a[idx.text]||'').trim();if(!text)continue;const left=+a[idx.left]||0,top=+a[idx.top]||0,width=+a[idx.width]||0,height=+a[idx.height]||0;out.push({text,confidence:+a[idx.conf]||0,bbox:{x0:left,y0:top,x1:left+width,y1:top+height}})}return out;
}
async function sourceCanvasFromFile(file){const bmp=await createImageBitmap(file),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0);try{bmp.close?.()}catch{}return c}
function preprocessResultsCanvas(source){return preprocessResultsRegion(source,0,0,source.width,source.height,source.width<1200?1.7:1.25)}
function preprocessResultsRegion(source,x0,y0,x1,y1,scale=3){
  x0=Math.max(0,Math.floor(x0));y0=Math.max(0,Math.floor(y0));x1=Math.min(source.width,Math.ceil(x1));y1=Math.min(source.height,Math.ceil(y1));
  const sw=Math.max(1,x1-x0),sh=Math.max(1,y1-y0),c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,x0,y0,sw,sh,0,0,c.width,c.height);
  const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;let avg=0;for(let i=0;i<d.length;i+=4)avg+=(d[i]+d[i+1]+d[i+2])/3;avg/=Math.max(1,d.length/4);const invert=avg<145;
  for(let i=0;i<d.length;i+=4){let v=.299*d[i]+.587*d[i+1]+.114*d[i+2];if(invert)v=255-v;v=Math.max(0,Math.min(255,(v-128)*1.62+128));d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}ctx.putImageData(im,0,0);return c
}
function percentile(values,q){const a=(values||[]).filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return 0;const i=Math.max(0,Math.min(a.length-1,Math.floor((a.length-1)*q)));return a[i]}
function detectResultsRowLayout(source,broadWords){
  const ws=DraftForgeScreenshotSync.cleanOcrWords(broadWords),w=source.width,h=source.height;
  const headers=ws.filter(x=>['pick','player'].includes(normalizeName(x.text))).sort((a,b)=>a.cy-b.cy),pickHeader=ws.filter(x=>normalizeName(x.text)==='pick').sort((a,b)=>a.cy-b.cy)[0]||headers[0]||null;
  let headerY=pickHeader?.cy||Math.round(h*.19);headerY=Math.max(0,Math.min(h-1,headerY));
  const ctx=source.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,w,h),d=im.data;let sample=0,n=0;for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){const i=(y*w+x)*4;sample+=(d[i]+d[i+1]+d[i+2])/3;n++}const dark=sample/Math.max(1,n)<145;
  const start=Math.min(h-2,Math.round(headerY+Math.max(8,h*.012))),end=Math.max(start+1,Math.round(h*.985)),energy=new Float32Array(h);
  for(let y=start;y<end;y++){let e=0;for(let x=Math.round(w*.01);x<Math.round(w*.99);x+=2){const i=(y*w+x)*4,r=d[i],g=d[i+1],b=d[i+2],lum=.299*r+.587*g+.114*b,sat=Math.max(r,g,b)-Math.min(r,g,b);if(dark?(lum>52&&(lum>90||sat>18)):(lum<210&&(lum<155||sat>18)))e++}energy[y]=e}
  const smooth=new Float32Array(h);for(let y=start+2;y<end-2;y++)smooth[y]=(energy[y-2]+energy[y-1]+energy[y]+energy[y+1]+energy[y+2])/5;
  const threshold=percentile(Array.from(smooth.slice(start,end)),.70),candidates=[];for(let y=start+2;y<end-2;y++)if(smooth[y]>=threshold&&smooth[y]>=smooth[y-1]&&smooth[y]>=smooth[y+1])candidates.push({y,value:smooth[y]});
  const minDist=Math.max(18,Math.min(34,Math.round(h*.028))),selected=[];candidates.sort((a,b)=>b.value-a.value);for(const c of candidates){if(selected.every(x=>Math.abs(x.y-c.y)>=minDist))selected.push(c);if(selected.length>=28)break}selected.sort((a,b)=>a.y-b.y);
  return{headerY,startY:start,rowCenters:selected.map(x=>x.y),rowHalf:Math.max(14,Math.round(minDist*.95)),minDist,dark}
}
function buildResultsRowRecords(tableWords,layout,tableCanvas,sourceY0,scale){
  const ws=DraftForgeScreenshotSync.cleanOcrWords(tableWords),w=tableCanvas.width,rowHalf=layout.rowHalf*scale,records=[];
  for(const sy of layout.rowCenters){const cy=(sy-sourceY0)*scale;if(cy<0||cy>tableCanvas.height)continue;const rw=ws.filter(x=>Math.abs(x.cy-cy)<=rowHalf).sort((a,b)=>a.y0-b.y0||a.x0-b.x0);if(!rw.length)continue;
    const left=rw.filter(x=>x.cx<w*.095),player=rw.filter(x=>x.cx>=w*.075&&x.cx<w*.82),team=rw.filter(x=>x.cx>=w*.82);
    const chunk=player.map(x=>x.text).join(' ').replace(/\s+/g,' ').trim(),fantasyTeam=team.map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();
    const nums=left.map(x=>String(x.text||'').replace(/[^0-9]/g,'')).filter(x=>/^\d{1,3}$/.test(x));const rawPick=nums[0]||null;
    const hasMeta=!!DraftForgeScreenshotSync.detectPos(chunk)||!!DraftForgeScreenshotSync.detectTeam(chunk);if(!hasMeta&&player.length<2)continue;records.push({sourceY:sy,rawPick,chunk,fantasyTeam});
  }
  // Collapse accidental duplicate centers that resolve to essentially the same text band.
  const out=[];for(const r of records){const prev=out[out.length-1];if(prev&&Math.abs(prev.sourceY-r.sourceY)<layout.minDist*.75){if(r.chunk.length>prev.chunk.length)out[out.length-1]=r}else out.push(r)}return out
}
async function secondPassUnresolvedRows(worker,source,records,snapshot,layout){
  const unresolved=new Set(snapshot?.unresolved||[]);if(!unresolved.size)return snapshot;let count=0;
  for(const row of snapshot.rows||[]){if(!unresolved.has(row.pick)||count>=4)continue;const rec=records.find(r=>r.sourceY===row.sourceY)||records[row.rowIndex];if(!rec)continue;const y=rec.sourceY,canvas=preprocessResultsRegion(source,0,y-layout.rowHalf,source.width,y+layout.rowHalf,4);const words=await recognizeCanvasWords(worker,canvas,'6'),text=DraftForgeScreenshotSync.cleanOcrWords(words).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();if(text){rec.chunk=`${rec.chunk} ${text}`.trim();count++}
  }
  return DraftForgeScreenshotSync.parseYahooResultsRows(records,DRAFTFORGE_PLAYERS,{teams:engine.teamCount(),maxPicks:engine.maxPicks(),existingPicks:engine.picks,nextOverall:engine.overall})
}
function ocrWordsFromResult(result){let words=result?.data?.words||[];if(!words.length&&result?.data?.tsv)words=wordsFromTsv(result.data.tsv);return words||[]}
async function recognizeCanvasWords(worker,canvas,psm='11'){await worker.setParameters({tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1'});const result=await worker.recognize(canvas,{}, {text:true,tsv:true});return ocrWordsFromResult(result)}
function reconcileReviewRows(){
  const snapshot={...(resultsSnapshot||{}),rows:reviewPicks.map(x=>({...x,player:reviewMatchedPlayer(x),matched:reviewMatchedPlayer(x)})),throughPick:resultsSnapshot?.throughPick||reviewPicks.reduce((m,x)=>Math.max(m,x.pick),0)};
  return DraftForgeScreenshotSync.reconcileResultsSnapshot(snapshot,engine.picks,{nextOverall:engine.overall});
}
async function analyzeScreenshots(){
  if(!screenshotFiles.length)return showToast('Paste or choose a Yahoo Results screenshot first.');
  let worker;try{worker=await getOcrWorker()}catch{return showToast('Browser OCR could not load. Check internet access and try again.')}
  const button=qs('analyzeScreenshotButton');if(button){button.disabled=true;button.textContent='Reading Yahoo Results…'}
  qs('screenshotStatus').textContent='Finding the Yahoo Results table and row bands…';
  try{
    const source=await sourceCanvasFromFile(screenshotFiles[0]);
    // Pass 1: lightweight whole-image OCR only to locate the Pick/Player header.
    const broadWords=await recognizeCanvasWords(worker,source,'11'),layout=detectResultsRowLayout(source,broadWords);
    if(!layout.rowCenters.length)throw new Error('No result row bands found');
    // Pass 2: crop just the results table, enlarge it 3×, and OCR the compact table once.
    const tableY0=Math.max(0,layout.startY-4),tableY1=Math.min(source.height,Math.max(...layout.rowCenters)+layout.rowHalf+8),scale=source.width<900?3.2:2.7;
    const table=preprocessResultsRegion(source,0,tableY0,source.width,tableY1,scale),tableWords=await recognizeCanvasWords(worker,table,'6'),records=buildResultsRowRecords(tableWords,layout,table,tableY0,scale);
    if(!records.length)throw new Error('No Yahoo Results rows found');
    resultsSnapshot=DraftForgeScreenshotSync.parseYahooResultsRows(records,DRAFTFORGE_PLAYERS,{teams:engine.teamCount(),maxPicks:engine.maxPicks(),existingPicks:engine.picks,nextOverall:engine.overall});
    if(!resultsSnapshot.rows.length)throw new Error('Could not establish the pick-number sequence');
    // Only questionable NEW rows get an expensive dedicated OCR pass. Cap it so the
    // live workflow remains fast under a short draft clock.
    resultsSnapshot=await secondPassUnresolvedRows(worker,source,records,resultsSnapshot,layout);
    if(resultsSnapshot.userSlot&&!engine.slot){engine.slot=resultsSnapshot.userSlot;rebuildSlotSelect();if(qs('slotSelect'))qs('slotSelect').value=engine.slot}
    resultsSnapshot.teamNames?.forEach((name,i)=>{if(name&&name!==`Team ${i+1}`)boardMeta.teamNames[i]=name});
    reviewPicks=resultsSnapshot.rows.map(r=>({pick:r.pick,team:r.team,name:r.player?.name||'',matched:r.player||null,player:r.player||null,suggested:r.suggested||null,known:r.known,confidence:r.confidence,fantasyTeam:r.fantasyTeam,raw:r.raw,sourceY:r.sourceY}));
    renderScreenshotReview();const rec=reconcileReviewRows();
    const seq=resultsSnapshot.sequence?`picks ${resultsSnapshot.sequence.bottom}–${resultsSnapshot.sequence.top}`:`${reviewPicks.length} rows`;
    showToast(rec.unresolved.length?`Read ${seq} • ${rec.unresolved.length} need a quick correction.`:`Read ${seq} • review and apply ${rec.newRows.length} new pick${rec.newRows.length===1?'':'s'}.`);
  }catch(e){console.error(e);resultsSnapshot=null;reviewPicks=[];renderScreenshotReview();showToast('Results reader could not build the Yahoo rows. Keep Pick, Player, and Team visible and include several consecutive picks.');qs('screenshotStatus').textContent=`Results read failed: ${e?.message||'unknown error'}. DraftForge memory was not changed.`}
  finally{try{await worker?.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'})}catch{}if(button){button.disabled=false;button.textContent='Analyze Again'}}
}
function applyReviewedPicks(){
  if(!resultsSnapshot)return showToast('Analyze a Yahoo Results screenshot first.');
  const rec=reconcileReviewRows();
  if(rec.conflicts.length)return showToast('A reviewed row conflicts with DraftForge memory. Correct it before applying.');
  if(rec.unresolved.length)return showToast(`Resolve pick${rec.unresolved.length===1?'':'s'} ${rec.unresolved.join(', ')} before applying.`);
  let applied=0;
  for(const row of rec.newRows){const p=reviewMatchedPlayer(row);if(!p||row.pick!==engine.overall)break;const team=engine.teamForOverall(engine.overall),mine=team===engine.slot;if(engine.choose(p.id,team,mine))applied++}
  boardMeta.lastSync={throughPick:engine.overall-1,timestamp:Date.now(),source:'Yahoo Results',myRosterCount:engine.slot?engine.myPlayers().length:null};
  save();render();
  if(screenshotFiles[0]?._previewUrl)URL.revokeObjectURL(screenshotFiles[0]._previewUrl);screenshotFiles=[];reviewPicks=[];resultsSnapshot=null;renderScreenshotReview();closeModal('screenshotModal');
  const top=engine.recs(1)[0],mine=engine.slot&&engine.teamForOverall(engine.overall)===engine.slot;showToast(top?`${applied} new picks synced • ${engine.avail().length} available • ${mine?'Best move':'Top target'}: ${top.p.name}`:`${applied} new picks synced.`);if(mine)qs('recommendations')?.scrollIntoView({behavior:'smooth',block:'center'});
}
function rebuildEngineFromPickRows(rows){
  const league=clone(engine.league),slot=engine.slot,favorites=clone(engine.favorites||{}),sorted=(rows||[]).slice().sort((a,b)=>a.overall-b.overall);
  const fresh=new DraftForgeEngine(DRAFTFORGE_PLAYERS,league,slot);fresh.favorites=favorites;
  for(const row of sorted){if(row.overall!==fresh.overall)throw new Error(`Missing pick ${fresh.overall}`);if(fresh.drafted[row.id])throw new Error(`${fresh.pby(row.id)?.name||'Player'} is already used at another pick`);const team=fresh.teamForOverall(fresh.overall);if(!fresh.choose(row.id,team,team===slot))throw new Error(`Could not apply pick ${row.overall}`)}
  fresh.history=[];engine=fresh;return engine;
}
function renderDraftTracker(){
  const el=qs('draftTracker');if(!el)return;const rows=engine.picks.slice().sort((a,b)=>b.overall-a.overall),limit=36,shown=rows.slice(0,limit);
  el.innerHTML=shown.length?`<div class="tracker-table"><div class="tracker-row tracker-head"><span>Pick</span><span>Team</span><span>Player</span><span>Pos</span><span></span></div>${shown.map(x=>{const p=engine.pby(x.id),round=engine.roundFor(x.overall),within=(x.overall-1)%engine.teamCount()+1;return `<div class="tracker-row"><span><b>${x.overall}</b><small>${round}.${within}</small></span><span>${escapeHtml(teamLabel(x.team))}</span><span><b>${escapeHtml(p?.name||'Unknown')}</b><small>${p?.team||''}</small></span><span>${p?.pos||'—'}</span><span><button class="button compact secondary" onclick="editTrackerPick(${x.overall})">Edit</button></span></div>`}).join('')}</div>${rows.length>limit?`<div class="subtle tracker-more">Showing latest ${limit} of ${rows.length} picks.</div>`:''}`:'<div class="subtle">No picks tracked yet. Results screenshots will populate this ledger.</div>';
  const stat=qs('trackerStatus');if(stat)stat.textContent=`${engine.picks.length} picks tracked • ${engine.avail().length} players available`;
}
function editTrackerPick(pick){const row=engine.picks.find(x=>x.overall===pick),p=row?engine.pby(row.id):null;qs('trackerPickInput').value=pick;qs('trackerPlayerInput').value=p?.name||'';qs('trackerPlayerInput').focus();qs('trackerEditorLabel').textContent=row?`Correct pick ${pick}`:`Add pick ${pick}`}
function saveTrackerCorrection(){
  const pick=+qs('trackerPickInput').value,name=qs('trackerPlayerInput').value.trim(),p=fuzzyPlayer(name);if(!pick||pick<1||pick>engine.maxPicks())return showToast('Enter a valid overall pick number.');if(!p)return showToast('Choose an exact player name from the list.');
  const rows=engine.picks.map(x=>({...x})),other=rows.find(x=>x.id===p.id&&x.overall!==pick);if(other)return showToast(`${p.name} is already recorded at pick ${other.overall}.`);
  const idx=rows.findIndex(x=>x.overall===pick);const row={overall:pick,team:engine.teamForOverall(pick),id:p.id};if(idx>=0)rows[idx]=row;else rows.push(row);
  rows.sort((a,b)=>a.overall-b.overall);for(let n=1;n<=rows.length;n++)if(!rows.some(x=>x.overall===n))return showToast(`Pick ${n} is still missing. Add that pick first.`);
  try{rebuildEngineFromPickRows(rows);boardMeta.lastSync={...(boardMeta.lastSync||{}),throughPick:engine.overall-1,timestamp:Date.now(),source:'Manual tracker edit'};save();render();qs('trackerPickInput').value='';qs('trackerPlayerInput').value='';qs('trackerEditorLabel').textContent='Add / correct a pick';showToast(`Pick ${pick} saved as ${p.name}. Rosters and recommendations rebuilt.`)}catch(e){showToast(e.message||'Could not rebuild draft tracker.')}
}
function openYahooSync(){openModal('yahooModal')}
async function syncYahooNow(){try{const leagueId=engine.league.leagueId||'846890',r=await fetch(`/api/yahoo/picks?leagueId=${encodeURIComponent(leagueId)}`);if(!r.ok)throw new Error('Yahoo server not configured');const data=await r.json();let applied=0;for(const x of data.picks||[]){const p=fuzzyPlayer(x.name);if(p&&!engine.drafted[p.id]){engine.choose(p.id,engine.teamForOverall(engine.overall),engine.teamForOverall(engine.overall)===engine.slot);applied++}}save();render();showToast(`Yahoo sync applied ${applied} new picks.`)}catch{showToast('Yahoo server sync is not configured on this deployment.')}}
async function copyDraftState(){const payload=JSON.stringify({version:'8.12',mode:draftMode,overall:engine.overall,slot:engine.slot,picks:engine.picks.map(x=>({...x,name:engine.pby(x.id)?.name}))},null,2);try{await navigator.clipboard.writeText(payload);showToast('Draft state copied.')}catch{prompt('Copy draft state:',payload)}}
window.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal.open').forEach(m=>closeModal(m.id))});
window.addEventListener('paste',handleScreenshotPaste);
window.addEventListener('DOMContentLoaded',boot);
