const APP_KEY='draftforge-v8-6-live-state';
const LEGACY_APP_KEY='draftforge-v8-5-turn-aware-state';
const MODE_KEY='draftforge-v8-6-mode';
const PROFILE_KEY='draftforge-v8-5-profile';
let engine;
let draftMode='mock';
let filter='ALL';
let screenshotFiles=[];
let reviewPicks=[];
const NFL_TEAMS=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];

function clone(x){return JSON.parse(JSON.stringify(x))}
function qs(id){return document.getElementById(id)}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showToast(msg){const t=qs('toast');t.textContent=msg;t.classList.add('show');clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.remove('show'),2600)}
function save(){localStorage.setItem(APP_KEY,JSON.stringify(engine.serialize()))}
function boot(){
  const league=clone(DRAFTFORGE_PRESETS['User Yahoo League']);
  engine=new DraftForgeEngine(DRAFTFORGE_PLAYERS,league);
  try{const saved=JSON.parse(localStorage.getItem(APP_KEY)||localStorage.getItem(LEGACY_APP_KEY)||'null');if(saved)engine.hydrate(saved)}catch{}
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
function rebuildPlayerNames(){qs('playerNames').innerHTML=DRAFTFORGE_PLAYERS.map(p=>`<option value="${escapeHtml(p.name)}"></option>`).join('')}
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
  screenshotFiles=[];reviewPicks=[];save();render();
  showToast(draftMode==='live'?`Live draft reset. Waiting for Yahoo pick 1.`:`Mock started from slot ${engine.slot}.`);
}
function startMock(){draftMode='mock';localStorage.setItem(MODE_KEY,draftMode);if(qs('modeSelect'))qs('modeSelect').value='mock';startDraft()}

function undoDraft(){if(!engine.undo())return showToast('Nothing to undo.');save();render()}
function afterMyPick(){if(draftMode==='mock')engine.autoToMyPick();save();render()}
function takeRecommended(){const a=engine.recs(1)[0];if(!a)return;if(engine.teamForOverall(engine.overall)!==engine.slot)return showToast('It is not your pick yet.');if(!engine.myChoose(a.p.id))return;afterMyPick()}
function takePlayer(id){if(!engine.slot)return showToast('Choose a draft slot first.');if(engine.teamForOverall(engine.overall)!==engine.slot)return showToast('It is not your pick yet.');if(!engine.myChoose(id))return;afterMyPick()}
function markDrafted(id){if(!engine.slot)return showToast('Choose a draft slot first.');const team=engine.teamForOverall(engine.overall),mine=team===engine.slot;if(mine&&draftMode==='live')return showToast('Yahoo says this is your pick. Use Draft, not Gone.');if(!engine.choose(id,team,mine))return;save();render()}

