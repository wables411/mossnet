/* Moss Quest - a DS-style moss-hunting game drawn on two stacked 256x192 panes. Data: GBIF.org
   Embeddable: window.mossQuest.start(canvas, {data|dataUrl, imgBase, user, muted, onStatus}) / stop() / press(button) / hold(dir, on) / setMuted(m).
   The host owns login, keyboard and d-pad wiring, the sound toggle and the status line; this file owns everything drawn on the panes. */
window.mossQuest=(function(){
'use strict';
/* ---------------- layout: one 256x192 pixel-art scene; the rest of the UI is HTML the host styles ---------------- */
const PW=256,PH=192,T=16;
const CW=PW,CH=PH;
const W=PW,H=PH;
let cv=null,ctx=null,ui=null,opts={};

/* ---------------- colours ---------------- */
const C={face:'#c6d19c',light:'#e4ebc4',shade:'#9fb07a',dark:'#587f3e',navy:'#1b3320',titleB:'#587f3e',ink:'#1b3320',muted:'#587f3e',
  paper:'#c6d19c',paper2:'#b7c48c',grid:'#a6b67e',accent:'#1b3320',lav:'#587f3e',lav2:'#a6b67e',green:'#2f6b32',mint:'#52ff7a',red:'#7b2a4d',gold:'#a4497a',sky:'#7fb2e5',white:'#e4ebc4'};
const SPR={'0':'#1a1a2e','1':'#2e5d1f','2':'#4f9a2d','3':'#7fcf4a','4':'#5b3a1e','5':'#6e6e78','6':'#a0a0a8','7':'#d0d0d6','8':'#3f8a2e','9':'#8fd45f',a:'#c8f07a',b:'#f2c9a0',c:'#e04848',d:'#ffffff',e:'#2f5fb3',f:'#6b4a2b',g:'#2a2a2a',h:'#ffd84a',
  w:'#e8e8f0',k:'#8a9a5b',s:'#f6f8fd',t:'#5b3a1e',p:'#e0a0c0'};

/* ---------------- 3x5 bitmap font ---------------- */
const GL={
A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',
F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',
K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',
P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',
U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',
Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
'4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010','8':'010101010101010',
'9':'010101011001110',' ':'000000000000000','.':'000000000000010',',':'000000000010100',':':'000010000010000',
'!':'010010010000010','?':'110001010000010','-':'000000111000000',"'":'010010000000000','(':'001010010010001',
')':'100010010010100','/':'001001010100100','#':'101111101111101','>':'100010001010100','&':'010100011101011',
'+':'000010111010000','%':'101001010100101','_':'000000000000111','=':'000111000111000','<':'001010100010001','@':'010101111100011','*':'101010111010101'};
const GL7={A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01110100011000010000100001000101110',D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',G:'01110100011000010111100011000101111',H:'10001100011000111111100011000110001',I:'01110001000010000100001000010001110',J:'00111000100001000010000101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',M:'10001110111010110101100011000110001',N:'10001100011100110101100111000110001',O:'01110100011000110001100011000101110',P:'11110100011000111110100001000010000',Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110',V:'10001100011000110001100010101000100',W:'10001100011000110101101011010101010',X:'10001100010101000100010101000110001',Y:'10001100011000101010001000010000100',Z:'11111000010001000100010001000011111',0:'01110100011001110101110011000101110',1:'00100011000010000100001000010001110',2:'01110100010000100010001000100011111',3:'11111000100010000010000011000101110',4:'00010001100101010010111110001000010',5:'11111100001111000001000011000101110',6:'00110010001000011110100011000101110',7:'11111000010001000100010000100001000',8:'01110100011000101110100011000101110',9:'01110100011000101111000010001001100',' ':'00000000000000000000000000000000000','.':'00000000000000000000000000110001100',',':'00000000000000000000011000010001000',':':'00000011000110000000011000110000000','!':'00100001000010000100001000000000100','?':'01110100010000100010001000000000100','-':'00000000000000011111000000000000000',"'":'00100001000100000000000000000000000','(':'00010001000100001000010000010000010',')':'01000001000001000010000100010001000','/':'00000000010001000100010001000000000','#':'01010010101111101010111110101001010','>':'10000010000010000010001000100010000','&':'01100100101010001000101011001001101','+':'00000001000010011111001000010000000','%':'11000110010001000100010001001100011','_':'00000000000000000000000000000011111','=':'00000000001111100000111110000000000','<':'00001000100010001000001000001000001','@':'01110100010000101101101011010101110','*':'00000001001010101110101010010000000'};
const F5={g:GL,w:3,h:5,adv:4},F7={g:GL7,w:5,h:7,adv:6};let F=F5;
function withFont(f,fn){const o=F;F=f;try{fn();}finally{F=o;}}
function norm(s){return String(s==null?'':s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
function text(s,x,y,col,sc){sc=sc||1;s=norm(s);ctx.fillStyle=col||C.ink;const f=F,n=f.w*f.h;
  for(let k=0;k<s.length;k++){const g=f.g[s[k]]||f.g['?'];
    for(let i=0;i<n;i++)if(g[i]==='1')ctx.fillRect(x+(i%f.w)*sc,y+((i/f.w)|0)*sc,sc,sc);x+=f.adv*sc;}}
const tw=(s,sc)=>norm(s).length*F.adv*(sc||1)-(F.adv-F.w)*(sc||1);
function textR(s,x,y,col,sc){text(s,x-tw(s,sc),y,col,sc);}
function textC(s,cx,y,col,sc){text(s,(cx-tw(s,sc)/2)|0,y,col,sc);}
function textS(s,x,y,col,shadow,sc){text(s,x+(sc||1),y+(sc||1),shadow,sc);text(s,x,y,col,sc);}
function textCS(s,cx,y,col,shadow,sc){textS(s,(cx-tw(s,sc)/2)|0,y,col,shadow,sc);}
function wrap(s,n){const out=[];for(const para of norm(s).split('\n')){let line='';
  for(const w of para.split(' ')){if((line+' '+w).trim().length>n){if(line)out.push(line);line=w;while(line.length>n){out.push(line.slice(0,n));line=line.slice(n);}}else line=(line?line+' ':'')+w;}
  out.push(line);}return out;}
function rect(x,y,w,h,col){ctx.fillStyle=col;ctx.fillRect(x,y,w,h);}

/* ---------------- Win2000 primitives ---------------- */
function bevelOut(x,y,w,h,face){rect(x,y,w,h,face||C.face);rect(x,y,w,1,C.light);rect(x,y,1,h,C.light);rect(x,y+h-1,w,1,C.dark);rect(x+w-1,y,1,h,C.dark);rect(x+1,y+h-2,w-2,1,C.shade);rect(x+w-2,y+1,1,h-2,C.shade);}
function bevelIn(x,y,w,h,fill){rect(x,y,w,h,fill||C.paper);rect(x,y,w,1,C.shade);rect(x,y,1,h,C.shade);rect(x+1,y+1,w-2,1,C.dark);rect(x+1,y+1,1,h-2,C.dark);rect(x,y+h-1,w,1,C.light);rect(x+w-1,y,1,h,C.light);}
function groove(x,y,w,h){rect(x,y,w,h,C.shade);rect(x+1,y+1,w,h,C.light);}
function dots(x,y,w,h,col){ctx.fillStyle=col||C.grid;for(let j=y+5;j<y+h-2;j+=12)for(let i=x+5;i<x+w-2;i+=12){ctx.fillRect(i-1,j,3,1);ctx.fillRect(i,j-1,1,3);}}
function titlebar(x,y,w,h,label,active,nobtn){ctx.fillStyle=active===false?C.shade:C.navy;ctx.fillRect(x,y,w,h);
  if(label)text(label,x+4,y+((h-5)/2|0),C.white);if(nobtn)return;
  const bx=x+w-3;[['_',bx-30],['#',bx-20],['X',bx-10]].forEach(([c,px])=>{bevelOut(px,y+2,9,h-4);text(c,px+3,y+((h-5)/2|0),C.ink);});}
function win(x,y,w,h,title,fill){bevelOut(x,y,w,h);if(title){titlebar(x+2,y+2,w-4,10,title);bevelIn(x+2,y+13,w-4,h-15,fill||C.paper);return {x:x+3,y:y+14,w:w-6,h:h-17};}
  bevelIn(x+2,y+2,w-4,h-4,fill||C.paper);return {x:x+3,y:y+3,w:w-6,h:h-6};}
function wbtn(x,y,w,h,label,sel,sc){bevelOut(x,y,w,h);if(sel){ctx.strokeStyle=C.ink;ctx.setLineDash([1,1]);ctx.strokeRect(x+3.5,y+3.5,w-7,h-7);ctx.setLineDash([]);}
  textC(label,x+w/2,y+((h-F.h*(sc||1))/2|0),sel?C.navy:C.ink,sc||1);}
function selrow(x,y,w,h){rect(x,y,w,h,C.navy);}
function bar(x,y,w,h,frac,fg){bevelIn(x,y,w,h,C.paper);const n=Math.round((w-4)*Math.max(0,Math.min(1,frac)));for(let i=0;i<n;i+=6)rect(x+2+i,y+2,Math.min(5,n-i),h-4,fg||C.navy);}
function panelBox(x,y,w,h,title){const r=win(x,y,w,h,title);rect(r.x,r.y,r.w,r.h,C.paper);dots(r.x,r.y,r.w,r.h);return r;}

/* ---------------- sky ---------------- */
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function mkSky(w,h,seed,top,bot,n){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,top);gr.addColorStop(1,bot);g.fillStyle=gr;g.fillRect(0,0,w,h);
  const r=rng(seed);for(let k=0;k<n;k++){const cx=r()*w,base=h*0.2+r()*h*0.55,s=12+r()*22,puffs=3+(r()*4|0);
    // a cumulus: puffs sit on a flat base, the biggest in the middle
    const P=[];for(let p=0;p<puffs;p++){const t=(p+0.5)/puffs;const px=cx+(t-0.5)*s*2.2,pr=s*(0.45+0.5*Math.sin(t*Math.PI))*(0.85+r()*0.3);P.push([px,base-pr*0.8,pr]);}
    const draw=(dx,dy,col,shrink)=>{g.fillStyle=col;g.beginPath();for(const [px,py,pr] of P){if(px+dx+pr<0||px+dx-pr>w)continue;g.moveTo(px+dx+pr-shrink,py+dy);g.arc(px+dx,py+dy,Math.max(1,pr-shrink),0,7);}
      const x0=P[0][0]-P[0][2]+shrink+dx,x1=P[P.length-1][0]+P[P.length-1][2]-shrink+dx;g.rect(x0,base-s*0.3+dy,x1-x0,s*0.3-shrink);g.fill();};
    for(const dx of [0,-w,w]){draw(dx,3,'rgba(150,180,220,0.55)',0);draw(dx,0,'rgba(255,255,255,0.96)',0);draw(dx,-2,'rgba(255,255,255,1)',s*0.3);}}
  // one cloud is a face: a disc, two slot eyes, a thin smile, all cut from the cloud so the sky shows through
  {const R=14+r()*8,cx=r()*w,cy=h*0.18+r()*h*0.4;
    for(const dx of [0,-w,w]){const x=cx+dx;if(x+R<0||x-R>w)continue;
      g.fillStyle='rgba(150,180,220,0.55)';g.beginPath();g.arc(x,cy+3,R,0,7);g.fill();
      g.fillStyle='rgba(255,255,255,0.97)';g.beginPath();g.arc(x,cy,R,0,7);g.fill();
      g.save();g.globalCompositeOperation='destination-out';
      for(const ex of [-0.40,0.40]){const ew=R*0.24,eh=R*0.9+4;g.beginPath();g.roundRect(x+ex*R-ew/2,cy-R-4,ew,eh,ew/2);g.fill();}
      g.lineWidth=Math.max(1,R*0.05);g.beginPath();g.arc(x,cy,R*0.84,Math.PI*0.034,Math.PI*0.966);g.stroke();
      g.restore();}
    g.save();g.globalCompositeOperation='destination-over';g.fillStyle=gr;g.fillRect(0,0,w,h);g.restore();}
  return c;}
let frame=0;
const SKY=mkSky(PW*2,PH,7,'#4f93de','#d6ebfb',14);
function drawSky(x,y,speed){const off=((frame*(speed||0.12))%(PW*2))|0;const w1=Math.min(PW,PW*2-off);ctx.drawImage(SKY,off,0,w1,PH,x,y,w1,PH);if(w1<PW)ctx.drawImage(SKY,0,0,PW-w1,PH,x+w1,y,PW-w1,PH);}
function emblem(cx,cy,r,col,col2){ctx.fillStyle=col;for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r*0.55,cy+Math.sin(a)*r*0.55,r*0.5,0,7);ctx.fill();}
  ctx.fillStyle=col2;ctx.beginPath();ctx.arc(cx,cy,r*0.38,0,7);ctx.fill();ctx.fillStyle=col;
  for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;ctx.fillRect((cx+Math.cos(a)*r*0.2)|0,(cy+Math.sin(a)*r*0.2)|0,1,1);}
  ctx.fillStyle=C.white;ctx.fillRect(cx|0,(cy-1)|0,1,3);ctx.fillRect((cx-1)|0,cy|0,3,1);}

/* ---------------- sprites ---------------- */
function sprite(rows,remap,size){const n=size||T;const c=document.createElement('canvas');c.width=Array.isArray(n)?n[0]:n;c.height=Array.isArray(n)?n[1]:n;const g=c.getContext('2d');
  rows.forEach((r,y)=>{for(let x=0;x<r.length;x++){const ch=r[x];if(ch!=='.'){g.fillStyle=(remap&&remap[ch])||SPR[ch]||'#f0f';g.fillRect(x,y,1,1);}}});return c;}
function tile(base,fn){const c=document.createElement('canvas');c.width=c.height=T;const g=c.getContext('2d');
  g.fillStyle=base;g.fillRect(0,0,T,T);const p=(x,y,col,w,h)=>{g.fillStyle=col;g.fillRect(x,y,w||1,h||1);};fn(p,g);return c;}
const TREEBM={
 broad:['......0000......','....00333300....','...0333332220...','..033333222210..','..033332222110..','.03333222221110.','.03332222211110.','.03322222211110.','.02222221111110.','..022221111110..','..001111111100..','....00444400....','.....044440.....','.....044440.....','....04444440....','....00000000....'],
 pine:['.......00.......','......0330......','.....033320.....','....03333220....','.....033320.....','....03333220....','...0333322210...','..033333222210..','...0332222210...','..033322222210..','.03333222222210.','0333222222221110','..000044440000..','......0440......','......0440......','.....000000.....'],
 palm:['....0.....0.....','...030...030....','..03330.03330...','.0333330333330..','.0333334333330..','..03334433330...','...00044000.....','......044.......','......044.......','.....044........','.....044........','....044.........','....044.........','...0440.........','...000..........','................'],
 acacia:['................','..000000000000..','.03333333333330.','.03333222222330.','..022222222220..','...0000440000...','.......44.......','.......44.......','......044.......','......044.......','.....044........','.....044........','.....044........','....0440........','....000.........','................'],
 euc:['......000.......','.....03320......','....0333220.....','...033322220....','...0000220000...','.....0332220....','....033322220...','.....0044000....','......044.......','......044.......','.....0440.......','......44........','......44........','.....0440.......','.....0440.......','.....0000.......'],
 bamboo:['..0..0..0.......','..3..3..3..0....','..3..3..3..3....','.03..3.03..3....','..3..3..3..3....','..3.03..3..3....','..3..3..3.03....','.03..3..3..3....','..3..3..3..3....','..3..3.03..3....','..3.03..3..3....','..3..3..3..3....','.03..3..3.03....','..3..3..3..3....','..0..0..0..0....','................'],
 cactus:['................','.......00.......','......0220......','......0220......','..00..0220..00..','.0220.0220.0220.','.0220.0220.0220.','.0220.0220.0220.','.02200022000220.','.02222222222220.','..000022220000..','......0220......','......0220......','......0220......','......0000......','................']};
const ROCKBM=['................','................','.....000000.....','....07777760....','...0777776660...','..077777666660..','..077776666660..','.07777666666650.','.07776666666550.','.06666666655550.','.06666665555550.','.05555555555550.','..000000000000..','................','................','................'];
const MTNBM=['.......00.......','......0dd0......','.....0dddd0.....','....0dd7dd60....','...07777666660..','...0777766660...','..077776666660..','..077766666660..','.07777666665550.','.07776666655550.','.07766666555550.','.06666655555550.','.06666555555550.','.05555555555550.','.00000000000000.','................'];
const MOSS=[sprite(['................','................','................','................','................','.....a.a.a......','....a9a9a9a.....','...a999999a9....','..a99989998a....','..9998999899a...','.a99999999998...','.8999899998998..','.08888888888880.','..000000000000..','................','................']),
            sprite(['................','................','................','......d.........','................','.....a.a.a......','....a9a9a9a.....','...a999999a9.d..','..a99989998a....','..9998999899a...','.a99999999998...','.8999899998998..','.08888888888880.','..000000000000..','................','................'])];
const BEETLEBM=[['................','................','....0......0....','.....0....0.....','......0000......','.....011110.....','....01111110....','...0111111110...','..0.01311110.0..','....01131110....','..0.01113110.0..','....01111110....','.....011110.....','..0...0000...0..','................','................'],
                ['................','................','...0........0...','....0......0....','......0000......','.....011110.....','....01111110....','..0.0111111110..','....01311110.0..','..0.01131110....','....01113110.0..','..0.01111110....','.....011110.....','.....000000.....','...0........0...','................']];
const MIDGEBM=[['................','................','................','................','......d.d.......','.....dd.dd......','......0g0.......','.....0ggg0......','......0g0.......','.....0.0.0......','................','................','................','................','................','................'],
               ['................','................','................','................','.....d...d......','.....dd0dd......','......0g0.......','.....0ggg0......','......0g0.......','....0..0..0.....','................','................','................','................','................','................']];
const PROFBM=['......................................EbbbEE....','....................................Ebeggggeb...','.............EbbE..................Ebgiijjiib...','..........ebbbggbgeb...............Egjjljijkie..','........CbggbeegebHE...............gjkkjiEgkkiH.','.......CEeegijjjjig...............bikkjib.Eikjg.','........bgjjkkkkjjjg.............OijjjiC..HikkiE','.......bijkkkkkibgkjgVVVVVVVVVVUShijkjjieCgkkjiE','......eiijkkjjibAejkjhVVVVVVVVVVUiijkkkkigjkkjeC','UffVVfiihjkjigC..CejkifVVVVVVVVVfiiikkkkjijkkje.','fffffhhfhjkjjgb..bijkjfVVVVVVVVVfihijkkkjjkkkiU.','fffVhgSVikkkkkiCEikkkjhVVVVVVVUUeihhjkkkkkkkjhV.','VfffheSfikkkkkjggjkkkjhVVVVVUUUSeihVhjkkkjihhfV.','VfffVSSVijkkkkjijkkkkjhVVVVUUUUTUihVfhijjiUVWVU.','UffVVSSVhjkkkkjjjkkjjjhVVVUUUUTTTiifVWfhhhWWWVO.','UffVVSMVVijkkkjjjjjiiifVVUUUUTTTSeiifWWWWWfWWOH.','VffVVSMSVfijjjjjiiihihVVUUUUTTTTTTeiihhhfffWWbH.','fVfUVSMSVVWhiiihfhfhihVUUUUUTTTTTTTehiiiihheeQH.','UUUUUUSSVWWWfhhfWWhihfVUUTTTTTTTTTTSTUegigggQQH.','UUUUUUSSVWfffffffhiifVUSSTTTTTTTSSTTNNNNObbQQFQ.','UUUUUSSVVVWffffhhihfWVSSSTTTTTSTTNNNNNOOOHHQQFX.','UUUUTSSVWWWffhhhihfWfVSSSNNNNNNNNNNNNNOEHHQQQFQ.','UUUUTSSTVWfhhhhhfWWWWUSSNNNONNNNNNNNOOOEHIQQQFQ.','UTUTTSSSVWWfffWWWWWWVSSNNOOOOOOOOCCEOOebHIQQJFI.','UTTTSSSSSUVVVWWWWWWWVSNNOOOOOEEEEEEEEOeHFIJJJFF.','OTTTSSSSSSSSSVVWWWWWUNNOOEEHHEEEEEEEHHHHFFJJJFF.','ONNNNSSSSSSSSSVWWWWWSNNOEEbbbHHHEEHHHHHFFFJJJFB.','ONONNNNNMSSSSSVWWWWVSNOObbbQQQHHHEHHHHHIIFJJJFQ.','OOOONNNNMMSSSSVWWWWUNNOEbbbQQQQIHHHHHHHIIIJJJFJ.','EEEEEOCCMMMMMSSWWWWUNOObbbbQQQQQIHHHHHIIIIIQJBF.','HHHHEEECCCMMMMSVWWVTNOObbbQQQQQQQIIIIIIIIIIQQBF.','HQIHHEEECCCCMMNUWWUNNObbbbQQXXXXJJJIFIIIIIIQQBI.','HQQIHHHEECCCCMMNUUNNNObbbQQXXXXXXXJJJJJJJQIQQBH.','IQQIIIHEEECCCCCMNNNCEEbbQQXXXXXXXXXXXXJJJIIQQFF.','QIQIIIHHEEEECCCCCEEEHHQQQXXXXXYYYYXXXXXJJJJJQFF.','XIQQIIIHHHHEEEEEEHHHHIQQJJXXXXYYYYYYYYXXXXXXXFF.','XFQQIIIIFFFFFHHHFFFFJJJJJJXXXXYYYYYYYYYYYXXXXFB.','XFJJJFFJJJJFFJJJJJJJJJJJJXXYYYYYYYYYYYYYYYYXXJB.','XJXJJJJJJJJJJJJJJXJJJXXYYYYYYYYYYYYYYYYYYYYYYJB.','XJXXXXXXXXPPPPPKKKKKKKKKKKKKKKKKYYYYYYYacccccX..','XJPPPPPPPPPPPKKKKKKKKKKKKKKKKKKKKKKaaaaaaacccY..','PPccccPccccaaZZZZKKKKKKKKKKKKKKKKKaaaaaaaacccY..','PPccccaaaaaaaZZZZZZGGGGKKKKKKKKKKKaaaaaaaaaccY..','PPcccddddadddaZZZZZGGGGGGGGGGGGGGZZaaaaaaaaccY..','PcdcddddddddddZZZZZGGGGGGGGGGGGGGZZaaaaaaaaccY..','PcddddddddddddZZZZZGGGGGGDDDDDGGGLZZaaaaaaaccY..','XcdddddddddddddZZZZZLLLDDDDDDDDGGLLZZaaaaaaaaY..','JcdddddddddddddZZZZZRLLLDDDDDDDLLLLLZZaaaaaaac..','JcddddddddddddZZZZZRRRLLLDDDLLLLLLLLZZZaaaaaaa..','JcddddddddddddZZZZRRRRLLLLLLLLLLLLLLLZZZZaaaaa..','JcdddddddddddZRRRRRRRRLLLLLLLLLLLLLLLLZZZaaaZa..','JcdddddddddZRRRLRRRLRRLLLLLLLLLLLLLLRRRZZaaaZZ..','JcddddddZRRRRLLLRRRRRRRRLLLLLLLRRRRRRRRdZZZZZZ..','JZdddZZRRRRRLLLLRRRRRRRRRLLRRRRRRRRRRRdRZZZZZZ..','JGdZZRRRRRRLLLLRRRRRRRRRRRRRRRRRRRddddRLLGGGGK..','.PGRZRRRRLRRLLLRRRRRRRRRRRRRRRRRRRRRRddZPKP.....','..PDLRRRRRRRLLRRRRRRRRRRRRLLLRdddcd.............','....GDRRRRRLLRRLLLDDDDRRZPP.....................','.....PDLLLLDDDDLDDGP............................','.......DDGPPP...................................'];
const PROFBM2=['.......................................b........','................................................','................................................','................................................','................................................','................................................','.................................e.............b','.......b...............SVVVVVVVUSh.............E','......ei..............VVVVVVVVVVUii...........EC','fffVVfihSVVVWhhhihifVVVVVVVVVVVVfihhjiiiiifiiEE.','fffffhhfVVVWfhihiiihVVVVVVVVVVVVfihhiijjjjjiebE.','fffVhgSVVVWVfhihiiihfVVVVVVVVVUUeihiihiiiifVUeE.','ffffheSVVWjifhhhiiijhVUVVVVVUUUSeihiihiiiifWUeE.','VfffVSSVVVhjjjjijjjiVVUVVVVUUUUTUihiiiiiiifWUbb.','UffVVSSVVVVVhijijiifVVUVVVUUUUTTTiihhhhhihfWWOE.','UffVVSSSVVVWWhhhiiihVVUVVUUUUTTTSeihfWWWWWWWWUE.','fVfVVSMSVVVWfhihiiihVVUVUUUUTTTTTTeiihhhfffWWbH.','fVfUVSMSVVVWfhihihihfVUUUUUUTTTTTTTehiiiihheeQH.','UUUUUUSSVWWWfhhfWWhihfVUUTTTTTTTTTTSTUegigggQIH.','UUUUUUSSVWfffffffhiifVUSSTTTTTTTSSTTNNNNObbQQFX.','UUUUUSSVVVWffffhhihfWVSSSTTTTTSTTNNNNNOOOHHQQFX.','UUUUTSSVWWWffhhhihfWfVSSSNNNNNNNNNNNNNOEHHQQQFQ.','UUUUTSSTVWfhhhhhfWWWWUSSNNNONNNNNNNNOOOEHIQQQFQ.','UTUTTSSSVWWfffWWWWWWVSSNNOOOOOOOOCCEOOebHIQQJFF.','NTTTSSSSSUVVVWWWWWWWVSNNOOOOOEEEEEEEEOeHFIJJJFF.','OTTTSSSSSSSSSVVWWWWWUNNOOEEHHEEEEEEEHHHHFFJJJFF.','ONNNNSSSSSSSSSVWWWWWSNNOEEbbbHHHEEHHHHHFFFJJJFB.','ONNNNNNNMSSSSSVWWWWVSNOObbbQQQHHHEHHHHHIIFJJJFI.','OOOONNNNMMSSSSVWWWWUNNOEbbbQQQQIHHHHHHHIIIJJJBF.','EEEEEOCCMMMMMSSWWWWUNOObbbbQQQQQIHHHHHIIIIIQJBF.','HHHHEEECCCMMMMSVWWVTNOObbbQQQQQQQIIIIIIIIIIQQBF.','HIIHHEEECCCCMMNUWWUNNObbbbQQXXXXJJJIFIIIIIIQQBF.','HQQIHHHEECCCCMMNUUNNNObbbQQXXXXXXXJJJJJJJQIQQBH.','IIQIIIHEEECCCCCMNNNCEEbbQQXXXXXXXXXXXXJJJIIQQBF.','XFQIIIHHEEEECCCCCEEEHHQQQXXXXXYYYYXXXXXJJJJJQFF.','XFQQIIIHHHHEEEEEEHHHHIQQJJXXXXYYYYYYYYXXXXXXXFF.','XFQQIIIIFFFFFHHHFFFFJJJJJJXXXXYYYYYYYYYYYXXXXFB.','XFJJJFFJJJJFFJJJJJJJJJJJJXXYYYYYYYYYYYYYYYYXXJB.','XFXJJJJJJJJJJJJJJXJJJXXYYYYYYYYYYYYYYYYYYYYYYJB.','XJXXXXXXXXPPPPPKKKKKKKKKKKKKKKKKYYYYYYYacccccX..','XJPPPPPPPPPPPKKKKKKKKKKKKKKKKKKKKKKaaaaaaacccY..','PPccccPccccaaZZZZKKKKKKKKKKKKKKKKKaaaaaaaacccY..','PPccccaaaaaaaZZZZZZGGGGKKKKKKKKKKKaaaaaaaaaccY..','PPcccddddadddaZZZZZGGGGGGGGGGGGGGZZaaaaaaaaccY..','PPdcddddddddddZZZZZGGGGGGGGGGGGGGZZaaaaaaaaccY..','PcddddddddddddZZZZZGGGGGGDDDDDGGGLZZaaaaaaaccY..','XcdddddddddddddZZZZZLLLDDDDDDDDGGLLZZaaaaaaaaY..','JcdddddddddddddZZZZZRLLLDDDDDDDLLLLLZZaaaaaaac..','JcddddddddddddZZZZZRRRLLLDDDLLLLLLLLZZZaaaaaaa..','JcddddddddddddZZZZRRRRLLLLLLLLLLLLLLLZZZZaaaaa..','JcdddddddddddZRRRRRRRRLLLLLLLLLLLLLLLLZZZaaaZa..','JZdddddddddZRRRLRRRLRRLLLLLLLLLLLLLLRRRZZaaaZZ..','JPddddddZRRRRLLLRRRRRRRRLLLLLLLRRRRRRRRdZZZZZZ..','JPdddZZRRRRRLLLLRRRRRRRRRLLRRRRRRRRRRRdRZZZZZZ..','JGdZZRRRRRRLLLLRRRRRRRRRRRRRRRRRRRddddRLLGGGGK..','.PGRZRRRRLRRLLLRRRRRRRRRRRRRRRRRRRRRRddZPKP.....','..PDLRRRRRRRLLRRRRRRRRRRRRLLLRdddcd.............','....GDRRRRRLLRRLLLDDDDRRZPP.....................','.....PDLLLLDDDDLDDGP............................','.......DDGPPP...................................'];
const LOGO9=['ykkyyykky','ykkyyykky','ykkyyykky','ykkyyykky','ykkyyykky','yyyyyyyyy','yyyyyyyyy','ykyyyyyky','yykkkkkyy'];
const LOGOPAL={y:'#f7d31a',k:'#141414'};
const PROFPAL={E:'#b9c2ba',b:'#acb3ad',e:'#9cb1ad',g:'#9a9c8e',i:'#456880',j:'#1d2228',l:'#000003',k:'#080808',C:'#bdc7c6',H:'#b8beac',O:'#afbfc5',V:'#8cc0ec',U:'#9dbce2',S:'#a2c2e3',h:'#578fb4',A:'#e7f0e8',f:'#7ab1e5',W:'#76c1e3',T:'#a1bee2',M:'#b1cbcb',Q:'#b1baa3',I:'#b8bca8',N:'#b0c2cc',F:'#bcc2a6',X:'#b8b593',J:'#babc97',B:'#c0cdb6',Y:'#bcb27b',P:'#b3be7a',K:'#c1bd75',a:'#b7af64',c:'#adb177',Z:'#b7b661',G:'#bec263',d:'#acb15e',D:'#bec661',L:'#babd5a',R:'#b3bb58'};
const PROF=sprite(PROFBM,PROFPAL,60),PROF2=sprite(PROFBM2,PROFPAL,60);
/*DEALER*/const DEALERBM=['........................................','........................................','........................................','........................................','........................................','........................................','........................................','........................................','......................JK...KJ...........','......................GFIKIFG...........','.....................JBBABABBJ..........','.....................HADCBCDAH..........','.....................LKLLLLKKL..........','....................UUVVVVVVVVU.........','...................KHGGGGGGGGGHK........','..................IBAAAAAAAAAAABI.......','................RIGHHHHHHHHHHHHHGJ......','....................UHHNQHHLUUU.........','...................NUIGHQIGHPUUSK.......','...................QQUPQUVVVPKIHGK......','...................NQUVVHKIHGBAABL......','.................OPQUNIIGHBABECGHK......','..............OOPQQPHFAGHHFDEDCEIN......','...............PUSUUHAHIHIGBDCEBFK......','....RPQQSQQQQQQQQUKGFIHGHHHBECCFAH......','....QQSQQSSQQQQSPVIAGJIHHGHGCDDEBGL.....','....SSSSSSUUSSSSQVIBGGIIIGHGBEDDDBI.....','....QQSQUUPOQUUSQVIHVFGHHCHKGBECEAI.....','....UUSUPJJJJKPUPVIFHEKJIIHIHBFDFAHR....','...HKOUPJJJJJJJNQVIAACIGFCAFHBFDFAH.....','..KGGJVKJLKLLLKKUVIAFBHFBDFEHFCDFAH.....','..KHHKUKKLNPNLLKNVIHUFHHBEFBHGBEFAI.....','..KHHKQKLLLLLLLKNVIGICGHBFFAHHBFEAI.....','...HGJVUUUUUUUUUSVIABBGHBFEBGGBECDK.....','....PUQPPNLLPNUSPVIACCCHFCDECBEEBG......','....PQULJJJJJLNPSVIGLGAHGBEDEEDFAI......','....PSSNJJJJJJJNOVIGJGBGIAFDDDECFN......','....PSKJJJKJLKJJNVIABCEAHHACFFDAIV......','....RPKJJJJLPKJJLVIABCDDBHHFBBDILHN.....','....PSLJLKJUJLPLNVIGJFCEDBHIHHIHBGN.....','....PSLKKKKKKKKKLVIGLGBEDFBCGGDABGL..M..','....PSUUUUUUUUUUSVIACCDDDDFEBBDFBFK.....','....OSQQUUNNUPUSPVIABCDDDDDDDEDDCCK.....','....OQSSLJJJJJKPSVIGIFCEDDDDDDDDDBI.....','....PULJJJJJJJJJOVIHUGBEDDDDDDDDEAI.....','....RPJJJKLLKJJJJVIAFCDDDDDDDDDDFAI.....','...MSNLKJJLLLPLLLVIADDDDDDDDDDDDFAH.....','...MQNJKKJKKKKLKKVIAFDDDDDDDDDDDFAH.....','..M.QPNNNNNNNNNNNVIAFEEEEDDEEDEEFBH.....','....PUUUUUUUUUUUSVIAECCCBCCCCCCCDAG.....','....OQPPPPPPPPPPPVIBFFFFFFFFFFFFFFGN....','....OOOOOOOOOOOOOSONNNNLKLNNNNNNLKK.....','.................PSUUUUR.UQUUUUUS.......','................OPSQQQQO.OPSQQQPO.......','................OPSSSSQO.RPSSQSQO.......','................OPSSSSQO.RPSSSSQO.......','................OPSQSSQO.RPSSSSQO.......','................OPSSQSQO.OPSSSSQO.......','.................QSSSSQO.OPSSSSQO.......','.................QSQSSQO.OPSSSSQO.......','.................PSSSSP...OQSSSPN.......','................QQSSSQO...OQSSQQQQ......','..............QPQSSQSQQOOOPQSSSSSPQ.....','...........QQSSSSSSSSSSQPPQSSSSSSSSQQQ..'];const DEALERBM2=['........................................','........................................','........................................','........................................','........................................','........................................','........................................','........................................','......................JK...KJ...........','......................GFIKIFG...........','.....................JBBABABBJ..........','.....................HADCBCDAH..........','.....................LKLLLLKKL..........','....................UUVVVVVVVVU.........','...................KHGGGGGGGGGHK........','..................IBAAAAAAAAAAABI.......','................RIGHHHHHHHHHHHHHGJ......','....................UHIPQHHNUUU.........','...................NSJHIPIHIPUUSK.......','...................QSUPPUVVVPKIHGK......','...................NQUVVHKIHGBAABL......','.................OPQUNIIGHBABECGHK......','..............OOPQQPHFAGHHFDEDCEIN......','...............PUSUUHAHIHIGBDCEBFK......','....RPQQSQQQQQQQQUKGFIHGHHHBECCFAH......','....QQSQQSSQQQQSPVIAGJIHHGHGCDDEBGL.....','....SSSSSSSUSSSSQVIBGGIIIGHGBEDDDBI.....','....QQSQUUPOQUUSQVIHVFGHHCHKGBECEAI.....','....UUSUPJJJJKPUPVIFHEKJIIHIHBFDFAHR....','...HKOUPJJJJJJJNQVIAACIGFCAFHBFDFAH.....','..KGGJVKJLKLLLKKUVIAFBHFBDFEHFCDFAH.....','..KHHKUKKLNPNLLKNVIHUFHHBEFBHGBEFAI.....','..KHHKQKLLLLLLLKNVIGICGHBFFAHHBFEAI.....','...HGJVUUUUUUUUUSVIABBGHBFEBGGBECDK.....','....PUQPPLLLPNUSPVIACCCHFCDECBEEBG......','....PQULKJJJJLNPSVIGLGAHGBEDEEDFAI......','....PSSNJJJJJJJNOVIGJGBGIAFDDDECFN......','....PSKJJJKJLKJJNVIABCEAHHACFFDAIV......','....RPKJJKJLPKJJLVIABCDDBHHFBBDILHN.....','....PSLJLKKUJLPLNVIGJFCEDBHIHHIHBGN.....','....PSLKKKKKKKKKLVIGLGBEDFBCGGDABGL..M..','....PSUUUUUUUUUUSVIACCDDDDFEBBDFBFK.....','....OSQQUUNNUPUSPVIABCDDDDDDDEDDCCK.....','....OQSSLJJJJJKPSVIGIFCEDDDDDDDDDBI.....','....PULJJJJJJJJJOVIHUGBEDDDDDDDDEAI.....','....RPJJJKLLKJJJJVIAFCDDDDDDDDDDFAI.....','...MSNLKJJLLLPLLLVIADDDDDDDDDDDDFAH.....','...MQNJKKJKKKKLKKVIAFDDDDDDDDDDDFAH.....','..M.QPNNNNNNNNNNNVIAFEEEEDDEEDEEFBH.....','....PUUUUUUUUUUUSVIAECCCBCCCCCCCDAG.....','....OQPPPPPPPPPPPVIBFFFFFFFFFFFFFFGN....','....OOOOOOOOOOOOOSONNNNLKLNNNNNNLKK.....','.................PSUUUUR.UQUUUUUS.......','................OPSQQQQO.OPSQQQPO.......','................OPSSSSQO.RPSSQSQO.......','................OPSSSSQO.RPSSSSQO.......','................OPSQSSQO.RPSSSSQO.......','................OPSSQSQO.OPSSSSQO.......','.................QSSSSQO.OPSSSSQO.......','.................QSQSSQO.OPSSSSQO.......','.................PSSSSP...OQSSSPN.......','................QQSSSQO...OQSSQQQQ......','..............QPQSSQSQQOOOPQSSSSSPQ.....','...........QQSSSSSSSSSSQPPQSSSSSSSSQQQ..'];const DEALERPAL={J:'#5a6845',K:'#4d5244',G:'#c9c9c9',F:'#dddddd',I:'#797c6e',B:'#e5e5e4',A:'#f0f0f0',H:'#a3a3a0',D:'#dfdfdf',C:'#e1e1e1',L:'#40433f',U:'#1e2127',V:'#13161c',R:'#1f2831',N:'#2e353a',Q:'#24262b',P:'#26292d',S:'#21252a',O:'#252c33',E:'#dedfde',M:'#294654'};const DEALER=sprite(DEALERBM,DEALERPAL,[40,64]),DEALER2=sprite(DEALERBM2,DEALERPAL,[40,64]);/*/DEALER*/
/*EYES*/const EYES=[{pal:{C:'#1d1b1a',F:'#141213',G:'#0e0f0f',D:'#161816',E:'#161615',A:'#96936f',B:'#433d34',H:'#060609',I:'#000105'},L:['...C..FF....','....GGFFGF..','...FGDGCCGE.','..FDEECAAGG.','.G.GDFCABGG.','B..FDDHBEFGC','A..EDEEGFCIB','B..EDDDCCEGB','B...FDDGGGF.','BB...FFBB.E.','BB.....A..F.','BBB......G..','BBBB...CF...','BBBB.C......'],R:['...C.EECC..','...EHGGHF..','..FGFGEBIG.','..FGEGAACH.','.GFEFGAAGGF','.CGEEHCBGEC','BFGEEEFGDF.','B.EEEDDCEF.','B..FEDEHD..','BE.DEEGAA..','.F...HBA...','.FF........','..FE.......','....FFF....']},{pal:{F:'#0c191d',G:'#111212',H:'#0b0a0e',E:'#1a1918',D:'#1e292a',C:'#515951',B:'#7cae7e',A:'#cee1c2',I:'#030305',J:'#000000'},L:['...F..FG....','....HGGGHG..','...EGEGEDHF.','..DCHEEBCHG.','.GADHGDBCHHC','CCADGEHDGGHD','B.ADGEEGGEIC','..ACHEEEEGGD','..ABIGEGIEC.','..AABGIDCBD.','...AAABBABI.','...AAAAABE..','..BB.BBCE...','..BBCD......'],R:['...D.FFFD..','...FHGGHG..','..FHGHECIG.','..EGEGBBEH.','.DDGEGCBHEF','.CCHEHGEHDC','CBCHEEGGGDA','CBCIEEEEJCA','CBAGGEGEDBA','.CABEHGBAA.','.DAAABBAAA.','..DBAAAAA..','...GDCBB...','......H....']},{pal:{D:'#162228',G:'#0d0e12',F:'#131313',H:'#040a1b',I:'#020303',E:'#211717',B:'#abb1a2',C:'#534f4a',A:'#f9f1ca',J:'#000000'},L:['...DD..GF....','....HGFGGIH..','...FEFFDBCI..','..FCEEGCABIG.','.IBCIEFFCDGGC','.CACGEFFIGFIC','BAACGEFFFFEIC','.AACIEFFFEFIC','.AABGFEEFGEC.','..AABIGGEFBD.','..AAABCCBBBI.','...AAAAAABE..','...AAAAABD...','.....CCDI....'],R:['...D.HHHD..','...HGGGFG..','..HGFIBAGG.','..EFEICBGG.','.DCGFFFIGEF','.CCGFGFFGEC','CCCGEFFFFDA','CBCIEFEEJCA','CBAGGEFFDBA','.CABEGFBBA.','.DAAABBBAA.','..DBAAAAA..','...GCCBB...','......H....']},{pal:{E:'#111f2a',H:'#0c0e1d',I:'#0e0f0e',C:'#58514c',A:'#d2e15a',J:'#000001',G:'#0a0c50',D:'#522930',F:'#080c88',B:'#978a79'},L:['...E..HH....','....IIIIEH..','...HIHHCAJH.','..HGIDCAADI.','.EFHICAAACJC','CBFHIHIACHJB','BBFHIIIBEHJC','BBFEIHIDHIID','BBFFIIHIIHE.','CBCFGIIDCGE.','CBBFFFGBFGI.','BCBBFFFFGI..','BBCBBCGEI...','BBBC.D......'],R:['...E.HHEE..','...HIIDII..','..HIHHADJI.','..HIDAAAEI.','.HHICAACIII','.GHIHIAIIHE','CGEIHICIIHC','CGGIHIEHIGC','CGFIIHIHDFC','.GFGHIIBCF.','.HFFFGFFFB.','..HFFFFFB..','...IHGGB...','......I....']}];/*/EYES*/
/*FACES*/const FACES=[{name:'Kagami',pal:{L:'#000000',D:'#ff7b70',F:'#ff796e',J:'#f87569',B:'#ff8075',C:'#ff7f74',G:'#fe776a',I:'#fd7164',K:'#d76f73',E:'#ff7970',A:'#f9948b'},L:{ox:0,oy:0,rows:['....','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','....']},R:{ox:0,oy:0,rows:['....','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','.LL.','....']},M:{ox:0,oy:10,rows:['.DF.','JBCG','GBCI','KEEA']}},{name:'Radcat',pal:{E:'#564d44',I:'#231f20',H:'#2e2b2a',G:'#3b3734',F:'#4a413b',C:'#978766',D:'#6c604d',J:'#110f10',B:'#cfb66d'},L:{ox:0,oy:0,rows:['E..........','IIHHGG.....','HIIH..F....','HHHG..HE...','GIGGHHIIE..','EIGEHIIIEE.','CIHHHHIFCID','CHIHHIJCCJ.','EFHIIJDBDI.','H.HEDCBBEI.','FHCBBBBBFH.','EIDBBCDEIF.','FHIIHIIHGE.','...........']},R:{ox:0,oy:0,rows:['...........','.....EGHGHH','....DG.IJJI','....GG.IIIH','..EGJIIHHJE','.EHJJIJFHJD','.HDHJIIHJIC','EICDJJJJJDB','DICBIJJJIDC','.ICBCGII.HH','.ICBBBBDJHD','EIHEDCBDIE.','.FGIIGGIHF.','...........']},bL:{ox:0,oy:-9,rows:['..FHHG..CDD','.....FGE...','.......EFF.','...........']},bR:{ox:0,oy:-9,rows:['EED..EGGE.','DDCFFFE...','..EF......','..........']},M:{ox:0,oy:11,rows:['.........','.........','.EEEEEE..','.EEEEE...']}},{name:'Shipu',pal:{D:'#2a2625',L:'#000000',F:'#030303',E:'#0d0c0b',B:'#736e6b',C:'#4b4644',G:'#030202',J:'#020001',H:'#010101',I:'#000101',K:'#000002',A:'#e2dad4'},L:{ox:0,oy:0,rows:['..DLLLFFEDBBC','..DLLLGFFFEEL','..DLLGFFFFJLH','..DJLHGGHFFHH','..CJGJHJHIHIL','..CJGGHHHHHHK','..BEFFHJJLLHL','...DJFFHLLGLD','....DLLGLLLEB','.....CELFED..','......BBC....','.............','.............','.............']},R:{ox:0,oy:0,rows:['AA.DJHGD.....','A..ELHLFD....','..CFLLLLLDCCD','..BJLLHGFLIFI','..BJLHJGGFFFE','..BLIHKGGFFFF','..BLIJKKHHFFF','..BFLGHHHLGLE','...CGJFGHLLFD','....EEGJIGDC.','......CCDC...','.............','.............','.............']},M:{ox:0,oy:15,rows:['...............','...............','........CC.....','......BELDC....','DC..CDEECDECC.B','DEGEFDC...DFDBC','.BCEB.....DDB..','...EC....CEB...','...DD....ED....','...DFC..ED.....','....DEDEDB.....','.....BCC.......']}}];/*/FACES*/
/*MOSSIMG*/const MOSSIMG={w:72,h:52,face:{x:1,y:7,w:68,h:32},pal:{I:'#605d25',E:'#8d8426',F:'#7b8025',G:'#64791b',D:'#8e9a17',C:'#afa740',B:'#c3ba6a',J:'#545c22',L:'#41561a',M:'#3b4d18',K:'#465f16',Q:'#392713',S:'#263710',P:'#3a4019',O:'#453719',H:'#71612f',T:'#26260e',U:'#132109',R:'#2c4113',N:'#5f391f'},rows:['............................IEEE........................................','.......................FGDDDI..ECBBB....................................','....................FGJLGIMGEFCCBCCCBCD.................................','.................KKGKJQMIFLFDDCCDDDDCDDCCB..............................','...............GLSPSSCIOECCCDDDDGGDDDDDDDCBB............................','.............KKLSSFHIECEDDDCCFFDDGFDDFDDDDCDCC..........................','............JKTPPSHFEDDFGDFGGGGDDEDFGFDGDDDDDCBB........................','..........KKMSU.EFGGGFFGKMKRRMJKGGDFMGGGFDDFFDDDC.......................','.........KRSST.JGFGKLLKLMMLSSSMLKKKFFKKKGDFFDDDDCCB.....................','.........JT..PJGKKKMMRRRRSMSUSPGGPLDDKGLFGKDDGEDDCCCB...................','.........JO.HFGGMRLMKRPMRPJTSPPKFFGFDFFEDGGGBDDCCCDDCBB.................','.....JJ.LMHMIFKKRUSLKKRLFJDGOHJPMEDDDDEGDFI..DDDFDDFDDCCB.B.............','.....HJ.SPGJLKMSSMJLFLKRGDDCHCGFFIDD..DKFDEFDDDGGFGKGDDDC...............','....JJ...RLKMMRSUJGJGKRGKDDDCDDDDGGFFDDGGFDGFDF.EIKJGDDDDDB.............','...HHJ..JJPMSRRT.RJGKKKGGGDFGDFGGGKGKKGGGGDDGFF.GGHFEGDFDCBC............','...HH..IJLRSU...JKGJGJKGGKMFLRKKKKKEMRKGKLGKMGGGGIGFDDDEDDDC............','...CH..IIPRST.J.MKKKKFKMRGLGLUMMGJFDLKFKKRJJGKFGJFDGDF.FGFDDCCB.........','...EEFHNOLRS.SKGMKKKJGGRLKFGKLRMGLFDJFGMRRGFKJCDGFFGD..IFEFDDDC.........','....GJPQ.MMLMRLKMSGGKKKLFJMKKMJLKRKGRFDJMMMGKK.FGGKGDDFGKEDDDDCB........','......MT..LKKLJKRLGGMLLMGGMKRM.JILGKSKGMJSTMMGGGGGMMFDGMJDFEDDDCCB......','.....LMT..PMMLLKMMJKMRMMKGTKRPIGLGDGLLGGGPTSLGDJKJSOGFFIGGGFFFDDDB......','....HI..LLJMRMGGGMSRRSRRLGSJJRLGLKDLRMGGKQTSPKKPGIQMJFILLJOFDFFDDDB.....','..HIHIH.JKGMJJGGKMSSSS.TSR.SRPMKRRKRKGGGRMLOSKKLINGGIGISGDGKIGGFDCCB....','...HJJJIJKKJKMLKRRSSSM.RSSRUULLKUSLKGKGJTKGJRRPOOKFFFFIPDDGOMFEFDDDC....','..HELMKJJGKKGRSSSR....RLSSSUSMKKR.RKKRLMPKGJLLP.RGG.JFGGDGJMGGEFDFDC....','...EHJLLPKKMMKRTS.....RRST..LLKKR.MKLLPPRMGJKJIPSJJ.FIGFFOPGFGFDDKDC....','....HMLMLMRSSSSS....P.MRUP..GMRMS.ULRSP.TMKGDDIPPPOJ.LTFFOPMFFGDEGDB....','..HHOPJGKRMSSS..RT..RRMRRRMLKURL...RKKJ.PMLMGDGMLOTOOTIEEOSJIEEFIDCBB.B.','..HFIIJGLMMMRMPLSR...PLKSSRMLSSSPMLSKGMJKKRMGGIJON..OJFIQOOJIEEFICBCCFC.','.HIIIGJPMJMRULMJLRSS..RKR..MSR..PMRRKKSPRSTRKJLGIJ..OOONTQONFGDEEEHGGG..','HHJPMKMRRMKMLMK.MMSMM.RLS..PU...S..SSPPTUPPRLIJDGPO..HTOQQOOLKFEFOTLFB..','HHRLJLRRSMMMFKRSSRSRKRUSUPI.TT....Q.O...RMPPKPKFGIN....T.QQTOEDFFHFEC...','.IPSMMRSSSRMMGRSRSULR.URSPM.......N..OO.JKGJPRGIIEI.....TTOOHEC....B....','.GGMPLKSSSRSLLRUS.SKSSRSS.ML.........OOPJGDJTJJIJ..Q....QQ.IH...........','.JGKLJKRMLSUTRRS..SMRUSSPMPJ.....J..JO.MMKDJLFLOJOQ....TQQ.OI...........','..KLSULRSRMU.RSS..SSSLRPSPLG.....JOOJO.USGGKIFDF...........Q............','..MLSRMLRRSUSS...MR..JGMJIFJ.....NINO..LJLJOSGDFNQ...QT...QQ..H.........','...RSSMRSSSUSRT.MLL.LMKMLKIFJ.....OO...PNOOOPGEH.QQ.......QO..O.........','....SUSRST....MSPJKMSSRSSOOIOOO......TQQOIQ.LJHH.......Q...Q............','.....SS.SRM...RS.LLKTMSPJQEITIN.....TTQQ.NONO......Q...Q..QO....O.......','......MT.RMS.PLMRSRRT..PIIEDJIO...Q....Q...ON.O...........H...H.........','.......S..SS..RRSSST....OJJFFOON..QOQ..Q..N.OHI.H.....N........NJ.......','........SS.SS..SST.......PPMGGOO...QQ...OOO..HN......OO...H...NI........','.........RSS.......P.O...OTOOII.Q.N..........HHI......O....N............','..........RS.MJ.......O.QTOO..O.O.O.Q........HEH........I..O............','.............PLKP.....OOOQOT......I.NN.O.....EHHHII......QQ.............','..............MLPP.....OONMQ..Q...NOO..Q....O.QNEI......................','...............PLP....JIHII.............................................','......................HHIFKI.....................H......................','........................IGGII.................JG.H......................','........................HIF....................J........................','........................................................................']};/*/MOSSIMG*/
/*CHARS*/const CHARS={feint:{name:'Winnsboro Feint',legs:false,w:16,h:24,bw:38,bh:48,pal:{T:'#252638',R:'#6c6d6b',S:'#1e3a1e',A:'#f8f8f8',Q:'#a8a69c',P:'#bec5b4',U:'#101137',N:'#d9e0c6',B:'#e4f3db',V:'#000000',M:'#d2e7c0',O:'#c8ddbb',E:'#dcedce',D:'#d5f0c3',I:'#d4efc2',L:'#d3ebc2',C:'#d5f0c4',G:'#d4f0c3',F:'#d9eebd',H:'#d4efc3',J:'#d3efc3',K:'#d4efc1'},down:['................','................','.............S..','.....SS.....SRS.','....SRQSSSSSTARS','...STRARNPQRUTTS','..SMRURTNNNOUTRS','..SMPUTRLNNIPQLS','..SMMQQLDDDIIIIS','..SMMIDDIDLMOIIS','..SMMIMPPPPOOIJS','..SMMIDDOPPODIDS','..SMMHDDDOHIIIS.','..SMMHDDDOMDDIS.','..SMMHDDDMMDDIS.','..SMMHDDDDODDDS.','..SMMDDDHOOMDOS.','..SMMHDOQQQQQPS.','..SQMQQPAAABNBS.','..SQQQEPQQQPNAS.','..SQQQBBAAAAAAS.','...SQQAAAEPQQS..','....SRQRSSSSS...','.....SSS........'],up:['................','................','.............S..','.....SS.....SIS.','....SIISSSSSHDDS','...SIDDIIIHIDDHS','..SIHDDIIGDIDDCS','..SHDDDDIGIIDDCS','..SGDDDDDDDDDDDS','..SDDDDDDDDDDDCS','..SDDDDDDDDDDDJS','..SDDDDDDDDDDDDS','..SIDDDDDDDDDDS.','..SDDDDDDDDDDDS.','..SCDDDDDIDDDDS.','..SDDDDDDDIDDDS.','..SDDDDDDDDDDDS.','..SHDDDDDDDDDDS.','..SHDDDDDDDDDDS.','..SGDDDDDDDDDDS.','..SCDDDDDDDDDDS.','...SDDDDDDIDDS..','....SHGDSSSSS...','.....SSS........'],right:['................','................','.............S..','.....SS.....SRS.','....SRQSSSSSTARS','...STRARNPQRUTTS','..SMRURTNNNOUTRS','..SMPUTRLNNIPQLS','..SMMQQLDDDIIIIS','..SMMIDDIDLMOIIS','..SMMIMPPPPOOIJS','..SMMIDDOPPODIDS','..SMMHDDDOHIIIS.','..SMMHDDDOMDDIS.','..SMMHDDDMMDDIS.','..SMMHDDDDODDDS.','..SMMDDDHOOMDOS.','..SMMHDOQQQQQPS.','..SQMQQPAAABNBS.','..SQQQEPQQQPNAS.','..SQQQBBAAAAAAS.','...SQQAAAEPQQS..','....SRQRSSSSS...','.....SSS........'],big:['...............................TT.....','..............T..............TTRRS....','.............................TAAAR....','............TQPQT...........UTAAAQU...','...........URAAANU..........UUQAARU...','..........UURAAABV....QQQQQSUUTRRVT...','.........RRUTAAAQVQPNPNPQQQSUVUUUUT...','.......MOPRUURBETVRNNNNNENORUUVURTR...','.......MMERUUUUUUVQDNNNNNNIPUUUUTT....','.......MMLRUUUUUUUODNENEENIIRUUUTP....','.......MMMPUUUTRURDINNNNNNDIIPRRQC....','.......MMMEQUUUUTOCGNFFCDDIIDIIIIH....','.......MMMMEQTURODDDGDDDDIIIIIIIII....','.......MMMMMPQODCIDDDDDDDIIIIIIIIJ....','.......MMMMMDDDDDDIDIDDDDIIIIIDIIC....','.......MMMMMDDDIDIIDDDDIIIIIIGKIIH....','.......MMMMMDIDDDDIIIDMOOOOPQPPIIH....','.......MMMMMDDDOOPPPPPQQPPPQPOMIIL....','.......LMMMMDDDPQPPPOPPOOIDDIDIIIH....','.......MMMMMDDDIOHDJOOPPPQOIIDDIIC....','.......MMMMMDCDDDDDPPQPPPPDIDDIIIJ....','.......LMMMMDDDDDDDOLPOLDDDDDDIIID....','........MMMMDDDDDDDDIMOGIIIIDDIDIH....','........MMMMDDDDDDDDDOPMDIIIIIIIIC....','........MMMMDCDDCDCDDOPODIDDDDIIID....','........MMMMDCDDCDCDDMPODDDDIIIIIH....','........MMMMDDDDDDDDDCMODDDDDIIIIH....','........MMMMCDDDDDDDDDM.DDDDDDIIIC....','........MMMMDDDDDDDDDDD.MDDDCDIIIH....','........MMMMDDCDDDDDIDD.MDDDDIDDDC....','........MMMMCDDDDDDDDDCOOCDDDDIIDC....','........MMMMCDCDDDDDDDDLKCDDDIIIIC....','........MMMMCDDDDDDDDCDMOPODDDIGDC....','........MMMMCCDDDDDOQQQPPOMGOQRRTT....','........MMMMCDDCDDDPMDOQRRTRRQPNPV....','........MMMMDDDDOQRRTRRQPNAAAAAAPV....','........MMMORRTTRQQNAAAAAAAAAAAAPU....','........RMMPRNAAAAAAAAAAAAABNPQNP.....','........RROPRAAAAAAAAANPQQQRRRQBP.....','........QBRQRAAABPPQRRRRRQPNBAAAP.....','........QQBRRAPRRRRQQPBAAAAAAAAAQ.....','........QRQRRANPNBAAAAAAAAAAAAAAQ.....','........RNQRRAAAAAAAAAAAAAAAAAAAQ.....','........QRARRAAAAAAAAAAAAAAAABPQT.....','........MPRRRAAAAAAAAAAANQRRTVV.......','.........MORRAAAAAAPQRTSV.............','..........MPRBPQRTVV..................','...........PUVV.......................']},kagami1:{name:'Peach Kagami',legs:true,w:16,h:24,bw:36,bh:48,pal:{I:'#e2d374',B:'#e4e231',E:'#e6e42c',D:'#e8e42c',G:'#e5e22c',F:'#e5e42b',J:'#dbd63f',N:'#d1c94a',O:'#cdc850',K:'#d2cf46',V:'#000000',R:'#b77843',S:'#fa360a',P:'#cbc74d',T:'#5a3421',M:'#e4c66d',L:'#ffc179',Q:'#daad65',C:'#e8e72b',U:'#020000',H:'#fed5de',A:'#efe88e'},down:['................','................','IE............JF','IBBR..JJRN..REBF','..GRPKGSSSGKRN..','...KJBGSSSEEG...','..OJBEENRSSNJK..','..KEJEJNJSSSQG..','..JEJJMMMQSRBB..','.JBEKPMLLQQMBBB.','..JJNRQLLQRMBF..','..OMMRQLLQRMMJ..','...JMQLLLLQMJ...','...JKM.RR.MKJ...','....K.TQQT.J....','......HHHH......','......HHHH......','......QHHQ......','.....TLHHLT.....','.......HH.......','.....HHHHHH.....','.......HH.......','.......TT.......','.......TT.......'],up:['................','................','IE............JF','IBBR..JJRN..REBF','..GRPKGSSSGKRN..','...KJBGSSSEEG...','..OJBEENRSSNJK..','..KEJEJNJSSSQG..','..JEJJOOOSSSBB..','.JBEKOOOOSSRBBB.','..JJNOOOOSSRBF..','..OMNOOOOSSRMJ..','...JNOOOOSSRJ...','...JJK.OO.RJJ...','....K.IIIQ.J....','......HHHH......','......HHHH......','......QHHQ......','.....TLHHLT.....','.......HH.......','.....HHHHHH.....','.......HH.......','.......TT.......','.......TT.......'],right:['..KG........BD..','...BK.KKNK.JB...','....RPJRSJPP....','....OKESSJGB....','....KEENSSBJ....','....BJBJJSSJ....','...OGJJONSSJB...','...JGJNOMRQBG...','...JBNPOLQMBB...','....JNPOLRMB....','....MNPOLRMJ....','....KNPOLLMK....','....KJ.OR.KK....','.....J.MR.J.....','......RHHR......','......RHHR......','......RHHR......','......THHT......','......RHHR......','......H..H......','......HHHH......','................','.......TT.......','.......TU.......'],big:['IIBE...........................EDDE.','..EEEG.......................FFJN...','.IBJJFF.......OOOOOOO.......FFEJKE..','.IBBBBJJV...OKJJJJRSJKO...VJEEEBBF..','....FBJPVPOOOJDGSSSSSNJJBPVJJJJ.....','.....EBPTPOKJJGRSSSSSREEBNTJKO......','........OOOBDEJSSSSSSREEEGJ.........','.......OKKKBEEJSSSSSSREEEFEE........','......ONEEEEEEEGSSSSSRGGEEBEK.......','......ONEEEEEEEBNSSSSSSSEBIBK.......','.....OKEENBEEEEBOOIBSSSSSSEIBK......','.....KBEENBEEJJBOOIBSSSSSSSMBG......','....PKEEENBEEJOKMOJKSSSSSSSMBEJ.....','...OOKEEENBEJKMMLOKMQSSSSSJJBEBJ....','...JKKEEDNBJKOMLLOMLLRSSRREEJBEE....','...BBJEEDNJKOMMLLMLLLQSQLNEEKBEB....','..KJBBBEDNOOQQLLLLLLLQQLLNEEJBEJK...','..GJJBKEDNOMRTLLLLLLLTRLLNEEEEFEB...','.O...JIBENOMRTLLLLLLLTRLLNEBEE...O..','.....OILENLLRTLLLLLLLTRLLNELBE......','.....OILENLLRTLLLLLLLTRLLNELBK......','......ILENLLRTLLLLLLLTRLLNELB.......','......IOENLLQQLLLLLLLQQLLNEOK.......','......ONENQLLLLLLQLLLLLLQNENI.......','......ONENQQMLLLLQLLLLMQQNDNI.......','......ONENBJ.....L.....JBNCNO.......','......O.ENB....TTLTT....BNC.O.......','........FN...UTHLLLHTU...NC.........','........C...URHHHHHHHRV...C.........','........O...URHHHHHHHRV...O.........','.......O....URHHHHHHHRV....O........','............URHHHHHHHRV.............','............URHHHHHHHRV.............','............UTHHHHHHHTV.............','............UTAHHHHHATV.............','...........UURAHHHHHARUV............','...........UTLLHHHHHLLTV............','...........VVRHHHHHHHRVV............','................HHH.................','...........HHHH.....HHHH............','...........HHHHHHHHHHHHH............','.............HHHHHHHHH..............','....................................','....................................','...............UQVQU................','...............UQVQU................','...............URVRU................','...............VVVVV................']},kagami2:{name:'Cocoa Kagami',legs:true,w:16,h:24,bw:36,bh:48,pal:{J:'#d2ce4e',K:'#ddda3a',E:'#e6e42c',H:'#e6e42a',F:'#e5e42c',G:'#e5e22c',I:'#e0d67f',M:'#cec950',L:'#d5d13f',B:'#e5e331',V:'#000000',N:'#c7ba62',C:'#e8e72c',U:'#493a2e',D:'#e8e42c',A:'#eee595',O:'#9ba992',R:'#a2805a',S:'#916b50',P:'#889e88',Q:'#859c88',T:'#828775'},down:['................','................','JF............KH','IKKS..LLLL..REKF','..GRMLBEEEGLRM..','...JKBBKBEEEG...','..MKBKBJJKEKIL..','..LEJAAIAAMAAG..','..LKAJIANRAJBB..','.KKFJRSRSSSNBKK.','..LLMUSSSSUNLG..','..JNNUSSSSUNNK..','...LNSSSSSSNL...','...LLN....NLL...','....L..SS..L....','.......OO.......','.......QP.......','......SOOT......','.....VTOOTV.....','....QTTQQTTQ....','....OPQQQQPO....','.......TT.......','.......UU.......','.......UU.......'],up:['................','................','JF............KH','IKKS..LLLL..REKF','..GRMLBEEEGLRM..','...JKBBKBEEEG...','..MKBKBJJKEKIL..','..LEJAAIAAMAAG..','..LKAJIAIAAIBB..','.KKFJMIAIAAIBKK.','..LLJMIAIAAILG..','..JNJMIAIAAINK..','...LMMIAIAAIL...','...LLM....ILL...','....L..AM..L....','.......OO.......','.......QP.......','......SOOT......','.....VTOOTV.....','....QTTQQTTQ....','....OPQQQQPO....','.......TT.......','.......UU.......','.......UU.......'],right:['..JF........BE..','...BL.JLLJ.LB...','....RNLEDBLM....','....JJEKEEGB....','....LEELBEBK....','....KKALAJIA....','...MBAIAIOIJK...','...LBAMARONKG...','...KBJMASSNBB...','....MJMASUNL....','....NJMASUNM....','....JMMASSNJ....','....LL....LJ....','.....K....K.....','................','.......PP.......','.......OO.......','......UOOU......','......UQQU......','.....PPQQPP.....','.......QQQ......','.......UU.......','.......UU.......','.......UU.......'],big:['JJKE...........................EHHH.','..EFFF.......................GEKJ...','.IKKKFF.......MMMMMMM.......FFELJH..','.JKBBBLLV...MLKKKKKKKLM...VLHEEBKG..','....GBKMVNMMMLEEECCCEBKKBNVLKLK.....','.....GBMUMMJLKEEEEEEEEEEBLULJM......','........JJJKEEBKEEEEEEEEEGL.........','.......MJJJBEEKLBBEEEEEEEEEE........','......MMEEEEEEEBMIBEEEEEEEBEJ.......','......MMEEEEEEEBMIBEHEEEEBIBJ.......','.....MJDEJBEAAEBMMJAIKEEEBAIBL......','.....LBEEJBAAAABMMAAAOMEKAAAKG......','....MLEEEAKKAAIJAMIAORNABIAAKEK.....','...MMLEBAAAKIIIAAAJOROAAABIKBEBK....','...KLLEBAAAJJMNOAANSSRAAIKEEKBEE....','...KKKEEEAJJNNRSANSSSSOORMEEJKEK....','..LLBBKEEMMNSSSSSSSSSSSSRMEEKBEKL...','..FLLKJEEMMRUUSSSSSSSUUSRMEEEEFHG...','.M...KJGEMMRUUSSSSSSSUUSRMEGGE...M..','.....MNSEMRSUUSSSSSSSUUSRMESLE......','.....MNSEMRSUUSSSSSSSUUSRMESLL......','......NSEMRSUUSSSSSSSUUSRMESL.......','......JNFMRSSSSSSSSSSSSSRMENJ.......','......MMEMRSSSSSSRSSSSSSRJHMJ.......','......MMEMNRRSSSSRSSSSRRNJCMJ.......','......MJEMBL.....S.....LBJCJJ.......','......M.EMB......S......BMC.M.......','........EM......SSS......MC.........','........C........S........C.........','........M.......PAP.......M.........','.......M.......QQPQQ.......M........','...............QQQQQ................','...............OQQQO................','.............UTOOQOOTU..............','............VUROOOOORUV.............','...........VVUTOOOOOTUVV............','...........VUTQQQQQQQTUV............','..........QUVUQQQQQQQUVUQ...........','........QQQOOQQQQQQQQQOOQQQ.........','.......Q.QQPPQQQQQQQQQPPQQ.Q........','..........OPQQ.QQQQQ.QQPO...........','................QQQ.................','...............VOUOV................','...............VTVTV................','...............VTVTV................','...............VOVAV................','...............VQVQV................','...............VVVVV................']},radcat:{name:'Radcat',legs:true,w:16,h:24,bw:33,bh:48,pal:{A:'#f4fcd1',C:'#e7f1b9',B:'#eaf9aa',E:'#e3f691',G:'#d5ec7e',N:'#b1a080',O:'#9f8365',K:'#cbd485',F:'#daf283',U:'#3f271d',M:'#b8b98c',H:'#d2e47c',T:'#573626',Q:'#74553d',I:'#c6e461',V:'#000000',P:'#8e5f46',S:'#6d3c29',R:'#764631',L:'#d0bea8',D:'#e3e5be',J:'#e2d7ce'},down:['................','.BBB............','.KQNBAAAAAAABBH.','.OUOEBBBCAAAEIUO','.KNIGFEFEECCBIQO','.BHIGGGNGMHBBFIG','.BIIHOPPPOOKBEE.','CEGIMSSTORSOCFE.','BGIDMPPSNPONJEEC','FIIJJJMLLLNJJBEC','FIILTQNJJJOUOBEC','BIILOUTLJNUTOKFB','.HIDNPQJJOPQJHF.','..HHJJJJJJJJKHB.','..NIDJJLLJJEHF..','..QOIKDDDDHHOP..','..QRQONIIIORSP..','.OQPSQQPRSTTRQ..','.OSPRPNLMOQRRR..','.OSTPMLLLLLPTR..','.OPQSJJJJJNQPO..','.EHIIJJJJJLIIG..','.EIIIMMLLLLIIF..','...KML....LL....'],up:['................','..........BC....','.CA.AAAAACBEB...','CECAACCBBBBBB...','FECBBBBEEEBBB...','GBBBBBBEEEEBB...','.BEEEEEEEFEEBC..','.BEFGGGFFEEEBB..','CEEGIIIHGFEEBB..','CEGIIIIIHGFEEB..','CEGIIIIIINKGFE..','.EHIIOONOPONHB..','.KIOONNNRRPPN...','..NPNPPQSRQPP...','..POOSSTSSSSPO..','..QORTTUUTSSRO..','.PPPTUTROQTSSP..','.PPSTTPMMNOSSR..','.ORUUPNMMNNORRP.','.OSTTONNNNNOSSR.','.PTTSPNNNNORRSSN','CPTRQNJLLJOPRRRM','.KRPOMMMLLMMMN..','..NNNNNNMMNNNM..'],right:['................','................','................','................','.............BC.','.........CBBEIE.','......ACBBBEEGG.','......BEEEEEEEE.','.....CBFFFEEEEB.','.....BEFFFFEEBBB','.....EGIHGGEEEBB','....CHIIIIHGFEEB','....OIIIIIIIHGEC','...PPNOOPPOIIHE.','..PSPPRRRRSPPKC.','.NQTRSRPRSSSPN..','.PTSSSSSRSSSRO..','.PNPSSSSRSTTSO..','POMLPSSSRSUTT...','PONMMPSSRPTUSO..','PRPNNORTSNOUSO..','PQRNJNPSSHKSQK..','.NOMJMOOOF.NND..','....LLLLL.......'],big:['...ACCC..........................','..CBEEEEC...................AC...','.CEGNOKFE....AAAAAAAA.....CCBEE..','.CGOUUUMEBAAAAAAAAAAAAAACBEEEFKE.','.CHTUUUOEEBCCCCCAAAAAAAACBFGHQUOE','.CHQUUUMFEBBBBBBBBAAAAAACEGIIUUUF','..FIQTOGGFEEEEEEEBBBAAAACBIIIUVUK','...HHIIIGGGFFFFFFFEEBBCCCBEIIOUTE','...EHIIIGGGGGGIONGFGKEBCCBBFIIIIB','...CGIIHGGGGGGINHFFOQHBBBBBEHIIH.','..AEGIIHGGGHIIINIIHHHGFBBBEEEHIE.','..CEGIIIHGIOPQSQRQPPPPPNEBEEEBE..','.AEEFIIIIOSSSRSSRRRPQRRPLCEEFEB..','.CEEFIIIDNRSTTTTRNOSRTRPLAEFFEEC.','.BEFGIIBJLPRRSTTRLLSRSRRLACFFFEC.','CEFGIIGAJQOONRSSRLJRRPOLLMAEFEEC.','CFIIIIDJJLOQOOOPRNJQRLNONJABFFEC.','CGIIIIJJJJJJLONLNJJLNOLJJJJDGFBC.','CIIIIIJJJMMLLJJJJJJJJJLJLJJDHFBC.','CHIIIIJJQUUQOJJJJJJJJMPUUTJDHFEC.','DGIIIIDOUPTTUPJJJJJJLUQUTUNDHFEB.','.EIIIIDNQNUTUQOJJJJLTVUUQQQDHFEB.','.CHIIIEJMOTUUOQJJJJNQUVUOOJKHGEB.','.CGIIIIJJPQOIPOJJJJMQOQQQJJHHHEC.','..EHIIIDJNUPQUMJJJJMUTQUMJLIHGE..','...FHIIEJJJJLLJJJJJJJJJLJJIIHEC..','....HHIIJJJJJJJJJJJJJJJJJKHHGE...','....KHHIEJJJJJJNNNMJJJJJKHHHFC...','....ONHIIDJJJJJLLLJJJJJKHHHGD....','....OQNHIIEJJJJJJJJJJDHHHHKO.....','....PRQPIIIHDDDDDDEKHIIHHORQ.....','...NQRQRQOIIIIIIIHHHHHINQTRQP....','...OQRPSTRPPOOIIIIIINPRTTTRRP....','...ORQPRTSQRQPPQQQQRSTTTTSRRP....','...ORRPPRSQQRRPPPRSSTTTTTSRRP....','...PPPQPPSRRRRPOOPPRSSSSSRRQP....','...PTRPPPRTROMLLLLMNPRSRSRRRP....','..EPSUTQPQPMLLLLLLLLLNPQQRSRP....','..HQSTTTRPNLLLLLLLLLLLNPRTTSP....','.BKRSTTTTQNLLLLLLLLLLMOSTUUTR....','..MRSSSTUUPAAAJJJJJJAOSSTRQQP....','..NNIIINOOMAAAAAAAAAAJOIIIIHH....','..BFGHHIIIMJJJJJJJJJJJIIIIIGG....','..CGHHHHIIMJJLLLLLLLMMIIIIIGF....','..CGIIIIIINMNNMMLLLJJJIIIIIGE....','...EHIIIIIMLLLLLLMMMMMMIIIHE.....','.....KIIIMLLLLLLLLLLLLLLLL.......','......LLLML......................']},shipu:{name:'Shīpu',legs:true,w:16,h:24,bw:29,bh:48,pal:{H:'#3a3b3c',F:'#464549',E:'#484c4a',I:'#293637',C:'#5c5b54',D:'#54524e',L:'#172527',J:'#2a2e2f',K:'#252627',G:'#414144',B:'#7c7c78',M:'#1b1c1c',A:'#ded3cc',R:'#070909',S:'#020303',O:'#141516',N:'#111a1a',Q:'#0c1010',P:'#111212',T:'#010001',V:'#000000',U:'#000001'},down:['..EDD...I..DDE..','.EDDCDGFFFHDEEE.','.EJKHGFFFFFGJJE.','.DJHHDEFCGECHHE.','.HDGEFGDDEGFHH..','..MKGJBCIBDHGI..','..GFHBCBBADDHEH.','..FHFAAAAABBH...','...KGBAABAACG...','....MMCAABDJ....','......PBBJN.....','.....PMBCEO.....','.....ROBCEQ.....','....PRPJJORQO...','....OSRSRRSQ....','....MROSRRRO....','....MROTRQRO....','....CBPRQRGB....','.....AKPRODA....','.....CMPROOB....','......OP.OP.....','......PR.QP.....','.....ORS.SP.....','.....MRN.PQK....'],up:['...CD..HHIECD...','..DDHGFFFFGGEC..','..CHIFFFEEFIIC..','..EHGFFEEEGGIE..','...KFGFEEEFGK...','...IHFEEEEEHJ...','...JKGGFEGGJK...','....LJJIHJJK....','.....LLKKKL.....','......MOPM......','.....SOOOPS.....','....NRTTTTRO....','....LRSTTSRM....','....MQRKHQQ.....','.....KOFHMK.....','.....BMKKMB.....','.....CRSSSC.....','......MQRM......','......MQRM......','......ORRO......','......MRSM......','......MRRM......','......PR.P......','.....OM..MN.....'],right:['......ECG.......','.....DEGCGH.....','....JEKKHGFH....','....HEJHGEFEH...','...IGGEEGDGFH...','...HGIKJGIBFK...','...KIHGHGBBB....','...KKJHHFABA....','....KJKHCAAA....','.....MKKBAA.....','.......PMM......','......QMOM......','......MMMM......','......RROM......','.....H.TRM......','....HFMSOM......','....JHPRMAH.....','.....MRROJ......','.......SPQ......','.......SMQ......','.......SM.......','.......RO.......','.......RRM......','.......OQRK.....'],big:['...HFEEI.............HFEEI...','..FCCCDCE..LIJKHHL..ECCCDCH..','.ECDCCCCCEHGFFFFFGFJFBCCCCCH.','ICCGHGCCCCHGFFFFFFFGFHDHHHEC.','GCGJKJHCHGFFFFFFFFFFFFKJJJHC.','EDJL.MKJEFFFFFFFFFFFFFFK.JKCG','DDJ.LEKGDFFFFFFDDGFEFDCKHKHCH','GCHKMEKDDDDEHFECCGFDGCCEHHGC.','KDCGGDJCCGDFHFCDCGGEHEEGJDCJ.','.KDDFHHFHFHJBGFEEDEHEGFHGKL..','..LMMMGFHJHBACGGIBAGHIFHD....','...MJJGHJKBBCBMJJAADKHFFJI...','..JGFIFGHBBKACMHAABCBBIGHGFI.','.HFEDFGJBBARSBAAAABRHBKGGCDEI','.GCCCIFFBAACKAAAAAAOCBHGIJJJ.','..JJKJFGDAAAAAAAAAAAABHEI....','....MJHHFAAAAAAAAAAAABHDI....','.....KHHECAAAAABBAAAAEHH.....','......KKMOBAAAAAAAABHJHJ.....','.......OOMKKKBAABDKMNK.......','...........NQCAACPNN.........','.........OPPOABCAMPOM........','.........POOJAHHBJPOO........','.........ROMJABEAEMOP........','.........RMMMACJAEMOR........','......OPRSQPOAHOAOMQSPOP.....','......NQPTQPOBMRBOPOSQQQ.....','......NOPSRPOMRSHPRRSQPN.....','......QOPTRQRSRRQQVSVQMQ.....','.......MSTQSVTSRSRTSTROQ.....','.......MOVPPRTSPVRPPUOMQ.....','.......MOTQOQTSQVQMQTOM......','.......OMTROQTSQTRMRVMM......','.......OMTRMRTRPSSMQTOM......','.......GBCKMRQRRPRMMCCE......','.......DAAKQRRRPRRQMBAC......','.......CAABROPSRRORCAAB......','.......DAFGOMPRRQMOFHAC......','........BEOOMPSQRMOOJBH......','........BJOOMPRQRMOOLB.......','..........POMRN.SMOO.........','..........QOMR..SMOP.........','..........OQMR..SMPP.........','..........QQQS..SRRP.........','..........PRST..VSQO.........','.........QQRTS..STQQQ........','.......LHMRSQM..MPTSMGI......','.......NNPQN......NPOON......']}};/*/CHARS*/
/*WORLDMAP*/const WORLDMAP={w:256,h:120,data:'AAAAAAAAAAAAAAAAD/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/////wf9gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/APwAYAH7wAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAB5+fcAAAAB4AAH8AAAAAAAA4gAAAAAAAAAAAAAAAAAAB/DvAAAAACAAAecAAAAAAAAeQAAAAAAAAAAAAAAAAnAf/YeAAAAA4AAAeAAAAD+AAAe+AAAAAAAAAAAAAAAP/AP/Af4AAABgAAAAAAAB34AH+AGAAAAAAAAAAAAAAf/AAP8AAYAAAOAAAAAAAAdgAHwAB/nAAAAAAAAAAAABH/wAs+AAwAADgAAAAAAADYB/wAAAjzA/wAAAAAH4AAP9Fh7AHADgAAaAAAAAeAAPgb5AAAAAP/A/gAAADgf9//+Nm//DgHAAB4AAAA+HAAA/mAAAAAAAAAB+/uBwAAMAD/99dnngMAB8AAAAMAD7n/HcAAAAAAAAAAGBnjgAAAABIZA+CJhgAYCMAABAAcfgABwAAAAAAAAAAAH/3AAAAAAAADDx8GAeA/YAAIHAuQAAMAAAAAAAAAAAARw+AAAAAAAB4P3AEBAB3AABA8D4AAAAAAAAAAAAAAAGABwAAAAAAAMA/+AIYAAgAA4PAAAAAAAAAAAAAAAAGAcAIA0AAAAABgCOQAdAAAAAEAkAAAAAAAAAAAAAAAGQeAA8P/wAAAAIAEJgAMAAAAARDfgAAAAAAAAAAAADtn+AAAe4A8AAAAwAw9AAAAAADA8YwAAAAAAAAAAAAAxcsAAAAcAAQAAAA8BACAAAAAAWB5PAAAAAAAAAAAAAMAMwAAAPgAAwAAAAPMAMAAAAAA4H8wAAAAAAAAAAAADAAjAAABwAABAAAAAFAAOAAAAADQf+AAAAAAAAAAAAAfACYAAAAAAADAAAAASAAIAAAAAM3AAAAAAAAAAAAAAACALAAAAAAAAGAAAAAwADgAAAAAzgAAAAAAAAAAAAAAAQA4AAAAAAAAEAAAAAAP3AAAAAH4AAAAAAAAAAAAAAABAAAAAAAAAAAcAAAAAB4mAAAAAPAAAAAAAAAAAAAAAAEAAAAAAAAAABwAAAAAYn4AAAAA4AAAJwAAAAAAAAAAAgAAAAAAAAAACAAAAAAHwAAAAAAQDgD/AAAAAAAAAAAEAAAAAAAAAAAIAAAAAB8AAAAAABB+AJ8AAAAAAAAAABgAAAAAAAAAABgAAAAAZAAAAAAH49XBgMAAAAAAAAAA8AAAAAAAAAAACAAAAADgAAAAAAQOD0X/wAAAAAAAACGBgAAAAAAAAAAYAAAAAcAAAAAABAgH74AAAAAAAAAA+wGAAAAAAAAAAAgAAAAGAAAAAAAEGAGuAAAAAAAAAAHqA4AAAAAAAAAADAAAAAYAAAAAAAcz8R0IAAAAAAAAAe0PAAAAAAAAAAAEAAAAAgAAAAAAAfwQGfwAAAAAAAAAxXkAAAAAAAAAAAOAAAAMAAAAAAABIBAABAAAAAAAAADH9wAAAAAAAAAAAMAAABgAAAAAAAYAHDgIAAAAAAAAAEHYAAAAAAAAAAAAcAAAIAAAAAAABAADL2gAAAAAAAAAYMAAAAAAAAAAAAB4AF+gAAAAAAAEAADgsAcAAAAAAABggAAAAAAAAAAAADgBuWAAAAAAAAgAAAAYAoAAAAAAACAAAAAAAAAAAAAAPAEAcAAAAAAAMAAAABwD2AAAAAAAYAAAAAAAAAAAAAAeAQBwAAAAAABgAAAADgH8EAAAAACAAAAAAAAAAAAAAA0CADAAAAAAAEAAAAAKAfvwAAAAAIAAAAAAAAAAAAAABoIAAAAAAAAAgAAAAAUADhwACAAHAAAAAAAAAAAAAAAAQw4AAAAAAAGAAAAABwAGDQB8APgAAAAAAAAAAAAAAABBGgAAAAAAAYAAAAACgAwHAEQBYAAAAAAAAAAAAAAAAGH2AAAAAAAAgAAAAALACAEAggIAAAAAAAAAAAAAAAAAOEQAAAAAAACAAAAAAUA4AQMCAQAAAAAAAAAAAAAAAAAHx4AAAAAAAIAAAAABIMAAjgPAgAAAAAAAAAAAAAAAAAAwwAAAAAABAAAAAADhgACIAEBAAAAAAAAAAAAAAAAAAB6AAAAAAACAAAAAAH4AAMgAcEAAAAAAAAAAAAAAAAAAA4HwAAAAAIAAAAAAM4AASAB4QAAAAAAAAAAAAAAAAAABw1+AAAAAYAAAAAA+gABIAGeAAAAAAAAAAAAAAAAAAAH+wMAAAAAgAAAAAAEAADgAYwAAAAAAAAAAAAAAAAAAAPgAYAAAADAAAAAAAQAAMABwAAAAAAAAAAAAAAAAAAAABAA8AAAAGA8AAAABAAAAADgDAAAAAAAAAAAAAAAAAAAEAAMAAAAP8eAAAAIAAAAB/A2AAAAAAAAAAAAAAAAAAAQAAQAAAAAAIAAADAAAAAC0GQAAAAAAAAAAAAAAAAAACAAAgAAAAAAgAAAIAAAAAFxhCAAAAAAAAAAAAAAAAAAYAACAAAAAACAAADAAAAAALEH4AAAAAAAAAAAAAAAAADAAAPAAAAAAIAAAQAAAAAAkQfDwAAAAAAAAAAAAAAAAMAAADAAAAAAgAADAAAAAABJC4P8AAAAAAAAAAAAAAAAwAAADgAAAABAAAIAAAAAACT7gMOAAAAAAAAAAAAAAACAAAABwAAAACAABgAAAAAAGAPAcMAAAAAAAAAAAAAAAIAAAABAAAAAMAAEAAAAAAAIAgAIIAAAAAAAAAAAAAAAYAAAAEAAAAAQAAQAAAAAAAAAAB3gAAAAAAAAAAAAAAAgAAAAwAAAABAABgAAAAAAAAAAB3gAAAAAAAAAAAAAACAAAAEAAAAAEAACAAAAAAAAAAEDOAAAAAAAAAAAAAAAEAAAAQAAAAAQAAIMAAAAAAAAA/MAAAAAAAAAAAAAAAAQAAACAAAAADAAAhwAAAAAAAAaIwAAAAAAAAAAAAAAAAgAAAIAAAAAIAACFAAAAAAAADxjgAAAAAAAAAAAAAAABgAAAgAAAAAgAAZkAAAAAAAAYD5AAAAAAAAAAAAAAAABgAAGAAAAACAADEQAAAAAAADADEAAAAAAAAAAAAAAAACAAAQAAAAAMAAwSAAAAAAAAYAAYAAAAAAAAAAAAAAAAIAABAAAAAAQACBIAAAAAAAOAAAwAAAAAAAAAAAAAAAAgAAIAAAAABgAMJAAAAAAADAAABgAAAAAAAAAAAAAAACAAHgAAAAACAAQkAAAAAAAIAAACAAAAAAAAAAAAAAAAIAAwAAAAAAIAHDwAAAAAAAgAAAGAAAAAAAAAAAAAAABAAEAAAAAAAgAQCAAAAAAACAAAAIAAAAAAAAAAAAAAAEAAQAAAAAADABAAAAAAAAAIAAAAgAAAAAAAAAAAAAAAQADAAAAAAAEAIAAAAAAAAAQAAACAAAAAAAAAAAAAAABAAIAAAAAAAIBAAAAAAAAABAAAAIAAAAAAAAAAAAAAAEADAAAAAAAAgMAAAAAAAAAGB+AAgAAAAAAAAAAAAAAAQAIAAAAAAACfAAAAAAAAAARYNAEAAAAAAAAAAAAAAABAPAAAAAAAAH4AAAAAAAAAB/AeAgADAAAAAAAAAAAAAIAQAAAAAAAAAAAAAAAAAAAAAAcCAAGAAAAAAAAAAAABgBAAAAAAAAAAAAAAAAAAAAAAASYAAeAAAAAAAAAAAAGB8AAAAAAAAAAAAAAAAAAAAAAA+AABYAAAAAAAAAAAAQMAAAAAAAAAAAAAAAAAAAAAAAAAAAPAAAAAAAAAAAABhwAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAGHAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAYwAAAAAAAAAAAAAAAAAAAAAAAAAADYAAAAAAAAAAAABCAAAAAAAAAAAAAAAAAAAAAAAAAAAaAAAAAAAAAAAAAMMAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAgwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAA+AAAIB4cADgAAAAAAAAAAAAAAAAADwAAAAAAAAAAAA+OYAf/8ef/7/AAAAAAAAAAAAAAAAB+AAAAAAAAAAAe+AGcHAAAAAAAH+AAAAAAAAAAAAAAAHEAAAAAAAD///eAAA3gAAAAAAAAHgAAAAAAAAAAAAAD2IAAAAAP/xgQAAAACwAAAAAAAAAB/AAAAAAAAAA+fxP4wAAAAHAAAAAAAAAOAAAAAAAAAAAMAAAAAD///juB/wGAAAAAwAAAAAAAAAAAAAAAAAAAAHAAAAAPwAAD/AAAPgAAAA8AAAAAAAAAAAAAAAAAAAAAgAAAH/gAAAAAAAfAAAAD8AAAAAAAAAAAAAAAAAAAAAGAAAAMAAAAAAAADwAA+DwAAAAAAAAAAAAAAAAAAAAAAOAAAAf4AAAAAAAPgAeMPwAAAAAAAAAAAAAAAAAAAAAHgAAAD/AAAAAAAAB/B/v+AAAAAAAAAAAAAAAAAAAAAAYAAAABAAAAAAAAAAD/BAAAAAAAAAAAAAAAAAAAAAAAAeAP///+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/',pins:{EUROPE:[136,24],NORTH_AMERICA:[57,30],SOUTH_AMERICA:[85,68],ASIA:[193,31],AFRICA:[142,55],OCEANIA:[222,77],ANTARCTICA:[135,116]}};/*/WORLDMAP*/
const CHAR_IDS=Object.keys(CHARS);let PL={},PLW=16,PLH=24,PLEGS=true;
function charId(id){return CHARS[id]?id:(save&&CHARS[save.char]?save.char:CHAR_IDS[0]);}
function flipX(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const g=c.getContext('2d');g.translate(src.width,0);g.scale(-1,1);g.drawImage(src,0,0);return c;}
function legFrame(src,side){/* one leg lifted: the bottom three rows on one side move up a pixel */
  const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const g=c.getContext('2d');const h=src.height,w=src.width,half=w>>1;
  g.drawImage(src,0,0);g.clearRect(side<0?0:half,h-3,half,3);g.drawImage(src,side<0?0:half,h-3,half,3,side<0?0:half,h-4,half,3);return c;}
function buildPlayer(id){const ch=CHARS[charId(id)];PLW=ch.w;PLH=ch.h;PLEGS=ch.legs;
  const mk=rows=>sprite(rows,ch.pal,[ch.w,ch.h]);PL={down:mk(ch.down),up:mk(ch.up),right:mk(ch.right)};PL.left=flipX(PL.right);
  for(const d of ['down','up','right','left'])PL[d+'W']=ch.legs?[legFrame(PL[d],-1),legFrame(PL[d],1)]:[PL[d],PL[d]];}
function charPortrait(id){const ch=CHARS[charId(id)];return sprite(ch.big,ch.pal,[ch.bw,ch.bh]);}
buildPlayer(CHAR_IDS[0]);

/* ---------------- tiles: ids, themes, factories ---------------- */
const G0=0,TREE=1,ROCK=2,WATER=3,PATH=4,WET=5,BLDG=6,ROAD=7,G2=8,MTN=9,ICE=10,TREE2=11,TREE3=12;
const WALK=[1,0,0,0,1,1,0,1,1,0,1,0,0];
const OVER=[0,1,1,0,0,0,1,0,0,1,0,1,1];   // drawn over ground
// Beetleboy tiers: Tin, Bronze, Mithril, Adamantine, Diamond
const TIER={TIN:{cheese:1,col:'#5cb85c',hi:'#a8e6a0',w:.58},BRONZE:{cheese:2,col:'#d9a441',hi:'#f5dd9a',w:.25},MITHRIL:{cheese:3,col:'#4fc3d9',hi:'#c6f3fb',w:.11},ADAMANTINE:{cheese:5,col:'#d23c3c',hi:'#ffb0b0',w:.045},DIAMOND:{cheese:8,col:'#8fd3ff',hi:'#ffffff',w:.015}};
const B=(name,tier,col,hi)=>({name,tier,col:col||TIER[tier].col,hi:hi||TIER[tier].hi});
const GREEN=B('GREEN BEETLE','TIN'),SCARAB=B('GOLDEN SCARAB','DIAMOND','#e6b422','#fff2a8');
const MONARCH=B('MONARCH','MITHRIL','#f08020','#2a2a2a'),BUMBLEBEE=B('BUMBLEBEE','MITHRIL','#f0c020','#2a2a2a'),PILLBUG=B('PILLBUG','MITHRIL','#7a7a86','#c8c8d0'),SUNSET=B('SUNSET MOTH','ADAMANTINE','#2fa060','#f0a030');
const SKULLBUG=B('SKULLBUG','MITHRIL','#2a2a2a','#f0f0f0'),WIDOW=B('BLACK WIDOW','DIAMOND','#1a1a1a','#e03030'),XMAS=B('CHRISTMAS BEETLE','MITHRIL','#c8a020','#fff0a0'),CANDY=B('CANDYCANE TIGER MOTH','DIAMOND','#e03040','#ffffff');
// Beetleboy's beetles as beetle.wiki lists them: name, tier, how they come; the wiki's renders are the cards
const BEETLE_IMG={'GREEN BEETLE':'green','LADYBUG':'ladybug','PURPLE BEETLE':'purple','STRIPED CUCUMBER BEETLE':'cucumber','POND BEETLE':'pond','MONARCH':'monarch','BUMBLEBEE':'bumblebee','GOLIATH BEETLE':'goliath','BOMBARDIER BEETLE':'bombardier','STAG BEETLE':'stag','GOLDEN SCARAB':'gold',
  'SKULLBUG':'skull','BLACK WIDOW':'widow','CHRISTMAS BEETLE':'christmas','CANDYCANE TIGER MOTH':'candycane_tiger','GIRAFFE WEEVIL':'giraffe_weevil','SABERTOOTH LONGHORN BEETLE':'sabertooth_longhorn','PILLBUG':'pillbug','IMPERIAL TORTOISE BEETLE':'imperial','GOLDEN TIGER BEETLE':'golden_tiger','BLUE LONGICORN BEETLE':'blue_longicorn','SUNSET MOTH':'sunset_moth','MARS RHINO BEETLE':'mars_rhino'};
const BEETLE_BOOK=[['GREEN BEETLE','TIN','drop'],['LADYBUG','BRONZE','drop'],['PURPLE BEETLE','BRONZE','drop'],['STRIPED CUCUMBER BEETLE','BRONZE','drop'],['POND BEETLE','MITHRIL','drop'],['MONARCH','MITHRIL','drop'],['BUMBLEBEE','MITHRIL','drop'],['GOLIATH BEETLE','ADAMANTINE','drop'],['BOMBARDIER BEETLE','ADAMANTINE','drop'],['STAG BEETLE','ADAMANTINE','drop'],['GOLDEN SCARAB','DIAMOND','drop'],
  ['SKULLBUG','MITHRIL','halloween'],['BLACK WIDOW','DIAMOND','halloween'],['CHRISTMAS BEETLE','MITHRIL','christmas'],['CANDYCANE TIGER MOTH','DIAMOND','christmas'],
  ['GIRAFFE WEEVIL','MITHRIL','craft'],['SABERTOOTH LONGHORN BEETLE','ADAMANTINE','craft'],['PILLBUG','MITHRIL','craft'],['IMPERIAL TORTOISE BEETLE','MITHRIL','craft'],['GOLDEN TIGER BEETLE','MITHRIL','craft'],['BLUE LONGICORN BEETLE','MITHRIL','craft'],['SUNSET MOTH','ADAMANTINE','craft'],['MARS RHINO BEETLE','DIAMOND','craft'],
  ['ANTARCTIC MIDGE','MITHRIL','moss'],['STOWAWAY GREEN BEETLE','TIN','moss']];
const HOLIDAY=()=>{const m=new Date().getMonth();return m===9?[SKULLBUG,WIDOW]:m===11?[XMAS,CANDY]:[];};
const THEMES={
 EUROPE:{blurb:'TEMPERATE WOODS, BOGS, RIVERS AND AN OLD TOWN',border:TREE,
  ground:['#78c55a','#5aa843','#9fe07c'],ground2:['#a9c96a','#8db052','#c6dd8f'],tree:'broad',treeCol:['#2e5d1f','#4f9a2d','#7fcf4a','#5b3a1e'],tree2:'pine',tree2Col:['#1f4a2a','#2f6b3a','#4e9a55','#5b3a1e'],
  water:['#6fb0f0','#bfe0ff','#4a8fdc'],path:['#cfc3a0','#b5a884','#e4dcc2'],wet:['#8aa35c','#5f7a3a','#6fa6d8'],rock:['#6e6e78','#a0a0a8','#d0d0d6'],bldg:{wall:'#f0e2c8',roof:'#b5533c',win:'#7fb2e5',door:'#5b3a1e'},road:['#9a9488','#b3ada2','#6f6a60'],mtn:['#7a8290','#a8b0bc','#ffffff'],
  town:{x:23,y:17,w:11,h:9,dens:.6},beetles:[GREEN,B('LADYBUG','BRONZE','#e04848','#ffd0d0'),B('POND BEETLE','MITHRIL'),BUMBLEBEE,PILLBUG,B('STAG BEETLE','ADAMANTINE','#6b3a1e','#c98e64'),SCARAB],
  layout(u,v,n1,n2,n3){const rx=0.62+0.06*Math.sin(v*9);if(Math.abs(u-rx)<.035)return WATER;if(n1<.16)return WATER;if(n1<.24&&v<.45)return WET;
    if(v<.22&&n2>.55)return TREE2;if(n2>.68)return TREE;if(n1>.9||n3<.07)return ROCK;if(Math.abs(n3-.5)<.016)return PATH;if(n2<.3&&n1>.55)return G2;return G0;}},
 NORTH_AMERICA:{blurb:'ROCKIES, GREAT LAKES, PRAIRIE, DESERT AND A GRID CITY',border:TREE,
  ground:['#6db85a','#4f9a45','#93d67c'],ground2:['#d8c46a','#bfa94e','#eedb92'],tree:'broad',treeCol:['#2a5a1f','#4a8f2d','#77c44a','#5b3a1e'],tree2:'pine',tree2Col:['#1c4028','#2c6238','#4a8f52','#4a2e16'],tree3:'cactus',tree3Col:['#3f7a3e','#5aa050','#8ad07a','#3f7a3e'],
  water:['#4f9be0','#a9d4ff','#2e6fbd'],path:['#c9b98f','#ad9d73','#e2d6b4'],wet:['#7f9a5a','#586f3a','#5f9ad0'],rock:['#7a6e66','#a89a90','#d6ccc4'],bldg:{wall:'#a85a3c',roof:'#4a4a52','win':'#9fd6ff',door:'#2a2a2a'},road:['#4a4a52','#6a6a72','#f0e68c'],mtn:['#6f7a8a','#9aa6b6','#ffffff'],
  town:{x:14,y:19,w:12,h:8,dens:.7},beetles:[GREEN,B('STRIPED CUCUMBER BEETLE','BRONZE','#f0d040','#2a2a2a'),B('LADYBUG','BRONZE','#e04848','#ffd0d0'),MONARCH,B('BOMBARDIER BEETLE','ADAMANTINE','#3a3a8a','#e07a30'),SCARAB],
  layout(u,v,n1,n2,n3){if(u<.26&&n2>.38)return MTN;if(u<.3&&v<.7&&n2>.22)return TREE2;if(u<.3&&v>=.7){if(n2>.7)return TREE3;if(n1>.9)return ROCK;return G2;}
    if(v<.38&&u>.38&&u<.68&&n1<.42)return WATER;if(Math.abs(v-.66)<.02)return ROAD;if(u>.3&&u<.6&&n1>.45&&v<.62)return G2;if(u>.6&&n2>.55)return TREE;if(n1<.1)return WATER;if(n1>.92)return ROCK;if(n1<.2&&u>.6)return WET;return G0;}},
 SOUTH_AMERICA:{blurb:'THE ANDES, THE AMAZON AND ITS FLOODPLAIN, PAMPAS, A COASTAL CITY',border:TREE,
  ground:['#4f9a3a','#3a7a2a','#6fbf55'],ground2:['#b8c977','#9cb05a','#d5e2a0'],tree:'broad',treeCol:['#1e4a18','#2f7a26','#55b040','#4a2e16'],tree2:'palm',tree2Col:['#2a6a22','#3f9a30','#7fd050','#8a6a3a'],
  water:['#7a9a4a','#b7cf7a','#5a7a30'],path:['#c9a26a','#a8834e','#e0c495'],wet:['#6f8a3a','#4a6a28','#8fae5a'],rock:['#6a6a6a','#9a9a9a','#cfcfcf'],bldg:{wall:'#e8c070','roof':'#c0442a','win':'#7fb2e5',door:'#5b3a1e'},road:['#8a8a80','#a5a59a','#5e5e56'],mtn:['#6a6f7a','#9aa0aa','#ffffff'],
  town:{x:26,y:3,w:8,h:7,dens:.75},beetles:[GREEN,B('PURPLE BEETLE','BRONZE','#8a3fbf','#d9a8ff'),B('BLUE LONGICORN BEETLE','MITHRIL','#2f6fd0','#a8d0ff'),B('IMPERIAL TORTOISE BEETLE','MITHRIL','#e0a020','#fff0a0'),B('SABERTOOTH LONGHORN BEETLE','ADAMANTINE','#5a3a1e','#c98e64'),SCARAB],
  layout(u,v,n1,n2,n3){if(u>.94)return WATER;if(u<.13&&n2>.3)return MTN;if(u<.2&&n2>.62)return ROCK;const ry=.42+.07*Math.sin(u*7+1);if(Math.abs(v-ry)<.04)return WATER;
    if(Math.abs(u-(.5+.1*Math.sin(v*8)))<.02&&v<ry)return WATER;if(Math.abs(v-ry)<.09&&n1<.5)return WET;if(v>.78){if(n2>.86)return TREE;return G2;}
    if(v<.74&&n2>.42)return n3>.5?TREE:TREE2;if(n1>.93)return ROCK;return G0;}},
 ASIA:{blurb:'HIMALAYAN PEAKS, RICE TERRACES, BAMBOO GROVES AND A MEGACITY',border:MTN,
  ground:['#8fc25a','#6fa343','#b5df7c'],ground2:['#e6eef6','#c8d6e6','#ffffff'],tree:'bamboo',treeCol:['#4a8a2a','#5a9a3a','#a8d860','#7a9a3a'],tree2:'broad',tree2Col:['#2e5d1f','#4f9a2d','#7fcf4a','#5b3a1e'],
  water:['#5fa3e0','#b0d8ff','#3a7fc0'],path:['#c8b48a','#a6906a','#e4d6b4'],wet:['#7fb35a','#5a8a3a','#9fd0ff'],rock:['#6e6e78','#a0a0a8','#d0d0d6'],bldg:{wall:'#c9ccd6',roof:'#b03030',win:'#ffe08a',door:'#2a2a2a'},road:['#5a5a62','#7a7a82','#f0e68c'],mtn:['#6a7080','#98a2b2','#ffffff'],
  town:{x:22,y:18,w:13,h:9,dens:.8},beetles:[GREEN,B('LADYBUG','BRONZE','#e04848','#ffd0d0'),B('GOLDEN TIGER BEETLE','MITHRIL','#c8a020','#fff0a0'),B('MARS RHINO BEETLE','DIAMOND','#7a2a2a','#ff9a9a'),SCARAB],
  layout(u,v,n1,n2,n3,x,y){if(v<.2&&n2>.3)return MTN;if(v<.26&&n2>.12)return G2;if(Math.abs(u-(.55+.08*Math.sin(v*6)))<.03&&v>.2)return WATER;
    if(v>.4&&v<.7&&u<.6){if(Math.abs(u-(.55+.08*Math.sin(v*6)))<.07)return WET;return (x%3!==0&&y%3!==0)?WET:PATH;}
    if(n2>.7&&v>.26)return TREE;if(v>.7&&n2>.55&&u<.6)return TREE2;if(n1>.92)return ROCK;if(n1<.1)return WATER;return G0;}},
 AFRICA:{blurb:'SAHARA DUNES, AN OASIS, SAVANNA, THE RIFT LAKE AND RAINFOREST',border:TREE,
  ground:['#d8c36a','#b9a24c','#efe0a0'],ground2:['#efd79a','#d9bd78','#fff1c8'],tree:'acacia',treeCol:['#3f6a22','#5a8f30','#8ab850','#5b3a1e'],tree2:'palm',tree2Col:['#2a6a22','#3f9a30','#7fd050','#8a6a3a'],
  water:['#4f9be0','#a9d4ff','#2e6fbd'],path:['#c9a26a','#a8834e','#e0c495'],wet:['#8aa35c','#5f7a3a','#6fa6d8'],rock:['#a07a4a','#c9a06a','#ead7a8'],bldg:{wall:'#d9a466',roof:'#8a5a2a',win:'#7fb2e5',door:'#4a2e16'},road:['#a08a6a','#b8a488','#7a6a50'],mtn:['#8a7a66','#b8a890','#ffffff'],
  town:{x:3,y:14,w:8,h:7,dens:.6},beetles:[GREEN,B('PURPLE BEETLE','BRONZE','#8a3fbf','#d9a8ff'),B('GIRAFFE WEEVIL','MITHRIL','#c03020','#2a2a2a'),SUNSET,B('GOLIATH BEETLE','ADAMANTINE','#f0f0f0','#2a2a2a'),SCARAB],
  layout(u,v,n1,n2,n3){if(v<.3){if(n1<.07)return WATER;if(n1<.13)return TREE2;if(n2>.75)return ROCK;return G2;}
    if(Math.abs(u-.64)<.035&&v>.38&&v<.82)return WATER;if(v>.42&&v<.62&&u<.48&&n2>.4)return n3>.5?TREE2:TREE;if(n2>.8)return TREE;if(n1>.9)return ROCK;if(n1<.12&&v>.6)return WET;if(n1<.3&&n2<.3)return PATH;return G0;}},
 OCEANIA:{blurb:'REEF, BEACHES, EUCALYPT BUSH, RED OUTBACK AND A HARBOUR TOWN',border:WATER,
  ground:['#a8b26a','#8a944e','#c6cf8c'],ground2:['#f2e3b8','#dccb96','#fff6dc'],tree:'euc',treeCol:['#5a7a5a','#7a9a7a','#a8c4a0','#b8b0a0'],tree2:'palm',tree2Col:['#2a6a22','#3f9a30','#7fd050','#8a6a3a'],
  water:['#3aa0d8','#9fe0ff','#2470b0'],path:['#c8643a','#a84c2a','#e08a5a'],wet:['#7fd6e8','#4fb8d8','#ffffff'],rock:['#a8502a','#c8703a','#e8a070'],bldg:{wall:'#f4f0e8',roof:'#c8443a',win:'#7fb2e5',door:'#2a2a2a'},road:['#6a6a6a','#8a8a8a','#f0e68c'],mtn:['#8a6a5a','#b8968a','#ffffff'],
  town:{x:25,y:19,w:8,h:6,dens:.65},beetles:[GREEN,B('LADYBUG','BRONZE','#e04848','#ffd0d0'),B('CHRISTMAS BEETLE','MITHRIL','#c8a020','#fff0a0'),B('SABERTOOTH LONGHORN BEETLE','ADAMANTINE','#5a3a1e','#c98e64'),SCARAB],
  layout(u,v,n1,n2,n3){const d=Math.min(u,1-u,v,1-v);if(d<.08+.04*n3)return WATER;if(d<.13&&n1>.55)return WET;if(d<.17)return G2;if(d<.3&&n2>.5)return TREE;if(d<.3&&n1<.12)return TREE2;
    if(Math.hypot(u-.5,v-.5)<.07)return ROCK;if(d>.3){if(n1>.35)return PATH;if(n2>.86)return TREE;return G0;}return G0;}},
 ANTARCTICA:{blurb:'ICE SHEET, NUNATAKS, PACK ICE AND MOSSY COASTAL ROCK BY A RESEARCH STATION',border:WATER,
  ground:['#f4f9ff','#dfeaf7','#ffffff'],ground2:['#dff3ff','#b8def5','#ffffff'],tree:'pine',treeCol:['#1f4a2a','#2f6b3a','#4e9a55','#5b3a1e'],
  water:['#2a4f8a','#4f7fc0','#1a2f5a'],path:['#9aa0a8','#7a8088','#c0c6cc'],wet:['#b8def5','#8fc0e8','#ffffff'],rock:['#4a4a52','#7a7a82','#b0b0b8'],bldg:{wall:'#e8e8ec',roof:'#d23c3c',win:'#7fb2e5',door:'#2a2a2a'},road:['#9aa0a8','#b0b6bc','#7a8088'],mtn:['#4a4a52','#8a8a92','#ffffff'],
  town:{x:6,y:6,w:6,h:4,dens:.4,soft:true},beetles:[B('ANTARCTIC MIDGE','MITHRIL','#2a2a2a','#ffffff'),B('STOWAWAY GREEN BEETLE','TIN')],
  layout(u,v,n1,n2,n3){const d=Math.min(u,1-u,v,1-v);if(d<.1+.05*n3)return WATER;if(d<.17&&n1>.68)return ICE;if(d<.22&&n2>.52)return ROCK;if(d>.4&&n2>.72)return MTN;if(d>.28&&n1>.3)return ICE;return G0;}}};
function buildTiles(th){const [g,gd,gl]=th.ground,[h,hd,hl]=th.ground2,[w,wl,wd]=th.water,[p,pd,pl]=th.path,[b,bd,bp]=th.wet,[ra,rb,rc]=th.rock,[ro,rl,rd]=th.road,[ma,mb,mc]=th.mtn;
  const tl={};
  tl[G0]=tile(g,q=>{[[3,4],[9,2],[12,10],[5,12],[14,7]].forEach(([x,y])=>{q(x,y,gd);q(x+2,y,gd);q(x+1,y+1,gd);});q(7,7,gl);q(1,14,gl);});
  tl[G2]=tile(h,q=>{q(2,3,hd);q(11,8,hd);q(7,13,hd);q(13,2,hl);q(4,9,hl);q(9,5,hl);});
  tl[PATH]=tile(p,q=>{q(2,3,pd);q(11,8,pd);q(7,13,pd);q(13,2,pl);q(4,9,pl);});
  tl[WATER]=[tile(w,q=>{q(2,3,wl,4);q(9,7,wl,4);q(4,12,wl,4);q(12,1,wd,3);q(1,9,wd,3);}),tile(w,q=>{q(3,4,wl,4);q(10,8,wl,4);q(5,13,wl,4);q(11,1,wd,3);q(2,9,wd,3);})];
  tl[WET]=tile(b,q=>{q(3,3,bd,3);q(10,6,bd,2);q(6,11,bd,3);q(12,12,bp,3,2);q(1,7,bp,2,2);q(8,1,bp);q(13,9,bp);});
  tl[ICE]=tile(h,q=>{q(0,0,hl,16,1);q(0,0,hl,1,16);q(4,6,hd,6,1);q(9,6,hd,1,5);q(2,13,hd,4,1);q(12,2,hl,3,3);});
  tl[ROAD]=tile(ro,q=>{q(0,0,rl,16,1);q(0,15,rl,16,1);q(0,7,rd,3,1);q(6,7,rd,4,1);q(13,7,rd,3,1);});
  tl[ROCK]=sprite(ROCKBM,{'5':ra,'6':rb,'7':rc});tl[MTN]=sprite(MTNBM,{'5':ma,'6':mb,'7':mb,'d':mc});
  const tc=(cols)=>({'1':cols[0],'2':cols[1],'3':cols[2],'4':cols[3]});
  tl[TREE]=sprite(TREEBM[th.tree],tc(th.treeCol));tl[TREE2]=th.tree2?sprite(TREEBM[th.tree2],tc(th.tree2Col)):tl[TREE];tl[TREE3]=th.tree3?sprite(TREEBM[th.tree3],tc(th.tree3Col)):tl[TREE];
  const bl=th.bldg;tl[BLDG]=[0,1,2].map(v=>tile(v===2?'#5a5048':bl.wall,q=>{q(0,0,v===2?'#3a3230':bl.roof,16,4);q(0,4,'#1a1a2e',16,1);q(0,0,'#1a1a2e',1,16);q(15,0,'#1a1a2e',1,16);
    for(let y=6;y<13;y+=4)for(let x=2;x<14;x+=4){if(v===2){q(x,y,'#1c1a22',3,2);q(x,y+1,'#6a5a48',3,1);}else{q(x,y,bl.win,3,2);q(x+1,y,'#fff6c8');}}if(v===2){q(6,12,'#2a2420',4,4);q(5,13,'#6a5a48',6,1);q(5,15,'#6a5a48',6,1);}else q(6,12,bl.door,4,4);q(0,15,'#1a1a2e',16,1);
}));
  return tl;}

/* ---------------- data ---------------- */
let DEX=null,CONT=[],SP=null;
const CN={EUROPE:'EUROPE',NORTH_AMERICA:'NORTH AMERICA',SOUTH_AMERICA:'SOUTH AMERICA',ASIA:'ASIA',AFRICA:'AFRICA',OCEANIA:'OCEANIA',ANTARCTICA:'ANTARCTICA'};
const CA={EUROPE:'EU',NORTH_AMERICA:'NA',SOUTH_AMERICA:'SA',ASIA:'AS',AFRICA:'AF',OCEANIA:'OC',ANTARCTICA:'AN'};
const roster={};
function loadData(d){DEX=d;CONT=d.continents;SP=d.species;CONT.forEach(c=>roster[c]=SP.filter(s=>s.regions.includes(c)));JF=CONT.length+2;}
const IMGS={};function img(sp){if(!sp||!sp.image)return null;let i=IMGS[sp.key];if(!i){i=new Image();i.src=(opts.imgBase||'')+sp.image.file;IMGS[sp.key]=i;}return i.complete&&i.naturalWidth?i:null;}
function lic(u){u=(u||'').toLowerCase();return u.includes('zero')||u.startsWith('cc0')?'CC0':u.includes('public')||u.startsWith('pd')?'PUBLIC DOMAIN':u.includes('by-sa')?'CC BY-SA':u.includes('/by/')||u.includes('cc by')?'CC BY':'?';}
function photo(sp,x,y,w,h,hidden){bevelIn(x-2,y-2,w+4,h+4,C.paper2);const im=hidden?null:img(sp);
  if(im){ctx.imageSmoothingEnabled=true;ctx.drawImage(im,x,y,w,h);ctx.imageSmoothingEnabled=false;}
  else{rect(x,y,w,h,hidden?C.shade:C.paper2);ctx.save();ctx.translate(x+w/2-24,y+h/2-24);ctx.scale(3,3);ctx.drawImage(MOSS[0],0,0);ctx.restore();
    textC(hidden?'???':(sp&&sp.image?'LOADING...':'NO PHOTO ON FILE'),x+w/2,y+h-12,hidden?C.paper:C.green);}}
const idstr=s=>'NO.'+String(s.id).padStart(4,'0');
let pfpImg=null;function pfp(x,y,s){if(pfpImg&&pfpImg.complete&&pfpImg.naturalWidth){ctx.imageSmoothingEnabled=false;ctx.drawImage(pfpImg,x,y,s,s);}else{rect(x,y,s,s,C.lav2);emblem(x+s/2,y+s/2,s*0.4,C.lav,C.white);}}

/* ---------------- sound ---------------- */
let AC=null,muted=false;
const PENT=[0,2,4,7,9];const hz=n=>220*Math.pow(2,n/12);
let master=null;
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=muted?0:1;master.connect(AC.destination);}catch(e){AC=null;}}if(AC&&AC.state==='suspended')AC.resume();return AC;}
function setMute(m){muted=!!m;if(master&&AC)master.gain.setTargetAtTime(muted?0:1,AC.currentTime,0.05);}
function tone(n,t,dur,type,gain,detune){const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.value=hz(n);if(detune)o.detune.value=detune;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(gain||0.08,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.03);}
function bell(n,t,dur,gain){tone(n,t,dur,'sine',gain);tone(n+12,t,dur*0.5,'sine',(gain||0.08)*0.35);tone(n,t,dur*0.8,'triangle',(gain||0.08)*0.3,6);}
const deg=i=>PENT[((i%5)+5)%5]+12*Math.floor(i/5);
function snd(kind,seed){const a=ac();if(!a)return;const t=a.currentTime;seed=seed||0;
  if(kind==='tune'){const n=(a.sampleRate*0.16)|0,b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n)*(1-i/n);
    const src=a.createBufferSource();src.buffer=b;const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=1600;f.Q.value=0.5;const g=a.createGain();g.gain.value=0.05;src.connect(f);f.connect(g);g.connect(master);src.start(t);tone(deg(0)-24,t,0.08,'square',0.02);}
  else if(kind==='step'){tone(deg(seed%5)-12,t,0.05,'triangle',0.025);}
  else if(kind==='move'){bell(deg(2+(seed%3)),t,0.12,0.05);}
  else if(kind==='ok'){[0,2,4].forEach((i,k)=>bell(deg(i),t+k*0.06,0.18,0.07));}
  else if(kind==='back'){bell(deg(2),t,0.1,0.05);bell(deg(0),t+0.07,0.14,0.05);}
  else if(kind==='found'){[4,6,8].forEach((i,k)=>bell(deg(i),t+k*0.05,0.16,0.07));}
  else if(kind==='beetle'){[2,4,2,6].forEach((i,k)=>tone(deg(i)+12,t+k*0.05,0.08,'square',0.03));}
  else if(kind==='collect'){const m=seed%5;[0,2,4,7,9].map(x=>x+PENT[m]).forEach((n,k)=>bell(n,t+k*0.07,0.22,0.07));bell(deg(9)+PENT[m],t+0.4,0.6,0.06);}
  else if(kind==='miss'){tone(deg(3),t,0.14,'sawtooth',0.03);tone(deg(3)-3,t+0.12,0.28,'sawtooth',0.03);}
  else if(kind==='win'){for(let k=0;k<10;k++)bell(deg(k),t+k*0.09,0.3,0.07);}
  else if(kind==='chime'){[0,4,7,9].forEach((i,k)=>bell(deg(i)+12,t+k*0.11,0.7,0.06));}
  else if(kind==='talk'){tone(deg(4+(seed%3))+12,t,0.03,'square',0.012);}
  else if(kind==='chirp'){bell(deg(7)+12,t,0.09,0.05);bell(deg(9)+12,t+0.07,0.12,0.05);}}
