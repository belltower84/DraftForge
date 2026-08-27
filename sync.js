(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.DraftForgeScreenshotSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUFFIXES=new Set(['jr','sr','ii','iii','iv','v']);
  const TEAM_ALIASES={JAC:'JAX',SFO:'SF',GBP:'GB',KAN:'KC',NOR:'NO',NWE:'NE',TAM:'TB',LVR:'LV',AU:'ATL',GIN:'CIN',SES:'SEA'};
  const VALID_TEAMS=new Set(['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']);
  function normalizeName(s=''){return String(s).toLowerCase().replace(/[^a-z0-9]/g,'')}
  function words(s=''){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean)}
  function levenshtein(a='',b=''){
    a=String(a);b=String(b);if(!a.length)return b.length;if(!b.length)return a.length;
    const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
    for(let i=1;i<=a.length;i++){
      cur[0]=i;
      for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      for(let j=0;j<=b.length;j++)prev[j]=cur[j];
    }
    return prev[b.length];
  }
  function similarity(a,b){a=normalizeName(a);b=normalizeName(b);if(!a||!b)return 0;return 1-levenshtein(a,b)/Math.max(a.length,b.length)}
  function playerParts(name=''){
    const raw=String(name).toLowerCase().replace(/[^a-z0-9'-]+/g,' ').trim().split(/\s+/).filter(Boolean);
    const clean=raw.filter(x=>!SUFFIXES.has(normalizeName(x)));
    const first=normalizeName(clean[0]||''),family=clean.slice(1).map(normalizeName).filter(Boolean),last=family[family.length-1]||'';
    return{first,family,last,full:normalizeName(clean.join(' '))};
  }
  function aliasesForPlayer(p){
    const x=playerParts(p.name),fi=x.first.slice(0,1),family=x.family.join('');
    return Array.from(new Set([x.full,x.last,family,fi+x.last,fi+family].filter(Boolean)));
  }
  function detectPos(chunk=''){
    const u=String(chunk).toUpperCase().replace(/[^A-Z0-9]+/g,' ');
    for(const p of ['DST','QB','RB','WR','TE','K'])if(new RegExp(`\\b${p}\\b`).test(u))return p;
    return null;
  }
  function detectTeam(chunk=''){
    const u=String(chunk).toUpperCase().replace(/[^A-Z0-9]+/g,' '),tokens=u.split(/\s+/).filter(Boolean);
    for(const t0 of tokens){const t=TEAM_ALIASES[t0]||t0;if(VALID_TEAMS.has(t))return t}
    return null;
  }
  function bestTokenSimilarity(chunk,alias){
    const toks=words(chunk),candidates=[...toks];
    for(let i=0;i<toks.length-1;i++)candidates.push(toks[i]+toks[i+1]);
    for(let i=0;i<toks.length-2;i++)candidates.push(toks[i]+toks[i+1]+toks[i+2]);
    let best=0;for(const t of candidates)best=Math.max(best,similarity(t,alias));return best;
  }
  function scorePlayerChunk(p,chunk){
    const compact=normalizeName(chunk),pos=detectPos(chunk),team=detectTeam(chunk),aliases=aliasesForPlayer(p),parts=playerParts(p.name);
    let score=0,nameSignal=0;
    if(compact.includes(parts.full)&&parts.full.length>=5){score+=120;nameSignal=1}
    for(const a of aliases){
      if(a.length<4)continue;
      if(compact.includes(a)){const pts=a===parts.full?100:a===parts.last?56:72;score=Math.max(score,pts);nameSignal=Math.max(nameSignal,.95);continue}
      const sim=bestTokenSimilarity(chunk,a);nameSignal=Math.max(nameSignal,sim);
    }
    if(nameSignal>=.92)score+=54;else if(nameSignal>=.80)score+=42;else if(nameSignal>=.68)score+=29;else if(nameSignal>=.56)score+=16;
    // Yahoo commonly abbreviates compound surnames (for example J. SMITH-NJIGBA).
    // OCR may distort the second half while preserving the first. Reward a fuzzy
    // adjacent-token match to the complete family name so a generic surname-only
    // candidate (e.g. another Smith) does not steal the row.
    if(parts.family.length>1){
      const fam=parts.family.join(''),toks=words(chunk).map(normalizeName);let famSignal=0;
      for(let i=0;i<toks.length-1;i++)famSignal=Math.max(famSignal,similarity(toks[i]+toks[i+1],fam));
      if(famSignal>=.84){score+=76;nameSignal=Math.max(nameSignal,.94)}
      else if(famSignal>=.70){score+=58;nameSignal=Math.max(nameSignal,.86)}
      else if(famSignal>=.60){score+=34;nameSignal=Math.max(nameSignal,.72)}
    }
    if(team&&team===p.team)score+=46;else if(team&&team!==p.team)score-=18;
    if(pos&&pos===p.pos)score+=28;else if(pos&&pos!==p.pos)score-=16;
    score+=Math.max(0,12-(+p.rank||200)/24);
    if(!team&&!pos&&nameSignal<.68)score-=35;
    return{score,nameSignal,team,pos};
  }
  function rankMatches(players,chunk,excludedIds){
    const excluded=excludedIds||new Set();
    return players.filter(p=>!excluded.has(p.id)).map(p=>({p,...scorePlayerChunk(p,chunk)})).sort((a,b)=>b.score-a.score||b.nameSignal-a.nameSignal||(+a.p.rank||999)-(+b.p.rank||999));
  }
  function playersFromYahooOcrText(text,players){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),found=[],seen=new Set(),consumed=new Set();
    for(let i=0;i<lines.length;i++){
      const meta=lines[i],pos=detectPos(meta),team=detectTeam(meta);
      if(!pos||(!team&&!/bye/i.test(meta)))continue;
      const chunk=`${lines[i-1]||''} ${meta}`.trim(),ranked=rankMatches(players,chunk,seen);
      if(!ranked.length)continue;
      const top=ranked[0],second=ranked[1]||{score:0},gap=top.score-second.score;
      const strongMeta=(top.pos===pos)&&(!team||top.team===team);
      if(top.score>=48&&strongMeta&&(top.nameSignal>=.34||gap>=7||top.score>=78)){
        seen.add(top.p.id);consumed.add(i-1);consumed.add(i);found.push({id:top.p.id,name:top.p.name,player:top.p,lineIndex:i-1,confidence:Math.max(0,Math.min(1,(top.score-42)/88)),raw:chunk});
      }
    }
    for(let i=0;i<lines.length;i++){
      if(consumed.has(i))continue;
      const ranked=rankMatches(players,lines[i],seen);if(!ranked.length)continue;
      const top=ranked[0],second=ranked[1]||{score:0};
      if(top.score>=105&&top.nameSignal>=.88&&top.score-second.score>=8){
        seen.add(top.p.id);found.push({id:top.p.id,name:top.p.name,player:top.p,lineIndex:i,confidence:Math.max(0,Math.min(1,(top.score-42)/88)),raw:lines[i]});
      }
    }
    found.sort((a,b)=>a.lineIndex-b.lineIndex);
    return found;
  }
  function alignDetectedPlayers(topDown,existingPicks,nextOverall){
    const chrono=[...(topDown||[])].reverse(),byId=new Map((existingPicks||[]).map(x=>[x.id,x.overall]));
    let anchorIndex=-1,anchorPick=-1;
    chrono.forEach((x,i)=>{const p=byId.get(x.id);if(p&&p>anchorPick){anchorPick=p;anchorIndex=i}});
    let start=(+nextOverall||1);
    if(anchorIndex>=0)start=anchorPick-anchorIndex;
    return chrono.map((x,i)=>{
      const knownPick=byId.get(x.id)||null,pick=knownPick||start+i;
      return{...x,pick,known:!!knownPick,status:knownPick?'known':'new'};
    }).filter(x=>x.pick>0);
  }

  function boxOf(w){
    if(w&&w.bbox)return{x0:+w.bbox.x0||0,y0:+w.bbox.y0||0,x1:+w.bbox.x1||0,y1:+w.bbox.y1||0};
    const x0=+w?.left||0,y0=+w?.top||0;return{x0,y0,x1:x0+(+w?.width||0),y1:y0+(+w?.height||0)};
  }
  function cleanOcrWords(input){return (input||[]).map(w=>{const b=boxOf(w),text=String(w.text||'').trim();return{text,confidence:+(w.confidence??w.conf??0)||0,...b,cx:(b.x0+b.x1)/2,cy:(b.y0+b.y1)/2}}).filter(w=>w.text)}
  function boardOverall(round,col,teams=12){return (round-1)*teams+(round%2?col+1:teams-col)}
  function boardColumnForOverall(overall,teams=12){const round=Math.ceil(overall/teams),within=(overall-1)%teams+1;return round%2?within-1:teams-within}
  function boardTeamForColumn(col){return col+1}
  function matchBoardCell(chunk,players,expectedOverall,excludedIds){
    const excluded=excludedIds||new Set(),team=detectTeam(chunk),pos=detectPos(chunk);
    const ranked=players.filter(p=>!excluded.has(p.id)).map(p=>{
      const x=scorePlayerChunk(p,chunk);let score=x.score;
      if(team)score+=team===p.team?65:-45;
      if(pos)score+=pos===p.pos?35:-30;
      score+=Math.max(0,18-Math.abs((+p.rank||200)-(+expectedOverall||1))*.25);
      return{p,...x,score,metaTeam:team,metaPos:pos};
    }).sort((a,b)=>b.score-a.score||b.nameSignal-a.nameSignal||(+a.p.rank||999)-(+b.p.rank||999));
    if(!ranked.length)return null;
    const top=ranked[0],second=ranked[1]||{score:-99},gap=top.score-second.score;
    const teamOk=!team||team===top.p.team,posOk=!pos||pos===top.p.pos,bothMeta=!!team&&!!pos&&teamOk&&posOk;
    let confidence=0;
    if(top.nameSignal>=.90&&teamOk&&posOk)confidence=.98;
    else if(top.nameSignal>=.75&&teamOk&&posOk)confidence=.94;
    else if(top.nameSignal>=.56&&teamOk&&posOk)confidence=.87;
    else if(bothMeta&&gap>=22)confidence=.84;
    else if(bothMeta&&gap>=10)confidence=.76;
    else if(bothMeta&&gap>=6)confidence=.68;
    else if((teamOk||posOk)&&top.nameSignal>=.72&&gap>=8)confidence=.80;
    else if(top.nameSignal>=.90&&gap>=10)confidence=.78;
    const accepted=confidence>=.67&&top.score>=82;
    return{player:top.p,confidence,accepted,score:top.score,gap,nameSignal:top.nameSignal,nflTeam:team,nflPos:pos,raw:chunk,second:second.p||null};
  }
  function parseYahooBoardWords(inputWords,players,options={}){
    const ws=cleanOcrWords(inputWords),width=+options.width||Math.max(1,...ws.map(w=>w.x1)),height=+options.height||Math.max(1,...ws.map(w=>w.y1)),teams=+options.teams||12,rounds=+options.rounds||15;
    const left=width*.02,right=width*.965,colW=(right-left)/teams,rowStart=height*.052,rowStep=height*.06975;
    const teamNames=Array.from({length:teams},(_,i)=>`Team ${i+1}`);
    const rawHeaders=[];
    for(let c=0;c<teams;c++){
      const xa=left+c*colW,xb=xa+colW;
      const hw=ws.filter(w=>w.cx>=xa&&w.cx<xb&&w.cy>=height*.006&&w.cy<rowStart*.96&&/[a-z]/i.test(w.text)).sort((a,b)=>a.y0-b.y0||a.x0-b.x0);
      const header=hw.map(w=>w.text.replace(/^[^a-z0-9]+/i,'')).filter(Boolean).join(' ').replace(/\s+/g,' ').trim(),avg=hw.length?hw.reduce((a,w)=>a+(w.confidence||0),0)/hw.length:0;
      rawHeaders[c]=header;
      if(header&&avg>=55)teamNames[c]=header.length>24?header.slice(0,24):header;
    }
    let userSlot=null,userScore=0;
    rawHeaders.forEach((name,i)=>{const n=normalizeName(name),s=Math.max(n.includes('you')?1:0,similarity(n,'you'),similarity(n,'vou'));if(s>userScore&&s>=.58){userScore=s;userSlot=i+1;teamNames[i]='You'}});
    const cells=[],seen=new Set();let currentPick=null;
    for(let r=1;r<=rounds;r++){
      const ya=rowStart+(r-1)*rowStep,yb=ya+rowStep;if(ya>=height)break;
      for(let c=0;c<teams;c++){
        const xa=left+c*colW,xb=xa+colW,overall=boardOverall(r,c,teams);
        const cellWords=ws.filter(w=>w.cx>=xa&&w.cx<xb&&w.cy>=ya&&w.cy<yb).sort((a,b)=>a.y0-b.y0||a.x0-b.x0);
        const chunk=cellWords.map(w=>w.text).join(' ').replace(/\s+/g,' ').trim();
        if(!chunk)continue;
        const compact=normalizeName(chunk);
        const onClock=compact.includes('ontheclock')||(compact.includes('clock')&&compact.includes('the'));
        if(onClock)currentPick=overall;
        const match=matchBoardCell(chunk,players,overall,seen);
        if(match?.accepted){seen.add(match.player.id);cells.push({round:r,col:c,team:boardTeamForColumn(c),overall,chunk,onClock,...match})}
        else if(onClock||detectPos(chunk)||detectTeam(chunk))cells.push({round:r,col:c,team:boardTeamForColumn(c),overall,chunk,onClock,...(match||{}),accepted:false});
      }
    }
    const picks=cells.filter(x=>x.accepted&&x.player).map(x=>({overall:x.overall,team:x.team,id:x.player.id,player:x.player,confidence:x.confidence,raw:x.chunk})).sort((a,b)=>a.overall-b.overall);
    if(!currentPick)currentPick=(picks.reduce((m,x)=>Math.max(m,x.overall),0)||0)+1;
    return{width,height,teams,rounds,teamNames,userSlot,currentPick,picks,cells,geometry:{left,right,colW,rowStart,rowStep}};
  }

  function snapshotQuality(snapshot){
    if(!snapshot)return -1e9;
    const pickSet=new Set((snapshot.picks||[]).map(x=>x.overall));
    let prefix=0;while(pickSet.has(prefix+1))prefix++;
    const current=+snapshot.currentPick||prefix+1;
    let gaps=0;for(let n=1;n<current;n++)if(!pickSet.has(n))gaps++;
    const named=(snapshot.teamNames||[]).filter((x,i)=>x&&x!==`Team ${i+1}`).length;
    const exactCurrent=current===prefix+1;
    // Continuity is the strongest signal. A correct Yahoo grid should reconstruct
    // every completed pick from 1 through the ON THE CLOCK cell with no gaps.
    return prefix*40+(snapshot.picks?.length||0)*3+named*2+(snapshot.userSlot?18:0)+(exactCurrent?80:0)-gaps*55;
  }
  function detectYahooBoardSnapshot(inputWords,players,options={}){
    const preferred=+options.preferredTeams||0;
    const base=(options.candidates||[8,10,12,14,16]).map(Number).filter(n=>n>=6&&n<=20);
    const candidates=Array.from(new Set([preferred,...base].filter(Boolean)));
    const attempts=candidates.map(teams=>{
      const snapshot=parseYahooBoardWords(inputWords,players,{...options,teams});
      return{teams,snapshot,quality:snapshotQuality(snapshot)};
    }).sort((a,b)=>b.quality-a.quality);
    const best=attempts[0];
    if(!best)return parseYahooBoardWords(inputWords,players,options);
    best.snapshot.detection={quality:best.quality,attempts:attempts.map(x=>({teams:x.teams,quality:x.quality,picks:x.snapshot.picks.length,currentPick:x.snapshot.currentPick,userSlot:x.snapshot.userSlot}))};
    return best.snapshot;
  }

  function reconcileBoardSnapshot(snapshot,existingPicks=[],options={}){
    const byOverall=new Map((existingPicks||[]).map(x=>[x.overall,x])),byId=new Map((existingPicks||[]).map(x=>[x.id,x])),incoming=new Map((snapshot?.picks||[]).map(x=>[x.overall,x]));
    const conflicts=[],confirmed=[],newPicks=[],unresolved=[];
    for(const [overall,old] of byOverall){const now=incoming.get(overall);if(!now)continue;if(now.id===old.id)confirmed.push(overall);else conflicts.push({overall,existing:old,incoming:now,reason:'pick-conflict'})}
    for(const p of snapshot?.picks||[]){const oldId=byId.get(p.id);if(oldId&&oldId.overall!==p.overall)conflicts.push({overall:p.overall,existing:oldId,incoming:p,reason:'player-moved'});if(!byOverall.has(p.overall)&&!byId.has(p.id))newPicks.push(p)}
    const start=+options.nextOverall||((existingPicks?.length||0)+1),current=+snapshot?.currentPick||start;
    for(let n=start;n<current;n++)if(!byOverall.has(n)&&!incoming.has(n))unresolved.push(n);
    newPicks.sort((a,b)=>a.overall-b.overall);
    const safe=conflicts.length===0&&unresolved.length===0&&newPicks.every((p,i)=>p.overall>=start&&(i===0?p.overall===start:newPicks[i-1].overall+1===p.overall));
    return{safe,conflicts,confirmed,newPicks,unresolved,currentPick:current,userSlot:snapshot?.userSlot||null,teamNames:snapshot?.teamNames||[]};
  }

  function snakeTeamForOverall(overall,teams=12){const r=Math.ceil(overall/teams),within=(overall-1)%teams+1;return r%2?within:teams+1-within}
  function median(nums){const a=(nums||[]).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
  function parseYahooResultsWords(inputWords,players,options={}){
    const ws=cleanOcrWords(inputWords),width=+options.width||Math.max(1,...ws.map(w=>w.x1)),height=+options.height||Math.max(1,...ws.map(w=>w.y1)),teams=+options.teams||12,maxPicks=+options.maxPicks||400;
    const headers=ws.filter(w=>normalizeName(w.text)==='pick');
    const nums=ws.map(w=>({w,n:+String(w.text||'').replace(/[^0-9]/g,'')})).filter(x=>/^\d{1,3}$/.test(String(x.w.text||'').replace(/[^0-9]/g,''))&&x.n>=1&&x.n<=maxPicks);
    let pickX=null,tableTop=0,bestCount=-1;
    for(const h of headers){const radius=Math.max(34,width*.045),count=nums.filter(x=>x.w.cy>h.cy+6&&Math.abs(x.w.cx-h.cx)<=radius).length;if(count>bestCount){bestCount=count;pickX=h.cx;tableTop=h.cy}}
    let candidates=nums.filter(x=>x.w.cy>tableTop+4&&(pickX!==null?Math.abs(x.w.cx-pickX)<=Math.max(36,width*.055):x.w.cx<width*.28));
    if(candidates.length<2)candidates=nums.filter(x=>x.w.cx<width*.30);
    const byPick=new Map();
    for(const x of candidates){const old=byPick.get(x.n);if(!old||x.w.confidence>old.w.confidence)byPick.set(x.n,x)}
    candidates=[...byPick.values()].sort((a,b)=>a.w.cy-b.w.cy);
    const gaps=[];for(let i=1;i<candidates.length;i++){const d=candidates[i].w.cy-candidates[i-1].w.cy;if(d>5&&d<height*.15)gaps.push(d)}
    const rowTol=Math.max(12,Math.min(height*.045,(median(gaps)||height*.055)*.46));
    const rows=[],seen=new Set(),existingByPick=new Map((options.existingPicks||[]).map(x=>[x.overall,x]));
    const teamNames=Array.from({length:teams},(_,i)=>`Team ${i+1}`);let userSlot=null;
    for(const x of candidates){
      const y=x.w.cy,pick=x.n,playerLeft=x.w.x1+Math.max(5,width*.006),playerRight=width*.76;
      const rowWords=ws.filter(w=>Math.abs(w.cy-y)<=rowTol&&w.cx>playerLeft).sort((a,b)=>a.x0-b.x0);
      const playerWords=rowWords.filter(w=>w.cx<playerRight),teamWords=rowWords.filter(w=>w.cx>=playerRight);
      const chunk=playerWords.map(w=>w.text).join(' ').replace(/\s+/g,' ').trim(),fantasyTeam=teamWords.map(w=>w.text).join(' ').replace(/\s+/g,' ').trim();
      if(!chunk)continue;
      const match=matchBoardCell(chunk,players,pick,seen),team=snakeTeamForOverall(pick,teams),accepted=!!match?.accepted;
      if(accepted)seen.add(match.player.id);
      if(fantasyTeam&&fantasyTeam.length<=42&&!/^(pick|player|team)$/i.test(fantasyTeam)){teamNames[team-1]=fantasyTeam;const n=normalizeName(fantasyTeam);if(n.includes('yourteam')||n==='you'||n.startsWith('you'))userSlot=team}
      const old=existingByPick.get(pick),known=!!(old&&accepted&&old.id===match.player.id);
      rows.push({pick,overall:pick,team,chunk,raw:chunk,fantasyTeam,accepted,known,player:accepted?match.player:null,suggested:match?.player||null,confidence:match?.confidence||0,score:match?.score||0,gap:match?.gap||0});
    }
    rows.sort((a,b)=>a.pick-b.pick);
    const picks=rows.filter(r=>r.accepted&&r.player).map(r=>({overall:r.pick,team:r.team,id:r.player.id,player:r.player,confidence:r.confidence,raw:r.raw,fantasyTeam:r.fantasyTeam}));
    const throughPick=rows.reduce((m,r)=>Math.max(m,r.pick),0),unresolved=rows.filter(r=>!r.accepted).map(r=>r.pick);
    return{width,height,teams,rows,picks,throughPick,unresolved,teamNames,userSlot,rowTolerance:rowTol,pickColumnX:pickX};
  }
  function parseLoosePickNumber(value,maxPicks=400){
    const m=String(value??'').match(/\d{1,3}/);if(!m)return null;const n=+m[0];return n>=1&&n<=maxPicks?n:null;
  }
  function inferDescendingPickSequence(rows,options={}){
    const maxPicks=+options.maxPicks||400,nextOverall=+options.nextOverall||1,count=(rows||[]).length;
    if(!count)return null;
    const nums=(rows||[]).map(r=>parseLoosePickNumber(r.rawPick,maxPicks));
    const candidates=new Set();
    nums.forEach((n,i)=>{if(!n)return;for(let add=0;add<=Math.min(maxPicks,90);add+=10){const top=n+add+i;if(top>=count&&top<=maxPicks)candidates.add(top)}});
    // A common first sync is a complete opening round. This is only a fallback
    // candidate; recognized pick digits must still beat it when available.
    if(nextOverall===1&&count<=+options.teams)candidates.add(count);
    if(!candidates.size)return null;
    const existing=new Set((options.existingPicks||[]).map(x=>x.overall));
    let best=null;
    for(const top of candidates){
      let score=0,exact=0;
      for(let i=0;i<count;i++){
        const expected=top-i,n=nums[i];
        if(expected<1||expected>maxPicks){score-=100;continue}
        if(n){if(n===expected){score+=20;exact++}else if(expected>=10&&expected%10===n){score+=4}else score-=9}
        if(existing.has(expected))score+=2;
      }
      const bottom=top-count+1;
      if(bottom<=nextOverall&&top>=nextOverall)score+=8;
      else if(bottom>nextOverall+6)score-=4;
      if(!best||score>best.score||(score===best.score&&exact>best.exact))best={top,bottom,score,exact,nums};
    }
    if(!best)return null;
    // With no exact digit anchors, only allow the explicit opening-round fallback.
    if(best.exact===0&&!(nextOverall===1&&best.top===count))return null;
    return best;
  }
  function parseYahooResultsRows(rowRecords,players,options={}){
    const teams=+options.teams||12,maxPicks=+options.maxPicks||400,existingPicks=options.existingPicks||[],nextOverall=+options.nextOverall||((existingPicks.length||0)+1);
    const raw=(rowRecords||[]).filter(r=>r&&String(r.chunk||'').trim());
    const seq=inferDescendingPickSequence(raw,{teams,maxPicks,nextOverall,existingPicks});
    if(!seq)return{teams,rows:[],picks:[],throughPick:0,unresolved:[],teamNames:Array.from({length:teams},(_,i)=>`Team ${i+1}`),userSlot:null,sequence:null};
    const seen=new Set(),existingByPick=new Map(existingPicks.map(x=>[x.overall,x])),teamNames=Array.from({length:teams},(_,i)=>`Team ${i+1}`),rows=[];let userSlot=null;
    for(let i=0;i<raw.length;i++){
      const r=raw[i],pick=seq.top-i;if(pick<1||pick>maxPicks)continue;
      const team=snakeTeamForOverall(pick,teams),match=matchBoardCell(r.chunk,players,pick,seen),accepted=!!match?.accepted;
      if(accepted)seen.add(match.player.id);
      const fantasyTeam=String(r.fantasyTeam||'').replace(/\s+/g,' ').trim();
      if(fantasyTeam&&fantasyTeam.length<=42&&!/^(pick|player|team)$/i.test(fantasyTeam)){teamNames[team-1]=fantasyTeam;const n=normalizeName(fantasyTeam);if(n.includes('yourteam')||n==='you'||n.startsWith('you'))userSlot=team}
      const old=existingByPick.get(pick),known=!!(old&&accepted&&old.id===match.player.id);
      rows.push({pick,overall:pick,team,chunk:r.chunk,raw:r.chunk,rawPick:r.rawPick??null,fantasyTeam,accepted,known,player:accepted?match.player:null,suggested:match?.player||null,confidence:match?.confidence||0,score:match?.score||0,gap:match?.gap||0,sourceY:r.sourceY??null,rowIndex:i});
    }
    rows.sort((a,b)=>a.pick-b.pick);
    const picks=rows.filter(r=>r.accepted&&r.player).map(r=>({overall:r.pick,team:r.team,id:r.player.id,player:r.player,confidence:r.confidence,raw:r.raw,fantasyTeam:r.fantasyTeam}));
    const throughPick=rows.reduce((m,r)=>Math.max(m,r.pick),0),unresolved=rows.filter(r=>!r.accepted).map(r=>r.pick);
    return{teams,rows,picks,throughPick,unresolved,teamNames,userSlot,sequence:seq};
  }

  function reconcileResultsSnapshot(snapshot,existingPicks=[],options={}){
    const byPick=new Map((existingPicks||[]).map(x=>[x.overall,x])),rows=(snapshot?.rows||[]).slice().sort((a,b)=>a.pick-b.pick),start=+options.nextOverall||((existingPicks?.length||0)+1),conflicts=[],newRows=[],confirmed=[];
    for(const r of rows){if(!r.player&&!r.matched)continue;const id=r.player?.id||r.matched?.id,old=byPick.get(r.pick);if(old){if(old.id===id)confirmed.push(r.pick);else conflicts.push({overall:r.pick,existing:old,incoming:r,reason:'pick-conflict'})}else if(r.pick>=start)newRows.push({...r,id})}
    const through=Math.max(start-1,+snapshot?.throughPick||0,...newRows.map(r=>r.pick)),unresolved=[];
    for(let n=start;n<=through;n++){if(byPick.has(n))continue;const row=rows.find(r=>r.pick===n);if(!row||!(row.player||row.matched))unresolved.push(n)}
    const ids=new Map();for(const p of existingPicks||[])ids.set(p.id,p.overall);for(const r of newRows){const id=r.player?.id||r.matched?.id;if(ids.has(id)&&ids.get(id)!==r.pick)conflicts.push({overall:r.pick,existing:{overall:ids.get(id),id},incoming:r,reason:'player-duplicate'});ids.set(id,r.pick)}
    newRows.sort((a,b)=>a.pick-b.pick);
    const safe=!conflicts.length&&!unresolved.length&&newRows.every((r,i)=>r.pick===start+i);
    return{safe,conflicts,confirmed,newRows,unresolved,throughPick:through};
  }

  return{normalizeName,levenshtein,similarity,detectPos,detectTeam,scorePlayerChunk,playersFromYahooOcrText,alignDetectedPlayers,cleanOcrWords,boardOverall,boardColumnForOverall,matchBoardCell,parseYahooBoardWords,snapshotQuality,detectYahooBoardSnapshot,reconcileBoardSnapshot,snakeTeamForOverall,parseYahooResultsWords,parseLoosePickNumber,inferDescendingPickSequence,parseYahooResultsRows,reconcileResultsSnapshot};
});