function toggleFav(id){engine.favorites[id]=!engine.favorites[id];save();render()}
function render(){renderHeader();renderLiveStatus();renderRecommendations();renderRoster();renderOpponentIntel();renderBoard();renderTeam();renderAnalytics()}
function renderHeader(){
  const league=engine.league,round=engine.roundFor(engine.overall),total=engine.totalRosterSize(),team=engine.teamForOverall(engine.overall),nx=engine.nextMine(),away=nx?Math.max(0,nx-engine.overall):null;
  qs('leagueTitle').textContent=league.name||'Fantasy Draft';qs('leagueSubtitle').textContent=`${engine.teamCount()}-Team ${(+league.scoring?.rec||0)===1?'PPR':(+league.scoring?.rec||0)===.5?'Half PPR':'Custom'} Snake Draft`;
  qs('roundStat').textContent=`${Math.min(round,total)} / ${total}`;qs('overallStat').textContent=`Pick ${Math.min(engine.overall,engine.maxPicks())}`;
  qs('clockOwner').textContent=engine.isComplete()?'Draft complete':!engine.slot?'Choose slot':team===engine.slot?'YOU':`Team ${team}`;qs('clockPick').textContent=engine.isComplete()?'Final roster locked':`Overall ${engine.overall}`;
  const after=engine.forecastMine();qs('picksAway').textContent=away===null?'—':away;qs('nextMineStat').textContent=nx?(team===engine.slot&&after?`After this: ${after}`:`Next: ${nx}`):'No remaining picks';
}
function renderLiveStatus(){
  const el=qs('liveStatusBanner');if(!el)return;
  const mine=engine.slot&&engine.teamForOverall(engine.overall)===engine.slot;
  const btn=qs('startDraftButton');if(btn)btn.textContent=draftMode==='live'?'Reset Live Draft':'Start / Restart Mock';
  if(qs('modeSelect'))qs('modeSelect').value=draftMode;
  el.className=`live-status ${draftMode}${mine?' my-clock':''}`;
  if(draftMode==='live'){
    el.innerHTML=mine
      ? `<div><span class="pulse-dot"></span><strong>YOU'RE ON THE CLOCK — PICK ${engine.overall}</strong><small>Make the selection in Yahoo first, then click Draft here. DraftForge will wait for the next real pick.</small></div><div class="live-actions"><button class="button secondary compact" onclick="openScreenshotSync()">Screenshot Catch-Up</button></div>`
      : `<div><span class="pulse-dot"></span><strong>LIVE — WAITING FOR YAHOO PICK ${engine.overall}</strong><small>Team ${engine.teamForOverall(engine.overall)} is up. Click Gone when Yahoo announces the pick.</small></div><div class="live-actions"><button class="button secondary compact" onclick="openScreenshotSync()">Screenshot Catch-Up</button></div>`;
  }else{
    el.innerHTML=`<div><strong>MOCK MODE</strong><small>Opponent selections are simulated automatically after each of your picks.</small></div>`;
  }
}
function renderRecommendations(){
  const recs=engine.recs(5);if(!recs.length){qs('recommendations').innerHTML='<div class="subtle">No recommendations available.</div>';return}
  qs('recommendations').innerHTML=recs.map(({p,s},i)=>{const sv=engine.nextPickSurvival(p),d=engine.turnDecision(p),tp=engine.playerTurnPressure(p);return `<div class="rec"><div class="rec-rank">${i+1}</div><div><div class="player-name">${escapeHtml(p.name)}</div><div class="player-meta">${p.team} • ${p.pos}${p.posRank} • Rank ${p.rank}${p.news?` • ${escapeHtml(p.trend||'NEWS')}`:''}</div></div><div class="rec-extra"><div class="label">Score</div><div class="score-pill">${s.toFixed(1)}</div></div><div class="rec-extra"><div class="label">Survive</div><strong>${sv===null?'—':Math.round(sv*100)+'%'}</strong></div><div class="rec-extra"><div class="label">Pressure</div><strong class="risk-${tp.label}">${tp.label}</strong></div><div><span class="turn-badge ${d.cls}" title="${escapeHtml(d.text)}">${d.label}</span>${engine.teamForOverall(engine.overall)===engine.slot?`<button class="button compact" style="margin-top:5px;width:100%" onclick="takePlayer('${p.id}')">Draft</button>`:''}</div></div>`}).join('')
}
function positionStrength(pos){const list=engine.myPlayers().filter(p=>p.pos===pos);if(!list.length)return 0;const avg=list.reduce((a,p)=>a+Math.max(0,110-p.rank),0)/list.length;return Math.max(5,Math.min(100,Math.round(avg)))}
function renderRoster(){
  const list=engine.myPlayers(),c=engine.counts(list),defs=[['QB',engine.requiredQB()],['RB',engine.requiredRB()],['WR',engine.requiredWR()],['TE',engine.requiredTE()],['DST',+engine.league.slots?.DST||0]];
  qs('positionStrengths').innerHTML=defs.filter(x=>x[1]>0).map(([p,n])=>{const st=positionStrength(p);return `<div class="strength-row"><b>${p}</b><div class="bar"><i style="width:${st}%"></i></div><span>${c[p]||0}</span></div>`}).join('');
  const needs=defs.filter(([p,n])=>(c[p]||0)<n).map(([p,n])=>p);qs('teamNeeds').innerHTML=needs.length?needs.map(p=>`<span class="chip hot">${p}</span>`).join(''):'<span class="chip">Core starters covered</span>';
  qs('rosterPeek').innerHTML=list.length?list.slice(-8).reverse().map(p=>`<div class="roster-mini"><span><b class="pos ${p.pos}">${p.pos}</b> ${escapeHtml(p.name)}</span><small>#${p.rank}</small></div>`).join(''):'<div class="subtle">No players drafted yet.</div>';
  const required=defs.filter(x=>x[1]>0),coverage=required.reduce((a,[p,n])=>a+Math.min(c[p]||0,n)/n,0)/Math.max(1,required.length),value=list.length?list.reduce((a,p)=>a+Math.max(0,100-p.rank)/100,0)/list.length:0;const total=Math.round((coverage*.72+value*.28)*100);qs('rosterGrade').textContent=total>=90?'A':total>=80?'B+':total>=70?'B':total>=58?'C':'—';
}
function renderOpponentIntel(){
  const seq=engine.interveningPickSequence();if(!seq.length){qs('opponentIntel').innerHTML='<div class="subtle">Choose a slot or make your pick to see who is between your turns.</div>';return}
  const seen=[];for(const q of seq){if(!seen.includes(q.team))seen.push(q.team)}
  qs('opponentIntel').innerHTML=seen.slice(0,12).map(team=>{const c=engine.counts(engine.teamRoster(team)),needs=[];if(c.QB<engine.requiredQB())needs.push('QB');if(c.RB<engine.requiredRB()+1)needs.push('RB');if(c.WR<engine.requiredWR()+1)needs.push('WR');if(c.TE<engine.requiredTE())needs.push('TE');const picks=seq.filter(q=>q.team===team).map(q=>q.overall).join(', ');return `<div class="opp"><small>Team ${team} • picks ${picks}</small><strong>${needs.length?needs.join(' / '):'Bench value'}</strong><small>${c.QB} QB • ${c.RB} RB • ${c.WR} WR • ${c.TE} TE</small></div>`}).join('')
}
function renderBoard(){
  const q=(qs('search')?.value||'').trim().toLowerCase();let arr=engine.avail().filter(p=>(filter==='ALL'||p.pos===filter||(filter==='FAV'&&engine.favBonus(p)>0))&&(!q||p.name.toLowerCase().includes(q)||p.team.toLowerCase().includes(q))).sort((a,b)=>a.rank-b.rank);qs('boardCount').textContent=`${arr.length} available`;
  qs('boardBody').innerHTML=arr.slice(0,292).map(p=>{const sv=engine.nextPickSurvival(p),d=engine.turnDecision(p),allowed=engine.candidateAllowed(p),score=allowed?engine.score(p):null;return `<tr><td><button class="fav ${engine.favorites[p.id]?'on':''}" onclick="toggleFav('${p.id}')">★</button> ${p.rank}</td><td><b>${escapeHtml(p.name)}</b><div class="player-meta">${p.team}${p.news?` • ${escapeHtml(p.news)}`:''}</div></td><td><span class="pos ${p.pos}">${p.pos}${p.posRank}</span></td><td>T${p.tier}</td><td>${score===null?'—':score.toFixed(1)}</td><td>${sv===null?'—':Math.round(sv*100)+'%'}</td><td><span class="turn-badge ${d.cls}">${d.label}</span></td><td>${engine.teamForOverall(engine.overall)===engine.slot?`<button class="button compact primary" onclick="takePlayer('${p.id}')">Draft</button>`:`<button class="button compact" onclick="markDrafted('${p.id}')">Gone</button>`}</td></tr>`}).join('')
}
function renderTeam(){
  const list=engine.myPlayers(),c=engine.counts(list);qs('fullRoster').innerHTML=list.length?`<div class="roster-table">${list.map((p,i)=>`<div class="roster-line"><b>${p.pos}</b><span>${escapeHtml(p.name)}</span><span>${p.team}</span><small>R${engine.picks.find(x=>x.id===p.id)?.overall||'—'}</small></div>`).join('')}</div>`:'<div class="subtle">No roster yet.</div>';
  const all=['QB','RB','WR','TE','DST','K'];qs('teamCounts').innerHTML=all.map(pos=>`<div class="count-card"><b>${pos}</b><div class="bar"><i style="width:${Math.min(100,(c[pos]||0)*22)}%"></i></div><strong>${c[pos]||0}</strong></div>`).join('')
}
function stableHash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function pseudoOpponent(p,week){const idx=(stableHash(p.team+week)+week*7)%NFL_TEAMS.length;let opp=NFL_TEAMS[idx];if(opp===p.team)opp=NFL_TEAMS[(idx+3)%NFL_TEAMS.length];return opp}
function baseWeeklyProjection(p){const r=p.posRank||p.rank||99;if(p.pos==='QB')return Math.max(8,24.5-(r-1)*.45);if(p.pos==='RB')return Math.max(4,19-(r-1)*.31);if(p.pos==='WR')return Math.max(4,18.5-(r-1)*.27);if(p.pos==='TE')return Math.max(3,15-(r-1)*.32);if(p.pos==='DST')return Math.max(4,9.5-(r-1)*.18);if(p.pos==='K')return Math.max(4,9-(r-1)*.15);return 5}
function weeklyData(p,week){let variance=((stableHash(p.id+':'+week)%1000)/1000-.5)*4.4,projection=baseWeeklyProjection(p)+variance+engine.scoringMods(p)*.45,status=p.news?'Questionable':'Active';if(status==='Questionable')projection*=.90;return{projection:Math.max(0,projection),floor:Math.max(0,projection*.70),ceiling:projection*1.36,opponent:pseudoOpponent(p,week),status}}
function lineupSlots(){const s=engine.league.slots||{},out=[];const add=(label,n,eligible)=>{for(let i=0;i<n;i++)out.push({label: n>1?`${label}${i+1}`:label,eligible})};add('QB',+s.QB||0,['QB']);add('RB',+s.RB||0,['RB']);add('WR',+s.WR||0,['WR']);add('TE',+s.TE||0,['TE']);add('FLEX',+s.FLEX||0,['RB','WR','TE']);add('SF',+s.SUPERFLEX||0,['QB','RB','WR','TE']);add('DST',+s.DST||0,['DST']);add('K',+s.K||0,['K']);return out}
function renderLineup(){const list=engine.myPlayers(),week=+qs('weekSelect').value||1,mode=qs('lineupMode').value||'balanced',used=new Set(),cards=[];for(const slot of lineupSlots()){const candidates=list.filter(p=>slot.eligible.includes(p.pos)&&!used.has(p.id)).map(p=>{const d=weeklyData(p,week),v=mode==='floor'?d.floor*.72+d.projection*.28:mode==='ceiling'?d.ceiling*.70+d.projection*.30:d.projection;return{p,d,v}}).sort((a,b)=>b.v-a.v);const a=candidates[0];if(a)used.add(a.p.id);cards.push(`<div class="lineup-slot"><span>${slot.label}</span><strong>${a?escapeHtml(a.p.name):'Open slot'}</strong><small>${a?`${a.p.team} vs ${a.d.opponent} • ${a.d.projection.toFixed(1)} proj`:'Draft a player'}</small></div>`)}qs('lineupOutput').innerHTML=list.length?`<div class="lineup-grid">${cards.join('')}</div>`:'<div class="subtle">Draft a roster first.</div>'}
function renderAnalytics(){const drafted=engine.picks.map(x=>engine.pby(x.id)).filter(Boolean),c=engine.counts(drafted),mx=Math.max(1,...['QB','RB','WR','TE','DST','K'].map(p=>c[p]||0));qs('positionAnalytics').innerHTML=['QB','RB','WR','TE','DST','K'].map(p=>`<div class="analytics-bar"><b>${p}</b><div class="bar"><i style="width:${(c[p]||0)/mx*100}%"></i></div><span>${c[p]||0}</span></div>`).join('');const mine=engine.myPlayers();if(!mine.length){qs('valueAnalytics').innerHTML='<div class="subtle">No picks yet.</div>';return}const rows=mine.map(p=>{const pick=engine.picks.find(x=>x.id===p.id)?.overall||0,value=pick-p.rank;return{p,pick,value}}).sort((a,b)=>b.value-a.value);qs('valueAnalytics').innerHTML=rows.map(x=>`<div class="roster-mini"><span>${escapeHtml(x.p.name)} <small>pick ${x.pick}</small></span><b style="color:${x.value>=0?'var(--green)':'var(--red)'}">${x.value>=0?'+':''}${x.value}</b></div>`).join('')}
function openModal(id){qs(id).classList.add('open');qs(id).setAttribute('aria-hidden','false')}
function closeModal(id){qs(id).classList.remove('open');qs(id).setAttribute('aria-hidden','true')}
function openLeagueSetup(){openModal('leagueModal');loadLeagueToForm(engine.league)}
function loadPresetIntoForm(){loadLeagueToForm(DRAFTFORGE_PRESETS[qs('presetSelect').value])}
function loadLeagueToForm(l){qs('leagueTeams').value=l.teams;qs('slotQB').value=l.slots.QB||0;qs('slotSF').value=l.slots.SUPERFLEX||0;qs('slotRB').value=l.slots.RB||0;qs('slotWR').value=l.slots.WR||0;qs('slotTE').value=l.slots.TE||0;qs('slotFlex').value=l.slots.FLEX||0;qs('slotDST').value=l.slots.DST||0;qs('slotK').value=l.slots.K||0;qs('slotBench').value=l.bench||0;qs('scoringRec').value=l.scoring?.rec??1}
function applyLeagueForm(){const l=clone(engine.league);l.teams=+qs('leagueTeams').value||12;l.slots={...l.slots,QB:+qs('slotQB').value||0,SUPERFLEX:+qs('slotSF').value||0,RB:+qs('slotRB').value||0,WR:+qs('slotWR').value||0,TE:+qs('slotTE').value||0,FLEX:+qs('slotFlex').value||0,DST:+qs('slotDST').value||0,K:+qs('slotK').value||0};l.bench=+qs('slotBench').value||0;l.scoring={...l.scoring,rec:+qs('scoringRec').value||0};engine.league=l;engine.ensureTeams();engine.reset();rebuildSlotSelect();save();closeModal('leagueModal');render();showToast('League settings applied; draft reset.')}
function openScreenshotSync(){openModal('screenshotModal');if(!qs('manualPickNo').value)qs('manualPickNo').value=engine.overall;renderScreenshotReview()}
function handleScreenshotFiles(files){for(const f of files||[])if(f.type&&f.type.startsWith('image/'))screenshotFiles.push(f);renderScreenshotReview()}
function handleScreenshotPaste(e){
  if(!qs('screenshotModal')?.classList.contains('open'))return;
  const files=[];for(const item of e.clipboardData?.items||[]){if(item.type?.startsWith('image/')){const f=item.getAsFile();if(f)files.push(f)}}
  if(files.length){e.preventDefault();handleScreenshotFiles(files);showToast(`${files.length} pasted screenshot${files.length===1?'':'s'} queued.`)}
}