let amb={on:false,next:0,seed:1,step:0};
function ambient(){const a=AC;if(!a||!amb.on)return;const t=a.currentTime;while(amb.next<t+0.8){const r=rng(amb.seed*977+amb.step);const base=(amb.seed%3)*5-5;
  if(r()<0.75){const n=deg(base+((r()*10)|0))-12;tone(n,amb.next,1.6,'sine',0.018);tone(n+12,amb.next+0.02,0.9,'triangle',0.006,4);}
  if(amb.step%4===0){tone(deg(base)-24,amb.next,2.4,'triangle',0.014);}
  amb.next+=0.42;amb.step++;}}
function ambientFor(i){amb.on=true;amb.seed=i+1;if(AC&&amb.next<AC.currentTime)amb.next=AC.currentTime+0.1;}

/* ---------------- identity ---------------- */
let user=null;
function setUser(u){user=u;if(u){pfpImg=null;if(u.pfpUrl){pfpImg=new Image();pfpImg.src=u.pfpUrl;}loadSave();buildPlayer();}}
const GUEST={handle:'GUEST',displayName:'Explorer',pfpUrl:null,id:'guest',guest:true};
const playerName=()=>(save&&save.name)||(user&&!user.guest?'~'+user.handle:null)||'Traveler';
const pname=()=>norm(playerName()).slice(0,18);

