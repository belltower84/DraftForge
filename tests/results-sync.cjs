const assert=require('assert');
const sync=require('../sync.js');
const players=require('../data/players.js');

const expected=[
  'Jahmyr Gibbs','Bijan Robinson',"Ja'Marr Chase",'Puka Nacua','Christian McCaffrey',
  'Jonathan Taylor','Amon-Ra St. Brown','James Cook III','Jaxon Smith-Njigba','Chase Brown','CeeDee Lamb','Saquon Barkley'
];
const byName=new Map(players.map(p=>[p.name,p]));
const words=[];
function add(text,x,y,w=60,h=14,confidence=96){words.push({text,confidence,bbox:{x0:x,y0:y,x1:x+w,y1:y+h}})}
add('Pick',40,20,35);add('Player',130,20,50);add('Team',840,20,45);
// Yahoo round-by-round is commonly newest/highest pick at the top.
for(let i=12;i>=1;i--){
  const y=50+(12-i)*34,p=byName.get(expected[i-1]);
  add(String(i),48,y,22);
  const parts=p.name.split(' ');let x=130;for(const part of parts){add(part,x,y,Math.max(32,part.length*8));x+=Math.max(38,part.length*8)+6}
  add(p.pos,x+8,y,25);add(p.team,x+42,y,30);
  add(i===3?'Your':`Team${i}`,840,y,58);if(i===3)add('Team',902,y,38);
}
const snapshot=sync.parseYahooResultsWords(words,players,{width:1000,height:500,teams:12,maxPicks:180,existingPicks:[]});
assert.strictEqual(snapshot.rows.length,12,'should find 12 explicit result rows');
assert.deepStrictEqual(snapshot.picks.map(x=>x.player.name),expected,'result rows should map to the correct players in overall-pick order');
assert.strictEqual(snapshot.userSlot,3,'Your Team row should identify snake slot 3');
assert.strictEqual(snapshot.throughPick,12,'through pick should be 12');

const existing=snapshot.picks.slice(0,8).map(x=>({overall:x.overall,id:x.id,team:x.team}));
const laterWords=words.filter(w=>w.text==='Pick'||w.text==='Player'||w.text==='Team'||(w.bbox.y0>=50 && w.bbox.y0<=50+6*34));
const overlap=sync.parseYahooResultsWords(laterWords,players,{width:1000,height:500,teams:12,maxPicks:180,existingPicks:existing});
const rec=sync.reconcileResultsSnapshot(overlap,existing,{nextOverall:9});
assert.ok(rec.newRows.every((r,i)=>r.pick===9+i),'overlap should add only contiguous new picks');
console.log('PASS: V8.12 Yahoo Results parser reads explicit pick rows and preserves overlap continuity.');