function renderScreenshotReview(){
  qs('screenshotQueue').innerHTML=screenshotFiles.length?screenshotFiles.map((f,i)=>`<div class="preview-item"><span>${escapeHtml(f.name||`Pasted screenshot ${i+1}`)}</span><button class="icon" onclick="removeScreenshot(${i})">✕</button></div>`).join(''):'<div class="subtle">No screenshots queued.</div>';
  reviewPicks.sort((a,b)=>a.pick-b.pick);
  qs('reviewPicks').innerHTML=reviewPicks.length?reviewPicks.map((x,i)=>`<div class="review-item"><input class="review-pick-number" type="number" min="1" value="${x.pick}" onchange="setReviewPickNumber(${i},this.value)"><span><b>${escapeHtml(x.name)}</b> ${x.matched?`→ ${escapeHtml(x.matched.name)}`:'<em>(unmatched)</em>'}${x.source==='ocr'?'<small> OCR</small>':''}</span><button class="icon" onclick="removeReviewPick(${i})">✕</button></div>`).join(''):'<div class="subtle">No reviewed picks yet.</div>';
  qs('screenshotStatus').textContent=`${reviewPicks.length} reviewed pick${reviewPicks.length===1?'':'s'}. Confirm pick numbers and order before applying.`
}
function setReviewPickNumber(i,value){const n=+value;if(!reviewPicks[i]||!n)return;reviewPicks[i].pick=n;renderScreenshotReview()}