/* ---------------- save ---------------- */
const SAVE_V=2;
const fresh=()=>({v:SAVE_V,name:null,char:null,jar:{},started:Date.now(),collected:{},seen:{},region:null,steps:0,last:null,cheese:0,beetles:{},pity:0,introDone:false,pet:null});
let save=fresh();
const saveKey=()=>'mossquest.save.'+(user?(user.id||user.handle):'guest');
function loadSave(){save=fresh();try{const s=localStorage.getItem(saveKey())||(user&&user.guest?localStorage.getItem('mossquest.save'):null);if(s)save=Object.assign(save,JSON.parse(s));}catch(e){}if(!save.started)save.started=Date.now();pruneSave();}
// species come and go between data builds; a save may only point at what exists now
function pruneSave(){if(!SP)return;const have=new Set(SP.map(x=>String(x.key)));let dropped=0;
  for(const k of Object.keys(save.collected))if(!have.has(k)){delete save.collected[k];dropped++;}
  for(const k of Object.keys(save.seen))if(!have.has(k))delete save.seen[k];
  if(save.last!=null&&!have.has(String(save.last)))save.last=null;
  if(save.pet&&!have.has(String(save.pet.key))){save.pet=null;dropped++;}
  if(!CONT.includes(save.region))save.region=null;
  if(save.v!==SAVE_V||dropped){save.v=SAVE_V;persist();}}
