"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Screen = "menu" | "instructions" | "playing" | "paused" | "victory" | "defeat";
type Result = "" | "GOAL!" | "SAVED!" | "MISS!" | "OFF THE POST!";
type Stats = { goals: number; shots: number; saves: number; time: number };

const W = 1280, H = 720, TARGET = 6;
const displaySeconds = (time:number) => time<=11?Math.min(10,Math.max(0,Math.floor(time))):Math.ceil(time);

class AudioEngine {
  ctx?: AudioContext; track?: HTMLAudioElement; music = true; sound = true; active = false;
  start() { if (!this.ctx) this.ctx = new AudioContext(); this.ctx.resume();if(!this.track){const musicPath=window.location.pathname.endsWith("/mobile/")?"../match-music.mp3":"./match-music.mp3";this.track=new Audio(musicPath);this.track.preload="auto";this.track.volume=.48}this.track.currentTime=0;this.active=true;if(this.music)this.track.play().catch(()=>{}); }
  setMusic(v:boolean) { this.music=v;if(!this.track)return;if(v&&this.active)this.track.play().catch(()=>{});else this.track.pause(); }
  setGameActive(v:boolean){this.active=v;if(!this.track)return;if(v&&this.music)this.track.play().catch(()=>{});else this.track.pause()}
  tone(f:number,d=.1,v=.1,type:OscillatorType="sine",when?:number){if(!this.ctx||!this.sound)return; const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=when??this.ctx.currentTime;o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+d);}
  noise(d=.08,v=.08,when?:number){if(!this.ctx||!this.sound)return;const len=this.ctx.sampleRate*d,b=this.ctx.createBuffer(1,len,this.ctx.sampleRate),a=b.getChannelData(0);for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=b;g.gain.value=v;s.connect(g).connect(this.ctx.destination);s.start(when??this.ctx.currentTime);}
  kick(){} shout(){if(!this.ctx||!this.sound)return;const t=this.ctx.currentTime;this.noise(.42,.13,t);[180,215,250].forEach((f,i)=>{this.tone(f,.32,.08,"sawtooth",t+i*.035)})} goal(){[392,523,659].forEach((f,i)=>this.tone(f,.45,.11,"square",this.ctx!.currentTime+i*.1));this.noise(.6,.08)} save(){this.tone(130,.2,.12,"sawtooth")} post(){this.tone(1200,.35,.15,"square")} warning(){this.tone(760,.1,.12,"square")} victory(){[262,330,392,523].forEach((f,i)=>this.tone(f,.7,.13,"triangle",this.ctx!.currentTime+i*.15))} defeat(){[294,247,196].forEach((f,i)=>this.tone(f,.55,.1,"sine",this.ctx!.currentTime+i*.2))}
}

function Button({children,onClick,secondary=false}:{children:React.ReactNode;onClick:()=>void;secondary?:boolean}){return <button className={secondary?"btn secondary":"btn"} onClick={onClick}>{children}</button>}