function removeScreenshot(i){screenshotFiles.splice(i,1);renderScreenshotReview()}
function removeReviewPick(i){reviewPicks.splice(i,1);renderScreenshotReview()}
function normalizeName(s=''){return s.toLowerCase().replace(/[^a-z0-9]/g,'')}
function fuzzyPlayer(name){const n=normalizeName(name);let exact=DRAFTFORGE_PLAYERS.find(p=>normalizeName(p.name)===n);if(exact)return exact;return DRAFTFORGE_PLAYERS.find(p=>normalizeName(p.name).includes(n)||n.includes(normalizeName(p.name)))||null}
function playersFromOcrText(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),found=[];
  for(const line of lines){
    const compact=normalizeName(line);if(compact.length<4)continue;
    let matches=DRAFTFORGE_PLAYERS.filter(p=>{const pn=normalizeName(p.name);const parts=p.name.toLowerCase().replace(/[^a-z .'-]/g,' ').split(/\s+/).filter(Boolean);const first=normalizeName(parts[0]||''),last=normalizeName(parts[parts.length-1]||'');return pn.length>=5&&compact.includes(pn)||(first.length>=3&&last.length>=4&&compact.includes(first)&&compact.includes(last))});
    matches.sort((a,b)=>b.name.length-a.name.length);
    const p=matches[0];if(p&&!found.some(x=>x.id===p.id))found.push(p);
  }
  return found;
}

function addManualReviewPick(){const pick=+qs('manualPickNo').value,name=qs('manualPlayer').value.trim();if(!pick||!name)return showToast('Enter a pick number and player name.');reviewPicks.push({pick,name,matched:fuzzyPlayer(name)});qs('manualPickNo').value=pick+1;qs('manualPlayer').value='';renderScreenshotReview()}
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(loadTesseract._promise)return loadTesseract._promise;
  loadTesseract._promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.async=true;
    script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library unavailable'));
    script.onerror=()=>reject(new Error('OCR library failed to load'));document.head.appendChild(script);
  });
  return loadTesseract._promise;
}
async function analyzeScreenshots(){
  if(!screenshotFiles.length)return showToast('Add or paste at least one screenshot first.');
  try{await loadTesseract()}catch{return showToast('Browser OCR could not load. Check internet access or use manual fallback.')}
  const button=qs('analyzeScreenshotButton');if(button){button.disabled=true;button.textContent='Reading screenshot…'}
  qs('screenshotStatus').textContent='OCR is reading the Yahoo results panel…';
  try{
    const detected=[];
    for(let i=0;i<screenshotFiles.length;i++){
      qs('screenshotStatus').textContent=`Reading screenshot ${i+1} of ${screenshotFiles.length}…`;
      const result=await Tesseract.recognize(screenshotFiles[i],'eng',{logger:m=>{if(m.status==='recognizing text')qs('screenshotStatus').textContent=`OCR ${Math.round((m.progress||0)*100)}% — screenshot ${i+1}/${screenshotFiles.length}`}});
      for(const p of playersFromOcrText(result?.data?.text||''))if(!engine.drafted[p.id]&&!detected.some(x=>x.id===p.id))detected.push(p);
    }
    if(!detected.length){renderScreenshotReview();return showToast('No DraftForge player names detected. Crop tighter around Yahoo draft results or use manual entry.')}
    let pick=engine.overall;
    const existing=new Set(reviewPicks.map(x=>x.matched?.id).filter(Boolean));
    for(const p of detected){if(existing.has(p.id))continue;reviewPicks.push({pick:pick++,name:p.name,matched:p,source:'ocr'})}
    renderScreenshotReview();showToast(`${detected.length} player${detected.length===1?'':'s'} detected. Review before applying.`)
  }catch(e){showToast('Screenshot OCR failed. Try a tighter crop or use manual entry.');qs('screenshotStatus').textContent='OCR failed; no draft state was changed.'}
  finally{if(button){button.disabled=false;button.textContent='Analyze Screenshot Locally'}}
}