function persist(){try{localStorage.setItem(saveKey(),JSON.stringify(save));}catch(e){}}
const nCollected=()=>Object.keys(save.collected).length;
const nCollectedIn=c=>roster[c].filter(s=>save.collected[s.key]).length;
const known=s=>save.collected[s.key]||save.seen[s.key];
const nBeetles=()=>Object.values(save.beetles).reduce((a,b)=>a+b,0);

/* ---------------- input ---------------- */
const keys={},just={},held={},tapT={};let click=null;
const BTN_DIRS=['up','down','left','right'];
// a press from a button or key: one "just" edge plus a few frames of the key held, enough to walk one tile
function pressKey(k){ac();just[k]=true;tapT[k]=BTN_DIRS.includes(k)?6:1;}
function holdKey(k,on){held[k]=!!on;if(on)ac();}
function syncKeys(){for(const k in tapT)if(tapT[k]>0)tapT[k]--;BTN_DIRS.forEach(d=>{keys[d]=!!held[d]||tapT[d]>0;});}
// the canvas is letterboxed inside its box (object-fit: contain), so map the pointer through that box
function bindPointer(c){c.addEventListener('pointerdown',e=>{ac();const r=c.getBoundingClientRect();const sc=Math.min(r.width/cv.width,r.height/cv.height);const ox=(r.width-cv.width*sc)/2,oy=(r.height-cv.height*sc)/2;
  const x=(e.clientX-r.left-ox)/sc,y=(e.clientY-r.top-oy)/sc;if(x<0||x>=cv.width||y<0||y>=cv.height)return;e.preventDefault();
  click={x:x|0,y:y|0,top:true,topy:y|0};});}
const hit=k=>{const v=!!just[k];just[k]=false;return v;};
const tap=(x,y,w,h)=>!!(click&&!click.top&&click.x>=x&&click.x<x+w&&click.y>=y&&click.y<y+h);

/* ---------------- map ---------------- */
const MW=36,MH=28,VW=W/T,VH=H/T;
let dealerAt=null;
let map=null,spots=[],beetles=[],player={x:0,y:0,px:0,py:0,dir:'down',mx:0,my:0,anim:0,path:[],goal:null},cam={x:0,y:0},TL=null,theme=null;
function noise(r,w,h,cell){const gw=Math.ceil(w/cell)+1,gh=Math.ceil(h/cell)+1,g=[];for(let i=0;i<gw*gh;i++)g.push(r());
  const out=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const gx=x/cell,gy=y/cell,x0=gx|0,y0=gy|0,fx=gx-x0,fy=gy-y0;
    const v=(a,b)=>g[b*gw+a];out.push((1-fx)*(1-fy)*v(x0,y0)+fx*(1-fy)*v(x0+1,y0)+(1-fx)*fy*v(x0,y0+1)+fx*fy*v(x0+1,y0+1));}
  const lo=Math.min(...out),hi=Math.max(...out);return out.map(v=>(v-lo)/(hi-lo||1));}