export default function Home({mobileMode=false}:{mobileMode?:boolean}){
  const canvasRef=useRef<HTMLCanvasElement>(null), game=useRef<any>(null), audio=useRef(new AudioEngine());
  const [screen,setScreen]=useState<Screen>("menu"),[result,setResult]=useState<Result>(""),[stats,setStats]=useState<Stats>({goals:0,shots:0,saves:0,time:60});
  const [music,setMusic]=useState(true),[sound,setSound]=useState(true);
  const screenRef=useRef<Screen>("menu");
  const elapsedRef=useRef(0);
  const statsRef=useRef(stats);

  const start=useCallback(()=>{audio.current.start();elapsedRef.current=0;setResult("");setStats({goals:0,shots:0,saves:0,time:60});setScreen("playing"); if(game.current) game.current.reset(true);},[]);
  const menu=()=>{setScreen("menu");setResult("");};

  useEffect(()=>{audio.current.setMusic(music);},[music]); useEffect(()=>{audio.current.sound=sound;},[sound]);
  useEffect(()=>{screenRef.current=screen;audio.current.setGameActive(screen==="playing")},[screen]);
  useEffect(()=>{statsRef.current=stats},[stats]);

  useEffect(()=>{
    const c=canvasRef.current!; if(!c)return; const ctx=c.getContext("2d")!;
    const G:any={state:"idle",ball:{x:640,y:596,z:0},player:{x:640,y:668},keeper:{x:640,y:272,v:80},aim:{x:640,y:220},power:0,drag:false,dragStart:null,shotT:0,shotDur:1,from:null,to:null,last:performance.now(),elapsed:0,net:0,flash:0,confetti:[],reset(full=false){this.state="idle";this.ball={x:640,y:596,z:0};this.player={x:640,y:668};this.aim={x:640,y:220};this.power=0;this.drag=false;this.shotT=0; if(full){this.elapsed=0;this.keeper.x=640;this.confetti=[];}},shoot(){if(this.state!=="charge")return;this.state="run";this.shotT=0;this.runFrom={...this.player};this.runTarget={x:this.ball.x,y:this.ball.y+46};this.runSpeed=mobileMode?390:210;this.runDur=mobileMode?Math.max(.34,Math.hypot(this.runFrom.x-this.runTarget.x,this.runFrom.y-this.runTarget.y)/this.runSpeed):.32;},launch(){audio.current.kick();this.state="flight";this.shotT=0;this.from={...this.ball};const p=this.power;this.to={x:this.aim.x,y:this.aim.y,z:0};this.shotDur=1.25-p*.83;setStats(s=>({...s,shots:s.shots+1}));setResult("");},resolve(){const x=this.to.x,y=this.to.y;const inGoal=x>365&&x<915&&y>112&&y<323;const post=(Math.abs(x-365)<18||Math.abs(x-915)<18||Math.abs(y-112)<14)&&x>345&&x<935&&y<340;const canReach=Math.abs(x-this.keeper.x)<(150+(1-this.power)*75);let r:Result;if(post){r="OFF THE POST!";audio.current.post();}else if(!inGoal){r="MISS!";audio.current.tone(180,.25,.09,"sine");}else if(canReach){r="SAVED!";audio.current.save();setStats(s=>({...s,saves:s.saves+1}));}else{r="GOAL!";audio.current.goal();this.net=1;setStats(s=>{const n={...s,goals:s.goals+1};if(n.goals>=TARGET){setTimeout(()=>{setScreen("victory");audio.current.victory();},250)}return n;});}setResult(r);this.state="result";this.shotT=0;},pointer(type:string,e:PointerEvent){if(screen!=="playing")return;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(type==="down"&&this.state==="idle"){if(Math.hypot(x-this.ball.x,y-this.ball.y)<48){this.state="place";this.drag=true;}else if(Math.hypot(x-this.player.x,y-this.player.y)<110){this.state="charge";this.drag=true;this.dragStart={x,y};c.setPointerCapture(e.pointerId);}}else if(type==="move"&&this.drag){if(this.state==="place"){this.ball.x=Math.max(540,Math.min(740,x));this.ball.y=Math.max(555,Math.min(615,y));this.player.x=this.ball.x;this.player.y=this.ball.y+72;}else if(this.state==="charge"){const dy=Math.max(0,y-this.dragStart.y),dx=x-this.dragStart.x;this.power=Math.min(1,dy/155);this.player.y=this.ball.y+72+this.power*105;this.player.x=this.ball.x+dx*.25;this.aim.x=Math.max(375,Math.min(905,this.ball.x-dx*2.35));this.aim.y=Math.max(130,Math.min(310,220-dy*.35));}}else if(type==="up"&&this.drag){this.drag=false;if(this.state==="place")this.state="idle";else if(this.state==="charge"&&this.power>.08)this.shoot();else this.reset();}},}; game.current=G;

    G.elapsed=elapsedRef.current;
    // Two-stage slingshot control: place the ball, then pull the player back.
    const originalReset=G.reset.bind(G);
    const originalLaunch=G.launch.bind(G);
    G.phase="placeBall";
    G.goalOffset=0;G.goalOffsetY=0;G.goalVelocity=135;G.goalVelocityY=-90;G.goalLast=performance.now()/1000;G.target={x:640,y:210};G.targetRel={x:0,y:0,vx:30,vy:20};
    G.ball.y=mobileMode?500:525;G.player=mobileMode?{x:760,y:690}:{x:835,y:630};G.keeper.y=mobileMode?248:272;G.reactionTimers=[];
    G.launch=()=>{originalLaunch();if(G.to){G.to.x=G.aim.x;G.to.y=G.aim.y;G.keeper.adjusting=false;const p=G.power,willAdjust=statsRef.current.goals<4&&Math.random()<(.22+(1-p)*.68);const reaction=window.setTimeout(()=>{if(G.state==="flight"&&willAdjust){G.keeper.adjusting=true;G.keeper.adjustTarget=G.to.x-G.goalOffset;G.keeper.adjustSpeed=208+(1-p)*352}},105+p*210);G.reactionTimers.push(reaction)}};
    G.resolve=()=>{
      const x=G.to.x-G.goalOffset,y=G.to.y-G.goalOffsetY,targetMode=statsRef.current.goals>=4;
      const inGoal=x>365&&x<915&&y>112&&y<323;
      const post=(Math.abs(x-365)<18||Math.abs(x-915)<18||Math.abs(y-112)<14)&&x>345&&x<935&&y<340;
      const distance=Math.abs(x-G.keeper.x),standingBlock=distance<58&&y>190,diveReach=G.keeper.willDive&&distance<(102+(1-G.power)*76),saved=!targetMode&&(standingBlock||diveReach),hitTarget=!targetMode||Math.hypot(G.to.x-G.target.x,G.to.y-G.target.y)<76;
      let shotResult:Result;
      if(post){shotResult="OFF THE POST!";audio.current.post()}
      else if(!inGoal||!hitTarget){shotResult="MISS!";audio.current.tone(180,.25,.09,"sine")}
      else if(saved){shotResult="SAVED!";G.savedPose=true;G.deflect={x:G.to.x,y:G.to.y,vx:(G.to.x>640?1:-1)*(250+Math.random()*120),vy:-190};audio.current.save();setStats(s=>({...s,saves:s.saves+1}))}
      else{shotResult="GOAL!";audio.current.goal();G.net=1;setStats(s=>{const next={...s,goals:s.goals+1};if(next.goals>=TARGET)setTimeout(()=>{setScreen("victory");audio.current.victory()},250);return next})}
      setResult(shotResult);G.state="result";G.shotT=0;
    };
    G.reset=(full=false)=>{G.reactionTimers.forEach(clearTimeout);G.reactionTimers=[];originalReset(full);G.savedPose=false;G.deflect=null;G.keeper.adjusting=false;G.ball.y=mobileMode?500:525;G.phase="placeBall";G.player=mobileMode?{x:760,y:690}:{x:835,y:630};G.keeper.y=mobileMode?248:272;G.targetRel={x:-145+Math.random()*290,y:-48+Math.random()*96,vx:(Math.random()<.5?-1:1)*(26+Math.random()*12),vy:(Math.random()<.5?-1:1)*(18+Math.random()*9)};if(full){G.goalOffset=0;G.goalOffsetY=0;G.goalVelocity=135;G.goalVelocityY=-90}};
    G.pointer=(type:string,e:PointerEvent)=>{
      if(screen!=="playing"||!["idle","place","charge"].includes(G.state))return;
      const r=c.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
      const x=mobileMode?(px-G.view.ox)/G.view.scaleX:px*W/r.width;
      const y=mobileMode?(py-G.view.oy)/G.view.scaleY:py*H/r.height;
      if(type==="down"){
        if(G.phase==="placeBall"&&y>(mobileMode?410:455)){G.state="place";G.drag=true;c.setPointerCapture(e.pointerId)}
        else if(G.phase==="runup"&&y>470){G.state="charge";G.drag=true;c.setPointerCapture(e.pointerId)}
      }
      if(type==="move"&&G.drag&&G.state==="place"){
        // The ball follows the pointer; Yamal waits at his original run-up spot.
        if(mobileMode){
          const arcX=640,arcY=598,radiusX=310,radiusY=128;
          let dx=Math.max(-radiusX,Math.min(radiusX,x-arcX)),dy=Math.min(0,y-arcY);
          const ellipseDistance=Math.hypot(dx/radiusX,dy/radiusY);
          if(ellipseDistance>1){dx/=ellipseDistance;dy/=ellipseDistance}
          G.ball.x=arcX+dx;G.ball.y=arcY+dy;
        }else{
          G.ball.x=Math.max(525,Math.min(755,x));G.ball.y=Math.max(490,Math.min(545,y));
        }
      }
      if(type==="move"&&G.drag&&G.state==="charge"){
        G.player.x=Math.max(mobileMode?350:430,Math.min(mobileMode?930:850,x));G.player.y=Math.max(G.ball.y+76,Math.min(mobileMode?920:704,y));
        const back=Math.max(0,G.player.y-G.ball.y-50),side=G.player.x-G.ball.x;
        const chargeDistance=mobileMode?back:Math.hypot(back,side*.45);
        G.power=Math.max(.12,Math.min(1,chargeDistance/(mobileMode?250:145)));
        G.aim.x=Math.max(375+G.goalOffset,Math.min(905+G.goalOffset,G.ball.x-side*2.05));
        G.aim.y=Math.max(132+G.goalOffsetY,Math.min(305+G.goalOffsetY,285-G.power*145+G.goalOffsetY));
      }
      if(type==="up"&&G.drag){
        G.drag=false;
        if(G.state==="place"){G.state="idle";G.phase="runup";}
        else if(G.state==="charge"&&G.power>.16){G.keeper.willDive=statsRef.current.goals<4&&Math.random()<.62;audio.current.shout();G.shoot();}
        else if(G.state==="charge"){G.state="idle";}
      }
    };
    const keydown=(e:KeyboardEvent)=>{if(screen!=="playing")return;if(e.key.toLowerCase()==="r"&&G.state==="idle")G.reset();};
    window.addEventListener("keydown",keydown);
    // Variable keeper rhythm: bursts, direction changes and short feint pauses.
    const keeperRhythm=window.setInterval(()=>{if(screen!=="playing"||G.state==="flight"||statsRef.current.goals>=4)return;const roll=Math.random();if(roll<.06)G.keeper.v=0;else if(roll<.34)G.keeper.v*=-1.32;else G.keeper.v=(Math.random()<.5?-1:1)*(208+Math.random()*336)},170);
    const resize=()=>{
      const d=Math.min(devicePixelRatio||1,2),r=c.getBoundingClientRect();
      c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);
      if(mobileMode){
        const scale=r.width/800,ox=r.width/2-W/2*scale,oy=0;
        G.view={scaleX:scale,scaleY:scale,ox,oy,logicalHeight:r.height/scale};ctx.setTransform(scale*d,0,0,scale*d,ox*d,oy*d);
      }else{
        G.view={scaleX:r.width/W,scaleY:r.height/H,ox:0,oy:0};ctx.setTransform(c.width/W,0,0,c.height/H,0,0);
      }
    };
    resize();const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(c);
    const pd=(e:PointerEvent)=>G.pointer("down",e),pm=(e:PointerEvent)=>G.pointer("move",e),pu=(e:PointerEvent)=>G.pointer("up",e);c.addEventListener("pointerdown",pd);c.addEventListener("pointermove",pm);c.addEventListener("pointerup",pu);c.addEventListener("pointercancel",pu);

    const round=(x:number,y:number,w:number,h:number,r:number)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()};
    const drawPlayer=(x:number,y:number,t:number,celebrate=false)=>{
      ctx.save();ctx.translate(x,y);ctx.scale(.7,1.28);const run=G.state==="run"?Math.sin(t*35)*13:0,bob=Math.sin(t*4)*2;
      // Boots, socks and athletic legs.
      ctx.fillStyle="#171219";ctx.beginPath();ctx.ellipse(-19+run,48,15,9,-.12,0,7);ctx.ellipse(19-run,48,15,9,.12,0,7);ctx.fill();
      ctx.strokeStyle="#e62d38";ctx.lineWidth=18;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-17,15);ctx.lineTo(-18+run,42);ctx.moveTo(17,15);ctx.lineTo(18-run,42);ctx.stroke();
      // Split-leg blue football shorts with a clear central notch.
      ctx.fillStyle="#173b91";ctx.beginPath();ctx.moveTo(-35,-10);ctx.lineTo(35,-10);ctx.lineTo(31,35);ctx.lineTo(7,35);ctx.lineTo(0,17);ctx.lineTo(-7,35);ctx.lineTo(-31,35);ctx.closePath();ctx.fill();
      // Long, straight athletic torso with no rounded belly.
      ctx.fillStyle="#e52832";ctx.beginPath();ctx.moveTo(-42,-86+bob);ctx.lineTo(42,-86+bob);ctx.lineTo(31,0);ctx.lineTo(-31,0);ctx.closePath();ctx.fill();ctx.fillStyle="#f4c92e";ctx.fillRect(-40,-66+bob,80,7);
      ctx.fillStyle="#f4c92e";ctx.beginPath();ctx.moveTo(-42,-82+bob);ctx.lineTo(-23,-86+bob);ctx.lineTo(-30,-65+bob);ctx.fill();ctx.beginPath();ctx.moveTo(42,-82+bob);ctx.lineTo(23,-86+bob);ctx.lineTo(30,-65+bob);ctx.fill();
      // Back-facing elongated rectangular head, with no facial features visible.
      ctx.fillStyle="#75422f";round(-25,-139+bob,50,61,13);
      ctx.beginPath();ctx.arc(-27,-106+bob,7,0,7);ctx.arc(27,-106+bob,7,0,7);ctx.fill();
      ctx.fillStyle="#171118";ctx.beginPath();ctx.rect(-25,-132+bob,50,23);ctx.fill();
      ctx.strokeStyle="#d7a43a";ctx.lineWidth=7;[-20,-8,5,18].forEach((i,j)=>{ctx.beginPath();ctx.arc(i,-134+bob-(j%2)*3,9,2.7,6.5);ctx.stroke()});
      // Arms and celebration pose.
      ctx.strokeStyle="#75422f";ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-38,-72);ctx.lineTo(celebrate?-68:-58,celebrate?-138:8);ctx.moveTo(38,-72);ctx.lineTo(celebrate?68:58,celebrate?-138:8);ctx.stroke();
      // Player identity on the back of the shirt.
      ctx.fillStyle="#ffe45a";ctx.textAlign="center";ctx.font="900 11px Arial";ctx.fillText("YAMAL",0,-39+bob);ctx.font="900 27px Arial";ctx.fillText("19",0,-14+bob);
      ctx.restore();
    };
    const drawKeeper=(t:number)=>{
      const x=G.keeper.x+G.goalOffset,y=G.keeper.y,dive=((G.state==="flight"&&G.shotT>.24)||G.savedPose)&&G.keeper.willDive;
      ctx.save();ctx.translate(x,y);if(mobileMode)ctx.scale(.9,.9);
      let gloveLeft={x:-67,y:-28},gloveRight={x:67,y:-28};
      if(dive){const dir=G.to.x<x?-1:1,high=G.to.y<205;ctx.rotate(dir*(high ? .62 : .46));ctx.translate(dir*(high?58:48),high?-36:4);gloveLeft={x:-72,y:-32};gloveRight={x:72,y:-32}}
      else if(G.state==="flight"||G.savedPose){const jump=G.to?.y<190?-18:0;ctx.translate(0,jump);gloveLeft={x:-54,y:-50};gloveRight={x:54,y:-50}}
      ctx.strokeStyle="#f1ad86";ctx.lineWidth=15;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-25,-8);ctx.lineTo(gloveLeft.x+8,gloveLeft.y+5);ctx.moveTo(25,-8);ctx.lineTo(gloveRight.x-8,gloveRight.y+5);ctx.stroke();
      // Oversized padded goalkeeper gloves with visible cuffs and finger ridges.
      [gloveLeft,gloveRight].forEach((g,i)=>{ctx.fillStyle="#f7f9ff";ctx.strokeStyle="#173a75";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(g.x,g.y,21,17,i?-.2:.2,0,7);ctx.fill();ctx.stroke();ctx.fillStyle="#70c6ee";ctx.fillRect(g.x-15,g.y+10,30,9);ctx.strokeStyle="#a7b7c9";ctx.lineWidth=2;[-8,0,8].forEach(o=>{ctx.beginPath();ctx.moveTo(g.x+o,g.y-14);ctx.lineTo(g.x+o+(i?3:-3),g.y-2);ctx.stroke()})});
      ctx.fillStyle="#70c6ee";round(-38,-50,76,64,12);ctx.fillStyle="#fff";ctx.fillRect(-38,-28,76,17);ctx.fillStyle="#142c65";round(-36,11,72,38,8);
      ctx.strokeStyle="#172036";ctx.lineWidth=17;ctx.beginPath();ctx.moveTo(-20,45);ctx.lineTo(-32,83);ctx.moveTo(20,45);ctx.lineTo(32,83);ctx.stroke();
      ctx.fillStyle="#d79a73";ctx.beginPath();ctx.arc(0,-71,22,0,7);ctx.fill();ctx.fillStyle="#271d18";ctx.beginPath();ctx.arc(0,-79,22,3.1,6.3);ctx.fill();ctx.restore();
    };
    const drawDrinkingKeeper=(t:number)=>{
      ctx.save();ctx.translate(952+G.goalOffset,292+G.goalOffsetY+Math.sin(t*3)*2);
      ctx.fillStyle="#70c6ee";round(-30,-42,60,62,12);ctx.fillStyle="#fff";ctx.fillRect(-30,-20,60,14);ctx.fillStyle="#142c65";round(-28,18,56,32,8);
      ctx.fillStyle="#d79a73";ctx.beginPath();ctx.arc(0,-62,20,0,7);ctx.fill();ctx.fillStyle="#271d18";ctx.beginPath();ctx.arc(0,-70,20,3.1,6.3);ctx.fill();
      ctx.strokeStyle="#d79a73";ctx.lineWidth=12;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(24,-28);ctx.lineTo(39,-60);ctx.stroke();
      // Concrete transparent sports bottle: cap, neck, water level, label and shine.
      ctx.save();ctx.translate(40,-66);ctx.rotate(.08);ctx.fillStyle="#173a75";round(-7,-28,14,7,2);ctx.fillStyle="#d8f7ff";ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-10,-23,20,43,7);ctx.fill();ctx.stroke();ctx.fillStyle="#54c9ee";ctx.beginPath();ctx.roundRect(-8,-5,16,23,5);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(-9,1,18,9);ctx.fillStyle="#173a75";ctx.font="900 6px Arial";ctx.textAlign="center";ctx.fillText("H₂O",0,8);ctx.strokeStyle="rgba(255,255,255,.9)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-18);ctx.lineTo(-5,-8);ctx.stroke();ctx.restore();
      ctx.fillStyle="#fff";ctx.font="900 10px Arial";ctx.textAlign="center";ctx.fillText("WATER BREAK",0,68);ctx.restore();
    };
    const drawBall=(x:number,y:number,s:number,t:number)=>{
      ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.rotate(G.state==="flight"?t*9:0);
      ctx.shadowColor="rgba(0,0,0,.35)";ctx.shadowBlur=8;ctx.shadowOffsetY=5;
      const leather=ctx.createRadialGradient(-6,-8,2,0,0,20);leather.addColorStop(0,"#fff");leather.addColorStop(.62,"#ecebe5");leather.addColorStop(1,"#aeb4b6");ctx.fillStyle=leather;ctx.strokeStyle="#17212b";ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.fill();ctx.stroke();ctx.shadowColor="transparent";
      // Central pentagon and stitched panel seams.
      ctx.fillStyle="#17212b";ctx.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;const px=Math.cos(a)*6.5,py=Math.sin(a)*6.5;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill();
      ctx.strokeStyle="#586168";ctx.lineWidth=1.3;for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5,b=a+.48;ctx.beginPath();ctx.moveTo(Math.cos(a)*7,Math.sin(a)*7);ctx.lineTo(Math.cos(a)*14,Math.sin(a)*14);ctx.lineTo(Math.cos(b)*18,Math.sin(b)*18);ctx.stroke()}
      ctx.fillStyle="rgba(255,255,255,.65)";ctx.beginPath();ctx.ellipse(-7,-8,4,2,-.5,0,7);ctx.fill();ctx.restore();
    };
    const draw=()=>{const t=performance.now()/1000;ctx.clearRect(0,0,W,mobileMode?(G.view.logicalHeight+120):H);const sky=ctx.createLinearGradient(0,0,0,720);sky.addColorStop(0,"#5fd3ff");sky.addColorStop(.42,"#b8ecff");sky.addColorStop(.43,"#1a4870");sky.addColorStop(1,"#168541");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);ctx.fillStyle="#17375d";ctx.fillRect(0,115,W,175);for(let i=0;i<160;i++){ctx.fillStyle=["#ffce3b","#ef3340","#fff","#72cdf4"][i%4];ctx.beginPath();ctx.arc((i*83)%W,140+(i*47)%120,3+(i%3),0,7);ctx.fill()}ctx.fillStyle="#102844";ctx.fillRect(0,279,W,40);["PLAY WITH YC","CHEER FOR SPAIN","PLAY WITH YC","CHEER FOR SPAIN"].forEach((s,i)=>{ctx.fillStyle=i%2?"#f8d53d":"#ef3d46";ctx.fillRect(i*320,282,315,31);ctx.fillStyle="#fff";ctx.font="900 15px Arial";ctx.textAlign="center";ctx.fillText(s,i*320+158,303)});ctx.fillStyle="#1da653";ctx.beginPath();ctx.moveTo(0,319);ctx.lineTo(W,319);ctx.lineTo(1130,720);ctx.lineTo(150,720);ctx.fill();for(let i=0;i<8;i++){ctx.fillStyle=i%2?"rgba(255,255,255,.035)":"rgba(0,0,0,.025)";ctx.beginPath();ctx.moveTo(160*i,319);ctx.lineTo(160*(i+1),319);ctx.lineTo(160*(i+1)+140,720);ctx.lineTo(160*i-140,720);ctx.fill()}ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(640,598,310,128,0,Math.PI,2*Math.PI);ctx.stroke();
      // Goal and animated net
      const goalDt=Math.min(.033,t-G.goalLast),goalStage=statsRef.current.goals,goalSpeed=goalStage>=4 ? .5 : 1;G.goalLast=t;if(goalStage>=2&&screen==="playing"){G.goalOffset+=G.goalVelocity*goalDt*goalSpeed;if(Math.abs(G.goalOffset)>145){G.goalOffset=Math.sign(G.goalOffset)*145;G.goalVelocity*=-1}}if(goalStage>=4&&screen==="playing"){G.goalOffsetY+=G.goalVelocityY*goalDt*goalSpeed;if(G.goalOffsetY<-82||G.goalOffsetY>45){G.goalOffsetY=Math.max(-82,Math.min(45,G.goalOffsetY));G.goalVelocityY*=-1}}const go=G.goalOffset,gy=G.goalOffsetY;
      ctx.strokeStyle=`rgba(230,250,255,${.55+G.net*.25})`;ctx.lineWidth=2;for(let x=365;x<=915;x+=34){ctx.beginPath();ctx.moveTo(x+go,110+gy);ctx.lineTo(x+go+(x-640)*.04*G.net,325+gy+Math.sin(t*20+x)*7*G.net);ctx.stroke()}for(let y=120;y<=325;y+=25){ctx.beginPath();ctx.moveTo(365+go,y+gy);ctx.lineTo(915+go,y+gy+Math.sin(t*18+y)*5*G.net);ctx.stroke()}ctx.strokeStyle="#fff";ctx.lineWidth=14;ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(360+go,330+gy);ctx.lineTo(360+go,105+gy);ctx.lineTo(920+go,105+gy);ctx.lineTo(920+go,330+gy);ctx.stroke();
      if(goalStage>=4){const targetSpeed=goalStage>=5?1.1:1;G.targetRel.x+=G.targetRel.vx*goalDt*targetSpeed;G.targetRel.y+=G.targetRel.vy*goalDt*targetSpeed;if(Math.abs(G.targetRel.x)>155)G.targetRel.vx*=-1;if(Math.abs(G.targetRel.y)>55)G.targetRel.vy*=-1;G.target={x:640+go+G.targetRel.x,y:215+gy+G.targetRel.y};ctx.fillStyle="rgba(255,255,255,.88)";ctx.beginPath();ctx.arc(G.target.x,G.target.y,46,0,7);ctx.fill();ctx.fillStyle="#ed2939";ctx.beginPath();ctx.arc(G.target.x,G.target.y,34,0,7);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(G.target.x,G.target.y,22,0,7);ctx.fill();ctx.fillStyle="#ffd43b";ctx.beginPath();ctx.arc(G.target.x,G.target.y,11,0,7);ctx.fill();drawDrinkingKeeper(t)}else drawKeeper(t);
      if(G.phase==="placeBall"&&["idle","place"].includes(G.state)){ctx.fillStyle="rgba(255,216,51,.2)";ctx.beginPath();ctx.arc(G.ball.x,G.ball.y,44+Math.sin(t*7)*5,0,7);ctx.fill();ctx.strokeStyle="#ffd833";ctx.lineWidth=3;ctx.beginPath();ctx.arc(G.ball.x,G.ball.y,34,0,7);ctx.stroke()}
      const powerX=mobileMode?900:1035;
      if(G.state==="charge"){ctx.setLineDash([10,10]);ctx.strokeStyle="rgba(255,255,255,.65)";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(G.ball.x,G.ball.y);ctx.lineTo(G.aim.x,G.aim.y);ctx.stroke();ctx.strokeStyle="#ffd833";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(G.ball.x,G.ball.y+10);ctx.lineTo(G.player.x,G.player.y-42);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle="#ffdf41";ctx.lineWidth=5;ctx.beginPath();ctx.arc(G.aim.x,G.aim.y,22+Math.sin(t*8)*3,0,7);ctx.stroke();ctx.fillStyle="rgba(10,20,30,.55)";round(powerX,480,32,174,16);ctx.fillStyle=G.power>.82?"#ff5252":"#ffd833";ctx.fillRect(powerX+6,648-G.power*160,20,G.power*160);ctx.fillStyle="#fff";ctx.font="800 15px Arial";ctx.textAlign="center";ctx.fillText("POWER",powerX+16,675)}
      if(["run","flight"].includes(G.state)){const predicted=G.state==="flight"?G.to:G.aim;ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle="rgba(255,223,65,.85)";ctx.lineWidth=4;ctx.beginPath();ctx.arc(predicted.x,predicted.y,24+Math.sin(t*9)*2,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
      let bx=G.ball.x,by=G.ball.y,scale=1;if(G.state==="flight"){const q=Math.min(1,G.shotT/G.shotDur),ease=1-Math.pow(1-q,2),trailQ=Math.max(0,q-(.025+G.power*.095)),trailEase=1-Math.pow(1-trailQ,2),trailX=G.from.x+(G.to.x-G.from.x)*trailEase,trailY=G.from.y+(G.to.y-G.from.y)*trailEase-Math.sin(trailQ*Math.PI)*110;bx=G.from.x+(G.to.x-G.from.x)*ease;by=G.from.y+(G.to.y-G.from.y)*ease-Math.sin(q*Math.PI)*110;scale=1-q*.48;ctx.save();ctx.strokeStyle=`rgba(255,255,255,${.18+G.power*.5})`;ctx.lineWidth=3+G.power*8;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(trailX,trailY);ctx.lineTo(bx,by);ctx.stroke();ctx.restore()}else if(G.state==="result"&&G.deflect){const q=G.shotT;bx=G.deflect.x+G.deflect.vx*q;by=G.deflect.y+G.deflect.vy*q+240*q*q;scale=.55;if(q<.24){ctx.strokeStyle=`rgba(255,255,255,${1-q*4})`;ctx.lineWidth=8;ctx.beginPath();ctx.arc(G.deflect.x,G.deflect.y,24+q*90,0,7);ctx.stroke()}}drawBall(bx,by,scale,t);if(G.state==="flight"){const speedPanelX=mobileMode?775:1015,speedKmh=Math.round(58+G.power*92);ctx.fillStyle="rgba(8,22,35,.82)";round(speedPanelX,638,210,42,21);ctx.fillStyle=G.power>.75?"#ffd833":"#fff";ctx.font="900 14px Arial";ctx.textAlign="center";ctx.fillText(`SHOT SPEED  ${speedKmh} KM/H`,speedPanelX+105,665)}drawPlayer(G.player.x,G.player.y,t,screen==="victory");
      if(G.state==="idle"&&screen==="playing"){ctx.fillStyle="rgba(8,22,35,.82)";round(430,642,420,46,23);ctx.fillStyle="#fff";ctx.font="800 17px Arial";ctx.textAlign="center";ctx.fillText(G.phase==="placeBall"?"1  DRAG THE GLOWING BALL • RELEASE TO LOCK":"2  PULL YAMAL BACK • RELEASE TO SHOOT",640,671)}
      if(screen==="victory"){for(let i=0;i<70;i++){ctx.fillStyle=["#ffd21f","#e62d37","#fff"][i%3];ctx.fillRect((i*97+t*45*(i%4+1))%W,(i*53+t*95*(i%3+1))%H,7,14)}}
    };
    let raf=0;const loop=(now:number)=>{const dt=Math.min(.033,(now-G.last)/1000);G.last=now;if(screen==="playing"){G.elapsed+=dt;G.net=Math.max(0,G.net-dt*2.5);if(G.state==="run"){G.shotT+=dt;if(mobileMode&&G.runFrom){const runQ=Math.min(1,G.shotT/G.runDur);G.player.x=G.runFrom.x+(G.runTarget.x-G.runFrom.x)*runQ;G.player.y=G.runFrom.y+(G.runTarget.y-G.runFrom.y)*runQ}else G.player.y-=dt*210;if(G.shotT>=G.runDur)G.launch()}else if(G.state==="flight"){G.shotT+=dt;if(G.shotT>=G.shotDur)G.resolve()}else if(G.state==="result"){G.shotT+=dt;if(G.shotT>.95){G.reset();setResult("")}}if(G.state==="flight"&&G.keeper.adjusting){G.keeper.adjustTarget=G.to.x-G.goalOffset;const adjustDelta=G.keeper.adjustTarget-G.keeper.x;if(Math.abs(adjustDelta)<12){G.keeper.v=0;G.keeper.adjusting=false}else G.keeper.v=Math.sign(adjustDelta)*G.keeper.adjustSpeed}G.keeper.x+=G.keeper.v*dt;if(G.keeper.x<455||G.keeper.x>825){G.keeper.v*=-1;G.keeper.v*=.75+Math.random()*.7}if(G.state!=="flight"&&Math.random()<.005)G.keeper.v*=-1;const remain=Math.max(0,60-G.elapsed);setStats((s:Stats)=>displaySeconds(remain)!==displaySeconds(s.time)?{...s,time:remain}:s);const countdown=displaySeconds(remain),previousCountdown=displaySeconds(remain+dt);if(countdown<=10&&countdown!==previousCountdown)audio.current.warning();if(remain<=0){setScreen("defeat");audio.current.defeat();}}draw();raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop);
    const vis=()=>{if(document.hidden&&screen==="playing")setScreen("paused")};document.addEventListener("visibilitychange",vis);
    return()=>{elapsedRef.current=G.elapsed;cancelAnimationFrame(raf);clearInterval(keeperRhythm);resizeObserver.disconnect();c.removeEventListener("pointerdown",pd);c.removeEventListener("pointermove",pm);c.removeEventListener("pointerup",pu);c.removeEventListener("pointercancel",pu);window.removeEventListener("keydown",keydown);document.removeEventListener("visibilitychange",vis)};
  },[screen,mobileMode]);

  const acc=stats.shots?Math.round(stats.goals/stats.shots*100):0;
  return <main className={mobileMode?"game-shell mobile-game":"game-shell"}>
    <canvas ref={canvasRef} aria-label="World Cup penalty shootout game" />
    <div className="brand"><span>WORLD CUP PENALTY</span><strong>SPAIN <i>VS</i> ARGENTINA</strong></div>
    <div className="orientation-hint"><b>ROTATE YOUR PHONE</b><span>Landscape mode gives you the full pitch and precise controls.</span></div>
    {screen==="playing"&&<><div className="hud"><div><small>TIME</small><b className={displaySeconds(stats.time)<=10?"danger":""}>{displaySeconds(stats.time)}</b></div><div><small>GOALS</small><b>{stats.goals}<em> / {TARGET}</em></b></div><div className="target"><small>{stats.goals>=4?`TARGET SHOT ${Math.min(2,stats.goals-3)} / 2`:"TARGET"}</small><b>{stats.goals>=4?"HIT BULLSEYE":`${TARGET} GOALS`}</b></div></div><button className="pause" aria-label="Pause game" onClick={()=>setScreen("paused")}>Ⅱ</button>{result&&<div className={`result ${result==="GOAL!"?"goal":""}`}>{result}</div>}</>}
    {screen==="menu"&&<div className="overlay"><section className="card hero"><div className="cup">★<span>WORLD<br/>CHAMPIONS</span></div><p className="eyebrow">THE FINAL</p><h1>TAKE<br/><span>THE SHOT.</span></h1><p className="lead match-rule">6 GOALS · 60 SECONDS · WIN THE CUP</p><div className="actions"><Button onClick={start}>START <span>→</span></Button><Button secondary onClick={()=>setScreen("instructions")}>HOW TO PLAY</Button></div><div className="toggles"><button onClick={()=>setMusic(!music)}>♫ MUSIC <b>{music?"ON":"OFF"}</b></button><button onClick={()=>setSound(!sound)}>◖ SOUND <b>{sound?"ON":"OFF"}</b></button></div></section></div>}
    {screen==="instructions"&&<div className="overlay"><section className="card rules"><p className="eyebrow">MATCH BRIEFING</p><h2>HOW TO PLAY</h2><ol><li><b>PLACE & PULL BACK</b><span>Distance sets shot speed; sideways movement sets aim. The aim marker is the exact landing point.</span></li><li><b>SCORE 6 IN 60 SECONDS</b><span>The first four goals are normal penalties. Slow shots give the goalkeeper more time to adjust.</span></li><li><b>FINAL TWO TARGETS</b><span>Goals 5 and 6 must hit the moving bullseye. The second target moves 10% faster.</span></li></ol><div className="rulebox">Score four normal goals, then hit both moving targets before time runs out.</div><Button onClick={start}>START →</Button><button className="textbtn" onClick={menu}>← BACK TO MAIN MENU</button></section></div>}
    {screen==="paused"&&<div className="overlay"><section className="card compact"><p className="eyebrow">MATCH PAUSED</p><h2>TAKE A BREATH.</h2><Button onClick={()=>setScreen("playing")}>RESUME MATCH</Button><Button secondary onClick={menu}>MAIN MENU</Button></section></div>}
    {(screen==="victory"||screen==="defeat")&&<div className="overlay end">{screen==="victory"&&<div className="confetti" aria-hidden="true">{Array.from({length:56},(_,i)=><i key={i} style={{"--i":i} as React.CSSProperties}/>)}</div>}<section className="card endcard"><div className={screen==="victory"?"trophy":"shield"}>{screen==="victory"?"★":"A"}</div><p className="eyebrow">FULL TIME</p><h2>{screen==="victory"?"SPAIN WINS!":"ARGENTINA WINS"}</h2>{screen==="defeat"&&<p className="needed">You needed {TARGET-stats.goals} more goal{TARGET-stats.goals===1?"":"s"}.</p>}<div className="stats"><div><b>{stats.goals}</b><span>GOALS</span></div><div><b>{stats.shots}</b><span>SHOTS</span></div><div><b>{stats.saves}</b><span>SAVES</span></div><div><b>{acc}%</b><span>ACCURACY</span></div>{screen==="victory"&&<div><b>{Math.ceil(stats.time)}s</b><span>TIME LEFT</span></div>}</div><div className="actions"><Button onClick={start}>{screen==="victory"?"PLAY AGAIN":"TRY AGAIN"} →</Button><Button secondary onClick={menu}>MAIN MENU</Button></div>{screen==="victory"&&navigator.share&&<button className="textbtn" onClick={()=>navigator.share({title:"World Cup Penalty",text:`Spain wins! ${stats.goals} goals from ${stats.shots} shots.`})}>SHARE RESULT</button>}</section></div>}
  </main>
}