function applyReviewedPicks(){
  const rows=reviewPicks.filter(x=>x.matched&&!engine.drafted[x.matched.id]).sort((a,b)=>a.pick-b.pick);if(!rows.length)return showToast('No matched picks to apply.');
  let applied=0;
  for(const x of rows){
    if(x.pick<engine.overall)continue;
    if(x.pick>engine.overall){showToast(`Stopped at pick ${engine.overall}: review is missing that pick. DraftForge will never invent skipped selections.`);break}
    const team=engine.teamForOverall(engine.overall),mine=team===engine.slot;if(engine.choose(x.matched.id,team,mine))applied++;
  }
  if(!applied)return;
  reviewPicks=reviewPicks.filter(x=>!engine.drafted[x.matched?.id]);save();render();renderScreenshotReview();
  showToast(`${applied} confirmed pick${applied===1?'':'s'} applied safely.`)
}

function openYahooSync(){openModal('yahooModal')}
async function syncYahooNow(){try{const leagueId=engine.league.leagueId||'846890',r=await fetch(`/api/yahoo/picks?leagueId=${encodeURIComponent(leagueId)}`);if(!r.ok)throw new Error('Yahoo server not configured');const data=await r.json();let applied=0;for(const x of data.picks||[]){const p=fuzzyPlayer(x.name);if(p&&!engine.drafted[p.id]){engine.choose(p.id,engine.teamForOverall(engine.overall),engine.teamForOverall(engine.overall)===engine.slot);applied++}}save();render();showToast(`Yahoo sync applied ${applied} new picks.`)}catch{showToast('Yahoo server sync is not configured on this deployment.')}}
async function copyDraftState(){const payload=JSON.stringify({version:'8.6',mode:draftMode,overall:engine.overall,slot:engine.slot,picks:engine.picks.map(x=>({...x,name:engine.pby(x.id)?.name}))},null,2);try{await navigator.clipboard.writeText(payload);showToast('Draft state copied.')}catch{prompt('Copy draft state:',payload)}}
window.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal.open').forEach(m=>closeModal(m.id))});
window.addEventListener('paste',handleScreenshotPaste);
window.addEventListener('DOMContentLoaded',boot);
