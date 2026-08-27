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
console.log('PASS: legacy Yahoo Results parser reads explicit pick rows and preserves overlap continuity.');

// V8.13 row-by-row path: model the kinds of distortions observed in a real Yahoo
// Results screenshot. The first pick number loses its leading 1 (12 -> 2), but
// the remaining descending sequence should repair the numbering without guessing
// player identity. Ambiguous rows must remain unresolved for manual review.
const rowRecords=[
  {rawPick:'2',chunk:'S. BARKLEY RB Phi Bye 10',fantasyTeam:'Team12'},
  {rawPick:'11',chunk:'CUM WR Dal Bye 14',fantasyTeam:'Nicholas'},
  {rawPick:'10',chunk:'C BROWN RB Cin Bye 6',fantasyTeam:'Gus Stewart'},
  {rawPick:'9',chunk:'J SMITH ALEGBA WR Ses Bye 11',fantasyTeam:'Goz'},
  {rawPick:'8',chunk:'LoKeS RB Buf Bye 7',fantasyTeam:'tj'},
  {rawPick:'7',chunk:'A ST BROWN WR Det Bye 6',fantasyTeam:'Keith'},
  {rawPick:'6',chunk:'Atmel RB Ind Bye 3',fantasyTeam:'Beach Ballers'},
  {rawPick:'5',chunk:'C MCCAFFREY RB SF Bye 8',fantasyTeam:'PatrickF'},
  {rawPick:'4',chunk:'PNAQA WR LAR Bye 11',fantasyTeam:'Jentry'},
  {rawPick:'3',chunk:'AGHUSE WR Gin Bye 6',fantasyTeam:'Your Team'},
  {rawPick:'2',chunk:'B ROBSISON RB Au Bye 11',fantasyTeam:'Brantley'},
  {rawPick:'1',chunk:'Lapas RB Det Bye 6',fantasyTeam:'Tommy'},
];
const rowSnap=sync.parseYahooResultsRows(rowRecords,players,{teams:12,maxPicks:180,nextOverall:1,existingPicks:[]});
assert.strictEqual(rowSnap.sequence.top,12,'row sequence should repair a dropped leading digit at pick 12');
assert.strictEqual(rowSnap.rows.length,12,'row path should preserve all 12 Yahoo result rows');
assert.strictEqual(rowSnap.rows.find(r=>r.pick===9).player?.name,'Jaxon Smith-Njigba','compound-surname OCR should not collapse to a generic Smith');
assert.strictEqual(rowSnap.rows.find(r=>r.pick===12).player?.name,'Saquon Barkley');
assert.strictEqual(rowSnap.rows.find(r=>r.pick===1).player?.name,'Jahmyr Gibbs');
assert.ok(rowSnap.unresolved.includes(11),'an ambiguous player row should stay editable instead of being guessed');
assert.notStrictEqual(rowSnap.rows.find(r=>r.pick===11).suggested?.name,'George Pickens','ambiguous DAL WR metadata must not silently become another player');
console.log('PASS: V8.13 row-by-row parser repairs pick sequencing and leaves ambiguous players unresolved.');