const occupied=(x,y)=>spots.some(s=>s.x===x&&s.y===y)||beetles.some(b=>b.x===x&&b.y===y)||(player.x===x&&player.y===y);
function genMap(cont){const ci=CONT.indexOf(cont);theme=THEMES[cont];TL=buildTiles(theme);const r=rng(ci*7919+17);const n1=noise(r,MW,MH,5),n2=noise(r,MW,MH,3),n3=noise(r,MW,MH,7);map=[];
  for(let y=0;y<MH;y++){const row=[];for(let x=0;x<MW;x++){const i=y*MW+x;let t=theme.layout(x/MW,y/MH,n1[i],n2[i],n3[i],x,y);
    if(x===0||y===0||x===MW-1||y===MH-1)t=theme.border;row.push(t);}map.push(row);}
  const tn=theme.town;if(tn){const tr=rng(ci*131+5);for(let y=tn.y;y<tn.y+tn.h;y++)for(let x=tn.x;x<tn.x+tn.w;x++){if(x<=0||y<=0||x>=MW-1||y>=MH-1)continue;const dx=x-tn.x,dy=y-tn.y;
    if(dx%4===0||dy%4===0||dx===tn.w-1||dy===tn.h-1)map[y][x]=tn.soft?PATH:ROAD;else{const q=tr();map[y][x]=q<tn.dens?BLDG:q<tn.dens+.25?PATH:G0;}}}
  const sx=MW>>1,sy=MH>>1;for(let y=sy-1;y<=sy+1;y++)for(let x=sx-1;x<=sx+1;x++)if(!WALK[map[y][x]])map[y][x]=G0;
  if(cont==='EUROPE')stampPond(rng(ci*311+9),sx,sy);
  player.x=sx;player.y=sy;player.px=sx*T;player.py=sy*T;player.mx=player.my=0;player.path=[];player.goal=null;
  const seen=new Set(),q=[[sx,sy]],reach=[];while(q.length){const [x,y]=q.pop();const k=y*MW+x;if(seen.has(k)||!WALK[map[y][x]])continue;seen.add(k);reach.push([x,y]);
    q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
  const HAB=new Set([TREE,TREE2,TREE3,ROCK,WATER,BLDG,MTN]);
  const good=reach.filter(([x,y])=>{const nb=[map[y-1][x],map[y+1][x],map[y][x-1],map[y][x+1]];return nb.some(t=>HAB.has(t))||map[y][x]===WET;});
  spots=[];beetles=[];const pool=good.length>20?good:reach;spots.pool=pool;spots.reach=reach;const rr=rng(Date.now()&0xffff);
  let guard=0;while(spots.length<10&&pool.length&&guard++<500){const [x,y]=pool[(rr()*pool.length)|0];if(Math.abs(x-sx)+Math.abs(y-sy)<2||occupied(x,y))continue;spots.push({x,y,sp:pickSpecies(cont)});}
  guard=0;while(beetles.length<4&&reach.length&&guard++<500){const [x,y]=reach[(rr()*reach.length)|0];if(Math.abs(x-sx)+Math.abs(y-sy)<3||occupied(x,y))continue;beetles.push(mkBeetle(x,y));}
  respawnQ=[];
}
let respawnQ=[];
// a round pond with two slot eyes of grass and a smile of grass: the face, seen from above
function stampPond(r,sx,sy){const R=4,cands=[];
  for(let y=R+2;y<MH-R-2;y++)for(let x=R+2;x<MW-R-2;x++){if(Math.abs(x-sx)+Math.abs(y-sy)<R+4)continue;let ok=true;
    for(let dy=-R-1;dy<=R+1&&ok;dy++)for(let dx=-R-1;dx<=R+1;dx++){if(dx*dx+dy*dy>(R+1)*(R+1))continue;const t=map[y+dy][x+dx];if(t===BLDG||t===ROAD||t===MTN||t===ICE||t===WATER){ok=false;break;}}
    if(ok)cands.push([x,y]);}
  if(!cands.length)return;const [cx,cy]=cands[(r()*cands.length)|0];
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++)if(dx*dx+dy*dy<=R*R+1)map[cy+dy][cx+dx]=WATER;
  for(const ex of [-2,2])for(let dy=-4;dy<=-1;dy++)map[cy+dy][cx+ex]=G0;
  [[-3,1],[-2,2],[-1,3],[0,3],[1,3],[2,2],[3,1]].forEach(([dx,dy])=>{map[cy+dy][cx+dx]=G0;});}
function respawnSpot(i){const pool=spots.pool;for(let k=0;k<50;k++){const [x,y]=pool[(Math.random()*pool.length)|0];
  if(Math.abs(x-player.x)+Math.abs(y-player.y)<3||occupied(x,y))continue;spots[i]={x,y,sp:pickSpecies(REG())};return;}spots.splice(i,1);}
function pickSpecies(cont){const Rr=roster[cont];let tot=0;const w=Rr.map(s=>{const c=s.regionCounts[cont]||1;const v=(save.collected[s.key]?1:12)*(0.4+Math.min(1,Math.log10(c+1)/4));tot+=v;return v;});
  let r=Math.random()*tot;for(let i=0;i<Rr.length;i++){r-=w[i];if(r<=0)return Rr[i];}return Rr[Rr.length-1];}
function choices(sp,cont){const Rr=roster[cont].filter(s=>s!==sp);const pool=Rr.length>=3?Rr:SP.filter(s=>s!==sp);let same=pool.filter(s=>s.family===sp.family);if(!same.length)same=pool.filter(s=>s.order&&s.order===sp.order);
  const out=[sp];let guard=0;while(out.length<4&&guard++<200){const from=(same.length&&Math.random()<.5)?same:pool;const c=from[(Math.random()*from.length)|0];if(!out.includes(c))out.push(c);}
  for(let i=out.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[out[i],out[j]]=[out[j],out[i]];}return out;}

/* ---------------- tap-to-walk ---------------- */
const DIRS=[[0,-1,'up'],[0,1,'down'],[-1,0,'left'],[1,0,'right']];
const thing=(x,y)=>spots.some(o=>o.x===x&&o.y===y)||beetles.some(o=>o.x===x&&o.y===y);
function pathTo(tx,ty){ // BFS from player to tx,ty (or to a tile adjacent to it if it is blocked); returns [dirs]
  const key=(x,y)=>y*MW+x,prev=new Map();prev.set(key(player.x,player.y),null);const q=[[player.x,player.y]];let end=null;
  const targetBlocked=!WALK[map[ty][tx]]||thing(tx,ty);
  while(q.length){const [x,y]=q.shift();if(x===tx&&y===ty){end=[x,y];break;}
    if(targetBlocked&&Math.abs(x-tx)+Math.abs(y-ty)===1){end=[x,y];break;}
    for(const [dx,dy,d] of DIRS){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=MW||ny>=MH||!WALK[map[ny][nx]]||thing(nx,ny)||prev.has(key(nx,ny)))continue;prev.set(key(nx,ny),[x,y,d]);q.push([nx,ny]);}}
  if(!end)return null;const out=[];let c=end;while(prev.get(key(c[0],c[1]))){const [px,py,d]=prev.get(key(c[0],c[1]));out.unshift(d);c=[px,py];}return out;}
function tapWorld(){const tx=Math.floor((click.x+cam.x)/T),ty=Math.floor((click.topy+cam.y)/T);if(tx<0||ty<0||tx>=MW||ty>=MH)return;
  if(tx===player.x&&ty===player.y)return;const path=pathTo(tx,ty);if(!path){snd('miss');return;}
  player.path=path;player.goal=thing(tx,ty)?{x:tx,y:ty}:null;snd('move',path.length);}
function faceTowards(x,y){player.dir=x>player.x?'right':x<player.x?'left':y>player.y?'down':'up';}
function interactAhead(){const dx={left:-1,right:1}[player.dir]||0,dy={up:-1,down:1}[player.dir]||0;const tx=player.x+dx,ty=player.y+dy;
  const s=spots.findIndex(o=>o.x===tx&&o.y===ty);if(s>=0){startEnc(s);return true;}
  const bi=beetles.findIndex(o=>o.x===tx&&o.y===ty);if(bi>=0){catchBeetle(bi);return true;}
  if(map[ty]&&map[ty][tx]===BLDG){if(dealerAt&&tx===dealerAt.x&&ty===dealerAt.y)openShop();else{snd('miss');toast={t:['LIGHTS ON. NOBODY ANSWERS.','THE CURTAIN TWITCHES. THE DOOR STAYS SHUT.','A DOG BARKS INSIDE. NO ONE COMES.','THEY ARE HOME. THEY ARE NOT OPENING.'][(tx*7+ty*13)%4],n:120};}return true;}return false;}

/* ---------------- beetles (Beetleboy tiers) ---------------- */
function rollBeetle(){const list=theme.beetles.concat(HOLIDAY());const pity=save.pity>=6;let pool=list.filter(b=>!pity||b.tier!=='TIN');if(!pool.length)pool=list;
  const tot=pool.reduce((a,b)=>a+TIER[b.tier].w,0);let r=Math.random()*tot;for(const b of pool){r-=TIER[b.tier].w;if(r<=0)return b;}return pool[0];}
function mkBeetle(x,y){const k=rollBeetle();const midge=k.name.includes('MIDGE');const bm=midge?MIDGEBM:BEETLEBM;
  return {x,y,kind:k,t:30+(Math.random()*60|0),spr:bm.map(rows=>sprite(rows,{'1':k.col,'3':k.hi,g:k.col,d:k.hi})),wig:0};}
function stepBeetles(){for(const b of beetles){if(--b.t>0)continue;b.t=30+(Math.random()*70|0);const d=[[1,0],[-1,0],[0,1],[0,-1]][(Math.random()*4)|0];const nx=b.x+d[0],ny=b.y+d[1];
    if(nx>0&&ny>0&&nx<MW-1&&ny<MH-1&&WALK[map[ny][nx]]&&!occupied(nx,ny)){b.x=nx;b.y=ny;}}
  for(let i=respawnQ.length-1;i>=0;i--){if(--respawnQ[i]<=0){respawnQ.splice(i,1);const reach=spots.reach;for(let k=0;k<50;k++){const [x,y]=reach[(Math.random()*reach.length)|0];if(Math.abs(x-player.x)+Math.abs(y-player.y)<4||occupied(x,y))continue;beetles.push(mkBeetle(x,y));break;}}}}
function catchBeetle(i){const b=beetles[i];beetles.splice(i,1);respawnQ.push(600+(Math.random()*600|0));const tier=TIER[b.kind.tier];save.cheese+=tier.cheese;save.beetles[b.kind.name]=(save.beetles[b.kind.name]||0)+1;
  save.pity=b.kind.tier==='TIN'?save.pity+1:0;persist();snd('beetle');card={kind:b.kind,cheese:tier.cheese,count:save.beetles[b.kind.name]};go('beetle');}

/* ---------------- intro (Professor Chaga) ---------------- */
const INTRO=()=>[
 {t:'HELLO THERE! WELCOME TO THE WORLD OF MOSS. MY NAME IS CHAGA. PEOPLE CALL ME THE MOSS PROFESSOR.'},
 {t:'LOOK DOWN. ON ROCKS, BARK, SOIL AND OLD WALLS THERE IS A SMALL GREEN WORLD THAT MOST PEOPLE WALK STRAIGHT PAST. THOSE ARE MOSSES. THERE ARE MORE THAN 12,000 KINDS.'},
 {t:'MOSSES WERE AMONG THE FIRST PLANTS EVER TO LIVE ON LAND, OVER 400 MILLION YEARS AGO. THEY HAVE NO ROOTS AND NO FLOWERS. THEY DRINK RAIN AND FOG STRAIGHT THROUGH THEIR LEAVES.'},
 {t:'WHEN IT IS DRY THEY CURL UP AND WAIT, SOMETIMES FOR YEARS. ONE DROP OF WATER AND THEY TURN GREEN AGAIN WITHIN MINUTES. ALMOST NOTHING ELSE ALIVE CAN DO THAT.'},
 {t:'AND THEY MATTER. MOSS HOLDS SOIL TOGETHER, SOAKS UP RAIN LIKE A SPONGE, AND THE PEAT BOGS BUILT BY SPHAGNUM MOSS STORE MORE CARBON THAN ALL THE FORESTS ON EARTH.'},
 {t:'I HAVE STUDIED THEM ALL MY LIFE. I BUILT THE MOSSDEX TO HOLD '+SP.length+' OF MY FAVORITE MOSS SPECIES IN THE WORLD: A PHOTO, A NAME, A FAMILY, AND THE LOCATION OF WHERE TO FIND EACH MOSS.'},
 {t:'LAST NIGHT EVERY ENTRY VANISHED. I CAN\'T PROVE THEY WERE STOLEN AND I HAVEN\'T RULED OUT MALWARE. REGARDLESS, MY LIFE\'S WORK HAS VANISHED, AND I AM FAR TOO OLD TO VISIT EACH CONTINENT ONCE MORE.'},
 {t:'I NEED YOUR HELP, TRAVELER. WILL YOU GO COLLECT ALL '+SP.length+' MOSS ENTRIES AND SAVE THE MOSSDEX?',ask:'quest'},
 {t:'WONDERFUL. WHAT SHALL I CALL YOU, TRAVELER?',ask:'name'},
 {t:'AND WHO IS WALKING ALL THAT WAY? PICK YOUR TRAVELER.',ask:'char'},
 {t:'{NAME}. A FINE NAME FOR A MOSS HUNTER. NOW, HOW TO LOG A MOSS: WALK UP TO A GREEN TUFT, FACE IT, AND PRESS THE A BUTTON. I WILL SHOW YOU ITS PHOTO. LOOK AT THE LEAF SHAPE, HOW THE SHOOTS BRANCH, THE COLOUR, AND THE LITTLE CAPSULES ON STALKS. THEN PICK ITS NAME FROM THE LIST. THE FAMILY IS YOUR CLUE.'},
 {t:'NAME IT RIGHT AND THE ENTRY RETURNS TO THE MOSSDEX. NAME IT WRONG AND THE MOSS SLIPS AWAY, BUT IT STAYS MARKED AS SEEN. EVERY MISTAKE TEACHES YOU A NAME.'},
 {t:'BEETLES LIVE AMONG THE MOSS. FACE ONE AND PRESS THE A BUTTON TO CATCH IT FOR CHEESE. STUCK ON A NAME? PRESS THE X BUTTON DURING A QUIZ TO SPEND ONE CHEESE, AND A BEETLE WILL RULE OUT TWO WRONG ANSWERS.'},
 {t:'EACH CONTINENT HAS ITS OWN MOSSES, FROM ANTARCTIC ROCK TO CITY PAVEMENTS. USE THE MAP TO TRAVEL. THE MOSSDEX SHOWS WHAT IS STILL MISSING IN EACH PLACE.'},
 {t:'ONCE YOU HAVE A SPECIES, PLANT A CUTTING IN GOODMOSS AND KEEP IT ALIVE. YOU WILL LEARN MORE FROM ONE LIVING MOSS THAN FROM ANY BOOK.'},
 {t:'RECOVER ALL '+SP.length+' ENTRIES AND MY LIFE\'S WORK IS SAFE AGAIN. {NAME}, YOUR MOSS QUEST BEGINS NOW!'}];
const INTRO_NO=[{t:'I UNDERSTAND. THE MOSS WILL WAIT, IT ALWAYS HAS. COME BACK WHEN YOU ARE READY, TRAVELER.'}];
let intro={page:0,ch:0,ret:'region',pages:[],opt:false,kb:false,buf:'',bail:false};
function startIntro(ret,pages){intro={page:0,ch:0,ret:ret||'region',pages:pages||INTRO(),opt:false,kb:false,buf:'',bail:false};state='intro';snd('chime');}
const pageText=()=>sentence((intro.pages[intro.page]||{t:''}).t);
function introNext(){if(intro.page<intro.pages.length-1){intro.page++;intro.ch=0;intro.opt=false;intro.kb=false;snd('move',intro.page);dirty();}else finishIntro();}


/* ---------------- GoodMoss ---------------- */
const FORMS={cushion:{rate:.0045,label:'CUSHION (ACROCARP)'},mat:{rate:.0065,label:'CREEPING MAT (PLEUROCARP)'},hummock:{rate:.0035,label:'SPHAGNUM HUMMOCK'}};
const SUBS=['rock','bark','soil','peat'];const SUBCOL={rock:['#8a8a92','#b8b8c0'],bark:['#6b4a2b','#8a6540'],soil:['#4a3a2a','#6a5238'],peat:['#3a2620','#5a3a30']};
const LIGHTS=[[.2,'SHADE'],[.6,'WINDOW'],[1,'FULL SUN']],LIDS=[[.8,'OPEN'],[.5,'VENTED'],[.2,'CLOSED']];
const FAMPREF={Sphagnaceae:['hummock',.95,.3,'peat'],Grimmiaceae:['cushion',.3,.9,'rock'],Polytrichaceae:['cushion',.6,.6,'soil'],Hypnaceae:['mat',.6,.3,'bark'],Bryaceae:['cushion',.45,.8,'soil'],Pottiaceae:['cushion',.3,.85,'soil'],
 Dicranaceae:['cushion',.6,.35,'soil'],Mniaceae:['cushion',.75,.25,'soil'],Brachytheciaceae:['mat',.6,.5,'bark'],Thuidiaceae:['mat',.65,.3,'soil'],Orthotrichaceae:['cushion',.35,.55,'bark'],Fissidentaceae:['cushion',.8,.25,'soil'],
 Amblystegiaceae:['mat',.85,.5,'soil'],Leucobryaceae:['cushion',.6,.3,'soil'],Hylocomiaceae:['mat',.6,.35,'soil'],Plagiotheciaceae:['mat',.65,.25,'bark'],Neckeraceae:['mat',.6,.3,'bark'],Ditrichaceae:['cushion',.35,.8,'soil'],
 Funariaceae:['cushion',.55,.75,'soil'],Splachnaceae:['cushion',.8,.5,'peat'],Andreaeaceae:['cushion',.3,.85,'rock'],Rhabdoweisiaceae:['cushion',.55,.5,'rock'],Rhytidiaceae:['mat',.55,.45,'soil'],Climaciaceae:['mat',.75,.4,'soil'],
 Racomitriaceae:['cushion',.35,.85,'rock'],Bartramiaceae:['cushion',.7,.4,'soil'],Aulacomniaceae:['cushion',.75,.4,'peat'],Meesiaceae:['cushion',.9,.5,'peat'],Calliergonaceae:['mat',.9,.5,'peat'],Scorpidiaceae:['mat',.9,.5,'peat'],
 Hedwigiaceae:['cushion',.3,.9,'rock'],Anomodontaceae:['mat',.5,.3,'bark'],Leskeaceae:['mat',.5,.4,'bark'],Entodontaceae:['mat',.5,.5,'bark'],Sematophyllaceae:['mat',.7,.4,'bark'],Pylaisiaceae:['mat',.55,.4,'bark'],
 Encalyptaceae:['cushion',.4,.7,'rock'],Seligeriaceae:['cushion',.5,.4,'rock'],Timmiaceae:['cushion',.6,.4,'soil'],Tetraphidaceae:['cushion',.6,.3,'bark']};
function prefs(sp){const f=FAMPREF[sp.family];if(f)return {form:f[0],moist:f[1],light:f[2],sub:f[3]};const mat=sp.order==='Hypnales'||sp.order==='Hookeriales';
  return {form:sp.order==='Sphagnales'?'hummock':mat?'mat':'cushion',moist:mat?.6:.5,light:mat?.35:.6,sub:mat?'bark':'soil'};}
const word=(v,lo,mid,hi)=>v<.4?lo:v<.7?mid:hi;
const PETNAMES=['MOSSY','PIP','BRYO','TUFT','SPRIG','VELVET','PUFF','CLOVER','FERN','DEWY','NUBBIN','SPORE'];
function newPet(sp,name){const pr=prefs(sp);return {key:sp.key,name:(name||PETNAMES[(Math.random()*PETNAMES.length)|0]).slice(0,12),born:Date.now(),last:Date.now(),hyd:.7,light:.6,air:.5,sub:pr.sub,growth:.08,health:.9,algae:0,spor:0,spores:0,fruited:0,dormant:false,dead:false,fit:.7,snaps:[],log:[]};}
function petSp(p){return SP.find(s=>s.key===p.key);}
function simPet(p,now){if(!p||p.dead)return;const pr=prefs(petSp(p));let dt=(now-p.last)/3600000;if(dt<=0.0005)return;if(dt>72){p.log.unshift('YOU WERE AWAY '+Math.round(dt/24)+' DAYS. GROWTH CAPPED AT 3.');dt=72;}
  const steps=Math.max(1,Math.ceil(dt));const h=dt/steps;
  for(let i=0;i<steps;i++){const t=p.last+i*h*3600000;const hour=new Date(t).getHours();const day=hour>=7&&hour<=19?1:.35;
    p.air=.5;p.sub=pr.sub;const evap=.012*(1+p.light*2)*.75*day*h;p.hyd=Math.max(0,p.hyd-evap);
    const dormant=p.hyd<.15;if(dormant&&!p.dormant)p.log.unshift('DRIED OUT. DORMANT, WAITING FOR RAIN.');if(!dormant&&p.dormant)p.log.unshift('REVIVED! GREEN AGAIN WITHIN MINUTES.');p.dormant=dormant;
    const mf=1-Math.abs(pr.moist-p.hyd),lf=1-Math.abs(pr.light-p.light),sf=p.sub===pr.sub?1:.55;const fit=Math.max(0,Math.min(1,(mf*.45+lf*.4+.15)*sf));p.fit=fit;
    if(dormant){if(p.light>.7)p.health=Math.max(0,p.health-.012*h);}
    else{const rot=p.hyd>.9;if(rot){p.health=Math.max(0,p.health-.015*h);p.algae=Math.min(1,p.algae+.012*h);}else p.algae=Math.max(0,p.algae-.006*h);
      p.growth=Math.min(1,p.growth+FORMS[pr.form].rate*fit*p.health*(1-p.algae*.7)*h);
      if(fit>.6)p.health=Math.min(1,p.health+.006*h);else if(fit<.3)p.health=Math.max(0,p.health-.006*h);
      if(p.growth>.6&&p.health>.75&&fit>.65)p.spor=Math.min(1,p.spor+.012*h);else p.spor=Math.max(0,p.spor-.002*h);
      if(p.spor>=1){p.spores++;p.fruited++;p.spor=0;p.log.unshift('SPOROPHYTES RIPENED! +1 SPORE');}}
    if(p.health<=0&&!p.dead){p.dead=true;p.log.unshift('THE MOSS HAS GONE. TAKE A CUTTING.');}
    p.snaps.push({t:t+h*3600000,g:p.growth,h:p.health,w:p.hyd,a:p.algae,s:p.spor});}
  while(p.snaps.length>360)p.snaps.shift();if(p.log.length>8)p.log.length=8;p.last=now;}
function petMood(p){if(p.dead)return ['GONE. START AGAIN FROM A CUTTING.',C.red];if(p.dormant)return ['DORMANT. WAITING FOR RAIN.','#8a7a55'];if(p.algae>.5)return ['GLAZED WITH ALGAE. EASE OFF THE WATER.',C.red];
  if(p.hyd>.9)return ['SOGGY. LET IT DRY A LITTLE.',C.red];if(p.spor>.5)return ['PUTTING UP SPOROPHYTES!',C.green];if(p.fit>.75)return ['THRIVING.',C.green];if(p.fit>.5)return ['CONTENT.',C.ink];return ['STRUGGLING. CHECK LIGHT AND WATER.',C.red];}
const SHOOTS={};function shoots(key){if(!SHOOTS[key]){const r=rng(key*17+3);SHOOTS[key]=Array.from({length:120},()=>({x:r(),y:r(),h:.6+r()*.8,k:r(),b:r()}));}return SHOOTS[key];}
let pa={blink:0,wake:0,bounce:0,beads:[],bug:{x:.5,y:.7,t:0,hop:0},fog:0};
const lerp=(a,b,t)=>a+(b-a)*t;const rgb=a=>'rgb('+Math.round(a[0])+','+Math.round(a[1])+','+Math.round(a[2])+')';
function tones(h,w,mix,dead){ // [dark,mid,light,outline] from health h, hydration w; mix forces green (wake anim)
  const dry=dead?1:Math.max(0,Math.min(1,(.3-w)/.15))*(1-(mix||0));
  const green=[lerp(95,70,h),lerp(125,168,h),lerp(70,62,h)],brown=dead?[120,112,100]:[150,118,74];
  const mid=green.map((v,i)=>lerp(v,brown[i],dry));const dark=mid.map(v=>v*.62),light=mid.map(v=>Math.min(255,v*1.3+22)),out=mid.map(v=>v*.35);
  return [rgb(dark),rgb(mid),rgb(light),rgb(out)];}
function fillEllipse(cx,cy,rx,ry,col,top){ctx.fillStyle=col;const y0=top?-ry:-ry,y1=top?0:ry;for(let y=Math.ceil(y0);y<=y1;y++){const t=y/ry;if(Math.abs(t)>1)continue;const hw=Math.max(1,Math.round(rx*Math.sqrt(1-t*t)));ctx.fillRect(Math.round(cx-hw),Math.round(cy+y),hw*2,1);}}
function px(x,y,col,w,h){ctx.fillStyle=col;ctx.fillRect(Math.round(x),Math.round(y),w||1,h||1);}
const SPIKY=new Set(['Polytrichaceae','Dicranaceae','Ditrichaceae','Pottiaceae','Grimmiaceae','Racomitriaceae']);
function expr(q,wake){ // q: {hyd,health,fit,algae,spor,dormant,dead,light,air}
  if(wake>0)return {eyes:wake>60?'closed':wake>30?'half':'open',mouth:wake>30?'flat':'smile',blush:wake<30,zzz:false,sweat:false,sparkle:wake<15};
  if(q.dead)return {eyes:'x',mouth:'flat',blush:false,zzz:false,sweat:false,sparkle:false};
  if(q.dormant)return {eyes:'closed',mouth:'flat',blush:false,zzz:true,sweat:false,sparkle:false,scorch:q.light>.7};
  if(q.hyd>.9)return {eyes:'small',mouth:'o',blush:false,zzz:false,sweat:true,sparkle:false};
  if(q.algae>.5)return {eyes:'squint',mouth:'wobble',blush:false,zzz:false,sweat:true,sparkle:false};
  if(q.spor>.5)return {eyes:'happy',mouth:'smile',blush:true,zzz:false,sweat:false,sparkle:true};
  if(q.fit>.75)return {eyes:'open',mouth:'smile',blush:true,zzz:false,sweat:false,sparkle:true};
  if(q.fit>.5)return {eyes:'open',mouth:'none',blush:false,zzz:false,sweat:false,sparkle:false};
  return {eyes:'squint',mouth:'flat',blush:false,zzz:false,sweat:true,sparkle:false};}
const EYEIMG=[];function eyeImg(i){if(!EYEIMG[i]){const st=EYES[i];EYEIMG[i]={L:sprite(st.L,st.pal,[st.L[0].length,st.L.length]),R:sprite(st.R,st.pal,[st.R[0].length,st.R.length])};}return EYEIMG[i];}
const eyeStyle=sp=>(Number(sp&&sp.key)||0)%(EYES.length+FACES.length);
const FACEIMG=[];function faceSet(i){const f=FACES[i];if(!f)return null;if(!FACEIMG[i]){const o={};for(const k of ['L','R','bL','bR','M'])if(f[k])o[k]={img:sprite(f[k].rows,f.pal,[f[k].rows[0].length,f[k].rows.length]),ox:f[k].ox,oy:f[k].oy};FACEIMG[i]=o;}return FACEIMG[i];}
function partAt(pt,x,y,k){const w=Math.max(1,Math.round(pt.img.width*k)),h=Math.max(1,Math.round(pt.img.height*k));ctx.drawImage(pt.img,Math.round(x+pt.ox*k-w/2),Math.round(y-h/2),w,h);}
function drawEye(img,x,fy,H,e,tone,blink,ink){const sc=H/img.height,w=Math.max(3,Math.round(img.width*sc));let hh=H,sy=fy-(H>>1);ctx.imageSmoothingEnabled=false;
  const kind=blink&&e.eyes==='open'?'closed':e.eyes;
  if(kind==='closed'||kind==='happy'){const part=Math.round(img.height*.32);ctx.drawImage(img,0,0,img.width,part,x-(w>>1),sy,w,Math.round(part*sc));if(kind==='closed')px(x-(w>>1)+1,sy+Math.round(part*sc),ink,w-2,1);else{px(x-(w>>1),sy+Math.round(part*sc)+1,ink);px(x-(w>>1)+1,sy+Math.round(part*sc),ink,w-2,1);px(x+(w>>1)-1,sy+Math.round(part*sc)+1,ink);}return;}
  if(kind==='squint'){hh=Math.max(3,H>>1);sy=fy-(hh>>1);ctx.drawImage(img,x-(w>>1),sy,w,hh);return;}
  if(kind==='small'){const w2=Math.max(3,Math.round(w*.75)),h2=Math.max(3,Math.round(H*.75));ctx.drawImage(img,x-(w2>>1),fy-(h2>>1),w2,h2);return;}
  ctx.drawImage(img,x-(w>>1),sy,w,hh);
  if(kind==='half'){ctx.fillStyle=tone;ctx.fillRect(x-(w>>1),sy,w,Math.round(hh*.45));px(x-(w>>1),sy+Math.round(hh*.45),ink,w,1);}}
