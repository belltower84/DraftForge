const assert=require('assert');
const sync=require('../sync.js');
const players=require('../data/players.js');
const ocr=`Pick Ployer
ROUND 1
2 g SBAMALEY =)
<> RB-Phi- Bye 10
cal @ cums
+> WR Dal-Bye14
10 8 Cmown ©
+ RB.Cin. Bye6
§ +] A. SaTHera
At WR+Sea> Bye Tt
g g iqueb
a. RB-Buf-Bye7
AST. mown ©)
z & WR - Det» Bye 6
6 & Atmore =
Vae> RB. Ind. Bye
CMOCAFREEY 0 ©
5 & RB+SF + Bye 8
4 2 RMAOM 9 =
i> WR>LAR> Bye tt
3 @ soma0G
~  WR-Gin- Bye 6
> |= Rms
SW) RB-AU.Byett
Lamas ©)
1 = RB Det - Bye 6`;
const expected=['Saquon Barkley','CeeDee Lamb','Chase Brown','Jaxon Smith-Njigba','James Cook III','Amon-Ra St. Brown','Jonathan Taylor','Christian McCaffrey','Puka Nacua',"Ja'Marr Chase",'Bijan Robinson','Jahmyr Gibbs'];
const found=sync.playersFromYahooOcrText(ocr,players);
assert.deepStrictEqual(found.map(x=>x.name),expected,'Yahoo-style OCR rows should resolve to the correct 12 players');
const aligned=sync.alignDetectedPlayers(found,[],1);
assert.deepStrictEqual(aligned.map(x=>x.pick),[1,2,3,4,5,6,7,8,9,10,11,12],'Top-down Yahoo results should reverse into chronological picks');
// Simulate DraftForge already remembering picks 1-8, then receiving an overlapping screenshot.
const chronological=[...found].reverse();
const existing=chronological.slice(0,8).map((x,i)=>({id:x.id,overall:i+1}));
const overlapTopDown=[...chronological.slice(5,12)].reverse();
const realigned=sync.alignDetectedPlayers(overlapTopDown,existing,9);
assert.strictEqual(realigned.find(x=>x.id===chronological[8].id).pick,9,'Overlapping screenshot should continue memory at pick 9');
console.log('Screenshot sync test passed: 12/12 Yahoo rows recognized and cumulative alignment preserved.');
