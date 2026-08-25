(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.DraftForgeScreenshotSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUFFIXES=new Set(['jr','sr','ii','iii','iv','v']);
  const TEAM_ALIASES={JAC:'JAX',SFO:'SF',GBP:'GB',KAN:'KC',NOR:'NO',NWE:'NE',TAM:'TB',LVR:'LV',AU:'ATL',GIN:'CIN'};
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
  return{normalizeName,levenshtein,similarity,detectPos,detectTeam,scorePlayerChunk,playersFromYahooOcrText,alignDetectedPlayers,cleanOcrWords,boardOverall,boardColumnForOverall,matchBoardCell,parseYahooBoardWords,reconcileBoardSnapshot};
});