function drawFace(cx,fy,d,er,e,tone,blink,style){const ink=C.ink;
  if(style!=null&&style>=EYES.length&&faceSet(style-EYES.length)&&e.eyes!=='x'){const fs=faceSet(style-EYES.length),H=Math.round((2*er+5)*1.35),k=H/fs.L.img.height;ctx.imageSmoothingEnabled=false;
    const ey=fy-2;drawEye(fs.L.img,cx-d,ey,H,e,tone,blink,ink);drawEye(fs.R.img,cx+d,ey,H,e,tone,blink,ink);
    const kb=k*.7,km=k*.55,drop=e.eyes==='squint'?Math.round(H*.18):0,by=ey-(H>>1)-Math.round((fs.bL||fs.bR||fs.L).img.height*kb/2)+drop;if(fs.bL)partAt(fs.bL,cx-d,by,kb);if(fs.bR)partAt(fs.bR,cx+d,by,kb);
    if(fs.M&&(e.mouth==='smile'||e.mouth==='none'||e.mouth==='flat')){partAt(fs.M,cx,ey+(H>>1)+Math.round(fs.M.img.height*km/2)-1,km);e={...e,mouth:'sprite'};}}
  else if(style!=null&&EYES[style]&&e.eyes!=='x'){const im=eyeImg(style),H=Math.round((2*er+5)*1.35);drawEye(im.L,cx-d,fy,H,e,tone,blink,ink);drawEye(im.R,cx+d,fy,H,e,tone,blink,ink);}
  else{const eye=(x)=>{
    if(e.eyes==='closed'||blink){px(x-er,fy,ink,er*2+1,1);return;}
    if(e.eyes==='x'){for(let k=-1;k<=1;k++){px(x+k,fy+k,ink);px(x+k,fy-k,ink);}return;}
    if(e.eyes==='happy'){px(x-er,fy+1,ink);px(x-er+1,fy,ink,er*2-1,1);px(x+er,fy+1,ink);return;}
    if(e.eyes==='squint'){px(x-er,fy,ink,er*2+1,1);px(x-er,fy-1,ink);px(x+er,fy-1,ink);return;}
    const r=e.eyes==='small'?Math.max(1,er-1):er;fillEllipse(x,fy,r,r+1,C.white);px(x-r,fy-r-1,tone,r*2+1,1);
    if(e.eyes==='half'){px(x-r,fy-r,tone,r*2+1,Math.max(1,r));}
    fillEllipse(x,fy+1,Math.max(1,r-1),Math.max(1,r),ink);px(x-1,fy-1,C.white);if(e.sparkle)px(x+1,fy+1,C.white);};
  eye(cx-d);eye(cx+d);}
  const my=fy+er+3;
  if(e.mouth==='smile'){px(cx-2,my,ink);px(cx-1,my+1,ink,3,1);px(cx+2,my,ink);}
  else if(e.mouth==='o'){px(cx-1,my,ink,3,1);px(cx-1,my+2,ink,3,1);px(cx-2,my+1,ink);px(cx+2,my+1,ink);}
  else if(e.mouth==='wobble'){px(cx-2,my+1,ink);px(cx-1,my,ink);px(cx,my+1,ink);px(cx+1,my,ink);px(cx+2,my+1,ink);}
  else if(e.mouth==='flat'){px(cx-1,my,ink,3,1);}
  if(e.blush){px(cx-d-er-3,fy+er,'#f4a0b0',3,1);px(cx+d+er+1,fy+er,'#f4a0b0',3,1);}
  if(e.scorch){px(cx-d-er-3,fy+er,'#e05050',3,2);px(cx+d+er+1,fy+er,'#e05050',3,2);}
  if(e.sweat){px(cx+d+er+4,fy-er-3,'#8fd0ff',2,3);px(cx+d+er+4,fy-er-3,C.white);}
  if(e.zzz){text('ZZZ',cx+d+er+4,fy-er-8,C.navy);}
}
let MOSSCV=null,MOSSTINT=null;function mossImg(){if(!MOSSCV)MOSSCV=sprite(MOSSIMG.rows,MOSSIMG.pal,[MOSSIMG.w,MOSSIMG.h]);return MOSSCV;}
const hasArt=pr=>pr.sub==='rock';
function drawMossImg(cx,base,g,q,sp,wake,bounce,snap){const img=mossImg();const bt=bounce>0?Math.sin((1-bounce/20)*Math.PI):0;const sc=(0.5+g*0.5)*1.0;
  const w=Math.max(8,Math.round(img.width*sc*(1+.06*bt))),h=Math.max(8,Math.round(img.height*sc*(1-.06*bt)));const x=Math.round(cx-w/2),y=Math.round(base-h*0.74);   // the ragged underside sinks into the soil
  ctx.imageSmoothingEnabled=false;
  const dry=q.dead?1:Math.max(0,Math.min(1,(.3-q.hyd)/.15));const tint=Math.min(1,dry*.8+(1-q.health)*.25+(q.dormant?.2:0));
  if(tint>.02){if(!MOSSTINT)MOSSTINT=document.createElement('canvas');MOSSTINT.width=w;MOSSTINT.height=h;const og=MOSSTINT.getContext('2d');og.imageSmoothingEnabled=false;og.drawImage(img,0,0,w,h);og.globalCompositeOperation='source-atop';og.fillStyle='rgba(150,118,74,'+tint.toFixed(2)+')';og.fillRect(0,0,w,h);og.globalCompositeOperation='source-over';ctx.drawImage(MOSSTINT,x,y);}
  else ctx.drawImage(img,x,y,w,h);
  const f=MOSSIMG.face;const fx=x+(f.x+f.w*.5)*sc,fy=y+(f.y+f.h*.48)*sc,d=Math.max(4,Math.round(f.w*sc*.19));
  const tn=tones(q.health,q.hyd,0,q.dead);const e=expr(q,wake);drawFace(Math.round(fx),Math.round(fy),d,3+Math.round(g*2),e,tn[1],!snap&&pa.blink>0&&e.eyes==='open',eyeStyle(sp));
  if(e.sparkle&&!snap&&((frame>>3)%7)<3){px(fx-d-6,fy-8,C.white,1,3);px(fx-d-7,fy-7,C.white,3,1);}
  return {rx:w/2,ry:h*.6,y0:base};}
function drawChibi(cx,base,g,q,pr,sp,wake,bounce,snap){
  const tn=tones(q.health,q.hyd,wake>0?1-wake/90:0,q.dead);const S=shoots(sp.key);
  const br=snap?0:Math.sin(frame/28)*.02;const bt=bounce>0?Math.sin((1-bounce/20)*Math.PI):0;
  const curl=q.dormant&&wake===0?.86:1;
  let rx,ry,fy,d;
  if(pr.form==='mat'){rx=(34+g*20)*(1+.08*bt);ry=(12+g*10)*curl*(1+br-.1*bt);}
  else if(pr.form==='hummock'){rx=(22+g*22)*(1+.06*bt);ry=(18+g*18)*curl*(1+br-.1*bt);}
  else{rx=(22+g*22)*(1+.08*bt);ry=(18+g*20)*curl*(1+br-.1*bt);}
  const y0=base-Math.round(bt*5);
  // body
  if(pr.form==='hummock'){const puffs=[[0,0,1],[-.55,.15,.7],[.55,.15,.7],[-.25,-.45,.6],[.3,-.5,.55]];
    puffs.forEach(([ox,oy,sc])=>{fillEllipse(cx+ox*rx,y0-ry*.55+oy*ry*.6,rx*.55*sc,ry*.5*sc,tn[3]);});
    puffs.forEach(([ox,oy,sc])=>{fillEllipse(cx+ox*rx,y0-ry*.55+oy*ry*.6,rx*.55*sc-1,ry*.5*sc-1,tn[1]);fillEllipse(cx+ox*rx-rx*.12*sc,y0-ry*.55+oy*ry*.6-ry*.15*sc,rx*.2*sc,ry*.15*sc,tn[2]);});
    for(let i=0;i<20+g*40;i++){const s=S[i];const x=cx+(s.x-.5)*rx*1.6,y=y0-ry*.1-s.y*ry*.9;if(Math.hypot((x-cx)/(rx*1.05),(y-(y0-ry*.55))/(ry*.8))<1)px(x,y,i%3?'rgba(215,120,110,0.85)':tn[2]);}
    fy=y0-ry*.62;d=rx*.28;}
  else{fillEllipse(cx,y0,rx,ry,tn[3],true);fillEllipse(cx,y0,rx-1,ry-1,tn[1],true);
    fillEllipse(cx-rx*.3,y0-ry*.5,rx*.32,ry*.28,tn[2]);fillEllipse(cx+rx*.25,y0-ry*.15,rx*.35,ry*.18,tn[0]);
    if(pr.form==='mat'){for(let i=0;i<Math.round(rx/3);i++){const t=(i+.5)/Math.round(rx/3);const x=cx-rx+t*rx*2;const yy=y0-ry*Math.sqrt(Math.max(0,1-Math.pow(t*2-1,2)));px(x,yy-2,tn[1],1,2);px(x+1,yy-1,tn[2]);}
      for(let i=0;i<8+g*10;i++){const s=S[i];const x=cx+(s.x-.5)*rx*1.5,y=y0-s.y*ry*.7;for(let k=0;k<4+s.h*6;k++)px(x+k*(s.k<.5?-1:1),y-Math.round(Math.sin(k*.8)*1),k%2?tn[2]:tn[0]);}
      fy=y0-ry*.45;d=rx*.32;}
    else{const spiky=SPIKY.has(sp.family);const n=Math.round(14+g*30);
      for(let i=0;i<n;i++){const t=(i+.5)/n,ang=Math.PI*(1-t);const ex=cx+Math.cos(ang)*(rx-1),ey=y0-Math.sin(ang)*(ry-1);const L=(spiky?3:1)+Math.round(S[i].h*(spiky?3:1.5));
        for(let k=1;k<=L;k++)px(ex+Math.cos(ang)*k,ey-Math.sin(ang)*k,k===L?tn[2]:tn[0]);}
      for(let i=0;i<10+g*30;i++){const s=S[i+30];const x=cx+(s.x-.5)*rx*1.5,y=y0-s.y*ry*.85;if(Math.hypot((x-cx)/rx,(y-y0)/ry)<.9)px(x,y,i%2?tn[2]:tn[0]);}
      if(sp.family==='Bryaceae')for(let i=0;i<12;i++){const s=S[i+60];px(cx+(s.x-.5)*rx*1.2,y0-ry*.4-s.y*ry*.5,'#e8f0f0');}
      fy=y0-ry*.5;d=rx*.3;}}
  // rhizoids
  for(let i=0;i<5;i++){const s=S[i+80];const x=cx+(s.x-.5)*rx*1.4;for(let k=1;k<3+s.h*3;k++)px(x+(k%2?1:0)*(s.k<.5?-1:1),y0+k,'#b09060');}
  // sporophyte antennae
  const so=q.spor;if(so>.3){const k=1+Math.round(so*4);for(let i=0;i<k;i++){const s=S[(i*11)%S.length];const bx=cx+(s.x-.5)*rx*1.1,by=y0-ry*Math.sqrt(Math.max(0,1-Math.pow((bx-cx)/rx,2)))+1;const len=8+Math.round(s.h*8+so*6);
      for(let t=0;t<len;t++)px(bx+Math.round(Math.sin(t*.25+s.b*6)*1.2),by-t,'#7a4a2a');
      const tx=bx+Math.round(Math.sin(len*.25+s.b*6)*1.2),ty=by-len;const ripe=so>.85;const cap=ripe?'#9a5a24':rgb([lerp(150,190,so),lerp(180,150,so),lerp(90,60,so)]);
      px(tx-1,ty-4,cap,3,4);px(tx-1,ty-4,ripe?'#c07a3a':'#c8e0a0');
      if(!ripe){px(tx,ty-6,'#e0c898');px(tx-1,ty-5,'#e0c898',3,1);}else{px(tx-1,ty-5,'#5a3010',3,1);if(!snap&&((frame>>4)+i)%5===0)for(let m=0;m<3;m++)px(tx+((frame*.3+m*7+i*3)%14)-7,ty-8-((frame*.2+m*5)%10),'rgba(230,220,180,0.8)');}}}
  // face
  const e=expr(q,wake);drawFace(Math.round(cx),Math.round(fy),Math.round(d),3+Math.round(g*2),e,tn[1],!snap&&pa.blink>0&&e.eyes==='open',eyeStyle(sp));
  if(e.sparkle&&!snap){const t=(frame>>3)%7;if(t<3){const s=S[(frame>>5)%S.length];const sx=cx+(s.x-.5)*rx*1.8,sy=y0-ry-4-s.y*8;px(sx,sy-1,C.white,1,3);px(sx-1,sy,C.white,3,1);}}
  return {rx,ry,y0};}
function roundRect(x,y,w,h,r,col){ctx.fillStyle=col;for(let i=0;i<r;i++){const d=r-Math.round(Math.sqrt(r*r-(r-i-.5)*(r-i-.5)));ctx.fillRect(x+d,y+i,w-2*d,1);ctx.fillRect(x+d,y+h-1-i,w-2*d,1);}ctx.fillRect(x,y+r,w,h-2*r);}
const JARGOODS=[['big','a bigger jar',25,'twice the soil. the moss spreads further'],['pebbles','river pebbles',5,'three smooth stones on the soil'],['twig','driftwood',5,'a branch to grow along'],['snail','a snail',8,'it keeps the glass clean and the moss company'],['lights','fairy lights',10,'a string of tiny lights under the lid']];
const jarHas=id=>!!(save.jar&&save.jar[id]);
function drawPot(x,y,w,h,p,snap){const q=snap?{hyd:snap.w,health:snap.h,fit:p.fit,algae:snap.a,spor:snap.s,dormant:snap.w<.15,dead:snap.h<=0,light:p.light,air:p.air}:p;const g=snap?snap.g:p.growth;
  const sp=petSp(p),pr=prefs(sp);const li=p.light;const R=rng(p.key*3+11);
  // the window behind the shelf: the light setting is the weather
  const bg=li>.8?['#fff3c0','#ffe08a']:li>.4?['#d2e8fa','#9ccaf0']:['#8b96ae','#5e6a86'];const gr=ctx.createLinearGradient(0,y-20,0,y+h+16);gr.addColorStop(0,bg[0]);gr.addColorStop(1,bg[1]);
  bevelOut(x-22,y-22,w+44,h+44,'#e8e4dc');ctx.fillStyle=gr;ctx.fillRect(x-18,y-18,w+36,h+36);px(x+(w>>1)-1,y-18,'#e8e4dc',2,h+36);px(x-18,y+h*.3,'#e8e4dc',w+36,2);
  if(li>.8){ctx.fillStyle='rgba(255,235,160,0.45)';for(let i=0;i<5;i++)ctx.fillRect(x-18+i*(w+36)/5+8,y-18,3,h+36);}
  else if(li<.4){for(let i=0;i<9;i++)px(x-12+((R()*(w+24))|0),y-14+((R()*(h*.35))|0),'#e8ecf4');}
  px(x-22,y-22,C.lav2,12,h+40);for(let i=0;i<5;i++)px(x-20+i*2,y-20,C.lav,1,h+36);
  // shelf
  rect(x-22,y+h+6,w+44,12,'#a08060');rect(x-22,y+h+6,w+44,1,'#c8a880');rect(x-22,y+h+17,w+44,1,'#6a4a30');
  px(x+w+4,y+h+2,'#f2c94c',12,3);px(x+w+16,y+h+2,'#f0a0b0',3,3);px(x+w+2,y+h+2,'#3a3a44',2,3);
  px(x-18,y+h-2,'#f4d35e',9,8);px(x-16,y+h,'#e0b840',2,2);px(x-12,y+h+3,'#e0b840',2,2);px(x-18,y+h-2,'#d9a441',9,1);
  // the jar: shoulders, neck, cork lid
  const rr=Math.min(14,w>>3);roundRect(x,y+6,w,h-6,rr,'rgba(20,40,80,0.75)');roundRect(x+1,y+7,w-2,h-8,rr-1,'rgba(230,242,255,0.5)');
  const nx=x+(w>>2),nw=w>>1;rect(nx,y,nw,8,'rgba(230,242,255,0.5)');px(nx,y,'rgba(20,40,80,0.75)',1,8);px(nx+nw-1,y,'rgba(20,40,80,0.75)',1,8);
  bevelOut(nx-3,y-9,nw+6,10,'#b07a44');rect(nx-1,y-6,nw+2,1,'#8a5a2c');rect(nx-1,y-3,nw+2,1,'#8a5a2c');
  px(nx-7,y-4,'#9a9aa2',2,12);px(nx+nw+5,y-4,'#9a9aa2',2,12);px(nx-7,y-4,'#c8c8d0',nw+14,2);px(nx-9,y+6,'#6a6a72',4,3);px(nx+nw+5,y+6,'#6a6a72',4,3);
  // layers: gravel, charcoal, soil
  const sh=Math.round(h*.26),gy=y+h-Math.round(h*.09),cy=gy-3,sy=y+h-sh;
  rect(x+2,gy,w-4,h-(gy-y)-2,'#b9bcc4');for(let i=0;i<Math.round(w/3);i++){px(x+3+((R()*(w-7))|0),gy+1+((R()*(h-(gy-y)-5))|0),'#8f939c',2,1);px(x+3+((R()*(w-7))|0),gy+1+((R()*(h-(gy-y)-5))|0),'#e6e8ee');}
  rect(x+2,cy,w-4,3,'#1e1e22');rect(x+2,cy,w-4,1,'#3a3a40');
  const sc=SUBCOL[p.sub][0],sl=SUBCOL[p.sub][1];rect(x+2,sy,w-4,cy-sy,sc);fillEllipse(x+(w>>1),sy,(w>>1)-2,3,sc);for(let i=0;i<Math.round(w/2);i++)px(x+3+((R()*(w-7))|0),sy+1+((R()*(cy-sy-2))|0),sl);
  // goods on the soil
  if(jarHas('pebbles')){[[.09,-1,8,5],[.19,1,6,4],[.86,-1,9,5],[.93,1,5,3]].forEach(([f,o,rx,ry])=>{const bx=x+f*w,by=sy+o;fillEllipse(bx,by,rx,ry,'#3e4249');fillEllipse(bx,by-1,rx-1,ry-1,'#8e939e');fillEllipse(bx-1,by-2,Math.max(1,rx-4),Math.max(1,ry-3),'#b9bec8');px(bx-rx+3,by-ry+1,'#e2e6ee',2,1);});}
  if(jarHas('twig')){const tx=x+w*.68,ty=sy-1,L=Math.round(w*.26);for(let k=0;k<L;k++){const yy=ty-Math.round(k*.4);px(tx+k,yy,'#5a3d22',1,3);px(tx+k,yy,'#8a6440');if(k===Math.round(L*.45))for(let m=0;m<7;m++)px(tx+k+m,yy-2-m,'#6a4a2c',1,2);if(k===Math.round(L*.75))for(let m=0;m<5;m++)px(tx+k-m,yy-3-m,'#6a4a2c',1,2);}px(tx+Math.round(L*.3),ty-Math.round(L*.12)+1,'#3a2614',2,1);}
  // the moss, and the carpet it spreads into
  const base=sy-1;const tn=tones(q.health,q.hyd,0,q.dead);const spread=Math.round(g*(jarHas('big')?7:4));
  for(let i=0;i<spread;i++){const f=i%2?.16+i*.06:.84-i*.06;const bx=x+f*w,ry=3+Math.round(g*4);fillEllipse(bx,base,7+g*5,ry,tn[3]);fillEllipse(bx,base,6+g*5,ry-1,tn[1]);px(bx-2,base-ry+1,tn[2],3,1);}
  const ks=Math.max(1,Math.min(1.7,w/150));ctx.save();ctx.translate(x+(w>>1),base);ctx.scale(ks,ks);ctx.translate(-(x+(w>>1)),-base);const info=hasArt(pr)?drawMossImg(x+(w>>1),base,g,q,sp,snap?0:pa.wake,snap?0:pa.bounce,snap):drawChibi(x+(w>>1),base,g,q,pr,sp,snap?0:pa.wake,snap?0:pa.bounce,snap);ctx.restore();
  // the snail, or the springtail
  if(!snap&&!q.dead){const bug=pa.bug;const bx=x+6+bug.x*(w-16),by=base-1;
    if(jarHas('snail')){fillEllipse(bx+1,by-5,6,5,'#5a3a1c');fillEllipse(bx+1,by-5,5,4,'#c48a4a');fillEllipse(bx+2,by-5,3,2,'#e8b878');px(bx+2,by-5,'#8a5a2c');px(bx-9,by-2,'#e0d0a8',10,3);px(bx-9,by-3,'#e0d0a8',3,1);px(bx-9,by-6,'#c8b890',1,4);px(bx-6,by-6,'#c8b890',1,4);px(bx-10,by-7,'#3a2a1a',2,2);px(bx-7,by-7,'#3a2a1a',2,2);}
    else if(q.fit>.6&&!q.dormant){const hy=by-bug.y*6-(bug.hop>0?3:0);px(bx,hy,'#8a6a4a',3,2);px(bx-1,hy-1,'#5a4a3a');px(bx+3,hy-1,'#5a4a3a');}}
  // the water cycle on the glass: beads high up when it is wet, fog at the shoulders, drips running down
  const nd=Math.round(q.hyd*16);for(let i=0;i<nd;i++){const dx=x+6+((R()*(w-12))|0),dy=y+10+((R()*(h*.35))|0);px(dx,dy,'rgba(160,210,255,0.8)',1,2);px(dx,dy,'rgba(255,255,255,0.9)');}
  if(q.hyd>.75){ctx.fillStyle='rgba(255,255,255,'+((q.hyd-.75)*1.6)+')';ctx.fillRect(x+2,y+8,w-4,h*.16);}
  if(q.algae>.05){ctx.fillStyle='rgba(90,160,60,'+(q.algae*.4)+')';ctx.fillRect(x+2,y+h*.4,w-4,sy-y-h*.4);}
  if(!snap)for(const bd of pa.beads){px(bd.x,bd.y,'#8fd0ff',1,3);px(bd.x,bd.y,C.white);}
  px(x+4,y+14,'rgba(255,255,255,0.8)',1,h-30);px(x+6,y+14,'rgba(255,255,255,0.5)',1,h*.3);px(x+w-5,y+16,'rgba(255,255,255,0.35)',1,h*.5);
  if(jarHas('lights')){const n=9,cols=['#ffe27a','#ff9ab0','#9ad8ff'];for(let i=0;i<n;i++){const lx=Math.round(x+8+i*((w-16)/(n-1))),ly=y+13+Math.round(Math.sin(i*1.1)*4);if(i<n-1){const nx=Math.round(x+8+(i+1)*((w-16)/(n-1))),ny=y+13+Math.round(Math.sin((i+1)*1.1)*4);for(let t=0;t<6;t++)px(lx+Math.round((nx-lx)*t/6),ly-3+Math.round((ny-ly)*t/6),'#4a3a2a');}const on=((frame>>4)+i)%4!==0,c=cols[i%3];if(on){ctx.fillStyle=c.replace(')',',0.35)').replace('#','rgba(').length?'rgba(255,240,200,0.28)':c;ctx.fillRect(lx-3,ly-3,8,8);}px(lx-1,ly-3,'#4a3a2a',3,2);px(lx-1,ly-1,on?c:'#8a8a80',4,4);px(lx,ly,on?'#ffffff':'#a0a098');}}
  // name tag
  const tagw=Math.min(w-10,tw(p.name)+10);const tx=x+w-tagw-5,ty=sy+5;px(tx,ty,C.lav,tagw,9);px(tx,ty,C.lav2,tagw,1);text(p.name,tx+5,ty+2,C.white);px(tx-4,ty+1,C.lav,3,3);px(tx-4,ty+5,C.lav,3,3);
  return info;}
function drawJar(x,y,w,h,p,snap){return drawPot(x,y,w,h,p,snap);}
let JAR={x:58,y:16,w:140,h:158};
function jarRect(){const h=Math.max(100,cv.height-44),w=Math.max(90,Math.round(cv.width*(jarHas('big')?0.86:0.7)));JAR={x:(cv.width-w)>>1,y:24,w,h};}
function addBeads(n){for(let k=0;k<n;k++)pa.beads.push({x:JAR.x+6+Math.random()*(JAR.w-12),y:JAR.y+12+Math.random()*30,v:.15+Math.random()*.35});}
function petAnim(p){if(pa.blink>0)pa.blink--;if(p&&p.hyd>.55&&!p.dormant&&frame%70===0)pa.beads.push({x:JAR.x+(Math.random()<.5?5:JAR.w-6),y:JAR.y+12+Math.random()*20,v:.25+Math.random()*.3});else if(Math.random()<.008)pa.blink=6;if(pa.wake>0)pa.wake--;if(pa.bounce>0)pa.bounce--;
  for(let i=pa.beads.length-1;i>=0;i--){const b=pa.beads[i];b.y+=b.v;if(b.y>JAR.y+JAR.h*0.72)pa.beads.splice(i,1);}
  const b=pa.bug;if(b.hop>0)b.hop--;if(--b.t<=0){b.t=30+(Math.random()*50|0);b.x=Math.max(.05,Math.min(.95,b.x+(Math.random()-.5)*.3));b.hop=6;}}
function petAge(p){const ms=Date.now()-p.born,d=Math.floor(ms/86400000),h=Math.floor(ms/3600000)%24;return d?d+'D '+h+'H':h+'H';}

/* ---------------- GoodMoss controls ---------------- */
let petCur=0,pick={cur:0},lapse={i:0},naming=null,petMenu=false;
function petAct(i){const p=save.pet;if(!p)return;if(p.dead&&i<2){snd('miss');say('IT IS GONE. TAKE A NEW CUTTING.');return;}
  if(i===0){const was=p.dormant;p.hyd=Math.min(1,p.hyd+.3);p.log.unshift('MISTED.');snd('ok');addBeads(6);
    if(was&&p.hyd>=.15){p.dormant=false;pa.wake=90;p.log.unshift('REVIVED! GREEN AGAIN WITHIN MINUTES.');snd('collect',p.key);}}
  else if(i===1){const k=(LIGHTS.findIndex(l=>l[0]===p.light)+1)%3;p.light=LIGHTS[k][0];p.log.unshift('MOVED TO '+LIGHTS[k][1]+'.');snd('move',k);}
  else if(i===2){if(p.snaps.length<2){snd('miss');say('NOTHING TO REPLAY YET');return;}lapse.i=0;go('petlapse');return;}
  else if(i===3){p.last-=6*3600000;simPet(p,Date.now());snd('found');say('6 HOURS PASSED (TEST)');}
  else if(i===4){petMenu=false;save.pet=null;snd('back');openPick();return;}
  if(p.log.length>8)p.log.length=8;persist();dirty();}
function pickList(){return SP.filter(s=>save.collected[s.key]);}
function openPick(){if(!pickList().length){snd('miss');say('COLLECT A MOSS FIRST, THEN PLANT IT');go('world');return;}naming=null;go('petpick');}
function plantPick(sp,name){save.pet=newPet(sp,name);save.pet.log=['PLANTED '+sp.name.toUpperCase()+' ON '+save.pet.sub.toUpperCase()+'.'];persist();snd('collect',sp.id);petCur=0;naming=null;go('pet');}
function openPet(){petMenu=false;if(save.pet){simPet(save.pet,Date.now());persist();petCur=0;go('pet');}else openPick();}
function petLabels(p){const pr=prefs(petSp(p));const L=LIGHTS.find(l=>l[0]===p.light)[1].toLowerCase();
  return [['water','a light mist. too much and algae moves in',0],['light: '+L,'shade, window, full sun. it likes '+word(pr.light,'shade','half shade','sun'),1],
    ['time-lapse','the jar so far, replayed',2],['fast-forward 6h','a test button: six hours pass',3,'dev']];}
// one sentence: how it is, and the one thing to do about it
function petAdvice(p){const pr=prefs(petSp(p));
  if(p.dead)return 'it is gone. take a new cutting.';
  if(p.dormant)return 'dried out and dormant. water it and it wakes within minutes.';
  if(p.hyd>.9)return 'soggy. let it dry a little before the next mist.';
  if(p.algae>.5)return 'a film of algae. go easier on the water.';
  if(p.hyd<pr.moist-.25)return 'thirsty. a mist would do.';
  if(p.light>pr.light+.35)return 'too bright for it. move it to '+(pr.light<.4?'the shade':'the window')+'.';
  if(p.light<pr.light-.35)return 'wants more light. try '+(pr.light>.7?'full sun':'the window')+'.';
  if(p.spor>.5)return 'putting up sporophytes. keep doing what you are doing.';
  if(p.fit>.75)return 'thriving.';
  if(p.fit>.5)return 'content.';return 'struggling a little. check light and water.';}
const pips=(v,n)=>{const k=Math.round(Math.max(0,Math.min(1,v))*n);return '●'.repeat(k)+'○'.repeat(n-k);};

/* ---------------- the Dealer ---------------- */
let shop=null;const TIERS={};const TIERN=['common','uncommon','rare'];
function tierOf(sp,c){if(!TIERS[c]){const L=roster[c].slice().sort((a,b)=>(b.regionCounts[c]||0)-(a.regionCounts[c]||0));const m={};L.forEach((x,i)=>{const f=i/L.length;m[x.key]=f<.5?0:f<.85?1:2;});TIERS[c]=m;}return TIERS[c][sp.key]||0;}
const dayKey=()=>new Date().toISOString().slice(0,10);
function hashStr(t){let h=7;for(const ch of String(t))h=(h*31+ch.charCodeAt(0))>>>0;return h;}
function shopState(){if(!save.shop||save.shop.day!==dayKey())save.shop={day:dayKey(),sold:{}};return save.shop;}
const BUYP=[4,9,15],SELLP=[1,3,6];
function dailyStock(c){const st=shopState();const r=rng(hashStr(dayKey()+'stock'+c));const pick=(t,n)=>{const L=roster[c].filter(x=>tierOf(x,c)===t&&!save.collected[x.key]).sort((A,B)=>String(A.key)<String(B.key)?-1:1);const out=[];for(let k=0;k<n&&L.length;k++)out.push(L.splice((r()*L.length)|0,1)[0]);return out;};
  const rows=[...pick(0,2),...pick(1,2),...pick(2,1)];return rows.map(sp=>{const t=tierOf(sp,c);const wob=((hashStr(dayKey()+sp.key)%5)-2);const yest=((hashStr(String(Number(dayKey().slice(-2))-1)+sp.key)%5)-2);return {sp,t,price:Math.max(2,BUYP[t]+wob),up:wob>=yest,sold:!!st.sold[sp.key]};});}
function shopBuy(key){const c=REG(),st=shopState();const it=dailyStock(c).find(x=>String(x.sp.key)===String(key));if(!it||it.sold)return;if(save.cheese<it.price){snd('miss');say(it.price+' CHEESE. NO CREDIT');return;}
  save.cheese-=it.price;st.sold[it.sp.key]=true;save.collected[it.sp.key]=Date.now();save.seen[it.sp.key]=1;persist();snd('collect',it.sp.id);say('BOUGHT '+it.sp.name.toUpperCase()+'. IT NEVER HAPPENED.');dirty();}
let confirmSell=null;
function shopSell(key){const c=REG();const sp=SP.find(x=>String(x.key)===String(key));if(!sp||!save.collected[sp.key])return;const pr=SELLP[tierOf(sp,c)];
  if(confirmSell!==String(key)){confirmSell=String(key);snd('miss');say('HE OFFERS '+pr+' CHEESE FOR '+sp.name.toUpperCase()+'. PRESS AGAIN TO SELL');return;}
  confirmSell=null;delete save.collected[sp.key];save.seen[sp.key]=1;save.cheese+=pr;persist();snd('ok');say('SOLD. '+sp.name.toUpperCase()+' IS OFF YOUR MOSSDEX. +'+pr+' CHEESE');dirty();}
function dailyCutting(c){const r=rng(hashStr(dayKey()+c));const L=roster[c].filter(x=>tierOf(x,c)===2&&!save.collected[x.key]);return L.length?L[(r()*L.length)|0]:null;}
const QUIPS=['heard the professor lost something. a thousand somethings. terrible business.','files go missing all the time. sometimes they turn up again. for a price.','I never click links. ask him if he does.','the moss remembers what the database forgot.','keep your voice down. these walls have spores.','somebody was shopping a very long moss list last night. was not me. I only buy.','every entry you bring back, somebody wanted gone. think about that.','you did not see me. you did not see the coat.'];
function openShop(){shopState();confirmSell=null;shop={mode:'menu',pick:[],quip:QUIPS[(Math.random()*QUIPS.length)|0],res:null};snd('move',2);go('shop');}
function shopTip(){if(save.cheese<3){snd('miss');say('THREE CHEESE FOR A TIP');return;}const c=REG();const unseen=roster[c].filter(x=>!known(x));if(!unseen.length){snd('miss');say('NOTHING LEFT TO SHOW YOU HERE');return;}
  let o=spots.find(q=>q.sp&&!known(q.sp)&&!q.tip);if(!o){o=spots.find(q=>!q.tip);if(!o){snd('miss');say('HE HAS ALREADY POINTED AT EVERYTHING');return;}o.sp=unseen[(Math.random()*unseen.length)|0];}
  o.tip=true;save.cheese-=3;persist();snd('ok');const dx=o.x-player.x,dy=o.y-player.y;const ns=dy<-2?'north':dy>2?'south':'',ew=dx<-2?'west':dx>2?'east':'';const dir=(ns&&ew)?ns+'-'+ew:(ns||ew||'right here');const steps=Math.abs(dx)+Math.abs(dy);shop.quip=steps<3?'you are standing next to it. the tuft with the question mark.':'about '+steps+' steps '+dir+' of this door. look for the question mark over the tuft. you did not hear it from me.';dirty();}
