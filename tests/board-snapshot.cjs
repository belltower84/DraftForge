const assert=require('assert');
const sync=require('../sync.js');
const players=require('../data/players.js');
const W=1790,H=1434,teams=12,left=W*.02,right=W*.965,cw=(right-left)/teams,y0=H*.052,step=H*.06975;
const out=[];
function addWord(text,x,y,conf=85){out.push({text,confidence:conf,bbox:{x0:x,y0:y,x1:x+Math.max(12,text.length*7),y1:y+22}})}
const headers=['Andrew','Al','Casey','Connor','You','Nick','Carson','Anna','Waylon','Team 10','Ried','Brett'];
headers.forEach((name,c)=>addWord(name,left+c*cw+12,25,90));
const rows=[
['BUAN ROBINSON RB Atl','cues RB Det','JAXON SMITHAUIGEA WR Sea','JAM ARR CHAS WR Cin','PUKA ACU WR LAR','JONATHAN TavLOR RB Ind','AMON RA ST BROWN WR Det','JAMAES cookm RB Buf','CHRISTIAN MCCAFFREY RB SF','CEEDEE LAMB WR Dal','SAQUON BARKLEY RB Phi','DEVON ACHANE RB Mia'],
['AAVONTE WALLIAMS RB Dal','AL BROWN WR NE','KYREN WILLIAMS RB LAR','BROCK BOWERS TE LV','DRAKE LONDON WR Atl','Justin JEFFERSON WR Min','ASHTON JEANTY RB LV','PICKENS WR Dal','OMARION HAMPTON RB LAC','DERRKK Henny RB Bal','KENNETH WALKER RB KC','CHASE BROWN RB Cin'],
['MALIK NABERS WR NYG','DEVONTA SMITH WR Phi','MICO COLLINS WR Hou','BREECE HALL RB NYJ','OLAVE WR NO','LOWE RB Ari','TREY MCBRIDE TE Ari','JOSH ALLEN QB Buf','Labo WR LAC','Te HIGGINS WR Cin','WADOLE WR Den','my FLOWERS WR Bal'],
[null,null,null,null,null,'ON THE CLOCK','TRAVIS ETIENNE RB NO','COLSTON LOVELAND TE Chi','EGBUKA WR TB','JACOBS RB GB','TETAROA MCMILLAN WR Car','RASHEE RICE WR KC']
];
for(let r=0;r<rows.length;r++)for(let c=0;c<12;c++){
  const chunk=rows[r][c];if(!chunk)continue;let x=left+c*cw+8,y=y0+r*step+10;
  for(const token of chunk.split(/\s+/)){addWord(token,x,y,80);x+=Math.max(16,token.length*7+4);if(x>left+(c+1)*cw-20){x=left+c*cw+8;y+=25}}
}
const snap=sync.parseYahooBoardWords(out,players,{width:W,height:H,teams:12,rounds:13});
assert.strictEqual(snap.userSlot,5,'Yahoo You column should set draft slot 5');
assert.strictEqual(snap.currentPick,43,'ON THE CLOCK cell should map to overall pick 43');
assert.strictEqual(snap.picks.length,42,'All completed cells before pick 43 should be recognized');
for(let n=1;n<=42;n++)assert(snap.picks.some(p=>p.overall===n),`Missing completed pick ${n}`);
assert.strictEqual(snap.picks.find(p=>p.overall===3).player.name,'Jaxon Smith-Njigba');
assert.strictEqual(snap.picks.find(p=>p.overall===20).player.name,'Drake London');
assert.strictEqual(snap.picks.find(p=>p.overall===29).player.name,'Chris Olave');
assert.strictEqual(snap.picks.find(p=>p.overall===39).player.name,'Josh Jacobs');
assert.strictEqual(snap.picks.find(p=>p.overall===42).player.name,'Travis Etienne Jr.');
const rec=sync.reconcileBoardSnapshot(snap,[],{nextOverall:1});
assert(rec.safe,'A complete first board snapshot should be safe to apply');
assert.strictEqual(rec.newPicks.length,42);
console.log('PASS: V8.9 board snapshot reconstructs 42 picks, 12 team columns, user slot, and current pick from one board image.');
