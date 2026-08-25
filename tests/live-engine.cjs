const fs=require('fs'),vm=require('vm');
const {DraftForgeEngine}=require('../engine.js');
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require.resolve('../data/players.js'),'utf8')+';this.P=DRAFTFORGE_PLAYERS;',ctx);
vm.runInContext(fs.readFileSync(require.resolve('../data/presets.js'),'utf8')+';this.L=DRAFTFORGE_PRESETS;',ctx);
const e=new DraftForgeEngine(ctx.P,ctx.L['User Yahoo League'],5);
for(let i=0;i<4;i++){
  const p=e.avail()[0];
  e.choose(p.id,e.teamForOverall(e.overall),false);
}
if(e.overall!==5||e.teamForOverall(e.overall)!==5)throw new Error('Did not reach user pick 5 correctly.');
if(e.forecastMine()!==20)throw new Error(`Expected next turn forecast at 20, got ${e.forecastMine()}`);
const rec=e.recs(1)[0];
if(!rec)throw new Error('No live recommendation.');
const survival=e.nextPickSurvival(rec.p);
if(survival===null)throw new Error('On-clock survival forecast is null.');
e.myChoose(rec.p.id);
if(e.overall!==6)throw new Error('Manual live pick should advance exactly one selection.');
e.undo();
if(e.overall!==5)throw new Error('Undo did not restore the previous live pick.');
console.log(`PASS: live engine pick-by-pick flow; on-clock survival=${Math.round(survival*100)}%, next turn=20.`);
