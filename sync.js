(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.DraftForgeScreenshotSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SUFFIXES=new Set(['jr','sr','ii','iii','iv','v']);
  const TEAM_ALIASES={JAC:'JAX',SFO:'SF',GBP:'GB',KAN:'KC',NOR:'NO',NWE:'NE',TAM:'TB',LVR:'LV',AU:'ATL',GIN:'CIN'};
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
    const valid=new Set(['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']);
    for(const t0 of tokens){const t=TEAM_ALIASES[t0]||t0;if(valid.has(t))return t}
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
    // Yahoo rows are normally OCR'd as a player-name line followed by a POS / NFL-team metadata line.
    // Start from those metadata anchors; it is much safer than guessing from arbitrary navigation text.
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
    // Fallback for a row where Yahoo metadata was mangled but the player name itself was clear.
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
  return{normalizeName,levenshtein,similarity,scorePlayerChunk,playersFromYahooOcrText,alignDetectedPlayers};
});
