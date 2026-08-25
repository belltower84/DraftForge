(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.DraftForgeEngine=api.DraftForgeEngine;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const clone=x=>JSON.parse(JSON.stringify(x));
  // 2026 NFL bye weeks (official schedule). Kept in-engine so GitHub Pages works offline.
  const BYE_WEEKS={ARI:14,ATL:11,BAL:13,BUF:7,CAR:5,CHI:10,CIN:6,CLE:11,DAL:14,DEN:10,DET:6,GB:11,HOU:8,IND:13,JAX:7,KC:5,LAC:7,LAR:11,LV:13,MIA:6,MIN:6,NE:11,NO:8,NYG:8,NYJ:13,PHI:10,PIT:9,SEA:11,SF:8,TB:10,TEN:9,WAS:7};
  class DraftForgeEngine{
    constructor(players,league,slot=null){
      this.players=clone(players||[]);
      this.league=clone(league||{});
      this.slot=slot;
      this.drafted={};this.picks=[];this.teams=[];this.mine=[];this.history=[];this.overall=1;this.complete=false;this.favorites={};
      this.ensureTeams();
    }
    hydrate(s){
      if(!s)return this;
      for(const k of ['slot','drafted','picks','teams','mine','history','overall','complete','favorites']) if(k in s)this[k]=clone(s[k]);
      if(s.league)this.league=clone(s.league);
      this.ensureTeams();return this;
    }
    serialize(){return {slot:this.slot,league:this.league,drafted:this.drafted,picks:this.picks,teams:this.teams,mine:this.mine,history:this.history,overall:this.overall,complete:this.complete,favorites:this.favorites}}
    teamCount(){return +this.league.teams||12}
    totalRosterSize(){return Object.values(this.league.slots||{}).reduce((a,b)=>a+(+b||0),0)+(+this.league.bench||0)}
    maxPicks(){return this.teamCount()*this.totalRosterSize()}
    hasSuperflex(){return (+this.league.slots?.SUPERFLEX||0)>0}
    requiredQB(){return (+this.league.slots?.QB||0)+(+this.league.slots?.SUPERFLEX||0)}
    requiredRB(){return +this.league.slots?.RB||0}
    requiredWR(){return +this.league.slots?.WR||0}
    requiredTE(){return +this.league.slots?.TE||0}
    ensureTeams(){while(this.teams.length<this.teamCount())this.teams.push([]);if(this.teams.length>this.teamCount())this.teams=this.teams.slice(0,this.teamCount())}
    pby(id){return this.players.find(p=>p.id===id)}
    avail(){return this.players.filter(p=>!this.drafted[p.id])}
    myPlayers(){return this.mine.map(x=>this.pby(x)).filter(Boolean)}
    teamRoster(teamNo){return (this.teams[teamNo-1]||[]).map(x=>this.pby(x)).filter(Boolean)}
    roundFor(n){return Math.ceil(n/this.teamCount())}
    teamForOverall(n){const tc=this.teamCount(),r=Math.ceil(n/tc),within=(n-1)%tc+1;return r%2?within:tc+1-within}
    myPickNumbers(){if(!this.slot)return[];const tc=this.teamCount(),a=[];for(let r=1;r<=this.totalRosterSize();r++)a.push((r-1)*tc+(r%2?this.slot:tc+1-this.slot));return a}
    nextMine(){return this.myPickNumbers().find(n=>n>=this.overall)}
    forecastMine(){const onClock=!!this.slot&&this.teamForOverall(this.overall)===this.slot;return this.myPickNumbers().find(n=>onClock?n>this.overall:n>=this.overall)}
    counts(list){const c={QB:0,RB:0,WR:0,TE:0,DST:0,K:0,DL:0,LB:0,DB:0};(list||[]).forEach(p=>c[p.pos]=(c[p.pos]||0)+1);return c}
    isComplete(){return this.complete||this.overall>this.maxPicks()||this.avail().length===0}
    favBonus(p){return (p.favoriteBonus||0)+(this.favorites[p.id]?8:0)}
    byeWeek(p){if(!p)return null;const n=+p.bye||+BYE_WEEKS[p.team]||0;return n||null}
    byeExposure(list=this.myPlayers()){
      const out={};for(const p of list||[]){const w=this.byeWeek(p);if(!w)continue;if(!out[w])out[w]={week:w,total:0,core:0,positions:{QB:0,RB:0,WR:0,TE:0,DST:0,K:0}};out[w].total++;out[w].positions[p.pos]=(out[w].positions[p.pos]||0)+1;if(['QB','RB','WR','TE'].includes(p.pos))out[w].core++}return out
    }
    byeFit(p,list=this.myPlayers(),overall=this.overall){
      const week=this.byeWeek(p);if(!week)return{week:null,adjustment:0,label:'—',cls:'neutral',text:'No NFL bye week mapped.'};
      const exposure=this.byeExposure(list),same=exposure[week]||{total:0,core:0,positions:{}},samePos=same.positions[p.pos]||0,round=this.roundFor(overall),totalRounds=Math.max(1,this.totalRosterSize());
      // Bye weeks should break close calls, not overrule a major talent/value edge in the opening rounds.
      const stage=round<=3?.42:round<=6?.68:round<=9?.86:1;
      let adj=0;
      if(same.core===1)adj-=.7;else if(same.core===2)adj-=2.0;else if(same.core===3)adj-=3.8;else if(same.core>=4)adj-=5.8+(same.core-4)*.7;
      // Same-bye backup QBs/TEs are especially inefficient because their replacement value disappears on the exact week you need it.
      if(p.pos==='QB'&&samePos>0)adj-=this.hasSuperflex()?3.8:5.8;
      else if(p.pos==='TE'&&samePos>0)adj-=3.5;
      else if(['DST','K'].includes(p.pos)&&samePos>0)adj-=5.5;
      else if(['RB','WR'].includes(p.pos)&&samePos>1)adj-=.75*(samePos-1);
      // Once a roster already has a concentrated bye, give close alternatives with clean weeks a small diversification bump.
      const peak=Object.values(exposure).reduce((m,x)=>Math.max(m,x.core||0),0);
      if(same.core===0&&peak>=2)adj+=peak>=4?1.6:peak===3?1.1:.65;
      // Bench-stage decisions should care a bit more about usable weekly coverage than early starter accumulation.
      if(round>=Math.ceil(totalRounds*.60))adj*=1.12;
      adj=Math.max(-8,Math.min(2,adj*stage));
      adj=Math.round(adj*10)/10;
      const label=adj<=-4?'AVOID BYE':adj<=-1.5?'BYE CONFLICT':adj<0?'MINOR OVERLAP':adj>=1?'BYE FIT+':'CLEAN';
      const cls=adj<=-1.5?'bad':adj<0?'warn':adj>=.5?'good':'neutral';
      const text=same.total?`Week ${week}: ${same.total} player${same.total===1?'':'s'} already on your roster (${same.core} core). Bye fit ${adj>0?'+':''}${adj.toFixed(1)}.`:`Week ${week}: no current roster overlap. Bye fit ${adj>0?'+':''}${adj.toFixed(1)}.`;
      return{week,adjustment:adj,label,cls,text,overlap:same.total,coreOverlap:same.core,samePos}
    }
    byeAdjustment(p,list=this.myPlayers(),overall=this.overall){return this.byeFit(p,list,overall).adjustment}
    scoringMods(p){const sc=this.league.scoring||{};let m=0;if(['WR','RB','TE'].includes(p.pos))m+=((+sc.rec||0)-.5)*2.4;if(p.pos==='TE')m+=(+sc.tePremium||0)*5;if(p.pos==='QB')m+=((+sc.passTd||4)-4)*1.6+(25/(+sc.passYardsPerPoint||25)-1)*4;if(['RB','WR','TE'].includes(p.pos)&&(+sc.firstDown||0)>0)m+=(+sc.firstDown)*2;return m}
    candidateAllowed(p,list=this.myPlayers(),overall=this.overall){
      const c=this.counts(list),round=this.roundFor(overall),slots=this.league.slots||{},needQ=this.requiredQB(),total=this.totalRosterSize(),remaining=Math.max(0,total-list.length);
      if((+slots.DST||0)===0&&p.pos==='DST')return false;if((+slots.K||0)===0&&p.pos==='K')return false;if(['DL','LB','DB'].includes(p.pos)&&(+slots[p.pos]||0)===0)return false;
      const missing={QB:Math.max(0,needQ-c.QB),RB:Math.max(0,this.requiredRB()-c.RB),WR:Math.max(0,this.requiredWR()-c.WR),TE:Math.max(0,this.requiredTE()-c.TE),DST:Math.max(0,(+slots.DST||0)-c.DST),K:Math.max(0,(+slots.K||0)-c.K)};
      const missingCore=Object.values(missing).reduce((a,b)=>a+b,0);if(remaining<=missingCore&&!(missing[p.pos]>0))return false;
      const specialistNeed=missing.DST+missing.K;if(['DST','K'].includes(p.pos)){if(specialistNeed===0)return false;if(remaining>specialistNeed&&round<total-1)return false}else if(remaining<=specialistNeed&&specialistNeed>0)return false;
      if(p.pos==='QB'){
        const maxQ=Math.max(needQ,this.hasSuperflex()?3:2);if(c.QB>=maxQ)return false;
        if(c.QB>=needQ){if(this.hasSuperflex()){if(round<12||c.RB<Math.max(this.requiredRB()+1,3)||c.WR<Math.max(this.requiredWR()+1,4)||c.TE<Math.max(this.requiredTE(),1)||(p.posRank||99)>22)return false}else if(round<11||(p.posRank||99)>18)return false}
      }
      if(p.pos==='TE'){const maxTE=Math.max(this.requiredTE()+1,1)+((+this.league.scoring?.tePremium||0)>=.5?1:0);if(c.TE>=maxTE)return false}
      return true;
    }
    needBonus(pos,list=this.myPlayers(),overall=this.overall){
      const c=this.counts(list),round=this.roundFor(overall),rq=this.requiredQB(),rr=this.requiredRB(),rw=this.requiredWR(),rt=this.requiredTE(),slots=this.league.slots||{},total=this.totalRosterSize();
      if(pos==='QB'){let b=c.QB<rq?(this.hasSuperflex()?12:7):0;if(round>=Math.max(4,Math.ceil(total*.24))&&c.QB<Math.min(1,rq))b+=12;if(this.hasSuperflex()&&round>=Math.ceil(total*.40)&&c.QB<rq)b+=16;return b}
      if(pos==='RB'){let b=c.RB<rr?8:c.RB<rr+2?4:1;if(round>=4&&rr>0&&c.RB===0)b+=14;if(round>=Math.ceil(total*.36)&&c.RB<rr)b+=18;if(round>=Math.ceil(total*.56)&&c.RB<rr+1)b+=9;return b}
      if(pos==='WR'){let b=c.WR<rw?8:c.WR<rw+2?4:1;if(round>=Math.ceil(total*.48)&&c.WR<rw)b+=15;if(round>=Math.ceil(total*.65)&&c.WR<rw+1)b+=7;return b}
      if(pos==='TE'){let b=c.TE<rt?3:-2;if(round>=Math.ceil(total*.42)&&c.TE<rt)b+=10;return b}
      if(pos==='DST')return(+slots.DST||0)>0&&round>=total-1&&c.DST<+slots.DST?70:-90;
      if(pos==='K')return(+slots.K||0)>0&&round>=total-1&&c.K<+slots.K?65:-90;return 0;
    }
    tierBonus(p){const n=this.avail().filter(x=>x.pos===p.pos&&x.tier===p.tier).length;return n<=1?2:n===2?1.5:n<=4?.5:0}
    qScarcity(p,list=this.myPlayers()){if(p.pos!=='QB'||this.counts(list).QB>=this.requiredQB())return 0;const gone=this.players.filter(x=>x.pos==='QB'&&this.drafted[x.id]).length;return Math.min(8,Math.max(0,(gone-6)*.5))}
    interveningPickSequence(){const nx=this.forecastMine();if(!this.slot||!nx||nx<=this.overall)return[];const seq=[];for(let n=this.overall;n<nx;n++){const team=this.teamForOverall(n);if(team!==this.slot)seq.push({overall:n,team,round:this.roundFor(n)})}return seq}
    positionDemandWeight(teamNo,pos,pickNo){const roster=this.teamRoster(teamNo),c=this.counts(roster),round=this.roundFor(pickNo);if(pos==='QB'){const req=this.requiredQB();if(c.QB<req)return 1;if(this.hasSuperflex()&&c.QB<req+1&&round>=8)return .28;if(!this.hasSuperflex()&&c.QB<2&&round>=10)return .12;return .04}if(pos==='RB'){if(c.RB<this.requiredRB())return 1;if(c.RB<this.requiredRB()+1)return .62;if(c.RB<this.requiredRB()+2)return .32;return .09}if(pos==='WR'){if(c.WR<this.requiredWR())return 1;if(c.WR<this.requiredWR()+1)return .58;if(c.WR<this.requiredWR()+2)return .30;return .08}if(pos==='TE'){if(c.TE<this.requiredTE())return .92;if(c.TE<this.requiredTE()+1&&round>=7)return .20;return .04}if(pos==='DST'||pos==='K')return round>=this.totalRosterSize()-1?.55:.01;return .05}
    playerTurnPressure(p){const seq=this.interveningPickSequence();if(!seq.length)return{picks:0,teams:0,needTeams:0,weightedDemand:0,tierLeft:0,risk:0,label:'NONE'};const unique=new Set(),needTeams=new Set();let weighted=0;for(const q of seq){unique.add(q.team);const w=this.positionDemandWeight(q.team,p.pos,q.overall);if(w>=.55)needTeams.add(q.team);const reach=p.rank-q.overall;const market=reach<=2?1.18:reach<=8?1.05:reach<=16?.82:reach<=28?.52:.28;weighted+=w*market}const tierLeft=this.avail().filter(x=>x.pos===p.pos&&x.tier===p.tier).length;const tierMult=tierLeft<=1?1.35:tierLeft===2?1.20:tierLeft<=4?1.08:1;const gapMult=Math.min(1.18,.82+seq.length*.025);const hazard=weighted*tierMult*gapMult;const risk=Math.max(0,Math.min(1,1-Math.exp(-hazard*.30)));const label=risk>=.72?'CRITICAL':risk>=.52?'HIGH':risk>=.30?'MEDIUM':'LOW';return{picks:seq.length,teams:unique.size,needTeams:needTeams.size,weightedDemand:weighted,tierLeft,risk,label}}
    marketSurvivalBaseline(p){const nx=this.forecastMine();if(!nx||nx<=this.overall)return null;const gap=nx-this.overall,expectedTaken=Math.max(0,p.rank-this.overall),z=(expectedTaken-gap*.72)/7;return Math.max(.02,Math.min(.98,1/(1+Math.exp(-z))))}
    nextPickSurvival(p){const base=this.marketSurvivalBaseline(p);if(base===null)return null;const tp=this.playerTurnPressure(p),pressureFactor=Math.max(.30,1-tp.risk*.62),tierFactor=tp.tierLeft<=1?.82:tp.tierLeft===2?.90:1;return Math.max(.02,Math.min(.98,base*pressureFactor*tierFactor))}
    turnPressureBonus(p){const surv=this.nextPickSurvival(p);if(surv===null)return 0;const tp=this.playerTurnPressure(p);let b=surv<.15?7:surv<.28?5:surv<.42?3:surv<.58?1:surv>.82?-2:0;b+=Math.min(3,tp.needTeams*.55);const ours=this.needBonus(p.pos);if(ours<3)b*=.55;return b}
    turnDecision(p){const surv=this.nextPickSurvival(p),tp=this.playerTurnPressure(p);if(surv===null)return{label:'NOW',cls:'neutral',risk:'—',text:'No next-pick forecast yet.'};const pct=Math.round(surv*100);if(pct<=20)return{label:'TAKE NOW',cls:'take',risk:tp.label,text:`Only ${pct}% projected survival; ${tp.needTeams} of ${tp.teams} intervening teams show ${p.pos} demand.`};if(pct<=42)return{label:'LEAN TAKE',cls:'lean',risk:tp.label,text:`${pct}% projected survival; waiting carries meaningful ${p.pos} risk.`};if(pct>=72)return{label:'CAN WAIT',cls:'wait',risk:tp.label,text:`${pct}% projected survival; only ${tp.needTeams} of ${tp.teams} intervening teams show strong ${p.pos} demand.`};return{label:'VALUE CALL',cls:'neutral',risk:tp.label,text:`${pct}% projected survival; balance value against your current roster need.`}}
    score(p,list=this.myPlayers(),overall=this.overall){if(!this.candidateAllowed(p,list,overall))return-99;const fw=+this.league.favoriteWeight||0,rw=+this.league.riskWeight||1;let s=108-p.rank*.40+this.needBonus(p.pos,list,overall)+this.tierBonus(p)+this.qScarcity(p,list)+this.favBonus(p)*fw+this.scoringMods(p)+(p.marketAdjust||0)+(p.ceiling||3)*1.15-(p.risk||3)*rw+this.byeAdjustment(p,list,overall);if(p.pos==='QB'&&this.counts(list).QB>=this.requiredQB())s-=this.hasSuperflex()?13:10;const reach=Math.max(0,p.rank-overall);if(reach>18)s-=Math.min(18,(reach-18)*.48);s+=this.turnPressureBonus(p);return Math.round(s*10)/10}
    recs(limit=30){return this.avail().filter(p=>this.candidateAllowed(p)).map(p=>({p,s:this.score(p)})).sort((a,b)=>b.s-a.s||a.p.rank-b.p.rank).slice(0,limit)}
    snapshot(){this.history.push(JSON.stringify({drafted:this.drafted,picks:this.picks,teams:this.teams,mine:this.mine,overall:this.overall,complete:this.complete}))}
    undo(){const h=this.history.pop();if(!h)return false;Object.assign(this,JSON.parse(h));return true}
    finalizeIfNeeded(){if(this.overall>this.maxPicks()||this.avail().length===0){this.complete=true;return true}return false}
    choose(id,team,isMine=false){if(this.isComplete()||this.drafted[id])return false;const p=this.pby(id);if(!p)return false;this.snapshot();this.drafted[id]=true;this.picks.push({overall:this.overall,team,id});this.ensureTeams();this.teams[team-1].push(id);if(isMine)this.mine.push(id);this.overall++;this.finalizeIfNeeded();return true}
    myChoose(id){if(!this.slot||this.teamForOverall(this.overall)!==this.slot)return false;return this.choose(id,this.slot,true)}
    opponentPick(team){const list=this.teamRoster(team),pool=this.avail();if(!pool.length)return null;let candidates=pool.filter(p=>this.candidateAllowed(p,list,this.overall)).map(p=>{const need=this.needBonus(p.pos,list,this.overall)*.75,benchQbPenalty=(p.pos==='QB'&&this.counts(list).QB>=this.requiredQB())?(this.hasSuperflex()?9:7):0;return{p,v:-p.rank+need-benchQbPenalty+(Math.random()-.5)*12}}).sort((a,b)=>b.v-a.v);if(!candidates.length)candidates=pool.filter(p=>['RB','WR'].includes(p.pos)).map(p=>({p,v:-p.rank+(Math.random()-.5)*8})).sort((a,b)=>b.v-a.v);return candidates[0]?.p||pool[0]||null}
    autoToMyPick(){if(!this.slot||this.isComplete())return;let guard=0;while(!this.complete&&this.overall<=this.maxPicks()&&this.teamForOverall(this.overall)!==this.slot&&guard<400){const team=this.teamForOverall(this.overall),p=this.opponentPick(team);if(!p){this.complete=true;break}this.drafted[p.id]=true;this.picks.push({overall:this.overall,team,id:p.id});this.teams[team-1].push(p.id);this.overall++;guard++;this.finalizeIfNeeded()}}
    reset(){this.drafted={};this.picks=[];this.teams=Array.from({length:this.teamCount()},()=>[]);this.mine=[];this.history=[];this.overall=1;this.complete=false}
    rosterValidity(){const c=this.counts(this.myPlayers()),s=this.league.slots||{};return{ok:c.QB>=this.requiredQB()&&c.RB>=this.requiredRB()&&c.WR>=this.requiredWR()&&c.TE>=this.requiredTE()&&c.DST>=(+s.DST||0)&&c.K>=(+s.K||0),counts:c}}
  }
  return{DraftForgeEngine};
});
