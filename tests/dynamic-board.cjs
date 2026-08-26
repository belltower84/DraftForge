const assert=require('assert');
const Sync=require('../sync.js');
const players=require('../data/players.json');

function wordsFor(teams,currentPick,userSlot){
  const W=1600,H=1000,left=W*.02,right=W*.965,colW=(right-left)/teams,rowStart=H*.052,rowStep=H*.06975;
  const out=[];
  function add(text,cx,cy,conf=95){out.push({text,confidence:conf,bbox:{x0:cx-10,y0:cy-5,x1:cx+10,y1:cy+5}})}
  for(let c=0;c<teams;c++)add(c===userSlot-1?'You':`T${c+1}`,left+(c+.5)*colW,H*.022);
  const used=new Set();
  for(let overall=1;overall<currentPick;overall++){
    const r=Math.ceil(overall/teams),within=(overall-1)%teams+1,c=r%2?within-1:teams-within;
    const p=players.find(x=>!used.has(x.id)&&x.rank===overall)||players.find(x=>!used.has(x.id)); used.add(p.id);
    const x=left+(c+.5)*colW,y=rowStart+(r-1)*rowStep+rowStep*.42;
    add(p.name,x,y-10);add(p.pos,x-8,y+8);add(p.team,x+10,y+8);
  }
  const r=Math.ceil(currentPick/teams),within=(currentPick-1)%teams+1,c=r%2?within-1:teams-within,x=left+(c+.5)*colW,y=rowStart+(r-1)*rowStep+rowStep*.42;
  add('ON',x-8,y);add('THE',x,y);add('CLOCK',x+8,y);
  return out;
}
for(const teams of [12,14]){
  const current=teams*2+8, words=wordsFor(teams,current,teams);
  const snap=Sync.detectYahooBoardSnapshot(words,players,{width:1600,height:1000,preferredTeams:12,candidates:[10,12,14,16],rounds:10});
  assert.equal(snap.teams,teams,`should detect ${teams} teams`);
  assert.equal(snap.currentPick,current);
  assert.equal(snap.userSlot,teams);
  assert.equal(snap.picks.length,current-1);
}
console.log('dynamic-board: PASS');
