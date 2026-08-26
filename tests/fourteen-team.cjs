const players=require('../data/players.js');
const presets=require('../data/presets.js');
const {DraftForgeEngine}=require('../engine.js');
const league=JSON.parse(JSON.stringify(presets['User Yahoo League']));league.teams=14;
let failures=[];
for(let slot=1;slot<=14;slot++){
  const e=new DraftForgeEngine(players,league,slot);e.reset();e.autoToMyPick();let guard=0;
  while(!e.isComplete()&&guard++<100){if(e.teamForOverall(e.overall)!==slot){e.autoToMyPick();continue}const r=e.recs(1)[0];if(!r){failures.push(`slot ${slot}: no rec at ${e.overall}`);break}e.myChoose(r.p.id);e.autoToMyPick()}
  const v=e.rosterValidity();if(!v.ok)failures.push(`slot ${slot}: invalid ${JSON.stringify(v.counts)}`);
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('PASS: 14/14 full 14-team mock drafts completed with valid required rosters.');