function shopCutting(){const c=REG(),st=shopState();const sp=dailyCutting(c);if(!sp||st.sold[c]){snd('miss');say('SOLD OUT. COME BACK TOMORROW');return;}if(save.cheese<15){snd('miss');say('FIFTEEN CHEESE. NO CREDIT');return;}
  save.cheese-=15;st.sold[c]=true;save.collected[sp.key]=Date.now();save.seen[sp.key]=1;persist();snd('collect',sp.id);shop.res={sp,t:'a cutting of '+sp.name+'. this never happened.'};shop.mode='result';dirty();}
function shopPick(key){key=String(key);const i=shop.pick.indexOf(key);if(i>=0)shop.pick.splice(i,1);else if(shop.pick.length<2)shop.pick.push(key);else{snd('miss');say('TWO AT A TIME');return;}snd('move',shop.pick.length);dirty();}
function shopDeal(){const c=REG();if(shop.pick.length!==2)return;const A=SP.find(x=>String(x.key)===shop.pick[0]),B=SP.find(x=>String(x.key)===shop.pick[1]);if(!A||!B)return;const t=tierOf(A,c);if(tierOf(B,c)!==t){snd('miss');say('TWO OF THE SAME KIND');return;}
  const pool=roster[c].filter(x=>tierOf(x,c)===t+1&&!save.collected[x.key]);if(!pool.length){snd('miss');say('HE HAS NOTHING OF THAT KIND LEFT');return;}
  delete save.collected[A.key];save.seen[A.key]=1;
  if(Math.random()<0.8){delete save.collected[B.key];save.seen[B.key]=1;const sp=pool[(Math.random()*pool.length)|0];save.collected[sp.key]=Date.now();save.seen[sp.key]=1;shop.res={sp,t:'done. '+sp.name+' is yours. '+A.name+' and '+B.name+' are his now.'};snd('collect',sp.id);}
  else{shop.res={sp:null,t:'the deal fell through. he kept '+A.name+' anyway. '+B.name+' is still yours. that is the risk.'};snd('miss');}
  shop.pick=[];shop.mode='result';persist();dirty();}
function drawShop(){rect(0,0,cv.width,cv.height,'#2f4a5e');const r=rng(99);for(let i=0;i<34;i++){const x=(r()*cv.width)|0,y=(r()*(cv.height-30))|0;px(x,y,'#1f3242',9,1);px(x+4,y-4,'#1f3242',1,4);}
  rect(0,cv.height-26,cv.width,26,'#1c2b38');rect(0,cv.height-26,cv.width,1,'#3d5870');
  const blink=(frame%170)<6,bob=(frame>>5)&1;const k=Math.max(1,Math.min(2,(cv.height-26)/66));ctx.save();ctx.translate(Math.round(cv.width*0.5-20*k),cv.height-26-Math.round(64*k)+bob);ctx.scale(k,k);ctx.drawImage(blink?DEALER2:DEALER,0,0);ctx.restore();
  withFont(F7,()=>{const t='THE DEALER';const w=tw(t)+8;bevelOut(6,6,w,12,C.paper);text(t,10,9,C.ink);});}

/* ---------------- states ---------------- */
let state='title',cur=0,enc=null,jr={filter:0,cur:0},entry=null,shot=false,info=false,card=null,bsel=null,toast=null,chimed=false,menuOpen=false,confirmNew=0,confirmRel=0,uiDirty=true,screenSig='';
const REG=()=>save.region;
let JF=9;function jlist(){return jr.filter===0?SP:jr.filter===JF-1?SP.filter(s=>save.collected[s.key]):roster[CONT[jr.filter-1]];}
function go(st){state=st;dirty();}
function dirty(){uiDirty=true;if(ui&&SP&&running)render();}
function say(t,n){toast={t,n:n||150};dirty();}
function placeDealer(ci){dealerAt=null;const r=rng(ci*977+3);const cand=[];for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++)if(map[y][x]===BLDG&&[[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy])=>WALK[map[y+dy][x+dx]]))cand.push([x,y]);
  if(cand.length){const [x,y]=cand[(r()*cand.length)|0];dealerAt={x,y};}}
function enterRegion(c){snd('ok');save.region=c;persist();genMap(c);placeDealer(CONT.indexOf(c));menuOpen=false;toast={t:'WELCOME TO '+CN[c],n:120};ambientFor(CONT.indexOf(c));go('world');}
function openJournal(){entry=null;jr.filter=CONT.indexOf(REG())+1;jr.cur=0;go('journal');}
function startEnc(i){snd('found');const sp=spots[i].sp||pickSpecies(REG());img(sp);enc={spot:i,sp,opts:choices(sp,REG()),cur:0,phase:0,ok:false,gone:[],hinted:false};go('enc');}
function toRegion(){if(!save.introDone)startIntro('region');else go('region');}
function titleOpts(){const o=[];if(nCollected()||save.region)o.push(['continue','pick up where you left off','title:continue']);o.push(o.length?['new game','start over with an empty MossDex','title:new']:['begin','Professor Chaga is waiting','title:begin']);return o;}
function titleAct(opt){if(!chimed){snd('chime');chimed=true;}
  if(opt==='title:continue'){if(save.region&&save.introDone)enterRegion(save.region);else toRegion();}
  else if(opt==='title:begin')toRegion();
  else if(opt==='title:new'){if(nCollected()&&confirmNew<=0){confirmNew=180;snd('miss');say('THIS ERASES YOUR MOSSDEX. PRESS AGAIN.',180);return;}confirmNew=0;save=fresh();persist();buildPlayer();toRegion();}}
const MENU=[['MossDex','the 1000 species, and which ones you have','menu:mossdex'],['beetles','every beetle Beetleboy knows, and the ones you have caught','menu:beetles'],['GoodMoss','plant a cutting, keep it watered and lit','menu:goodmoss'],['map','travel to another continent','menu:map'],['tutorial','Professor Chaga, again','menu:tutorial'],['traveler','change who you play as','menu:traveler'],['close','return to quest','menu:close']];
function useHint(){if(enc.hinted||save.cheese<1){snd('miss');say(enc.hinted?'THE BEETLE ALREADY HELPED':'NO CHEESE. CATCH A BEETLE FIRST',120);return;}
  save.cheese--;enc.hinted=true;const wrong=enc.opts.map((o,i)=>i).filter(i=>enc.opts[i]!==enc.sp);for(let k=wrong.length-1;k>0;k--){const j=(Math.random()*(k+1))|0;[wrong[k],wrong[j]]=[wrong[j],wrong[k]];}
  enc.gone=wrong.slice(0,2);persist();snd('beetle');dirty();}
function answer(i){if(enc.phase!==1||enc.gone.includes(i))return;const ok=enc.opts[i]===enc.sp;enc.ok=ok;enc.cur=i;enc.phase=2;save.seen[enc.sp.key]=1;save.last=enc.sp.key;
  if(ok)save.collected[enc.sp.key]=Date.now();persist();snd(ok?'collect':'miss',enc.sp.id);dirty();}
function encDone(){respawnSpot(enc.spot);toast=null;if(nCollected()>=SP.length){snd('win');go('win');}else go('world');}
function finishIntro(){if(intro.bail){snd('back');go('title');return;}save.introDone=true;persist();snd('ok');if(intro.ret==='world'&&map)go('world');else go('region');}

// which buttons the game wants for itself right now; the host's focus cursor takes the rest
function handles(b){
  if(b==='b')return true;
  if(state==='world')return !menuOpen;
  if(state==='intro'){const pg=intro.pages[intro.page]||{};if(b==='a')return !(pg.ask&&intro.opt);return false;}
  if(state==='petlapse'||state==='win')return true;
  if(state==='journal')return b==='left'||b==='right'||b==='j'||(entry&&(shot||info)&&b==='a');
  if(state==='enc')return (enc.phase===2&&b==='a')||(enc.phase===1&&b==='j');
  if(state==='pet'||state==='petpick')return b==='j';
  if(state==='beetle')return b==='a';
  if(state==='shop')return false;
  if(state==='beetles')return b==='j'||(bsel&&b==='a');
  return false;}
const pad=()=>state==='world'&&!menuOpen;

// the game's own input, for the states it handles. Menus, lists and buttons are clicked by the host.
function update(){frame++;if(tuneT>0){tuneT--;drawTune();}if(amb.on&&!muted&&state!=='title')ambient();if(confirmNew>0)confirmNew--;if(confirmRel>0)confirmRel--;
  if(toast&&--toast.n<=0){toast=null;dirty();}
  if(state==='intro'){const pg=intro.pages[intro.page],txt=pageText();if(intro.ch<txt.length){intro.ch+=2;if(frame%3===0)snd('talk',intro.ch);const d=ui&&ui.querySelector('#q-dialog');if(d)d.textContent=txt.slice(0,intro.ch);}
    if(intro.ch>=txt.length&&pg.ask&&!intro.opt){intro.opt=true;dirty();}
    if(hit('a')||(click&&click.top)){if(intro.ch<txt.length){intro.ch=txt.length;const d=ui&&ui.querySelector('#q-dialog');if(d)d.textContent=txt;if(pg.ask){intro.opt=true;dirty();}}else if(!pg.ask)introNext();}
    if(hit('b')){if(intro.kb&&intro.buf){intro.buf=intro.buf.slice(0,-1);dirty();}else if(intro.kb){intro.kb=false;dirty();}else if(intro.page>0&&!intro.bail){intro.page--;intro.ch=pageText().length;intro.opt=!!intro.pages[intro.page].ask;snd('back');dirty();}else snd('miss');}}
  else if(state==='region'){if(hit('b')&&save.region&&map){snd('back');go('world');}}
  else if(state==='world'){stepBeetles();
    if(menuOpen){if(hit('b')){menuOpen=false;snd('back');dirty();}}
    else{if(click&&click.top)tapWorld();
      if(!player.mx&&!player.my){
        if(hit('j'))openJournal();
        else if(hit('b')){menuOpen=true;snd('move',0);dirty();}
        else{
          if(hit('a')){player.path=[];if(interactAhead()){click=null;return;}}
          if(keys.up||keys.down||keys.left||keys.right){player.path=[];player.goal=null;}
          let dx=0,dy=0;if(keys.up){dy=-1;player.dir='up';}else if(keys.down){dy=1;player.dir='down';}else if(keys.left){dx=-1;player.dir='left';}else if(keys.right){dx=1;player.dir='right';}
          if(!dx&&!dy&&!player.path.length&&player.goal){const g=player.goal;player.goal=null;if(Math.abs(g.x-player.x)+Math.abs(g.y-player.y)===1){faceTowards(g.x,g.y);if(interactAhead()){click=null;return;}}}
          if(!dx&&!dy&&player.path.length){const d=player.path.shift();player.dir=d;dx={left:-1,right:1}[d]||0;dy={up:-1,down:1}[d]||0;}
          if(dx||dy){const nx=player.x+dx,ny=player.y+dy;if(nx>=0&&ny>=0&&nx<MW&&ny<MH&&WALK[map[ny][nx]]&&!spots.some(o=>o.x===nx&&o.y===ny)&&!beetles.some(o=>o.x===nx&&o.y===ny)){player.x=nx;player.y=ny;player.mx=-dx*T;player.my=-dy*T;save.steps++;snd('step',save.steps);}}}
      }else if(player.mx||player.my){const v=2;if(player.mx)player.mx+=player.mx<0?v:-v;if(player.my)player.my+=player.my<0?v:-v;player.anim++;}
      player.px=player.x*T+player.mx;player.py=player.y*T+player.my;
      cam.x=Math.max(0,Math.min(MW*T-cv.width,player.px-cv.width/2+8));cam.y=Math.max(0,Math.min(MH*T-cv.height,player.py-cv.height/2+8));}}
  else if(state==='enc'){if(enc.phase===1&&hit('j'))useHint();else if(enc.phase===2&&(hit('a')||hit('b')))encDone();else if(hit('b')){/* no fleeing: face it */snd('miss');}}
  else if(state==='pet'){const p=save.pet;if(!p){openPick();}else{if(frame%120===0){simPet(p,Date.now());persist();dirty();}petAnim(p);if(click&&click.top){pa.bounce=20;snd('chirp');}
    if(hit('b')||hit('j')){if(petMenu){petMenu=false;snd('back');dirty();}else{petMenu=true;snd('move',0);dirty();}}}}
  else if(state==='petpick'){if(hit('b')||hit('j')){if(naming){naming=null;dirty();}else{snd('back');go('world');}}}
  else if(state==='petlapse'){const p=save.pet;if(frame%4===0){lapse.i++;const f=ui&&ui.querySelector('#q-frame');if(f&&p)f.textContent='frame '+(Math.min(lapse.i,p.snaps.length-1)+1)+' / '+p.snaps.length;}if(!p||lapse.i>=p.snaps.length+15||hit('a')||hit('b')||click)go('pet');}
  else if(state==='journal'){const L=jlist();
    if(entry&&L.length&&(hit('left')||hit('right'))){jr.cur=(L.indexOf(entry)+(hit('left')?-1:1)+L.length)%L.length;entry=L[jr.cur];shot=false;snd('move',jr.cur);dirty();}
    else{if(hit('left')){jr.filter=(jr.filter+JF-1)%JF;jr.cur=0;entry=null;snd('move',jr.filter);dirty();}
    if(hit('right')){jr.filter=(jr.filter+1)%JF;jr.cur=0;entry=null;snd('move',jr.filter);dirty();}}
    if(entry&&hit('j')){info=!info;shot=false;snd('move',1);dirty();}
    if(entry&&hit('a')&&shot){shot=false;snd('back');dirty();}
    if(hit('b')){if(shot){shot=false;snd('back');dirty();}else if(info){info=false;snd('back');dirty();}else if(entry){entry=null;snd('back');dirty();}else{snd('back');go('world');}}
    if(hit('j')&&!entry){snd('back');go('world');}}
  else if(state==='win'){if(hit('a')||hit('b')||click)go('world');}
  else if(state==='beetle'){if(hit('a')||hit('b')){card=null;go('world');}}
  else if(state==='shop'){if(hit('b')){if(!shop||shop.mode==='menu'){snd('back');go('world');}else{shop.mode='menu';shop.pick=[];snd('back');dirty();}}}
  else if(state==='beetles'){if(bsel&&(hit('a')||hit('b'))){bsel=null;snd('back');dirty();}else if(hit('b')||hit('j')){snd('back');go('world');}}
  else if(state==='title'){if(hit('b'))snd('miss');}
  click=null;
}

// clicks on the game's own HTML: the host's A button clicks the focused item, a mouse or finger clicks it directly
function act(name,arg){
  if(name.startsWith('title:'))titleAct(name);
  else if(name==='region:go')enterRegion(arg);
  else if(name==='intro:yes')introNext();
  else if(name==='intro:no'){intro.pages=INTRO_NO;intro.page=0;intro.ch=0;intro.opt=false;intro.bail=true;snd('back');dirty();}
  else if(name==='intro:name'){let nm=String(arg||'').trim().slice(0,12);if(!nm)return;if(nm[0]!=='~')nm=nm.charAt(0).toUpperCase()+nm.slice(1).toLowerCase();save.name=nm;persist();snd('ok');introNext();}
  else if(name==='intro:namekb'){intro.kb=true;intro.buf='';dirty();}
  else if(name==='intro:key'){if(arg==='<')intro.buf=intro.buf.slice(0,-1);else if(intro.buf.length<12)intro.buf+=arg;dirty();}
  else if(name==='world:menu'){menuOpen=true;dirty();}
  else if(name==='menu:mossdex'){menuOpen=false;openJournal();}
  else if(name==='menu:goodmoss'){menuOpen=false;openPet();}
  else if(name==='menu:map'){menuOpen=false;go('region');}
  else if(name==='menu:tutorial'){menuOpen=false;startIntro('world');dirty();}
  else if(name==='menu:traveler'){menuOpen=false;startIntro('world',[{t:'WHO IS WALKING TODAY, {NAME}?',ask:'char'}]);dirty();}
  else if(name==='intro:char'){if(!CHARS[arg])return;save.char=arg;persist();buildPlayer();snd('ok');introNext();}
  else if(name==='menu:beetles'){menuOpen=false;bsel=null;go('beetles');}
  else if(name==='beetle:done'){card=null;go('world');}
  else if(name==='shop:tip')shopTip();
  else if(name==='shop:buy')shopBuy(arg);
  else if(name==='shop:sell')shopSell(arg);
  else if(name==='shop:none'){}
  else if(name==='shop:cutting')shopCutting();
  else if(name==='shop:swap'){shop.mode='swap';shop.pick=[];dirty();}
  else if(name==='shop:goods'){shop.mode='goods';dirty();}
  else if(name==='shop:buy'){const gd=JARGOODS.find(x=>x[0]===arg);if(!gd||jarHas(gd[0]))return;if(save.cheese<gd[2]){snd('miss');say(gd[2]+' CHEESE. NO CREDIT');return;}save.cheese-=gd[2];save.jar=save.jar||{};save.jar[gd[0]]=true;persist();snd('ok');say('IT IS IN THE JAR');dirty();}
  else if(name==='shop:pick')shopPick(arg);
  else if(name==='shop:deal')shopDeal();
  else if(name==='shop:back'){shop.mode='menu';shop.pick=[];dirty();}
  else if(name==='shop:ok'){shop.mode='menu';shop.res=null;dirty();}
  else if(name==='shop:leave'){snd('back');go('world');}
  else if(name==='beetle:open'){bsel=BEETLE_BOOK.find(x=>x[0]===arg)||null;dirty();}
  else if(name==='beetle:back'){bsel=null;dirty();}
  else if(name==='menu:close'){menuOpen=false;dirty();}
  else if(name==='enc:identify'){enc.phase=1;dirty();}
  else if(name==='enc:answer')answer(Number(arg));
  else if(name==='enc:hint')useHint();
  else if(name==='enc:continue')encDone();
  else if(name==='dex:open'){const s=SP.find(x=>String(x.key)===String(arg));if(s){entry=s;shot=false;info=false;jr.cur=jlist().indexOf(s);dirty();}}
  else if(name==='dex:back'){entry=null;shot=false;info=false;dirty();}
  else if(name==='dex:info'){info=true;shot=false;dirty();}
  else if(name==='dex:shot'){if(entry&&entry.image&&known(entry)){shot=true;info=false;snd('move',1);dirty();}}
  else if(name==='dex:discovered'){jr.filter=JF-1;jr.cur=0;entry=null;dirty();}
  else if(name==='dex:all'){jr.filter=0;jr.cur=0;entry=null;dirty();}
  else if(name==='dex:filter'){jr.filter=(jr.filter+Number(arg)+JF)%JF;jr.cur=0;entry=null;dirty();}
  else if(name==='pet:act')petAct(Number(arg));
  else if(name==='pet:pick'){const s=SP.find(x=>String(x.key)===String(arg));if(s){naming=s;dirty();}}
  else if(name==='pet:name'&&naming)plantPick(naming,arg==='*'?undefined:arg);
  else if(name==='pet:cancel'){naming=null;dirty();}
  else if(name==='pet:back'){petMenu=false;snd('back');go('world');}
  else if(name==='pet:menu'){petMenu=false;dirty();}
  else if(name==='pet:release'){if(confirmRel<=0){confirmRel=180;snd('miss');say('RELEASE '+save.pet.name+'? PRESS AGAIN.');return;}confirmRel=0;petAct(4);}
  else if(name==='win:go')go('world');
  else if(name==='sys:retry')start(cv,opts);
}

