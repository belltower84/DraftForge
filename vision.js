(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DraftForgeBoardVision=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function median(xs){if(!xs.length)return 0;const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
  function boardOverall(round,col,teams){return (round-1)*teams+(round%2?col+1:teams-col)}
  function dist3(a,b){return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])}
  function quantKey(r,g,b,step=4){return `${Math.round(r/step)*step},${Math.round(g/step)*step},${Math.round(b/step)*step}`}
  function parseKey(k){return k.split(',').map(Number)}
  function dominantColorFromData(data,w,rect){
    const x0=clamp(Math.floor(rect.x+2),0,w-1),y0=Math.max(0,Math.floor(rect.y+2)),x1=clamp(Math.ceil(rect.x+rect.w-2),x0+1,w),y1=Math.max(y0+1,Math.ceil(rect.y+rect.h-2));
    const counts=new Map();
    for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){const i=(y*w+x)*4,k=quantKey(data[i],data[i+1],data[i+2]);counts.set(k,(counts.get(k)||0)+1)}
    let best='0,0,0',n=-1;for(const [k,v] of counts)if(v>n){n=v;best=k}return parseKey(best);
  }
  function classifyPosition(bg){
    const refs={RB:[0,32,36],WR:[60,16,0],TE:[60,0,36],QB:[4,20,76]};
    let best=null,score=1e9;for(const [p,c] of Object.entries(refs)){const d=dist3(bg,c);if(d<score){score=d;best=p}}
    return score<=48?best:null;
  }
  function isClockColor(bg){const [r,g,b]=bg;return b>52&&r>10&&r<52&&g<12&&b>r*1.32}
  function canvasFromBitmap(bitmap){const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);return c}
  function connectedComponents(mask,w,h){
    const out=[],stack=new Int32Array(w*h);let sp=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const start=y*w+x;if(!mask[start])continue;mask[start]=0;stack[sp++]=start;
      let minX=x,maxX=x,minY=y,maxY=y,area=0;
      while(sp){const idx=stack[--sp],cy=(idx/w)|0,cx=idx-cy*w;area++;if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;
        const xA=Math.max(0,cx-1),xB=Math.min(w-1,cx+1),yA=Math.max(0,cy-1),yB=Math.min(h-1,cy+1);
        for(let yy=yA;yy<=yB;yy++)for(let xx=xA;xx<=xB;xx++){const ni=yy*w+xx;if(mask[ni]){mask[ni]=0;stack[sp++]=ni}}
      }
      out.push({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,area});
    }
    return out;
  }
  function groupRows(rects){
    if(!rects.length)return[];const tol=Math.max(8,median(rects.map(r=>r.h))*.68),rows=[];
    for(const rect of [...rects].sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2)||a.x-b.x)){
      const cy=rect.y+rect.h/2;let best=null,bestD=1e9;for(const row of rows){const d=Math.abs(cy-row.cy);if(d<bestD){bestD=d;best=row}}
      if(best&&bestD<=tol){best.items.push(rect);best.cy=best.items.reduce((s,r)=>s+r.y+r.h/2,0)/best.items.length}else rows.push({cy,items:[rect]});
    }
    rows.sort((a,b)=>a.cy-b.cy);return rows;
  }
  function detectTileGrid(sourceCanvas,options={}){
    const sw=sourceCanvas.width,sh=sourceCanvas.height,down=sw>=1500?.5:.65,c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*down));c.height=Math.max(1,Math.round(sh*down));const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(sourceCanvas,0,0,c.width,c.height);
    const W=c.width,H=c.height,im=ctx.getImageData(0,0,W,H),d=im.data,rx0=Math.floor(W*.14),rx1=Math.floor(W*.87),ry0=Math.floor(H*.20),ry1=Math.floor(H*.82),rw=rx1-rx0,rh=ry1-ry0,mask=new Uint8Array(rw*rh);
    for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const i=((y+ry0)*W+(x+rx0))*4,r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),mean=(r+g+b)/3;if(mean<52&&mx-mn>17&&mx>22)mask[y*rw+x]=1}
    let comps=connectedComponents(mask,rw,rh).map(r=>({...r,x:r.x+rx0,y:r.y+ry0,fill:r.area/(r.w*r.h)}));
    comps=comps.filter(r=>r.w>W*.018&&r.w<W*.095&&r.h>H*.025&&r.h<H*.115&&r.fill>.53);
    let rows=groupRows(comps);const maxCols=Math.max(0,...rows.map(r=>r.items.length));rows=rows.filter(r=>r.items.length>=Math.max(2,Math.ceil(maxCols*.42)));
    if(!rows.length||!maxCols)return{ok:false,reason:'No Yahoo player-tile grid detected',teams:0,tiles:[]};
    const fullRow=rows.slice().sort((a,b)=>b.items.length-a.items.length)[0],teams=fullRow.items.length;
    if(teams<6||teams>20)return{ok:false,reason:`Detected ${teams} columns, outside supported range`,teams,tiles:[]};
    const colCenters=fullRow.items.slice().sort((a,b)=>a.x-b.x).map(r=>r.x+r.w/2),scaleBack=1/down,srcCtx=sourceCanvas.getContext('2d',{willReadFrequently:true}),srcData=srcCtx.getImageData(0,0,sw,sh).data,tiles=[];
    rows.forEach((row,ri)=>{row.items.slice().sort((a,b)=>a.x-b.x).forEach(r=>{const cx=r.x+r.w/2;let col=0,best=1e9;colCenters.forEach((v,i)=>{const dd=Math.abs(v-cx);if(dd<best){best=dd;col=i}});const rect={x:r.x*scaleBack,y:r.y*scaleBack,w:r.w*scaleBack,h:r.h*scaleBack},bg=dominantColorFromData(srcData,sw,rect),clock=isClockColor(bg),pos=clock?null:classifyPosition(bg),round=ri+1,overall=boardOverall(ri+1,col,teams);tiles.push({round:ri+1,col,overall,rect,bg,clock,pos})})});
    const clockTiles=tiles.filter(t=>t.clock),currentPick=clockTiles.length?clockTiles[0].overall:Math.max(0,...tiles.map(t=>t.overall))+1;
    return{ok:true,teams,rows:rows.length,tiles:tiles.sort((a,b)=>a.overall-b.overall),currentPick,colCenters:colCenters.map(x=>x*scaleBack),firstRowTop:Math.min(...tiles.filter(t=>t.round===1).map(t=>t.rect.y)),tileHeight:median(tiles.map(t=>t.rect.h)),sourceWidth:sw,sourceHeight:sh};
  }
  function binaryTilePatch(sourceCanvas,tile,targetW,targetH,mode='distance'){
    const r=tile.rect,x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y)),w=Math.max(1,Math.min(sourceCanvas.width-x,Math.ceil(r.w))),h=Math.max(1,Math.min(sourceCanvas.height-y,Math.ceil(r.h))),srcCtx=sourceCanvas.getContext('2d',{willReadFrequently:true}),im=srcCtx.getImageData(x,y,w,h),d=im.data,bg=tile.bg,bgLum=.299*bg[0]+.587*bg[1]+.114*bg[2];
    for(let i=0;i<d.length;i+=4){const rr=d[i],gg=d[i+1],bb=d[i+2],lum=.299*rr+.587*gg+.114*bb,delta=Math.abs(rr-bg[0])+Math.abs(gg-bg[1])+Math.abs(bb-bg[2]);let ink;if(mode==='luma')ink=(lum-bgLum)>13||delta>52;else ink=delta>24||lum>bgLum+24;const v=ink?0:255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
    const small=document.createElement('canvas');small.width=w;small.height=h;small.getContext('2d').putImageData(im,0,0);const out=document.createElement('canvas');out.width=targetW;out.height=targetH;const o=out.getContext('2d');o.fillStyle='#fff';o.fillRect(0,0,targetW,targetH);o.imageSmoothingEnabled=false;o.drawImage(small,0,0,w,h,4,4,targetW-8,targetH-8);return out;
  }
  function makeTileComposite(sourceCanvas,tiles,options={}){
    const patchW=options.patchW||330,patchH=options.patchH||210,gap=options.gap||18,mode=options.mode||'distance',c=document.createElement('canvas');c.width=patchW;c.height=Math.max(1,tiles.length*(patchH+gap));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);tiles.forEach((t,i)=>{const p=binaryTilePatch(sourceCanvas,t,patchW,patchH,mode);ctx.drawImage(p,0,i*(patchH+gap))});return{canvas:c,patchW,patchH,gap,tiles};
  }
  function chunksFromOcrWords(words,composite){
    const out=Array.from({length:composite.tiles.length},()=>[]),stride=composite.patchH+composite.gap;
    for(const w of words||[]){const b=w.bbox||{x0:w.left||0,y0:w.top||0,x1:(w.left||0)+(w.width||0),y1:(w.top||0)+(w.height||0)},cy=(+b.y0+(+b.y1||+b.y0))/2,idx=Math.floor(cy/stride);if(idx<0||idx>=out.length)continue;const local=cy-idx*stride;if(local>composite.patchH)continue;out[idx].push({text:String(w.text||'').trim(),x:+b.x0||0,y:+b.y0||0,conf:+(w.confidence??w.conf??0)||0})}
    return out.map(xs=>xs.filter(x=>x.text).sort((a,b)=>a.y-b.y||a.x-b.x).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim());
  }
  function makeHeaderCanvas(sourceCanvas,grid){
    if(!grid?.ok||!grid.colCenters?.length)return null;const tileW=grid.tiles[0]?.rect.w||80,x0=Math.max(0,Math.floor(grid.colCenters[0]-tileW*.55)),x1=Math.min(sourceCanvas.width,Math.ceil(grid.colCenters[grid.colCenters.length-1]+tileW*.55)),y1=Math.max(1,Math.floor(grid.firstRowTop-4)),y0=Math.max(0,Math.floor(y1-Math.max(48,grid.tileHeight*1.35))),w=x1-x0,h=y1-y0,src=sourceCanvas.getContext('2d',{willReadFrequently:true}).getImageData(x0,y0,w,h),d=src.data;
    for(let i=0;i<d.length;i+=4){const lum=.299*d[i]+.587*d[i+1]+.114*d[i+2],mx=Math.max(d[i],d[i+1],d[i+2]);const ink=lum>112||mx>155,v=ink?0:255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
    const small=document.createElement('canvas');small.width=w;small.height=h;small.getContext('2d').putImageData(src,0,0);const scale=2,c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,c.width,c.height);return{canvas:c,x0,y0,scale};
  }
  return{boardOverall,detectTileGrid,makeTileComposite,chunksFromOcrWords,makeHeaderCanvas,classifyPosition,isClockColor};
});
