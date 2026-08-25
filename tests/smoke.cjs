const players=require('../data/players.js');
const presets=require('../data/presets.js');
const {DraftForgeEngine}=require('../engine.js');
let failures=[];
for(let slot=1;slot<=12;slot++){
  const e=new DraftForgeEngine(players,presets['User Yahoo League'],slot);
  e.reset();e.autoToMyPick();let guard=0;
  while(!e.isComplete()&&guard++<100){
    if(e.teamForOverall(e.overall)!==slot){e.autoToMyPick();continue}
    const r=e.recs(1)[0];if(!r){failures.push(`slot ${slot}: no recommendation at ${e.overall}`);break}
    e.myChoose(r.p.id);e.autoToMyPick();
  }
  const v=e.rosterValidity();
  if(!v.ok) failures.push(`slot ${slot}: invalid roster ${JSON.stringify(v.counts)}`);
  if(e.mine.length!==e.totalRosterSize()) failures.push(`slot ${slot}: roster size ${e.mine.length}/${e.totalRosterSize()}`);
}
const topEngine=new DraftForgeEngine(players,presets['User Yahoo League'],1);
const top=topEngine.recs(5).map(x=>`${x.p.name}:${x.s}`).join(' | ');
console.log('Top recommendations:',top);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('PASS: 12/12 full-draft smoke tests completed with valid required rosters.');