/* ---------------- the HTML side, in the host's own vocabulary ---------------- */
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mi=(label,actn,arg,note,cls)=>`<li><button type="button" class="menu-item focusable${cls?' '+cls:''}" data-act="${actn}"${arg!=null?` data-arg="${esc(arg)}"`:''}${note?` data-note="${esc(note)}"`:''}>${esc(label)}</button></li>`;
const heading=t=>`<li class="menu-heading">${esc(t)}</li>`;
const note=t=>`<li class="menu-note">${esc(t)}</li>`;
const msg=t=>t?`<p class="lcd-msg">${esc(sentence(t))}</p>`:'';
const row=(k,v)=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`;
const photoEl=(sp,hidden)=>sp&&sp.image&&!hidden?`<img class="q-photo" src="${esc((opts.imgBase||'')+sp.image.file)}" alt="${esc(sp.name)}">`:`<div class="q-photo q-nophoto">${hidden?'???':'no photo'}</div>`;
const low=t=>String(t||'').toLowerCase();
const PROPER={traveler:'Traveler',mossdex:'MossDex',goodmoss:'GoodMoss',chaga:'Chaga',gbif:'GBIF',inaturalist:'iNaturalist',antarctic:'Antarctic',antarctica:'Antarctica',sphagnum:'Sphagnum',remilianet:'RemiliaNET'};
function sentence(t){const name=playerName();t=String(t||'').toLowerCase();
  t=t.replace(/(^|[.!?]\s+)([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\bi\b/g,'I').replace(/[a-z]+/gi,w=>PROPER[w.toLowerCase()]||w).replace(/\b(press(?: the)? )([abxy])\b/gi,(m,a,b)=>a+b.toUpperCase());
  return t.replace(/\{name\}/g,name);}
const titleCase=t=>String(t||'').toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
const cap=t=>{t=String(t||'');return t.charAt(0).toUpperCase()+t.slice(1).toLowerCase();};
const regionList=sp=>sp.regions.map(r=>titleCase(CN[r])).join(', ');
const status=sp=>save.collected[sp.key]?'collected':save.seen[sp.key]?'seen':'unknown';
function beetleImg(name,dim,girl){const f=BEETLE_IMG[name];if(f)return `<img class="q-beetle${girl?' q-girl':''}${dim?' q-dim':''}" src="${esc((opts.imgBase||'')+'beetles/'+f+(girl?'_card.webp':'.png'))}" alt="${esc(name)}">`;
  const b=theme&&theme.beetles.find(x=>x.name===name)||[SKULLBUG,WIDOW,XMAS,CANDY].find(x=>x.name===name);const bm=name.includes('MIDGE')?MIDGEBM:BEETLEBM;const k=b||{col:'#2a2a2a',hi:'#ffffff'};
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(sprite(bm[0],{'1':k.col,'3':k.hi,g:k.col,d:k.hi}),0,0,16,16,0,0,64,64);return `<img class="q-beetle${dim?' q-dim':''}" src="${c.toDataURL()}" alt="${esc(name)}">`;}
const beetleHome=name=>{const rs=CONT.filter(c=>THEMES[c].beetles.some(b=>b.name===name)).map(c=>titleCase(CN[c]));const bk=BEETLE_BOOK.find(x=>x[0]===name);
  if(bk&&bk[2]==='halloween')return 'anywhere, in October';if(bk&&bk[2]==='christmas')return (rs.length?rs.join(', ')+' all year, and ':'')+'anywhere in December';return rs.length?rs.join(', '):'not in the wild here';};
function dexInfo(sp){const kn=known(sp);const regs=regionList(sp);const when=save.collected[sp.key]?new Date(save.collected[sp.key]).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):null;
  const desc=kn?`${sp.name}${sp.common?', the '+low(sp.common)+',':''} is a moss of the family ${sp.family||'?'}${sp.order?' in the order '+sp.order:''}. GBIF holds ${sp.records.toLocaleString('en-US')} records of it, from ${regs}.${sp.image?' The photo is by '+sp.image.by+(/inaturalist/i.test(sp.image.src||'')?' on iNaturalist':'')+', '+lic(sp.image.license)+'.':''} ${when?'You logged it on '+when+'.':save.seen[sp.key]?'You have seen it but not yet named it.':''}`:'You have not found this one yet. Its entry is still missing from the MossDex.';
  return `<div class="q-info"><h2>${esc(kn?sp.name:'?????')}${kn&&sp.author?` <span class="q-author">${esc(sp.author)}</span>`:''}</h2><p>${esc(desc)}</p><dl>${row('no.',String(sp.id).padStart(4,'0'))}${row('family',kn?sp.family||'?':'?')}${row('order',kn?sp.order||'?':'?')}${kn&&sp.genus?row('genus',sp.genus):''}${row('found in',regs)}${row('records',sp.records.toLocaleString('en-US')+' on GBIF')}${kn&&sp.image?row('photo',sp.image.by+' · '+lic(sp.image.license)):''}${row('status',status(sp))}</dl></div>`;}
function speciesCard(sp,k){const known_=k==null?known(sp):k;return `<div class="q-card"><div class="q-stage">${photoEl(sp,!known_)}</div>
  <h2 class="q-name">${esc(known_?sp.name:'?????')}${known_&&sp.author?` <span class="q-author">${esc(sp.author)}</span>`:''}</h2>
  ${known_&&sp.common?`<p class="q-common">${esc(sp.common)}</p>`:''}
  <dl>${row('no.',String(sp.id).padStart(4,'0'))}${row('family',known_?sp.family||'?':'?')}${row('order',known_?sp.order||'?':'?')}${row('found in',regionList(sp))}${row('records',sp.records.toLocaleString('en-US')+' on GBIF')}${known_&&sp.image?row('photo',sp.image.by+' · '+lic(sp.image.license)):''}${row('status',status(sp))}</dl></div>`;}

function render(){if(!ui)return;let h='',focus=0,scene='none';const u=user||GUEST;
  const pkey=state+'|'+(!!entry)+(!!bsel)+menuOpen+intro.kb+(!!naming)+(!!card);if(lastPage&&pkey!==lastPage)tune();lastPage=pkey;
  if(state==='title'){scene='lab';h=`<h1 class="q-title">moss quest</h1><p class="lcd-note q-center">${esc(SP.length)} species · seven continents · one MossDex</p>
    <div class="q-who">${u.pfpUrl?`<img class="rn-pfp q-pfp" src="${esc(u.pfpUrl)}" alt="">`:''}<div><b>${esc(playerName())}</b><span class="rn-handle">${u.guest?'guest · saved on this device':'@'+esc(u.handle)+' · RemiliaNET'}${nCollected()?' · '+nCollected()+' / '+SP.length+' logged · '+save.cheese+' cheese':''}</span></div></div>
    ${msg(toast&&toast.t)}<ul class="menu">${titleOpts().map(o=>mi(o[0],o[2],null,o[1])).join('')}</ul>`;}
  else if(state==='intro'){scene=intro.kb?'none':'lab';const pg=intro.pages[intro.page],txt=pageText();h=`<div class="lcd-header"><span class="lcd-header-title">PROF. CHAGA</span><span class="item-meta">page ${intro.page+1} / ${intro.pages.length}</span></div><p class="q-dialog" id="q-dialog">${esc(txt.slice(0,intro.ch))}</p>`;
    if(intro.opt&&pg.ask==='quest')h+=`<ul class="menu">${mi('gladly','intro:yes',null,'the moss quest begins')}${mi('not today','intro:no',null,'the professor will wait')}</ul>`;
    else if(intro.opt&&pg.ask==='name'){
      if(intro.kb){const keys='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');const kb=(l,act,arg,note,cls)=>`<button type="button" class="menu-item focusable${cls?' '+cls:''}" data-act="${act}" data-arg="${esc(arg)}" data-note="${esc(note)}">${esc(l)}</button>`;
        h+=`<p class="q-name q-typed">${esc(intro.buf)||'&nbsp;'}<span class="q-caret">_</span></p><div class="grid q-keys">${keys.map(k=>kb(k,'intro:key',k,'A: type '+k)).join('')}${kb('⌫','intro:key','<','A: delete · B does too')}${kb('done','intro:name',intro.buf,intro.buf?'call me '+intro.buf:'type a name first','q-wide')}</div>`;}
      else{const rn=user&&!user.guest?'~'+user.handle:null;h+=`<ul class="menu">${rn?mi('call me '+rn,'intro:name',rn,'your RemiliaNET name'):''}${mi(rn?'something else':'type a name','intro:namekb',null,'spell it on the letter grid')}${save.name?mi('still '+save.name,'intro:name',save.name,'the name you used before'):''}</ul>`;}}
    else if(intro.opt&&pg.ask==='char'){scene='none';const cur=charId();focus=Math.max(0,CHAR_IDS.indexOf(cur));h+=`<div class="grid q-chars">${CHAR_IDS.map(id=>`<button type="button" class="menu-item focusable${id===cur?' q-current':''}" data-act="intro:char" data-arg="${id}" data-note="${esc('walk as '+CHARS[id].name)}"><canvas data-char="${id}" width="${CHARS[id].bw}" height="${CHARS[id].bh}"></canvas><span>${esc(CHARS[id].name)}</span></button>`).join('')}</div>`;}}
  else if(state==='region'){scene='map';h=`<div class="lcd-header"><span class="lcd-header-title">WHERE TO?</span><span class="item-meta">${nCollected()} / ${SP.length} logged</span></div><div class="grid q-regions">`+
    CONT.map(c=>{const R=roster[c],g=nCollectedIn(c);return `<button type="button" class="menu-item focusable${c===save.region?' q-here':''}" data-act="region:go" data-arg="${c}" data-note="${esc(g+' / '+R.length+' here · '+low(THEMES[c].blurb))}">${esc(titleCase(CN[c]))}</button>`;}).join('')+'</div>';
    focus=Math.max(0,CONT.indexOf(save.region));}
  else if(state==='world'){scene='world';const c=REG(),R=roster[c],g=nCollectedIn(c);const last=SP.find(s=>s.key===save.last);
    if(menuOpen){h=`<ul class="menu">${heading(titleCase(CN[c]))}${MENU.map(m=>mi(m[0],m[2],null,m[1])).join('')}</ul>`;}
    else{h=`<div class="q-strip"><span class="q-strip-title">${esc(titleCase(CN[c]))}</span><span class="item-meta">${g} / ${R.length} here · ${nCollected()} / ${SP.length} · cheese ${save.cheese}</span></div>`+
      (last?`<p class="lcd-note">last found: <b>${esc(last.name)}</b>${last.common?', '+esc(low(last.common)):''} · ${save.collected[last.key]?'in the MossDex':'seen only'}</p>`:`<p class="lcd-note">walk up to a moss tuft, face it and press A. catch beetles for cheese.</p>`);}}
  else if(state==='enc'){const sp=enc.sp;
    if(enc.phase===0){h=`<div class="q-stage">${photoEl(sp)}</div><h2 class="q-name">a wild moss appears!</h2><dl>${row('family',sp.family||'?')}${row('found in',regionList(sp))}${row('records',sp.records.toLocaleString('en-US'))}${row('status',save.collected[sp.key]?'already in the MossDex':save.seen[sp.key]?'seen before. remember it?':'new species!')}</dl>
      <ul class="menu item-links">${mi('identify','enc:identify',null,'A: look closely, then pick the name')}</ul>`;}
    else if(enc.phase===1){h=`<div class="q-stage q-quiz">${photoEl(sp)}</div><h2 class="q-name">what species is it? <span class="item-meta">family ${esc(sp.family||'?')}</span></h2>${msg(toast&&toast.t)}<ul class="menu">`+
      enc.opts.map((o,i)=>{const gone=enc.gone.includes(i);return gone?`<li><button type="button" class="menu-item q-gone" disabled>${esc(o.name)}</button></li>`:mi(o.name,'enc:answer',i,'A: answer');}).join('')+
      `</ul><ul class="menu item-links">${mi(enc.hinted?'the beetle has spoken':`ask a beetle · 1 cheese, you have ${save.cheese}`,'enc:hint',null,'a beetle rules out two wrong names')}</ul>`;focus=enc.cur;}
    else{h=`<div class="q-result">${photoEl(sp)}<div><h2 class="q-name">${enc.ok?'correct.':'not this one.'}</h2><p class="q-name">${esc(sp.name)}${sp.author?` <span class="q-author">${esc(sp.author)}</span>`:''}</p>${sp.common?`<p class="q-common">${esc(sp.common)}</p>`:''}</div></div>
      <dl>${row('entry',String(sp.id).padStart(4,'0'))}${row('family',sp.family||'?')}${row('found in',regionList(sp))}${sp.image?row('photo',sp.image.by+' · '+lic(sp.image.license)):''}</dl>
      <p class="lcd-msg">${enc.ok?'entry '+String(sp.id).padStart(4,'0')+' is back in the MossDex.':'it stays marked as seen. find it again and name it to collect.'}</p>
      <ul class="menu item-links">${mi('continue','enc:continue',null,'return to quest')}</ul>`;}}
  else if(state==='journal'){const L=jlist();const name=jr.filter===0?'all regions':jr.filter===JF-1?'discovered':low(CN[CONT[jr.filter-1]]);const got=L.filter(s=>save.collected[s.key]).length;
    if(entry&&shot&&entry.image){scene='none';h=`<div class="q-shot"><img class="q-shotimg" src="${esc((opts.imgBase||'')+entry.image.file)}" alt="${esc(entry.name)}"></div>`;}
    else if(entry&&info){scene='none';h=dexInfo(entry);}
    else if(entry){scene='none';const kn=known(entry),idx=L.indexOf(entry);const lnk=(label,href,note)=>`<li><a class="menu-item focusable" href="${esc(href)}" target="_blank" rel="noopener" data-note="${esc(note)}">${esc(label)}</a></li>`;
      h=`<div class="q-item"><button type="button" class="item-stage focusable" data-act="dex:shot" data-note="A: showcase · X: info · L/R: prev / next · B: back">${kn&&entry.image?`<img class="item-image" src="${esc((opts.imgBase||'')+entry.image.file)}" alt="${esc(entry.name)}">`:`<div class="item-image q-nophoto">${kn?'no photo':'???'}</div>`}</button>
      <h2 class="item-name"><span>${esc(kn?entry.name:'?????')}</span><span class="item-meta">${idx+1} / ${L.length}</span></h2>
      <ul class="item-links">${kn?lnk('GBIF','https://www.gbif.org/species/'+entry.key,'the species on gbif.org, in a new tab'):''}${kn&&entry.image&&entry.image.src?lnk(/inaturalist/i.test(entry.image.src)?'iNaturalist':'photo source',entry.image.src,'where the photo comes from, in a new tab'):''}${mi('INFO','dex:info',null,'X does it too')}${mi('BACK','dex:back',null,'B does it too')}</ul></div>`;focus=0;}
    else{h=`<div class="lcd-header"><span class="lcd-header-title">MOSSDEX</span><nav class="tabs"><button type="button" class="tab" data-act="dex:filter" data-arg="-1">◀</button><span class="tab active">${esc(name)} · ${got}/${L.length}</span><button type="button" class="tab" data-act="dex:filter" data-arg="1">▶</button></nav></div><ul class="menu item-links q-dexbtns">${jr.filter===JF-1?mi('all regions','dex:all',null,'every species, found or not'):mi('discovered · '+nCollected(),'dex:discovered',null,'everything you have logged, all continents')}</ul>`+
      (L.length?`<ul class="menu q-list">`+L.map(s=>{const st=status(s);return mi(`${String(s.id).padStart(4,'0')}  ${st==='unknown'?'-----':s.name}`,'dex:open',s.key,st==='collected'?'in the MossDex':st==='seen'?'seen, not yet named':'not found yet','q-'+st);}).join('')+'</ul>':`<p class="lcd-msg">${jr.filter===JF-1?'nothing collected yet':'nothing here'}</p>`);
      focus=jr.cur;}}
  else if(state==='petpick'){const L=pickList();
    if(naming){h=`<div class="lcd-header"><span class="lcd-header-title">NAME IT</span></div>${speciesCard(naming)}<ul class="menu">${heading('a name for your moss')}${PETNAMES.map(n=>mi(low(n),'pet:name',n,'plant '+naming.name+' as '+low(n))).join('')}${mi('surprise me','pet:name','*','a random name')}${mi('back','pet:cancel',null,'choose another cutting')}</ul>`;}
    else{h=`<div class="lcd-header"><span class="lcd-header-title">PLANT A CUTTING</span><span class="item-meta">${L.length} collected</span></div><p class="lcd-note">mosses have no roots. they drink from the air and go dormant, not dead, when they dry. keep light and water near what the species knows from the wild and it will fruit.</p><ul class="menu q-list">`+
      L.map(s=>{const pr=prefs(s);return mi(s.name,'pet:pick',s.key,`grows as a ${FORMS[pr.form].label.toLowerCase()} · likes ${word(pr.moist,'dryish','moist','wet')}, ${word(pr.light,'shade','half shade','sun')} · on ${pr.sub}`);}).join('')+'</ul>';focus=pick.cur;}}
  else if(state==='pet'&&save.pet){scene='jar';const p=save.pet,sp=petSp(p),pr=prefs(sp);const acts=petLabels(p).filter(a=>a[3]!=='dev'||opts.dev);
    const btn=a=>mi(a[0],'pet:act',a[2],a[1]);const need=(l,v)=>`<span class="q-need"><b>${l}</b>${pips(v,5)}</span>`;
    h=`<div class="lcd-header"><span class="lcd-header-title">${esc(p.name)}</span><span class="item-meta">${esc(sp.name)} · ${esc(low(petAge(p)))} old</span></div>
      <div class="q-needs-row">${need('water',p.hyd)}${need('light',p.light)}${need('health',p.health)}</div>
      <p class="lcd-msg q-advice">${esc(petAdvice(p))} <span class="item-meta">· grown ${pips(p.growth,5)}${p.spores?' · spores '+p.spores:''}</span></p>`;
    if(petMenu){h+=`<ul class="menu">${mi('return to quest','pet:back',null,'leave the jar, it keeps growing')}${mi('release '+low(p.name),'pet:release',null,'let it go and plant another cutting')}${mi('stay','pet:menu',null,'close this')}</ul>`;focus=0;}
    else{h+=`<ul class="menu item-links q-petacts">${acts.map(btn).join('')}</ul>${msg(toast&&toast.t)}`;focus=petCur;}}
  else if(state==='petlapse'&&save.pet){scene='jar';const p=save.pet;h=`<div class="lcd-header"><span class="lcd-header-title">TIME-LAPSE</span><span class="item-meta" id="q-frame">frame 1 / ${p.snaps.length}</span></div><p class="lcd-note">the jar so far, replayed. A: back to the jar</p>`;}
  else if(state==='shop'&&shop){scene='shop';const c=REG();const cut=dailyCutting(c),st=shopState();
    if(shop.mode==='menu'){const stock=dailyStock(c);const coat=roster[c].filter(x=>save.collected[x.key]).sort((A,B)=>(save.collected[B.key]||0)-(save.collected[A.key]||0)).slice(0,5);const rows=Math.max(stock.length,coat.length,1);
      const day=Math.floor((Date.now()-(save.started||Date.now()))/86400000)+1;const ph=save.pet?Math.round(save.pet.health*100):null;
      const cell=(label,act,arg,note,cls)=>`<button type="button" class="menu-item focusable${cls?' '+cls:''}" data-act="${act}"${arg!=null?` data-arg="${esc(arg)}"`:''}${note?` data-note="${esc(note)}"`:''}>${esc(label)}</button>`;
      let grid='';for(let i=0;i<rows;i++){const it=stock[i],sp=coat[i];
        grid+=it?(it.sold?cell('sold','shop:none',null,'gone for today','q-gone'):cell(`${it.up?'▲':'▼'} ${it.sp.name} · ${it.price}`,'shop:buy',it.sp.key,`A: buy for ${it.price} cheese · ${TIERN[it.t]}`)):cell('—','shop:none',null,'nothing here','q-gone');
        grid+=sp?cell(`${sp.name} · ${SELLP[tierOf(sp,c)]}`,'shop:sell',sp.key,`A: sell for ${SELLP[tierOf(sp,c)]} cheese, press twice · ${TIERN[tierOf(sp,c)]}`):cell('—','shop:none',null,'nothing in the coat','q-gone');}
      h=`<div class="q-dw"><div class="q-dw-top"><div class="q-dw-bank"><span class="q-dw-k">day</span><b>${day}</b><span class="q-dw-k">cheese</span><b class="q-dw-g">${save.cheese}</b><span class="q-dw-k">logged</span><b>${nCollected()}/${SP.length}</b><span class="q-dw-k">moss health</span><span class="q-dw-bar">${ph==null?'<i style="width:0"></i><em>no jar</em>':`<i style="width:${ph}%"></i><em>${ph}%</em>`}</span></div><div class="q-dw-city"><b>${esc(titleCase(CN[c]))}</b><span>the Dealer · abandoned house</span></div></div>
        <p class="q-dw-news">${esc(shop.quip)}</p>
        <div class="grid q-dw-cols"><div class="q-dw-h">available moss</div><div class="q-dw-h">your coat · ${roster[c].filter(x=>save.collected[x.key]).length}</div>${grid}</div>
        <ul class="menu item-links q-dw-btns">${mi('swap two for one','shop:swap',null,'two of a kind for one of the next kind up. sometimes he keeps a cut')}${mi('a tip · 3','shop:tip',null,'he points out a moss you have never seen on this map')}${mi('jar goods','shop:goods',null,'things for the GoodMoss terrarium')}${mi('leave','shop:leave',null,'return to quest')}</ul>${msg(toast&&toast.t)}</div>`;}
    else if(shop.mode==='goods'){h=`<div class="lcd-header"><span class="lcd-header-title">JAR GOODS</span><span class="item-meta">${save.cheese} cheese</span></div><p class="lcd-note">for the terrarium. bought once, kept for every cutting after.</p><ul class="menu">${JARGOODS.map(gd=>jarHas(gd[0])?`<li><button type="button" class="menu-item q-gone" disabled>${esc(gd[1])} · yours</button></li>`:mi(gd[1]+' · '+gd[2]+' cheese','shop:buy',gd[0],gd[3])).join('')}${mi('back','shop:back',null,'B does it too')}</ul>`;}
    else if(shop.mode==='swap'){const L=roster[c].filter(x=>save.collected[x.key]&&tierOf(x,c)<2);const ready=shop.pick.length===2;const t=ready?tierOf(SP.find(x=>String(x.key)===shop.pick[0]),c):0;const on=x=>shop.pick.includes(String(x.key));
      h=`<div class="lcd-header"><span class="lcd-header-title">TWO FOR ONE</span><span class="item-meta">${shop.pick.length} / 2 offered</span></div><p class="lcd-note">${L.length?'two of the same kind from this continent. common pairs become uncommon, uncommon pairs become rare. eight deals in ten go through.':'nothing to trade. collect some common moss here first.'}</p><ul class="menu item-links">${ready?mi('deal','shop:deal',null,'trade the two for one '+TIERN[t+1]+' species'):''}${mi('back','shop:back',null,'B does it too')}</ul><ul class="menu q-list">${L.map(x=>mi((on(x)?'✓ ':'')+x.name+'  ·  '+TIERN[tierOf(x,c)],'shop:pick',x.key,'A: '+(on(x)?'take it back':'offer it'),on(x)?'q-collected':'')).join('')}</ul>`;}
    else{h=`<div class="lcd-header"><span class="lcd-header-title">THE DEALER</span><span class="item-meta">${save.cheese} cheese</span></div><p class="lcd-msg">${esc(shop.res.t)}</p>${shop.res.sp?speciesCard(shop.res.sp,true):''}<ul class="menu item-links">${mi('continue','shop:ok',null,'back to the coat')}</ul>`;}}
  else if(state==='beetle'&&card){h=`<div class="q-stage q-duo">${beetleImg(card.kind.name,false,true)}${beetleImg(card.kind.name)}</div><h2 class="q-name">caught a ${esc(low(card.kind.name))}!</h2>
      <dl>${row('tier',cap(card.kind.tier))}${row('cheese','+'+card.cheese+' · you have '+save.cheese)}${row('caught',card.count+'×')}</dl>
      <ul class="menu item-links">${mi('continue','beetle:done',null,'return to quest')}</ul>`;}
  else if(state==='beetles'){const have=BEETLE_BOOK.filter(b=>save.beetles[b[0]]).length;
    if(bsel){const n=save.beetles[bsel[0]]||0;h=`<div class="lcd-header"><span class="lcd-header-title">BEETLES</span><span class="item-meta">${have} / ${BEETLE_BOOK.length}</span></div><div class="q-stage q-duo">${beetleImg(bsel[0],!n,true)}${beetleImg(bsel[0],!n)}</div><h2 class="q-name">${esc(low(bsel[0]))}</h2>
      <dl>${row('tier',cap(bsel[1])+' · '+TIER[bsel[1]].cheese+' cheese')}${row('found',beetleHome(bsel[0]))}${row('caught',n?n+'×':'not yet')}${bsel[2]==='craft'?row('in Beetleboy','a crafted beetle. here it lives in the wild'):''}</dl>
      <ul class="menu item-links">${mi('back to the book','beetle:back',null,'B: back')}</ul>`;}
    else{h=`<div class="lcd-header"><span class="lcd-header-title">BEETLES</span><span class="item-meta">${have} / ${BEETLE_BOOK.length} caught</span></div><ul class="menu q-list">`+
      BEETLE_BOOK.map(b=>{const n=save.beetles[b[0]]||0;return mi(`${titleCase(b[0])}${n?'  ·  '+n+'×':''}`,'beetle:open',b[0],cap(b[1])+' · '+beetleHome(b[0]),n?'q-collected':'q-unknown');}).join('')+'</ul><p class="lcd-note">the beetles and their cards belong to Beetleboy · beetle.wiki</p>';}}
  else if(state==='win'){h=`<h1 class="q-title">you did it!</h1><p class="lcd-msg">every moss collected. a bryologist is born.</p><dl>${row('steps walked',String(save.steps))}${row('beetles caught',String(nBeetles()))}${row('cheese',String(save.cheese))}${CONT.map(c=>row(titleCase(CN[c]),nCollectedIn(c)+' / '+roster[c].length)).join('')}</dl><ul class="menu item-links">${mi('keep exploring','win:go',null,'the moss is still out there')}</ul>`;}
  ui.innerHTML=h;const host=ui.closest('[data-scene]')||ui.parentElement;if(host)host.dataset.scene=scene;
  ui.querySelectorAll('canvas[data-char]').forEach(c=>{c.getContext('2d').drawImage(charPortrait(c.dataset.char),0,0);});
  // the same screen redrawn (a timer, a toast, a hint) keeps the cursor where the player left it: null asks the host to reuse its index
  const sg=[state,menuOpen,enc&&enc.phase,entry&&entry.key,shot,info,naming&&naming.key,jr.filter,shop&&shop.mode].join('|');const keep=sg===screenSig;screenSig=sg;
  if(opts.onRender)opts.onRender(keep?null:focus);
  if(opts.onStatus)opts.onStatus(statusText());lastStatus=statusText();uiDirty=false;}
function meter(label,v){const n=Math.round(Math.max(0,Math.min(1,v))*10);return row(label,'█'.repeat(n)+'░'.repeat(10-n));}

/* ---------------- the pixel-art scene ---------------- */
function drawTileAt(t,x,y,tx,ty){const base=OVER[t]?TL[G0]:null;if(base)ctx.drawImage(base,x,y);
  let img_=TL[t];if(t===WATER)img_=TL[WATER][(frame>>5)&1];else if(t===BLDG)img_=(dealerAt&&tx===dealerAt.x&&ty===dealerAt.y)?TL[BLDG][2]:TL[BLDG][(tx+ty)&1];ctx.drawImage(img_,x,y);}
function drawWorld(){const ox=-cam.x|0,oy=-cam.y|0;const x0=Math.max(0,(cam.x/T)|0),y0=Math.max(0,(cam.y/T)|0);const VH=cv.height/T,VW=cv.width/T;
  for(let y=y0;y<Math.min(MH,y0+VH+1);y++)for(let x=x0;x<Math.min(MW,x0+VW+1);x++)drawTileAt(map[y][x],x*T+ox,y*T+oy,x,y);
  const mf=((frame>>4)&3)===0?1:0;for(const s of spots){if(s.x>=x0-1&&s.x<x0+VW+1&&s.y>=y0-1&&s.y<y0+VH+1)ctx.drawImage(MOSS[mf],s.x*T+ox,s.y*T+oy);}
  for(const b of beetles){if(b.x>=x0-1&&b.x<x0+VW+1&&b.y>=y0-1&&b.y<y0+VH+1)ctx.drawImage(b.spr[(frame>>3)&1],b.x*T+ox,b.y*T+oy);}
  const moving=player.mx||player.my,step=(player.anim>>2)&3;const bob=moving&&(step&1)?-1:0;const spr=moving&&PLEGS&&(step&1)?PL[player.dir+'W'][step>>1]:PL[player.dir];
  ctx.drawImage(spr,(player.px+ox+((T-PLW)>>1))|0,(player.py+oy+bob+T-PLH)|0);
  const dx={left:-1,right:1}[player.dir]||0,dy={up:-1,down:1}[player.dir]||0;const tx=player.x+dx,ty=player.y+dy;
  if(!player.mx&&!player.my&&(spots.some(o=>o.x===tx&&o.y===ty)||beetles.some(o=>o.x===tx&&o.y===ty))){const bx=player.px+ox+5,by=player.py+oy+T-PLH-10+((frame>>3)&1);bevelOut(bx-2,by-2,10,11,C.paper);text('!',bx+1,by+1,C.red);}
  for(const o of spots)if(o.tip&&o.x>=x0-1&&o.x<x0+VW+1&&o.y>=y0-1&&o.y<y0+VH+1){const bx=o.x*T+ox+4,by=o.y*T+oy-9+((frame>>3)&1);bevelOut(bx-2,by-2,10,11,C.paper);text('?',bx+1,by+1,C.ink);}
  drawCloudShadows();
  const hh=cv.height,cx=cv.width/2;if(toast){withFont(F7,()=>{const w=tw(toast.t)+16;bevelOut(cx-w/2,hh-26,w,18,C.face);text(toast.t,cx-w/2+8,hh-20,toast.tier?TIER[toast.tier].col:C.ink);});}
  if(player.goal||player.path.length){const g=player.goal;if(g){rect(g.x*T+ox+7,g.y*T+oy-3+((frame>>3)&1),2,2,C.red);}}
  if(menuOpen){ctx.fillStyle='rgba(27,51,32,0.35)';ctx.fillRect(0,0,cv.width,cv.height);}}
// on the map the canvas is as tall as the box it sits in, so no letterbox: 256 wide, 192..320 tall
function fitWorld(){let ww=CW,hh=CH;if(state==='region')hh=MAPH;else if((state==='world'||state==='pet'||state==='petlapse'||state==='shop')&&cv.clientWidth>0&&cv.clientHeight>0){const a=cv.clientWidth/cv.clientHeight;if(a>CW/CH)ww=Math.min(400,Math.round(CH*a));else hh=Math.min(320,Math.round(CW/a));}
  if(cv.width!==ww||cv.height!==hh){cv.width=ww;cv.height=hh;ctx.imageSmoothingEnabled=false;}jarRect();}
// shadows of clouds crossing the map: two fluffy ones and the face, each drifting at its own pace
const SHADOWS=(()=>{const mk=(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#08183a';fn(g,w,h);return c;};
  const cumulus=(seed,w,h)=>mk(w,h,(g)=>{const r=rng(seed);const base=h*0.8,s=h*0.55,n=4+(r()*3|0);g.beginPath();
    for(let i=0;i<n;i++){const t=(i+0.5)/n;const px=w*0.12+t*w*0.76,pr=s*(0.45+0.55*Math.sin(t*Math.PI))*(0.85+r()*0.3);g.moveTo(px+pr,base-pr*0.8);g.arc(px,base-pr*0.8,pr,0,7);}
    g.rect(w*0.12,base-s*0.3,w*0.76,s*0.3);g.fill();});
  const face=(d)=>mk(d,d,(g)=>{const R=d/2;g.beginPath();g.arc(R,R,R,0,7);g.fill();g.globalCompositeOperation='destination-out';
    for(const ex of [-0.40,0.40]){const ew=R*0.24;g.beginPath();g.roundRect(R+ex*R-ew/2,-4,ew,R*0.9+4,ew/2);g.fill();}
    g.lineWidth=Math.max(1,R*0.06);g.beginPath();g.arc(R,R,R*0.84,Math.PI*0.034,Math.PI*0.966);g.stroke();});
  return [{img:cumulus(11,110,44),y:26,v:0.22},{img:face(60),y:118,v:0.17},{img:cumulus(23,86,36),y:170,v:0.27}];})();
function drawCloudShadows(){ctx.globalAlpha=0.1;for(let i=0;i<SHADOWS.length;i++){const sh=SHADOWS[i];const span=cv.width+sh.img.width+80;const x=((frame*sh.v+i*160)%span)-sh.img.width-40;ctx.drawImage(sh.img,x|0,(sh.y%cv.height)|0);}ctx.globalAlpha=1;}
function drawLab(){drawSky(0,0,0.08);dots(0,0,W,H,'rgba(255,255,255,0.3)');
  rect(0,140,W,52,'#c8d4c0');for(let i=0;i<W;i+=16)for(let j=140;j<H;j+=16)if(((i+j)>>4)&1)rect(i,j,16,16,'#bccab4');
  bevelOut(150,96,96,52,'#a08060');rect(154,100,88,44,'#c8a880');ctx.drawImage(MOSS[0],160,92);ctx.drawImage(MOSS[1],200,92);
  photo(null,178,104,40,30,true);
  const talking=state==='intro'&&intro.ch<(intro.pages[intro.page]||'').length;const nod=talking?((frame>>2)&1)*2:((frame>>5)&1);const blink=(frame%210)<7;
  ctx.save();ctx.translate(40,34+nod);ctx.scale(2,2);ctx.drawImage(blink?PROF2:PROF,0,0);ctx.restore();
  const bob=(frame>>4)&1;ctx.drawImage(MOSS[bob],20,150);ctx.drawImage(MOSS[1-bob],120,160);}
const MAPH=136;let WORLDIMG=null;
function worldImg(){if(WORLDIMG)return WORLDIMG;const c=document.createElement('canvas');c.width=WORLDMAP.w;c.height=WORLDMAP.h;const g=c.getContext('2d');g.fillStyle=C.ink;
  const bin=atob(WORLDMAP.data),bpr=WORLDMAP.w>>3;for(let y=0;y<WORLDMAP.h;y++)for(let x=0;x<WORLDMAP.w;x++)if(bin.charCodeAt(y*bpr+(x>>3))&(128>>(x&7)))g.fillRect(x,y,1,1);return WORLDIMG=c;}
function drawMap(){dots(0,0,cv.width,cv.height,'rgba(27,51,32,0.10)');const my=(cv.height-WORLDMAP.h)>>1,mx=(cv.width-WORLDMAP.w)>>1;ctx.drawImage(worldImg(),mx,my);
  const f=ui&&ui.querySelector('.focused'),fc=f&&f.dataset.act==='region:go'?f.dataset.arg:null;
  for(const c of CONT){const pin=WORLDMAP.pins[c];if(!pin)continue;const x=mx+pin[0],y=my+pin[1],cur=c===fc,done=roster[c].length&&nCollectedIn(c)===roster[c].length;
    if(c===save.region)ctx.drawImage(MOSS[(frame>>4)&1],x-8,y-15);
    rect(x-2,y-2,5,5,C.ink);rect(x-1,y-1,3,3,done?C.gold:cur&&((frame>>3)&1)?C.red:C.paper);
    if(cur){rect(x-5,y-5,11,1,C.red);rect(x-5,y+5,11,1,C.red);rect(x-5,y-5,1,11,C.red);rect(x+5,y-5,1,11,C.red);
      withFont(F7,()=>{const t=titleCase(CN[c])+' '+nCollectedIn(c)+'/'+roster[c].length;const w=tw(t)+6,lx=Math.max(2,Math.min(cv.width-w-2,x-(w>>1))),ly=y<my+30?y+9:y-19;bevelOut(lx,ly,w,12,C.paper);text(t,lx+3,ly+3,C.ink);});}}}
function drawScene(){fitWorld();rect(0,0,cv.width,cv.height,C.paper);
  if(state==='world')drawWorld();
  else if(state==='region')drawMap();
  else if(state==='shop')drawShop();
  else if(state==='title'||state==='intro')drawLab();
  else if((state==='pet'||state==='petlapse')&&save.pet){const p=save.pet;const snap=state==='petlapse'?p.snaps[Math.min(lapse.i,p.snaps.length-1)]:null;drawJar(JAR.x,JAR.y,JAR.w,JAR.h,p,snap);}}

/* ---------------- status + lifecycle ---------------- */
let lastStatus='',lastPage='',tuneT=0,tuneEl=null,tuneTimer=0;
const calm=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function tune(){const host=ui&&(ui.closest('[data-scene]')||ui.parentElement);if(!host||calm())return;
  if(!tuneEl){tuneEl=document.createElement('canvas');tuneEl.id='quest-tune';tuneEl.width=96;tuneEl.height=72;host.appendChild(tuneEl);}
  tuneT=5;drawTune();host.classList.add('q-tune');clearTimeout(tuneTimer);tuneTimer=setTimeout(()=>{host.classList.remove('q-tune');tuneT=0;},200);snd('tune');}
function drawTune(){if(!tuneEl)return;const g=tuneEl.getContext('2d'),w=tuneEl.width,h=tuneEl.height,d=tuneT/5;g.clearRect(0,0,w,h);
  for(let y=0;y<h;y++){const bar=((y+frame*5)%29)<3;for(let x=0;x<w;x++){const v=Math.random();if(v<0.12*d+(bar?0.5:0))g.fillStyle=C.light;else if(v<0.30*d)g.fillStyle=C.ink;else continue;g.fillRect(x,y,1,1);}}
  const sy=(frame*11)%h;g.fillStyle='rgba(228,235,196,0.55)';g.fillRect(0,sy,w,2);}
function statusText(){const n=nCollected()+'/'+SP.length;
  if(state==='title')return 'A: ok · '+n+' logged';
  if(state==='intro')return intro.kb?'spell your name · A: type · B: delete':intro.opt?((intro.pages[intro.page]||{}).ask==='char'?'pick a Traveler · A: choose':'Prof. Chaga · A: choose'):'Prof. Chaga · A: next · B: back';
  if(state==='region')return 'A: travel · B: back';
  if(state==='world')return menuOpen?'A: ok · B: close':titleCase(CN[REG()])+' · '+n+' · d-pad: walk · A: look · B: menu · X: MossDex';
  if(state==='enc')return enc.phase===0?'A: identify':enc.phase===1?'A: answer · X: ask a beetle, 1 cheese':'A: continue';
  if(state==='journal')return shot?'A or B: leave showcase':info?'✚: scroll · L/R: prev / next · X or B: back':entry?'A: showcase · X: info · L/R: prev / next · B: back':'MossDex · L/R: region · A: open · X: back';
  if(state==='petpick')return naming?'A: name it · B: back':'GoodMoss · A: plant this cutting · B: back';
  if(state==='pet')return petMenu?'A: choose · B: close':'GoodMoss · A: do it · d-pad: pick · B: leave or release';
  if(state==='petlapse')return 'time-lapse · A: back';
  if(state==='beetle')return 'A: continue';
  if(state==='beetles')return bsel?'B: back to the book':'beetles · A: look · B: back';
  if(state==='shop')return shop&&shop.mode==='swap'?'A: offer · B: back':shop&&shop.mode==='goods'?'A: buy · B: back':'the Dealer · left: buy · right: sell · B: leave';
  if(state==='win')return 'every moss found · A: keep exploring';return '';}
function pushStatus(){const t=statusText();if(t!==lastStatus){lastStatus=t;if(opts.onStatus)opts.onStatus(t);}}
let raf=0,running=false;
function loop(){if(!running)return;syncKeys();update();for(const k in just)just[k]=false;if(uiDirty)render();drawScene();pushStatus();raf=requestAnimationFrame(loop);}
function start(canvas,o){opts=o||{};cv=canvas;ctx=cv.getContext('2d');cv.width=CW;cv.height=CH;ctx.imageSmoothingEnabled=false;ui=opts.ui||null;
  if(!cv.__mossQuest){cv.__mossQuest=true;bindPointer(cv);}
  if(ui&&!ui.__mossQuest){ui.__mossQuest=true;ui.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(el&&ui.contains(el))act(el.dataset.act,el.dataset.arg);});}
  const begin=()=>{if(!SP)loadData(opts.data);setUser(opts.user||GUEST);setMute(!!opts.muted);for(const k in held)held[k]=false;
    if(state!=='title'&&save.region)ambientFor(CONT.indexOf(save.region));lastStatus='';running=true;if(opts.notice){toast={t:opts.notice,n:400};opts.notice=null;}dirty();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);};
  const fail=e=>{if(opts.onStatus)opts.onStatus('the MossDex could not load');if(ui){ui.innerHTML=`<p class="lcd-msg">the MossDex could not load: ${esc(e&&e.message||e)}</p><ul class="menu item-links"><li><button type="button" class="menu-item focusable" data-act="sys:retry" data-note="fetch the species data again">try again</button></li></ul>`;if(opts.onRender)opts.onRender(0);}};
  if(SP||opts.data)begin();else fetch(opts.dataUrl||'mossdex.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(d=>{loadData(d);begin();}).catch(fail);
  if(opts.dev&&!window.MQ)window.MQ=DEBUG;
  return api;}
function stop(){running=false;cancelAnimationFrame(raf);amb.on=false;if(AC&&AC.state==='running')AC.suspend();}
const api={start,stop,press:pressKey,hold:holdKey,handles,pad,setMuted:setMute,setUser,act,get state(){return state;},get user(){return user;}};

const DEBUG={get map(){return map;},get spots(){return spots;},get beetles(){return beetles;},get player(){return player;},get state(){return state;},get save(){return save;},get enc(){return enc;},get user(){return user;},
  setUser,go(c){enterRegion(c);},intro(){startIntro('world');dirty();},pet(){openPet();},ff(h){if(save.pet){save.pet.last-=h*3600000;simPet(save.pet,Date.now());persist();dirty();}},act,
  tick(n){for(let i=0;i<(n||1);i++){syncKeys();update();for(const k in just)just[k]=false;}if(uiDirty)render();drawScene();},
  press(k,n){for(let i=0;i<(n||1);i++){pressKey(k);syncKeys();update();for(const q in just)just[q]=false;for(let f=0;f<10;f++){syncKeys();update();}}if(uiDirty)render();drawScene();},
  tapAt(x,y){click={x,y,top:true,topy:y};update();drawScene();}};
return api;
})();
