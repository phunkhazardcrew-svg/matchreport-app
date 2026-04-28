import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, Square, Settings as SettingsIcon, FileText, ChevronLeft,
  Upload, Plus, Minus, Trash2, Download, Users, AlertTriangle,
  RotateCcw, Clock, CircleDot, RectangleHorizontal, ArrowLeftRight,
  X, Check, Shirt, Eye, Edit, Save, FileSpreadsheet, Home,
  Volume2, VolumeX, Archive, Music
} from "lucide-react";

import { db, initSoundDefaults, requestPersistentStorage } from './db';
import type { Match, SoundConfig } from './db';
import { Ringtones } from './plugins/ringtones';
import { App as CapApp } from '@capacitor/app';
import { getPresetsForCategory, playPresetById, PRESETS } from './utils/soundPresets';

function fmt(sec:number){const m=Math.floor(Math.abs(sec)/60);const s=Math.abs(sec)%60;return`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}

function playWebTone(freq=3200){playPresetById('goal-fanfare');}

function scheduleHalftimeAlarm(remainingSeconds: number) {
  try {
    const triggerAt = Date.now() + (remainingSeconds * 1000);
    Ringtones.scheduleAlarm({ triggerAt, toneDuration: alarmToneSec, vibDuration: alarmVibSec });
  } catch(_) {}
}
function cancelHalftimeAlarm() {
  try { Ringtones.cancelAlarm(); } catch(_) {}
}

function vibrate(){try{navigator.vibrate?.([300,100,300]);}catch(_){}}

function playEventSound(eventType:string){
  try{
    const defaults:Record<string,string>={goal:'goal-fanfare',eigentor:'eigen-sad',elfmeter:'elf-drum',yellow:'card-short',red:'card-alarm',sub:'sub-bell',halftime:'ht-whistle',fulltime:'ft-triple'};
    const isLoud=eventType==='halftime'||eventType==='fulltime';
    db.soundConfigs.get(eventType).then(cfg=>{
      if(cfg?.uri==='silent')return; // Stumm
      if(cfg?.uri?.startsWith('preset:')){playPresetById(cfg.uri.replace('preset:',''));return;}
      if(cfg?.uri){
        // Native sound — use playLoud for HZ/FT to bypass silent mode
        if(isLoud){try{Ringtones.playLoud({uri:cfg.uri});}catch(_){playPresetById(defaults[eventType]||'ht-whistle');}}
        else{try{Ringtones.play({uri:cfg.uri});}catch(_){playPresetById(defaults[eventType]||'goal-fanfare');}}
        return;
      }
      // Default preset — for HZ/FT try playLoud with system default
      if(isLoud){try{Ringtones.playLoud();}catch(_){}}
      playPresetById(defaults[eventType]||'goal-fanfare');
    }).catch(()=>{playPresetById(defaults[eventType]||'goal-fanfare');});
  }catch(_){playPresetById('goal-fanfare');}
}

function parseCSV(text:string){
  const lines=text.trim().split("\n");if(lines.length<2)return null;
  const hdr=lines[0].split(";"),val=lines[1].split(";");
  const g=(k:string)=>{const i=hdr.indexOf(k);return i>=0?(val[i]||"").trim():"";};
  const hp:any[]=[],ap:any[]=[];
  for(let i=1;i<=7;i++){const n=g(`H-S${i}-Nr`),nm=g(`H-S${i}-Spieler`),h=g(`H-S${i}-Hinweis`);if(n&&nm)hp.push({number:n,name:nm,isGoalkeeper:h.includes("TW"),isCaptain:h.includes("C"),isStarter:true,id:`hs${i}-${Date.now()}`});}
  for(let i=1;i<=6;i++){const n=g(`H-A${i}-Nr`),nm=g(`H-A${i}-Spieler`),h=g(`H-A${i}-Hinweis`);if(n&&nm)hp.push({number:n,name:nm,isGoalkeeper:h.includes("TW"),isCaptain:h.includes("C"),isStarter:false,id:`ha${i}-${Date.now()}`});}
  for(let i=1;i<=7;i++){const n=g(`G-S${i}-Nr`),nm=g(`G-S${i}-Spieler`),h=g(`G-S${i}-Hinweis`);if(n&&nm)ap.push({number:n,name:nm,isGoalkeeper:h.includes("TW"),isCaptain:h.includes("C"),isStarter:true,id:`gs${i}-${Date.now()}`});}
  for(let i=1;i<=6;i++){const n=g(`G-A${i}-Nr`),nm=g(`G-A${i}-Spieler`),h=g(`G-A${i}-Hinweis`);if(n&&nm)ap.push({number:n,name:nm,isGoalkeeper:h.includes("TW"),isCaptain:h.includes("C"),isStarter:false,id:`ga${i}-${Date.now()}`});}
  if(!hp.length&&!ap.length)return null;
  return{homeTeam:g("Heimmannschaft"),awayTeam:g("Gastmannschaft"),homePlayers:hp,awayPlayers:ap};
}

const DEMO_H=[
  {id:"dh1",number:"1",name:"Schmidt, Lukas",isGoalkeeper:true,isCaptain:false,isStarter:true},
  {id:"dh2",number:"3",name:"Wagner, Tim",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"dh3",number:"5",name:"Fischer, Jonas",isGoalkeeper:false,isCaptain:true,isStarter:true},
  {id:"dh4",number:"7",name:"Weber, Elias",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"dh5",number:"8",name:"Becker, Leon",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"dh6",number:"9",name:"Hoffmann, Paul",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"dh7",number:"11",name:"Schulz, Finn",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"dh8",number:"14",name:"Meyer, Noah",isGoalkeeper:false,isCaptain:false,isStarter:false},
  {id:"dh9",number:"16",name:"Koch, Ben",isGoalkeeper:false,isCaptain:false,isStarter:false},
];
const DEMO_A=[
  {id:"da1",number:"1",name:"Klein, Max",isGoalkeeper:true,isCaptain:false,isStarter:true},
  {id:"da2",number:"2",name:"Wolf, Luca",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"da3",number:"4",name:"Schäfer, Jan",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"da4",number:"6",name:"Neumann, Erik",isGoalkeeper:false,isCaptain:true,isStarter:true},
  {id:"da5",number:"8",name:"Schwarz, Tom",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"da6",number:"10",name:"Zimmermann, Luis",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"da7",number:"12",name:"Krüger, Nico",isGoalkeeper:false,isCaptain:false,isStarter:true},
  {id:"da8",number:"13",name:"Braun, Felix",isGoalkeeper:false,isCaptain:false,isStarter:false},
  {id:"da9",number:"15",name:"Hartmann, Mika",isGoalkeeper:false,isCaptain:false,isStarter:false},
];

const C={bg:"#0a0f1a",card:"#111827",card2:"#1a2236",bdr:"#1e293b",tx:"#e2e8f0",txd:"#64748b",grn:"#10b981",grnD:"#065f46",yel:"#eab308",red:"#ef4444",blu:"#3b82f6",org:"#f97316"};

function Btn({children,onClick,color=C.grn,disabled,full,small}:any){return(<button onClick={onClick} disabled={disabled} style={{background:disabled?"#334155":color,color:disabled?"#64748b":"#fff",border:"none",borderRadius:10,padding:small?"6px 12px":"12px 18px",fontSize:small?12:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:full?"100%":"auto",opacity:disabled?0.5:1,fontFamily:"'JetBrains Mono',monospace"}}>{children}</button>);}

function Modal({title,onClose,children}:any){return(<div onClick={onClose} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div onClick={(e:any)=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto",border:`1px solid ${C.bdr}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{color:C.tx,margin:0,fontSize:18,fontWeight:700}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:C.txd,cursor:"pointer"}}><X size={20}/></button></div>{children}</div></div>);}

function PBtn({p,onClick}:any){return(<button onClick={()=>onClick(p)} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:C.tx,textAlign:"left",width:"100%",marginBottom:4}}><span style={{background:C.grn,color:"#fff",borderRadius:6,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,fontFamily:"'JetBrains Mono',monospace"}}>{p.number}</span><span style={{fontSize:14,fontWeight:500}}>{p.name}{p.isGoalkeeper&&<span style={{color:C.yel,marginLeft:6,fontSize:11}}>TW</span>}{p.isCaptain&&<span style={{color:C.blu,marginLeft:6,fontSize:11}}>C</span>}</span></button>);}

function NavBar({title,onBack}:any){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingTop:4}}>{onBack?<button onClick={onBack} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:10,color:C.txd,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13,padding:"8px 14px"}}><ChevronLeft size={18}/> Zurück</button>:<div/>}{title&&<span style={{fontSize:14,fontWeight:700,color:C.grn}}>{title}</span>}<div style={{width:40}}/></div>);}

function BottomBar({onHome,screen}:any){if(screen==="home"||screen==="game")return null;return(<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,background:C.card,borderTop:`2px solid ${C.grn}40`,padding:"10px 16px calc(12px + env(safe-area-inset-bottom, 0px))",display:"flex",justifyContent:"center"}}><button onClick={onHome} style={{background:C.grn,border:"none",borderRadius:12,padding:"12px 36px",cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",boxShadow:"0 -2px 16px rgba(16,185,129,0.25)"}}><Home size={20}/> Hauptmenü</button></div>);}

export default function MatchReport(){
  const [screen,setScreen]=useState("home");
  const [hd,setHd]=useState(20);
  const [pc,setPc]=useState(7);
  const [ht,setHt]=useState("");
  const [at,setAt]=useState("");
  const [hp,setHp]=useState<any[]>([]);
  const [ap,setAp]=useState<any[]>([]);
  const [addNum,setAddNum]=useState("");
  const [addName,setAddName]=useState("");
  const [addTeam,setAddTeam]=useState("home");
  const [addSt,setAddSt]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [showPaste,setShowPaste]=useState(false);
  const [pasteText,setPasteText]=useState("");
  const [msg,setMsg]=useState("");
  const csvRef=useRef<HTMLInputElement>(null);
  const [half,setHalf]=useState(1);
  const [tl,setTl]=useState<number|null>(null);
  const [run,setRun]=useState(false);
  const [pau,setPau]=useState(false);
  const [isOt,setIsOt]=useState(false);
  const [otS,setOtS]=useState(0);
  const [hS,setHS]=useState(0);
  const [aS,setAS]=useState(0);
  const [htH,setHtH]=useState<number|null>(null);
  const [htA,setHtA]=useState<number|null>(null);
  const [evts,setEvts]=useState<any[]>([]);
  const [whistled,setWhistled]=useState(false);
  const [started,setStarted]=useState(false);
  const [hOn,setHOn]=useState<string[]>([]);
  const [aOn,setAOn]=useState<string[]>([]);
  const [notes,setNotes]=useState("");
  const [exporting,setExporting]=useState("");
  const [modal,setModal]=useState<string|null>(null);
  const [mT,setMT]=useState<string|null>(null);
  const [mS,setMS]=useState(0);
  const [mD,setMD]=useState<any>({});
  const [soundCfgs,setSoundCfgs]=useState<SoundConfig[]>([]);
  const [archivedMatches,setArchivedMatches]=useState<Match[]>([]);
  const [viewMatch,setViewMatch]=useState<Match|null>(null);
  const [expandCat,setExpandCat]=useState<string|null>(null);
  const [addMin,setAddMin]=useState("");
  const [addHalf2,setAddHalf2]=useState(1);
  const [alarmToneSec,setAlarmToneSec]=useState(5);
  const [alarmVibSec,setAlarmVibSec]=useState(10);
  const [editEvt,setEditEvt]=useState<any>(null);
  const [alarmTone,setAlarmTone]=useState(()=>parseInt(localStorage.getItem("alarmTone")||"10"));
  const [alarmVib,setAlarmVib]=useState(()=>parseInt(localStorage.getItem("alarmVib")||"60"));
  const [scoreFlash,setScoreFlash]=useState("");
  const [confirmAction,setConfirmAction]=useState<{title:string,text:string,onOk:()=>void}|null>(null);
  const tmr=useRef<any>(null);
  const runStartRef=useRef<number>(0);
  const pausedElapsedRef=useRef<number>(0);
  const inp:any={width:"100%",boxSizing:"border-box",padding:"10px 14px",background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,color:C.tx,fontSize:15,outline:"none"};

  // Init DB on mount
  useEffect(()=>{
    initSoundDefaults().then(()=>db.soundConfigs.toArray().then(setSoundCfgs));
    requestPersistentStorage();
    loadArchive();
  },[]);

  // Fix 3: Android back button → navigate back instead of closing app
  const screenHistory=useRef<string[]>(['home']);
  const origSetScreen=setScreen;
  const navTo=(s:string)=>{screenHistory.current.push(s);origSetScreen(s);};
  // Override setScreen to track history
  useEffect(()=>{
    const handler=CapApp.addListener('backButton',({canGoBack})=>{
      const hist=screenHistory.current;
      if(hist.length>1){hist.pop();origSetScreen(hist[hist.length-1]);}
      else{CapApp.exitApp();}
    });
    return()=>{handler.then(h=>h.remove());};
  },[]);


  // Save alarm config
  useEffect(()=>{try{localStorage.setItem('matchreport_alarm_cfg',JSON.stringify({tone:alarmToneSec,vib:alarmVibSec}));}catch(_){}},[alarmToneSec,alarmVibSec]);

  // === STATE PERSISTENCE: Survive app kill ===
  useEffect(()=>{localStorage.setItem("alarmTone",String(alarmTone));localStorage.setItem("alarmVib",String(alarmVib));},[alarmTone,alarmVib]);

  const SAVE_KEY = 'matchreport_game_state';

  function saveGameState() {
    if (!started) return;
    const state = {
      screen, hd, pc, ht, at, hp, ap, half, tl, run, pau, isOt, otS,
      hS, aS, htH, htA, evts, whistled, started, hOn, aOn, notes,
      pausedElapsed: pausedElapsedRef.current,
      runStart: runStartRef.current,
      savedAt: Date.now(), alarmToneSec, alarmVibSec
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(_) {}
  }

  function restoreGameState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s.started) return false;
      // Only restore if saved less than 6 hours ago
      if (Date.now() - s.savedAt > 6 * 60 * 60 * 1000) { localStorage.removeItem(SAVE_KEY); return false; }
      setHd(s.hd); setPc(s.pc); setHt(s.ht); setAt(s.at);
      setHp(s.hp); setAp(s.ap); setHalf(s.half); setTl(s.tl);
      setPau(true); // Always restore paused
      setIsOt(s.isOt); setOtS(s.otS); setHS(s.hS); setAS(s.aS);
      setHtH(s.htH); setHtA(s.htA); setEvts(s.evts);
      setWhistled(s.whistled); setStarted(s.started);
      setHOn(s.hOn); setAOn(s.aOn); setNotes(s.notes);
      if(s.alarmToneSec!==undefined)setAlarmToneSec(s.alarmToneSec);
      if(s.alarmVibSec!==undefined)setAlarmVibSec(s.alarmVibSec);
      pausedElapsedRef.current = s.pausedElapsed || 0;
      runStartRef.current = 0; // Will be set on resume
      setScreen('game');
      return true;
    } catch(_) { return false; }
  }

  function clearGameState() {
    try { localStorage.removeItem(SAVE_KEY); } catch(_) {}
  }

  // Restore on mount
  useEffect(() => {
    restoreGameState();
    try{const s=localStorage.getItem('matchreport_alarm_cfg');if(s){const c=JSON.parse(s);setAlarmToneSec(c.tone||5);setAlarmVibSec(c.vib||10);}}catch(_){}
  }, []);

  // Auto-save every 2 seconds when game is active
  useEffect(() => {
    if (!started) return;
    const iv = setInterval(saveGameState, 2000);
    // Also save on visibility change (user switches app)
    const onVis = () => { if (document.visibilityState === 'hidden') saveGameState(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [started, screen, hd, pc, ht, at, half, tl, run, pau, isOt, otS, hS, aS, htH, htA, evts, whistled, hOn, aOn, notes]);

  async function loadArchive(){const m=await db.matches.orderBy('createdAt').reverse().toArray();setArchivedMatches(m);}
  async function loadSounds(){const s=await db.soundConfigs.toArray();setSoundCfgs(s);}

  useEffect(()=>{if(started&&hOn.length===0){setHOn(hp.filter(p=>p.isStarter).map(p=>p.id));setAOn(ap.filter(p=>p.isStarter).map(p=>p.id));}},[started]);

  // Timestamp-based timer: survives screen lock
  useEffect(()=>{
    if(run&&!pau){
      if(runStartRef.current===0) runStartRef.current=Date.now();
      tmr.current=setInterval(()=>{
        const elapsed=pausedElapsedRef.current+Math.floor((Date.now()-runStartRef.current)/1000);
        const total=hd*60;
        const remaining=total-elapsed;
        if(!isOt){
          if(remaining<=0){
            setTl(0);setIsOt(true);
            if(!whistled){playEventSound(half===1?'halftime':'fulltime');vibrate();setWhistled(true);}
          } else { setTl(remaining); }
        } else {
          setTl(0);setOtS(elapsed-total);
        }
      },250);
    }
    if(pau&&run){
      // Save elapsed when pausing
      pausedElapsedRef.current+=Math.floor((Date.now()-runStartRef.current)/1000);
      runStartRef.current=0;
    }
    return()=>clearInterval(tmr.current);
  },[run,pau,isOt,whistled,half,hd]);

  const getDispMin=useCallback(()=>{
    const elapsed=hd*60-(tl||0);const m=Math.floor(elapsed/60)+(half===2?hd:0);
    if(isOt)return`${hd*half}+${Math.floor(otS/60)+1}'`;
    return`${m+1}'`;
  },[tl,half,hd,isOt,otS]);

  function flash(m:string){setMsg(m);setTimeout(()=>setMsg(""),3000);}
  function goHome(){screenHistory.current=["home"];setScreen("home");}

  function applyCSV(t:string){const r=parseCSV(t);if(r){if(r.homeTeam)setHt(r.homeTeam);if(r.awayTeam)setAt(r.awayTeam);if(r.homePlayers.length)setHp(r.homePlayers);if(r.awayPlayers.length)setAp(r.awayPlayers);flash("ok");return true;}flash("err");return false;}
  function onFile(e:any){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>applyCSV(ev.target?.result as string);r.readAsText(f);e.target.value="";}
  function loadDemo(){setHt("FC Teststadt");setAt("SV Musterheim");setHp([...DEMO_H]);setAp([...DEMO_A]);flash("ok");}
  function startT(){if(tl===null){setTl(hd*60);pausedElapsedRef.current=0;}runStartRef.current=Date.now();setRun(true);setPau(false);setStarted(true);try{Ringtones.startGame();}catch(_){}scheduleHalftimeAlarm(tl||hd*60);}
  function confirmHT(){setRun(false);setPau(false);setIsOt(false);if(otS>0)setEvts(p=>[...p,{type:"info",half:1,text:`Nachspielzeit: ${fmt(otS)}`,id:`ot1-${Date.now()}`}]);setHtH(hS);setHtA(aS);setOtS(0);setWhistled(false);setHalf(2);setTl(hd*60);pausedElapsedRef.current=0;runStartRef.current=0;cancelHalftimeAlarm();setModal(null);}
  function confirmFT(){setRun(false);setPau(false);if(otS>0)setEvts(p=>[...p,{type:"info",half:2,text:`Nachspielzeit: ${fmt(otS)}`,id:`ot2-${Date.now()}`}]);setModal(null);navTo("review");}

  function openAct(t:string,tm:string){setMT(tm);setMS(0);setMD({});setModal(t);}
  function selGT(t:string){setMD({gt:t});setMS(1);}
  function selGP(p:any){const gt=mD.gt;const own=gt==="Eigentor";if(own){if(mT==="home")setAS(s=>s+1);else setHS(s=>s+1);}else{if(mT==="home")setHS(s=>s+1);else setAS(s=>s+1);}setEvts(x=>[...x,{type:"goal",goalType:gt,half,player:p,team:mT,id:`g-${Date.now()}`,displayTime:getDispMin()}]);playEventSound(gt==='Eigentor'?'eigentor':gt==='Elfmeter'?'elfmeter':'goal');vibrate();setScoreFlash(mT||"");setTimeout(()=>setScoreFlash(""),800);setModal(null);}
  function selCT(t:string){setMD({ct:t});setMS(1);}
  function selCP(p:any){setEvts(x=>[...x,{type:"card",cardType:mD.ct,half,player:p,team:mT,id:`c-${Date.now()}`,displayTime:getDispMin()}]);playEventSound(mD.ct==='Gelb'?'yellow':'red');setModal(null);}
  function selSO(p:any){setMD({out:p});setMS(1);}
  function selSI(p:any){const fn=mT==="home"?setHOn:setAOn;fn(x=>x.filter(id=>id!==mD.out.id).concat(p.id));setEvts(x=>[...x,{type:"sub",half,outPlayer:mD.out,inPlayer:p,team:mT,id:`s-${Date.now()}`,displayTime:getDispMin()}]);playEventSound('sub');setModal(null);}
  function delEv(ev:any){setEvts(x=>x.filter(e=>e.id!==ev.id));if(ev.type==="goal"){const own=ev.goalType==="Eigentor";if(own){if(ev.team==="home")setAS(s=>Math.max(0,s-1));else setHS(s=>Math.max(0,s-1));}else{if(ev.team==="home")setHS(s=>Math.max(0,s-1));else setAS(s=>Math.max(0,s-1));}}}
  function resetAll(){clearGameState();cancelHalftimeAlarm();try{Ringtones.stopGame();}catch(_){}setHalf(1);setTl(null);setRun(false);setPau(false);setIsOt(false);setOtS(0);setHS(0);setAS(0);setHtH(null);setHtA(null);setEvts([]);setWhistled(false);setStarted(false);setHOn([]);setAOn([]);setNotes("");setExporting("");setModal(null);screenHistory.current=["home"];setScreen("home");}

  async function saveMatchToArchive(){clearGameState();try{Ringtones.stopGame();}catch(_){}
    const match:Match={id:crypto.randomUUID(),homeTeam:ht,awayTeam:at,homePlayers:hp,awayPlayers:ap,homeScore:hS,awayScore:aS,htHomeScore:htH,htAwayScore:htA,halfDuration:hd,playerCount:pc,events:evts,notes,status:'finished',createdAt:Date.now(),updatedAt:Date.now()};
    await db.matches.put(match);
    await loadArchive();
  }

  async function deleteArchivedMatch(id:string){await db.matches.delete(id);await loadArchive();}

  const onF=(tm:string)=>(tm==="home"?hp:ap).filter(p=>(tm==="home"?hOn:aOn).includes(p.id));
  const bnch=(tm:string)=>(tm==="home"?hp:ap).filter(p=>!(tm==="home"?hOn:aOn).includes(p.id));
  const allP=(tm:string)=>tm==="home"?hp:ap;


  /* ═══ CONFIRM OVERLAY (renders on top of any screen) ═══ */
  const confirmOverlay = confirmAction ? (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setConfirmAction(null)}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:24,width:"100%",maxWidth:340,border:`1px solid ${C.bdr}`}}>
        <div style={{fontSize:18,fontWeight:700,color:C.tx,marginBottom:8}}>{confirmAction.title}</div>
        <div style={{fontSize:14,color:C.txd,marginBottom:20}}>{confirmAction.text}</div>
        <div style={{display:"flex",gap:10}}>
          <Btn full color={C.txd} onClick={()=>setConfirmAction(null)}>Abbrechen</Btn>
          <Btn full color={C.red} onClick={confirmAction.onOk}>Bestätigen</Btn>
        </div>
      </div>
    </div>
  ) : null;

  /* ═══ HOME ═══ */
  if(screen==="home"){
    const hasActive=started&&!evts.some(e=>e.type==="info"&&e.half===2);
    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      {confirmOverlay}
      <div style={{padding:"24px clamp(12px, 4vw, 20px)",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontSize:36,fontWeight:800,color:C.grn,marginTop:"clamp(20px, 6vh, 50px)",marginBottom:4}}>⚽</div>
        <div style={{fontSize:28,fontWeight:800,color:C.grn,marginBottom:4}}>Matchreport</div>
        <div style={{color:C.txd,fontSize:13,marginBottom:"clamp(20px, 5vh, 40px)"}}>Fußball-Spielbericht</div>

        <div style={{width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:12}}>
          {hasActive&&<Btn full color={C.org} onClick={()=>navTo("game")}><Play size={18}/> Laufendes Spiel fortsetzen</Btn>}
          {hasActive&&<Btn full color={C.red} onClick={()=>setConfirmAction({title:'Spiel abbrechen?',text:'Alle Spieldaten werden gelöscht und nicht archiviert.',onOk:()=>{resetAll();setConfirmAction(null);}})}><X size={18}/> Laufendes Spiel abbrechen</Btn>}
          <Btn full color={C.grn} onClick={()=>navTo("settings")}><Plus size={18}/> Neues Spiel</Btn>
          <div style={{fontSize:11,color:C.txd,textAlign:"center",marginTop:-8,marginBottom:4}}>Mannschaften aufstellen & Spiel starten</div>
          <Btn full color={C.blu} onClick={()=>{loadArchive();navTo("archive");}}><Archive size={18}/> Spielarchiv ({archivedMatches.length})</Btn>
          <div style={{fontSize:11,color:C.txd,textAlign:"center",marginTop:-8,marginBottom:4}}>Vergangene Spiele ansehen & exportieren</div>
          <Btn full color={C.card2} onClick={()=>{loadSounds();navTo("sounds");}}><Music size={18}/> Sound-Einstellungen</Btn>
          <div style={{marginTop:20}}><Btn full color="#1e293b" onClick={()=>setConfirmAction({title:'App beenden?',text:'Die App wird geschlossen.',onOk:()=>CapApp.exitApp()})}><Square size={16}/> App beenden</Btn></div>
        </div>

        <div style={{marginTop:60,color:C.txd,fontSize:11,textAlign:"center"}}>Version 3.3 • Offline-fähig</div>
      </div>
    </div>);
  }

  /* ═══ SOUNDS ═══ */

  /* ═══ SOUNDS ═══ */
  if(screen==="sounds"){
    const cats:{id:string,label:string,cat:string}[]=[
      {id:"goal",label:"⚽ Tor",cat:"goal"},{id:"eigentor",label:"⚽ Eigentor",cat:"eigentor"},
      {id:"elfmeter",label:"⚽ Elfmeter",cat:"elfmeter"},{id:"yellow",label:"🟨 Gelbe Karte",cat:"yellow"},
      {id:"red",label:"🟥 Rote Karte",cat:"red"},{id:"sub",label:"🔄 Wechsel",cat:"sub"},
      {id:"halftime",label:"⏱ Halbzeit",cat:"halftime"},{id:"fulltime",label:"🏁 Spielende",cat:"fulltime"},
    ];

    async function selectPreset(evId:string,presetId:string){
      const uri=presetId.startsWith('silent')?'silent':`preset:${presetId}`;
      await db.soundConfigs.update(evId,{uri});
      await loadSounds();flash("ok");
    }
    async function tryNative(evId:string){
      try{const r=await Ringtones.pick({type:"notification",title:"Geräte-Sound"});
        if(!r.cancelled&&r.uri){await db.soundConfigs.update(evId,{uri:r.uri});await loadSounds();flash("ok");return;}
      }catch(_){}
      try{const r=await Ringtones.list({type:"all"});
        if(r.ringtones.length>0){setModal("nlist");setMD({evId,list:r.ringtones});return;}
      }catch(_){}
      flash("err");
    }
    async function testCur(evId:string){
      const cfg=soundCfgs.find(s=>s.id===evId);
      if(cfg?.uri?.startsWith('preset:')){playPresetById(cfg.uri.replace('preset:',''));return;}
      if(cfg?.uri){try{await Ringtones.play({uri:cfg.uri});return;}catch(_){}}
      playEventSound(evId);
    }
    async function clearSnd(evId:string){await db.soundConfigs.update(evId,{uri:null});await loadSounds();}

    function getSndName(evId:string):string{
      const cfg=soundCfgs.find(s=>s.id===evId);
      if(!cfg?.uri)return"Standard";
      if(cfg.uri==="silent")return"🔇 Stumm";
      if(cfg.uri.startsWith('preset:')){const p=PRESETS.find(x=>x.id===cfg.uri!.replace('preset:',''));return p?p.name:"Preset";}
      return"Geräte-Sound";
    }

    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"20px clamp(12px, 4vw, 20px) 150px"}}>
        <NavBar title="Sound-Einstellungen" onBack={goHome}/>
        <div style={{fontSize:13,color:C.txd,marginBottom:16}}>Tippe auf ein Ereignis um den Sound zu ändern.</div>

        {cats.map(({id,label,cat})=>{
          const isOpen=expandCat===id;
          const presets=getPresetsForCategory(cat);
          const cfg=soundCfgs.find(s=>s.id===id);
          const hasCust=!!cfg?.uri;

          return(
            <div key={id} style={{background:C.card,borderRadius:12,marginBottom:10,border:`1px solid ${isOpen?C.grn:C.bdr}`,overflow:"hidden"}}>
              <button onClick={()=>setExpandCat(isOpen?null:id)} style={{width:"100%",padding:"14px 16px",background:"none",border:"none",color:C.tx,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:15,fontWeight:600}}>{label}</span>
                <span style={{fontSize:12,color:hasCust?C.grn:C.txd,fontWeight:500}}>{getSndName(id)} ▾</span>
              </button>
              {isOpen&&<div style={{padding:"0 16px 14px"}}>
                <div style={{fontSize:11,color:C.txd,fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Vorauswahl</div>
                <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
                  {presets.map(p=>{
                    const isAct=cfg?.uri===`preset:${p.id}`;
                    return(<div key={p.id} style={{display:"flex",gap:6,alignItems:"center"}}>
                      <button onClick={()=>p.play()} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:6,padding:"6px 10px",color:C.tx,cursor:"pointer",fontSize:12,flexShrink:0}}><Volume2 size={12}/></button>
                      <button onClick={()=>selectPreset(id,p.id)} style={{flex:1,padding:"8px 12px",background:isAct?`${C.grn}30`:C.card2,border:`1px solid ${isAct?C.grn:C.bdr}`,borderRadius:8,color:isAct?C.grn:C.tx,cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:isAct?700:400}}>
                        {p.name}{isAct?" ✓":""}
                      </button>
                    </div>);
                  })}
                </div>
                <div style={{fontSize:11,color:C.txd,fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Eigener Sound</div>
                <div style={{display:"flex",gap:6}}>
                  <Btn small color={C.blu} onClick={()=>tryNative(id)}><Music size={14}/> Vom Gerät</Btn>
                  <Btn small color={C.card2} onClick={()=>testCur(id)}><Volume2 size={14}/> Testen</Btn>
                  {hasCust&&<Btn small color={C.red} onClick={()=>clearSnd(id)}><VolumeX size={14}/></Btn>}
                </div>
              </div>}
            </div>
          );
        })}

        {msg==="ok"&&<div style={{padding:10,background:`${C.grn}20`,borderRadius:10,fontSize:13,color:C.grn,textAlign:"center",marginTop:8}}>✅ Sound gespeichert!</div>}
        {msg==="err"&&<div style={{padding:10,background:`${C.red}20`,borderRadius:10,fontSize:13,color:C.red,textAlign:"center",marginTop:8}}>Geräte-Sounds nicht verfügbar.</div>}
      </div>

      {modal==="nlist"&&mD.list&&<Modal title="Geräte-Sound wählen" onClose={()=>setModal(null)}>
        <div style={{maxHeight:350,overflowY:"auto"}}>{mD.list.map((r:any,i:number)=>(<button key={i} onClick={async()=>{await db.soundConfigs.update(mD.evId,{uri:r.uri});await loadSounds();setModal(null);flash("ok");}} style={{display:"block",width:"100%",padding:"10px",background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,color:C.tx,cursor:"pointer",textAlign:"left",marginBottom:4,fontSize:13}}>{r.title}</button>))}</div>
      </Modal>}

      <BottomBar onHome={goHome} screen={screen}/>
    </div>);
  }

  /* ═══ ARCHIVE ═══ */
  if(screen==="archive"){
    if(viewMatch){
      const m=viewMatch;
      const exportData={homeTeam:m.homeTeam,awayTeam:m.awayTeam,homeScore:m.homeScore,awayScore:m.awayScore,htHomeScore:m.htHomeScore,htAwayScore:m.htAwayScore,homePlayers:m.homePlayers,awayPlayers:m.awayPlayers,events:m.events,notes:m.notes,halfDuration:m.halfDuration};
      async function reExportPdf(){setExporting("pdf");try{const{generatePDF}=await import('./utils/exportPdf');const{sharePDF}=await import('./utils/shareFile');const d=generatePDF(exportData);await sharePDF(d,`Spielbericht_${m.homeTeam}_vs_${m.awayTeam}.pdf`);flash("pdf_ok");}catch(_){flash("pdf_err");}setExporting("");}
      async function reExportXls(){setExporting("xls");try{const{generateXLS}=await import('./utils/exportXls');const{shareXLS}=await import('./utils/shareFile');const d=generateXLS(exportData);await shareXLS(d,`Spielbericht_${m.homeTeam}_vs_${m.awayTeam}.xlsx`);flash("xls_ok");}catch(_){flash("xls_err");}setExporting("");}

      const hz1=m.events.filter(e=>e.half===1&&e.type!=="info"),hz2=m.events.filter(e=>e.half===2&&e.type!=="info");
      return(
      <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
        <div style={{padding:"20px clamp(12px, 4vw, 20px) 150px"}}>
          <NavBar title="Archiv" onBack={()=>setViewMatch(null)}/>
          <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${C.bdr}`,textAlign:"center"}}>
            <div style={{fontSize:12,color:C.txd,marginBottom:8}}>{new Date(m.createdAt).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>
            <div style={{fontSize:20,fontWeight:800}}>{m.homeTeam} {m.homeScore} : {m.awayScore} {m.awayTeam}</div>
            {m.htHomeScore!==null&&<div style={{fontSize:13,color:C.txd}}>HZ: {m.htHomeScore} : {m.htAwayScore}</div>}
          </div>

          <div style={{background:C.card,borderRadius:14,padding:14,marginBottom:16,border:`1px solid ${C.bdr}`}}>
            <div style={{fontSize:13,fontWeight:700,color:C.txd,marginBottom:8}}>Spielverlauf</div>
            {[...hz1,...hz2].map(ev=>(<div key={ev.id} style={{fontSize:12,padding:"3px 0",display:"flex",gap:6}}>
              <span style={{color:ev.half===1?C.grn:C.blu,fontWeight:700,minWidth:36,fontFamily:"'JetBrains Mono',monospace"}}>{ev.displayTime}</span>
              <span>{ev.type==="goal"?`⚽ ${ev.goalType!=='Tor'?'('+ev.goalType+') ':''}${ev.player?.number} ${ev.player?.name}`:ev.type==="card"?`${ev.cardType==='Gelb'?'🟨':'🟥'} ${ev.player?.number} ${ev.player?.name}`:ev.type==="sub"?`🔄 ${ev.outPlayer?.number}→${ev.inPlayer?.number} ${ev.inPlayer?.name}`:''} <span style={{color:C.txd}}>— {ev.team==="home"?m.homeTeam:m.awayTeam}</span></span>
            </div>))}
            {hz1.length===0&&hz2.length===0&&<div style={{color:C.txd,fontSize:12}}>Keine Aktionen</div>}
          </div>

          {m.notes&&<div style={{background:C.card,borderRadius:14,padding:14,marginBottom:16,border:`1px solid ${C.bdr}`}}>
            <div style={{fontSize:13,fontWeight:700,color:C.txd,marginBottom:4}}>Bemerkungen</div>
            <div style={{fontSize:12,whiteSpace:"pre-wrap"}}>{m.notes}</div>
          </div>}

          <div style={{display:"flex",gap:10,marginBottom:10}}>
            <Btn full color={C.red} disabled={exporting==="pdf"} onClick={reExportPdf}><Download size={15}/> PDF</Btn>
            <Btn full color={C.grn} disabled={exporting==="xls"} onClick={reExportXls}><FileSpreadsheet size={15}/> Excel</Btn>
          </div>
          {(msg==="pdf_ok"||msg==="xls_ok")&&<div style={{padding:8,background:`${C.grn}20`,borderRadius:8,fontSize:12,color:C.grn,textAlign:"center"}}>✅ Export erstellt!</div>}
        </div>
      </div>);
    }

    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      {confirmOverlay}
      <div style={{padding:"20px clamp(12px, 4vw, 20px) 150px"}}>
        <NavBar title="Spielarchiv"/>
        {archivedMatches.length===0?<div style={{textAlign:"center",color:C.txd,padding:40}}>Noch keine archivierten Spiele</div>:
          archivedMatches.map(m=>{
            const isWin=m.homeScore>m.awayScore;const isDraw=m.homeScore===m.awayScore;const isLoss=m.homeScore<m.awayScore;
            const resultColor=isWin?C.grn:isDraw?C.yel:C.red;
            const goals=m.events.filter(e=>e.type==='goal').length;
            const cards=m.events.filter(e=>e.type==='card').length;
            const subs=m.events.filter(e=>e.type==='sub').length;
            return(<div key={m.id} style={{background:C.card,borderRadius:14,marginBottom:12,border:`1px solid ${C.bdr}`,overflow:"hidden"}}>
              <button onClick={()=>setViewMatch(m)} style={{background:"none",border:"none",color:C.tx,cursor:"pointer",textAlign:"left",width:"100%",padding:0}}>
                {/* Date bar */}
                <div style={{background:C.card2,padding:"6px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:C.txd,fontWeight:600}}>{new Date(m.createdAt).toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}</span>
                  <span style={{fontSize:10,color:C.txd}}>{m.halfDuration*2} min</span>
                </div>
                {/* Score */}
                <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1,textAlign:"right"}}><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{m.homeTeam}</div></div>
                  <div style={{background:`${resultColor}20`,borderRadius:10,padding:"6px 14px",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:24,fontWeight:900,fontFamily:"'JetBrains Mono',monospace",color:resultColor}}>{m.homeScore}</span>
                    <span style={{color:C.txd,fontSize:14}}>:</span>
                    <span style={{fontSize:24,fontWeight:900,fontFamily:"'JetBrains Mono',monospace",color:resultColor}}>{m.awayScore}</span>
                  </div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{m.awayTeam}</div></div>
                </div>
                {/* Stats bar */}
                <div style={{padding:"0 14px 10px",display:"flex",gap:12,fontSize:11,color:C.txd}}>
                  {goals>0&&<span>⚽ {goals} Tore</span>}
                  {cards>0&&<span>🟨 {cards} Karten</span>}
                  {subs>0&&<span>🔄 {subs} Wechsel</span>}
                  {m.htHomeScore!==null&&<span>HZ: {m.htHomeScore}:{m.htAwayScore}</span>}
                </div>
              </button>
              <div style={{borderTop:`1px solid ${C.bdr}`,padding:"8px 14px",display:"flex",justifyContent:"flex-end"}}>
                <button onClick={(e)=>{e.stopPropagation();setConfirmAction({title:'Spiel löschen?',text:'Das archivierte Spiel wird unwiderruflich gelöscht.',onOk:()=>{deleteArchivedMatch(m.id);setConfirmAction(null);}});}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",padding:4,opacity:0.5,fontSize:11,display:"flex",alignItems:"center",gap:4}}><Trash2 size={13}/> Löschen</button>
              </div>
            </div>);
          })
        }
      <BottomBar onHome={goHome} screen={screen}/>
      </div>
    </div>);
  }

  /* ═══ SETTINGS ═══ */
  if(screen==="settings"){return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"20px clamp(12px, 4vw, 20px) 150px"}}>
        <NavBar title="Spieleinstellungen"/>

        <div style={{background:C.card,borderRadius:14,padding:18,marginBottom:14,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.txd,textTransform:"uppercase",marginBottom:14}}><Clock size={14} style={{verticalAlign:"middle",marginRight:6}}/>Spielparameter</div>
          {[{l:"Halbzeitdauer",v:`${hd} min`,d:()=>setHd(x=>Math.max(5,x-5)),i:()=>setHd(x=>Math.min(45,x+5))},          {l:"Signalton (Sek.)",v:`${alarmToneSec}s`,d:()=>setAlarmToneSec(x=>Math.max(0,x-5)),i:()=>setAlarmToneSec(x=>Math.min(120,x+5))},
            {l:"Vibration (Sek.)",v:`${alarmVibSec}s`,d:()=>setAlarmVibSec(x=>Math.max(0,x-5)),i:()=>setAlarmVibSec(x=>Math.min(120,x+5))},
            {l:"Spieler (inkl. TW)",v:pc,d:()=>setPc(x=>Math.max(3,x-1)),i:()=>setPc(x=>Math.min(11,x+1))}].map(({l,v,d,i})=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:14}}>{l}</span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button onClick={d} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,width:36,height:36,color:C.tx,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Minus size={16}/></button>
                <span style={{fontSize:20,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",minWidth:50,textAlign:"center"}}>{v}</span>
                <button onClick={i} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,width:36,height:36,color:C.tx,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Plus size={16}/></button>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:C.card,borderRadius:14,padding:18,marginBottom:14,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.txd,textTransform:"uppercase",marginBottom:14}}><Shirt size={14} style={{verticalAlign:"middle",marginRight:6}}/>Mannschaften</div>
          <div style={{marginBottom:12}}><label style={{fontSize:12,color:C.txd,display:"block",marginBottom:4}}>Heimmannschaft</label><input value={ht} onChange={(e:any)=>setHt(e.target.value)} placeholder="z.B. JSG Prümer Land" style={inp}/></div>
          <div><label style={{fontSize:12,color:C.txd,display:"block",marginBottom:4}}>Gastmannschaft</label><input value={at} onChange={(e:any)=>setAt(e.target.value)} placeholder="z.B. JSG Pronsfeld" style={inp}/></div>
        </div>

        <div style={{background:C.card,borderRadius:14,padding:18,marginBottom:14,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.txd,textTransform:"uppercase",marginBottom:10}}><Upload size={14} style={{verticalAlign:"middle",marginRight:6}}/>Datenimport</div>
          <p style={{fontSize:12,color:C.txd,margin:"0 0 12px"}}>DFB/FVR CSV (Semikolon-getrennt)</p>
          <input ref={csvRef} type="file" accept=".csv,.txt" onChange={onFile} style={{display:"none"}}/>
          <div style={{display:"flex",gap:8}}>
            <Btn full color={C.blu} onClick={()=>csvRef.current?.click()}><Upload size={15}/> Datei</Btn>
            <Btn full color={C.card2} onClick={()=>setShowPaste(true)}><FileText size={15}/> Einfügen</Btn>
          </div>
          <button onClick={loadDemo} style={{marginTop:8,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 16px",background:C.grnD,borderRadius:10,cursor:"pointer",color:C.grn,fontWeight:600,fontSize:13,border:`1px solid ${C.grn}40`}}><Users size={15}/> Demo-Daten laden</button>
          {msg==="ok"&&<div style={{marginTop:10,padding:"8px 12px",background:`${C.grn}20`,borderRadius:8,fontSize:13,color:C.grn,textAlign:"center"}}><Check size={14} style={{verticalAlign:"middle"}}/> Import erfolgreich!</div>}
          {msg==="err"&&<div style={{marginTop:10,padding:"8px 12px",background:`${C.red}20`,borderRadius:8,fontSize:13,color:C.red,textAlign:"center"}}><AlertTriangle size={14} style={{verticalAlign:"middle"}}/> CSV nicht lesbar</div>}
        </div>

        {[{k:"home",l:ht||"Heim",pl:hp},{k:"away",l:at||"Gast",pl:ap}].map(({k,l,pl})=>(
          <div key={k} style={{background:C.card,borderRadius:14,padding:18,marginBottom:14,border:`1px solid ${C.bdr}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:C.txd,textTransform:"uppercase"}}><Users size={14} style={{verticalAlign:"middle",marginRight:6}}/>{l} ({pl.length})</div>
              <button onClick={()=>{setShowAdd(true);setAddTeam(k);}} style={{background:C.grn,border:"none",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff"}}><Plus size={16}/></button>
            </div>
            {["Startaufstellung","Ersatzbank"].map(cat=>{const isSt=cat==="Startaufstellung";const f=pl.filter((p:any)=>p.isStarter===isSt);if(!f.length)return null;return(
              <div key={cat} style={{marginBottom:8}}>
                <div style={{fontSize:11,color:isSt?C.grn:C.org,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>{cat}</div>
                {f.map((p:any)=>(
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:C.card2,borderRadius:8,marginBottom:3}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:isSt?C.grn:C.org,fontSize:14,minWidth:24,textAlign:"center"}}>{p.number}</span>
                      <span style={{fontSize:13}}>{p.name}</span>
                      <div style={{display:"flex",gap:3,marginLeft:"auto",marginRight:8}}>
                        <button onClick={(e)=>{e.stopPropagation();if(k==="home")setHp(x=>x.map(q=>q.id===p.id?{...q,isGoalkeeper:!q.isGoalkeeper}:q));else setAp(x=>x.map(q=>q.id===p.id?{...q,isGoalkeeper:!q.isGoalkeeper}:q));}} style={{background:p.isGoalkeeper?C.yel:`${C.yel}20`,border:"none",borderRadius:4,padding:"2px 6px",color:p.isGoalkeeper?"#000":C.txd,cursor:"pointer",fontSize:10,fontWeight:700}}>TW</button>
                        <button onClick={(e)=>{e.stopPropagation();if(k==="home")setHp(x=>x.map(q=>q.id===p.id?{...q,isCaptain:!q.isCaptain}:q));else setAp(x=>x.map(q=>q.id===p.id?{...q,isCaptain:!q.isCaptain}:q));}} style={{background:p.isCaptain?C.blu:`${C.blu}20`,border:"none",borderRadius:4,padding:"2px 6px",color:p.isCaptain?"#fff":C.txd,cursor:"pointer",fontSize:10,fontWeight:700}}>C</button>
                      </div>
                    </div>
                    <button onClick={()=>{if(k==="home")setHp(x=>x.filter(q=>q.id!==p.id));else setAp(x=>x.filter(q=>q.id!==p.id));}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",padding:4}}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            );})}
            {!pl.length&&<div style={{textAlign:"center",color:C.txd,fontSize:13,padding:16}}>Keine Spieler</div>}
          </div>
        ))}

        <Btn full color={C.grn} onClick={()=>{if(!ht||!at){alert("Bitte Mannschaftsnamen eingeben!");return;}if(hp.length===0&&ap.length===0){alert("Bitte mindestens eine Mannschaft aufstellen!");}navTo("game");}}><Play size={18}/> Zum Spielfeld</Btn>
        {hp.filter(p=>p.isStarter).length>0&&<div style={{fontSize:11,color:hp.filter(p=>p.isStarter).length>=pc?C.grn:C.org,textAlign:"center",marginTop:8}}>{ht||"Heim"}: {hp.filter(p=>p.isStarter).length}/{pc} Starter{hp.filter(p=>p.isStarter).length<pc?" ⚠️":""} • {at||"Gast"}: {ap.filter(p=>p.isStarter).length}/{pc} Starter{ap.filter(p=>p.isStarter).length<pc?" ⚠️":""}</div>}
      </div>

      <BottomBar onHome={goHome} screen={screen}/>
      {showAdd&&<Modal title="Spieler hinzufügen" onClose={()=>setShowAdd(false)}>
        <div style={{display:"flex",gap:8,marginBottom:12}}>{[{k:"home",l:ht||"Heim"},{k:"away",l:at||"Gast"}].map(({k,l})=>(<button key={k} onClick={()=>setAddTeam(k)} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",background:addTeam===k?C.grn:C.card2,color:"#fff",border:`1px solid ${addTeam===k?C.grn:C.bdr}`,fontWeight:600,fontSize:13}}>{l}</button>))}</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}><input value={addNum} onChange={(e:any)=>setAddNum(e.target.value)} placeholder="Nr." type="number" style={{...inp,width:70,textAlign:"center"}}/><input value={addName} onChange={(e:any)=>setAddName(e.target.value)} placeholder="Nachname, Vorname" style={{...inp,flex:1}}/></div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>{[{s:true,l:"Starter",c:C.grn},{s:false,l:"Ersatz",c:C.org}].map(({s,l,c})=>(<button key={l} onClick={()=>setAddSt(s)} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",background:addSt===s?c:C.card2,color:"#fff",border:`1px solid ${addSt===s?c:C.bdr}`,fontWeight:600,fontSize:13}}>{l}</button>))}</div>
        <Btn full disabled={!addNum||!addName} onClick={()=>{const p={number:addNum,name:addName,isGoalkeeper:false,isCaptain:false,isStarter:addSt,id:`${addTeam}-${addNum}-${Date.now()}`};if(addTeam==="home")setHp(x=>[...x,p]);else setAp(x=>[...x,p]);setAddNum("");setAddName("");}}><Plus size={16}/> Hinzufügen</Btn>
      </Modal>}

      {showPaste&&<Modal title="CSV einfügen" onClose={()=>{setShowPaste(false);setPasteText("");}}>
        <p style={{fontSize:12,color:C.txd,margin:"0 0 12px"}}>CSV-Inhalt hier einfügen:</p>
        <textarea value={pasteText} onChange={(e:any)=>setPasteText(e.target.value)} placeholder="Semikolon-getrennte Daten..." style={{...inp,minHeight:120,resize:"vertical",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}/>
        <div style={{marginTop:12}}><Btn full disabled={!pasteText.trim()} onClick={()=>{if(applyCSV(pasteText)){setShowPaste(false);setPasteText("");}}}><Check size={16}/> Importieren</Btn></div>
      </Modal>}
    </div>
  );}

  /* ═══ GAME ═══ */
  if(screen==="game"){return(
    <div style={{background:C.bg,height:"100dvh",minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:"0 0 auto",padding:"12px 16px",textAlign:"center",background:`linear-gradient(180deg,${C.card} 0%,${C.bg} 100%)`,borderBottom:`1px solid ${C.bdr}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <button onClick={()=>navTo("settings")} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}><SettingsIcon size={15}/> Einstellungen</button>
          <div style={{fontSize:12,fontWeight:700,color:half===1?C.grn:C.blu,background:half===1?`${C.grn}20`:`${C.blu}20`,padding:"4px 12px",borderRadius:20}}>{half}. Halbzeit</div>
          <button onClick={goHome} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Home size={15}/></button>
        </div>
        <div style={{fontSize:isOt?28:48,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",color:isOt?C.red:C.tx,padding:"8px 0"}}>{isOt?`${fmt(0)} +${fmt(otS)}`:fmt(tl??hd*60)}</div>
        <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:4}}>
          {!run&&!pau&&<Btn color={C.grn} onClick={startT}><Play size={18}/> Start</Btn>}
          {run&&!pau&&<div style={{display:"flex",gap:12}}><Btn color={C.yel} onClick={()=>{setPau(true);cancelHalftimeAlarm();}}><Pause size={18}/> Pause</Btn><Btn color={C.red} onClick={()=>setModal(half===1?"ht":"ft")}><Square size={18}/> Stopp</Btn></div>}
          {pau&&<div style={{display:"flex",gap:12}}><Btn color={C.grn} onClick={()=>{runStartRef.current=Date.now();setPau(false);const remaining=tl||0;if(remaining>0)scheduleHalftimeAlarm(remaining);}}><Play size={18}/> Weiter</Btn><Btn color={C.red} onClick={()=>setModal(half===1?"ht":"ft")}><Square size={18}/> Stopp</Btn></div>}
        </div>
      </div>

      <div style={{flex:"0 0 auto",padding:16,display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
        <div style={{flex:1,textAlign:"center",transition:"all 0.3s",transform:scoreFlash==="home"?"scale(1.15)":"scale(1)"}}><div style={{fontSize:12,fontWeight:700,color:C.txd,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ht}</div><div style={{fontSize:48,fontWeight:900,fontFamily:"'JetBrains Mono',monospace",color:scoreFlash==="home"?C.grn:C.tx,transition:"color 0.3s"}}>{hS}</div>{htH!==null&&<div style={{fontSize:14,color:C.txd,fontFamily:"'JetBrains Mono',monospace"}}>({htH})</div>}</div>
        <div style={{fontSize:28,color:C.txd,fontWeight:300}}>:</div>
        <div style={{flex:1,textAlign:"center",transition:"all 0.3s",transform:scoreFlash==="away"?"scale(1.15)":"scale(1)"}}><div style={{fontSize:12,fontWeight:700,color:C.txd,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{at}</div><div style={{fontSize:48,fontWeight:900,fontFamily:"'JetBrains Mono',monospace",color:scoreFlash==="away"?C.grn:C.tx,transition:"color 0.3s"}}>{aS}</div>{htA!==null&&<div style={{fontSize:14,color:C.txd,fontFamily:"'JetBrains Mono',monospace"}}>({htA})</div>}</div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"0 16px 16px",display:"flex",flexDirection:"column"}}>
        {/* Timer hint */}
        {!run&&!pau&&started&&<div style={{textAlign:"center",padding:"8px 12px",marginBottom:8,background:`${C.yel}15`,borderRadius:10,fontSize:12,color:C.yel}}>⏸ Timer pausiert — starte den Timer um Aktionen zu erfassen</div>}
        {!started&&<div style={{textAlign:"center",padding:"8px 12px",marginBottom:8,background:`${C.grn}15`,borderRadius:10,fontSize:12,color:C.grn}}>▶ Starte den Timer um das Spiel zu beginnen</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,flex:1}}>
          {[{k:"home",l:ht},{k:"away",l:at}].map(({k,l})=>(
            <div key={k} style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:11,fontWeight:700,color:C.txd,textAlign:"center",textTransform:"uppercase"}}>{l}</div>
              <Btn full color={C.grn} onClick={()=>openAct("goal",k)} disabled={!run}><CircleDot size={16}/> Tor</Btn>
              <Btn full color={C.yel} onClick={()=>openAct("card",k)} disabled={!run}><RectangleHorizontal size={16}/> Karte</Btn>
              <Btn full color={C.blu} onClick={()=>openAct("sub",k)} disabled={!run}><ArrowLeftRight size={16}/> Wechsel</Btn>
            </div>
          ))}
        </div>

        {/* Undo last action */}
        {evts.filter(e=>e.type!=="info").length>0&&<div style={{marginTop:8}}><Btn full color="#334155" small onClick={()=>{const last=evts.filter(e=>e.type!=="info").pop();if(last)delEv(last);}}><RotateCcw size={14}/> Letzte Aktion rückgängig</Btn></div>}
        {evts.filter(e=>e.type!=="info").length>0&&<div style={{marginTop:12,background:C.card,borderRadius:12,padding:12,border:`1px solid ${C.bdr}`,maxHeight:120,overflowY:"auto"}}>
          <div style={{fontSize:11,color:C.txd,fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>Letzte Aktionen</div>
          {[...evts].filter(e=>e.type!=="info").reverse().slice(0,5).map(ev=>(<div key={ev.id} style={{fontSize:12,padding:"3px 0",display:"flex",gap:8,alignItems:"center"}}><span style={{color:C.txd,fontFamily:"'JetBrains Mono',monospace",fontSize:11,minWidth:36}}>{ev.displayTime}</span><span>{ev.type==="goal"&&<span>⚽ {ev.goalType!=="Tor"&&`(${ev.goalType}) `}{ev.player.number} {ev.player.name}</span>}{ev.type==="card"&&<span>{ev.cardType==="Gelb"?"🟨":ev.cardType==="Rot"?"🟥":"⏱️"} {ev.player.number} {ev.player.name}</span>}{ev.type==="sub"&&<span>🔄 {ev.outPlayer.number}↔{ev.inPlayer.number}</span>}<span style={{color:C.txd}}> — {ev.team==="home"?ht:at}</span></span></div>))}
        </div>}
      </div>

      {modal==="goal"&&<Modal title={`Tor — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:8}}><Btn full color={C.grn} onClick={()=>selGT("Tor")}>⚽ Tor</Btn><Btn full color={C.yel} onClick={()=>selGT("Elfmeter")}>⚽ Elfmeter</Btn><Btn full color={C.red} onClick={()=>selGT("Eigentor")}>⚽ Eigentor</Btn></div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Torschütze ({mD.gt})</div>{allP(mT!).map(p=><PBtn key={p.id} p={p} onClick={selGP}/>)}</div>}</Modal>}
      {modal==="card"&&<Modal title={`Karte — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:8}}><Btn full color={C.yel} onClick={()=>selCT("Gelb")}>🟨 Gelb</Btn><Btn full color={C.red} onClick={()=>selCT("Rot")}>🟥 Rot</Btn><Btn full color={C.org} onClick={()=>selCT("Zeitstrafe")}>⏱️ Zeitstrafe</Btn></div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Spieler ({mD.ct})</div>{allP(mT!).map(p=><PBtn key={p.id} p={p} onClick={selCP}/>)}</div>}</Modal>}
      {modal==="sub"&&<Modal title={`Wechsel — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Auswechslung (raus)</div>{onF(mT!).map(p=><PBtn key={p.id} p={p} onClick={selSO}/>)}</div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Einwechslung für #{mD.out?.number}</div>{bnch(mT!).map(p=><PBtn key={p.id} p={p} onClick={selSI}/>)}</div>}</Modal>}
      {modal==="ht"&&<Modal title="Halbzeit beenden?" onClose={()=>setModal(null)}><p style={{color:C.txd,fontSize:14,margin:"0 0 16px"}}>2. Halbzeit starten?</p><div style={{display:"flex",gap:10}}><Btn full color={C.txd} onClick={()=>setModal(null)}>Abbrechen</Btn><Btn full color={C.grn} onClick={confirmHT}><Check size={16}/> Bestätigen</Btn></div></Modal>}
      {modal==="ft"&&<Modal title="Spiel beenden?" onClose={()=>setModal(null)}><p style={{color:C.txd,fontSize:14,margin:"0 0 16px"}}>Endstand: {hS} : {aS}</p><div style={{display:"flex",gap:10}}><Btn full color={C.txd} onClick={()=>setModal(null)}>Abbrechen</Btn><Btn full color={C.grn} onClick={confirmFT}><Check size={16}/> Spielbericht</Btn></div></Modal>}
    </div>
  );}

  /* ═══ REVIEW ═══ */

  /* ═══ REVIEW — voller Editier-Zugriff ═══ */
  if(screen==="review"){
    const hz1r=evts.filter(e=>e.half===1&&e.type!=="info").sort((a,b)=>parseInt(a.displayTime)-parseInt(b.displayTime)),hz2r=evts.filter(e=>e.half===2&&e.type!=="info").sort((a,b)=>parseInt(a.displayTime)-parseInt(b.displayTime));
    const o1r=evts.find(e=>e.half===1&&e.type==="info"),o2r=evts.find(e=>e.half===2&&e.type==="info");

    function revGoal(team:string,goalType:string,player:any){
      const own=goalType==="Eigentor";
      if(own){if(team==="home")setAS(s=>s+1);else setHS(s=>s+1);}
      else{if(team==="home")setHS(s=>s+1);else setAS(s=>s+1);}
      setEvts(x=>[...x,{type:"goal",goalType,half:addHalf2,player,team,id:`rg-${Date.now()}`,displayTime:`${addMin||"0"}'`}]);
      setModal(null);setAddMin("");
    }
    function revCard(team:string,cardType:string,player:any){
      setEvts(x=>[...x,{type:"card",cardType,half:addHalf2,player,team,id:`rc-${Date.now()}`,displayTime:`${addMin||"0"}'`}]);
      setModal(null);setAddMin("");
    }
    function revSub(team:string,outP:any,inP:any){
      setEvts(x=>[...x,{type:"sub",half:addHalf2,outPlayer:outP,inPlayer:inP,team,id:`rs-${Date.now()}`,displayTime:`${addMin||"0"}'`}]);
      setModal(null);setAddMin("");
    }
    function saveEdit(){
      if(!editEvt)return;
      setEvts(x=>x.map(e=>e.id===editEvt.id?{...editEvt}:e));
      let hs=0,as=0;
      evts.map(e=>e.id===editEvt.id?{...editEvt}:e).filter(e=>e.type==="goal").forEach(e=>{
        if(e.goalType==="Eigentor"){if(e.team==="home")as++;else hs++;}
        else{if(e.team==="home")hs++;else as++;}
      });
      setHS(hs);setAS(as);
      setEditEvt(null);setModal(null);
    }

    const evRow=(ev:any)=>(<div key={ev.id} style={{fontSize:12,padding:"8px 0",display:"flex",gap:5,alignItems:"center",borderBottom:`1px solid ${C.bdr}40`}}>
      <span style={{color:ev.half===1?C.grn:C.blu,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,minWidth:36,fontSize:12}}>{ev.displayTime}</span>
      <span style={{flex:1,fontSize:12}}>{ev.type==="goal"&&<span>⚽{ev.goalType!=="Tor"?`(${ev.goalType})`:""} {ev.player?.number} {ev.player?.name}</span>}{ev.type==="card"&&<span>{ev.cardType==="Gelb"?"🟨":"🟥"} {ev.player?.number} {ev.player?.name}</span>}{ev.type==="sub"&&<span>🔄{ev.outPlayer?.number}→{ev.inPlayer?.number}</span>} <span style={{color:C.txd}}>{ev.team==="home"?ht:at}</span></span>
      <button onClick={()=>{setEditEvt({...ev});setModal("edit");}} style={{background:C.blu,border:"none",color:"#fff",cursor:"pointer",padding:"5px 8px",borderRadius:6,fontSize:11,flexShrink:0}}>✏️</button>
      <button onClick={()=>delEv(ev)} style={{background:C.red,border:"none",color:"#fff",cursor:"pointer",padding:"5px 8px",borderRadius:6,fontSize:11,flexShrink:0}}>✕</button>
    </div>);

    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"20px clamp(12px, 4vw, 20px) 150px"}}>
        <NavBar title="Korrektur & Bearbeitung" onBack={()=>navTo("game")}/>

        {/* Editable Score + Teams */}
        <div style={{background:C.card,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${C.bdr}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <div style={{flex:1,textAlign:"center"}}>
              <input value={ht} onChange={(e:any)=>setHt(e.target.value)} style={{background:"transparent",border:`1px solid ${C.bdr}`,borderRadius:6,color:C.tx,fontSize:12,fontWeight:700,textAlign:"center",width:"100%",padding:"4px",outline:"none"}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:6}}>
                <button onClick={()=>setHS(s=>Math.max(0,s-1))} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:6,width:28,height:28,color:C.tx,cursor:"pointer",fontSize:14}}>-</button>
                <span style={{fontSize:32,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{hS}</span>
                <button onClick={()=>setHS(s=>s+1)} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:6,width:28,height:28,color:C.tx,cursor:"pointer",fontSize:14}}>+</button>
              </div>
            </div>
            <span style={{fontSize:22,color:C.txd}}>:</span>
            <div style={{flex:1,textAlign:"center"}}>
              <input value={at} onChange={(e:any)=>setAt(e.target.value)} style={{background:"transparent",border:`1px solid ${C.bdr}`,borderRadius:6,color:C.tx,fontSize:12,fontWeight:700,textAlign:"center",width:"100%",padding:"4px",outline:"none"}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:6}}>
                <button onClick={()=>setAS(s=>Math.max(0,s-1))} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:6,width:28,height:28,color:C.tx,cursor:"pointer",fontSize:14}}>-</button>
                <span style={{fontSize:32,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{aS}</span>
                <button onClick={()=>setAS(s=>s+1)} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:6,width:28,height:28,color:C.tx,cursor:"pointer",fontSize:14}}>+</button>
              </div>
            </div>
          </div>
          {htH!==null&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:8,fontSize:12,color:C.txd}}>
            HZ: <button onClick={()=>setHtH(s=>Math.max(0,(s??0)-1))} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:4,width:22,height:22,color:C.tx,cursor:"pointer",fontSize:11}}>-</button><span style={{fontWeight:700}}>{htH}</span><button onClick={()=>setHtH(s=>(s??0)+1)} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:4,width:22,height:22,color:C.tx,cursor:"pointer",fontSize:11}}>+</button>
            :<button onClick={()=>setHtA(s=>Math.max(0,(s??0)-1))} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:4,width:22,height:22,color:C.tx,cursor:"pointer",fontSize:11}}>-</button><span style={{fontWeight:700}}>{htA}</span><button onClick={()=>setHtA(s=>(s??0)+1)} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:4,width:22,height:22,color:C.tx,cursor:"pointer",fontSize:11}}>+</button>
          </div>}
        </div>

        {/* Add new */}
        <div style={{background:C.card,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${C.grn}40`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.grn,marginBottom:8}}><Plus size={14} style={{verticalAlign:"middle",marginRight:4}}/>Hinzufügen</div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <div style={{flex:1}}><label style={{fontSize:10,color:C.txd}}>Min.</label><input value={addMin} onChange={(e:any)=>setAddMin(e.target.value)} type="number" placeholder="12" style={{...inp,textAlign:"center",fontSize:15,padding:"5px"}}/></div>
            <div style={{flex:1}}><label style={{fontSize:10,color:C.txd}}>HZ</label><div style={{display:"flex",gap:3,marginTop:2}}><button onClick={()=>setAddHalf2(1)} style={{flex:1,padding:5,borderRadius:6,background:addHalf2===1?C.grn:C.card2,color:"#fff",border:`1px solid ${addHalf2===1?C.grn:C.bdr}`,fontWeight:600,fontSize:11,cursor:"pointer"}}>1.HZ</button><button onClick={()=>setAddHalf2(2)} style={{flex:1,padding:5,borderRadius:6,background:addHalf2===2?C.blu:C.card2,color:"#fff",border:`1px solid ${addHalf2===2?C.blu:C.bdr}`,fontWeight:600,fontSize:11,cursor:"pointer"}}>2.HZ</button></div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            <Btn small color={C.grn} onClick={()=>{setMT("home");setMS(0);setMD({});setModal("rev-goal");}}><CircleDot size={12}/> Tor {ht||"H"}</Btn>
            <Btn small color={C.grn} onClick={()=>{setMT("away");setMS(0);setMD({});setModal("rev-goal");}}><CircleDot size={12}/> Tor {at||"G"}</Btn>
            <Btn small color={C.yel} onClick={()=>{setMT("home");setMS(0);setMD({});setModal("rev-card");}}><RectangleHorizontal size={12}/> Karte {ht||"H"}</Btn>
            <Btn small color={C.yel} onClick={()=>{setMT("away");setMS(0);setMD({});setModal("rev-card");}}><RectangleHorizontal size={12}/> Karte {at||"G"}</Btn>
            <Btn small color={C.blu} onClick={()=>{setMT("home");setMS(0);setMD({});setModal("rev-sub");}}><ArrowLeftRight size={12}/> Wechsel {ht||"H"}</Btn>
            <Btn small color={C.blu} onClick={()=>{setMT("away");setMS(0);setMD({});setModal("rev-sub");}}><ArrowLeftRight size={12}/> Wechsel {at||"G"}</Btn>
          </div>
        </div>

        {/* Events: ✏️ edit + ✕ delete */}
        <div style={{background:C.card,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Ereignisse ({hz1r.length+hz2r.length}) <span style={{fontSize:10,fontWeight:400,color:C.txd}}>✏️ bearbeiten ✕ löschen</span></div>
          {hz1r.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:C.grn,marginBottom:4,borderBottom:`1px solid ${C.bdr}`,paddingBottom:3}}>1. HZ{o1r&&<span style={{fontWeight:400,color:C.txd,marginLeft:6}}>{o1r.text}</span>}</div>{hz1r.map(evRow)}</div>}
          {hz2r.length>0&&<div><div style={{fontSize:11,fontWeight:700,color:C.blu,marginBottom:4,borderBottom:`1px solid ${C.bdr}`,paddingBottom:3}}>2. HZ{o2r&&<span style={{fontWeight:400,color:C.txd,marginLeft:6}}>{o2r.text}</span>}</div>{hz2r.map(evRow)}</div>}
          {hz1r.length===0&&hz2r.length===0&&<div style={{textAlign:"center",color:C.txd,padding:14,fontSize:13}}>Keine Ereignisse</div>}
        </div>

        <div style={{background:C.card,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Bemerkungen</div>
          <textarea value={notes} onChange={(e:any)=>setNotes(e.target.value)} placeholder="Besondere Vorkommnisse..." style={{...inp,minHeight:80,resize:"vertical",fontSize:13}}/>
        </div>

        <Btn full color={C.grn} onClick={()=>navTo("report")}><Save size={18}/> Alles korrekt — Spielbericht</Btn>
      </div>

      <BottomBar onHome={goHome} screen={screen}/>

      {/* ── EDIT MODAL: jedes Feld änderbar ── */}
      {modal==="edit"&&editEvt&&<Modal title="Ereignis bearbeiten" onClose={()=>{setEditEvt(null);setModal(null);}}>
        <div style={{marginBottom:10}}><label style={{fontSize:11,color:C.txd}}>Spielminute</label><input value={editEvt.displayTime?.replace("'","")||""} onChange={(e:any)=>setEditEvt({...editEvt,displayTime:`${e.target.value}'`})} type="number" style={{...inp,textAlign:"center",fontSize:18,marginTop:4}}/></div>
        <div style={{marginBottom:10}}><label style={{fontSize:11,color:C.txd}}>Halbzeit</label><div style={{display:"flex",gap:6,marginTop:4}}><button onClick={()=>setEditEvt({...editEvt,half:1})} style={{flex:1,padding:8,borderRadius:8,background:editEvt.half===1?C.grn:C.card2,color:"#fff",border:`1px solid ${editEvt.half===1?C.grn:C.bdr}`,fontWeight:600,cursor:"pointer"}}>1. HZ</button><button onClick={()=>setEditEvt({...editEvt,half:2})} style={{flex:1,padding:8,borderRadius:8,background:editEvt.half===2?C.blu:C.card2,color:"#fff",border:`1px solid ${editEvt.half===2?C.blu:C.bdr}`,fontWeight:600,cursor:"pointer"}}>2. HZ</button></div></div>
        <div style={{marginBottom:10}}><label style={{fontSize:11,color:C.txd}}>Mannschaft</label><div style={{display:"flex",gap:6,marginTop:4}}><button onClick={()=>setEditEvt({...editEvt,team:"home"})} style={{flex:1,padding:8,borderRadius:8,background:editEvt.team==="home"?C.grn:C.card2,color:"#fff",border:`1px solid ${editEvt.team==="home"?C.grn:C.bdr}`,fontWeight:600,cursor:"pointer"}}>{ht}</button><button onClick={()=>setEditEvt({...editEvt,team:"away"})} style={{flex:1,padding:8,borderRadius:8,background:editEvt.team==="away"?C.blu:C.card2,color:"#fff",border:`1px solid ${editEvt.team==="away"?C.blu:C.bdr}`,fontWeight:600,cursor:"pointer"}}>{at}</button></div></div>
        <div style={{marginBottom:10}}><label style={{fontSize:11,color:C.txd}}>Typ</label><div style={{display:"flex",gap:4,marginTop:4}}>{[{t:"goal",l:"⚽Tor",c:C.grn},{t:"card",l:"🟨Karte",c:C.yel},{t:"sub",l:"🔄Wechsel",c:C.blu}].map(({t,l,c})=>(<button key={t} onClick={()=>setEditEvt({...editEvt,type:t})} style={{flex:1,padding:6,borderRadius:6,background:editEvt.type===t?c:C.card2,color:"#fff",border:`1px solid ${editEvt.type===t?c:C.bdr}`,fontWeight:600,fontSize:11,cursor:"pointer"}}>{l}</button>))}</div></div>

        {editEvt.type==="goal"&&<div style={{marginBottom:10}}><label style={{fontSize:11,color:C.txd}}>Torart</label><div style={{display:"flex",gap:4,marginTop:4}}>{["Tor","Elfmeter","Eigentor"].map(g=>(<button key={g} onClick={()=>setEditEvt({...editEvt,goalType:g})} style={{flex:1,padding:6,borderRadius:6,background:editEvt.goalType===g?C.grn:C.card2,color:"#fff",border:`1px solid ${editEvt.goalType===g?C.grn:C.bdr}`,fontWeight:600,fontSize:11,cursor:"pointer"}}>{g}</button>))}</div></div>}
        {editEvt.type==="card"&&<div style={{marginBottom:10}}><label style={{fontSize:11,color:C.txd}}>Kartentyp</label><div style={{display:"flex",gap:4,marginTop:4}}>{["Gelb","Rot","Zeitstrafe"].map(c=>(<button key={c} onClick={()=>setEditEvt({...editEvt,cardType:c})} style={{flex:1,padding:6,borderRadius:6,background:editEvt.cardType===c?C.yel:C.card2,color:"#fff",border:`1px solid ${editEvt.cardType===c?C.yel:C.bdr}`,fontWeight:600,fontSize:11,cursor:"pointer"}}>{c}</button>))}</div></div>}

        {(editEvt.type==="goal"||editEvt.type==="card")&&<div style={{marginBottom:10}}><label style={{fontSize:11,color:C.txd}}>Spieler: <b style={{color:C.grn}}>{editEvt.player?.number} {editEvt.player?.name||"?"}</b></label><div style={{maxHeight:140,overflowY:"auto",marginTop:4}}>{allP(editEvt.team||"home").map(p=>(<button key={p.id} onClick={()=>setEditEvt({...editEvt,player:p})} style={{display:"block",width:"100%",padding:"7px 10px",background:editEvt.player?.id===p.id?`${C.grn}30`:C.card2,border:`1px solid ${editEvt.player?.id===p.id?C.grn:C.bdr}`,borderRadius:6,color:C.tx,cursor:"pointer",textAlign:"left",fontSize:12,marginBottom:3}}><b>{p.number}</b> {p.name}</button>))}</div></div>}

        {editEvt.type==="sub"&&<div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:C.txd}}>Raus: <b style={{color:C.red}}>{editEvt.outPlayer?.number} {editEvt.outPlayer?.name||"?"}</b></label>
          <div style={{maxHeight:120,overflowY:"auto",marginTop:4}}>{allP(editEvt.team||"home").map(p=>(<button key={p.id} onClick={()=>setEditEvt({...editEvt,outPlayer:p})} style={{display:"block",width:"100%",padding:"6px 10px",background:editEvt.outPlayer?.id===p.id?`${C.red}30`:C.card2,border:`1px solid ${editEvt.outPlayer?.id===p.id?C.red:C.bdr}`,borderRadius:6,color:C.tx,cursor:"pointer",textAlign:"left",fontSize:12,marginBottom:2}}><b>{p.number}</b> {p.name}</button>))}</div>
          <label style={{fontSize:11,color:C.txd,marginTop:8,display:"block"}}>Rein: <b style={{color:C.grn}}>{editEvt.inPlayer?.number} {editEvt.inPlayer?.name||"?"}</b></label>
          <div style={{maxHeight:120,overflowY:"auto",marginTop:4}}>{allP(editEvt.team||"home").map(p=>(<button key={p.id} onClick={()=>setEditEvt({...editEvt,inPlayer:p})} style={{display:"block",width:"100%",padding:"6px 10px",background:editEvt.inPlayer?.id===p.id?`${C.grn}30`:C.card2,border:`1px solid ${editEvt.inPlayer?.id===p.id?C.grn:C.bdr}`,borderRadius:6,color:C.tx,cursor:"pointer",textAlign:"left",fontSize:12,marginBottom:2}}><b>{p.number}</b> {p.name}</button>))}</div>
        </div>}

        <div style={{display:"flex",gap:8,marginTop:12}}><Btn full color={C.txd} onClick={()=>{setEditEvt(null);setModal(null);}}>Abbrechen</Btn><Btn full color={C.grn} onClick={saveEdit}><Save size={15}/> Speichern</Btn></div>
      </Modal>}

      {/* Add modals */}
      {modal==="rev-goal"&&<Modal title={`Tor — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:8}}><Btn full color={C.grn} onClick={()=>{setMD({gt:"Tor"});setMS(1);}}>⚽ Tor</Btn><Btn full color={C.yel} onClick={()=>{setMD({gt:"Elfmeter"});setMS(1);}}>⚽ Elfmeter</Btn><Btn full color={C.red} onClick={()=>{setMD({gt:"Eigentor"});setMS(1);}}>⚽ Eigentor</Btn></div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Torschütze ({mD.gt})</div>{allP(mT!).map(p=><PBtn key={p.id} p={p} onClick={(pl:any)=>revGoal(mT!,mD.gt,pl)}/>)}</div>}</Modal>}
      {modal==="rev-card"&&<Modal title={`Karte — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:8}}><Btn full color={C.yel} onClick={()=>{setMD({ct:"Gelb"});setMS(1);}}>🟨 Gelb</Btn><Btn full color={C.red} onClick={()=>{setMD({ct:"Rot"});setMS(1);}}>🟥 Rot</Btn><Btn full color={C.org} onClick={()=>{setMD({ct:"Zeitstrafe"});setMS(1);}}>⏱️ Zeitstrafe</Btn></div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Spieler ({mD.ct})</div>{allP(mT!).map(p=><PBtn key={p.id} p={p} onClick={(pl:any)=>revCard(mT!,mD.ct,pl)}/>)}</div>}</Modal>}
      {modal==="rev-sub"&&<Modal title={`Wechsel — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13}}>Spieler raus</div>{allP(mT!).map(p=><PBtn key={p.id} p={p} onClick={(pl:any)=>{setMD({out:pl});setMS(1);}}/>)}</div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13}}>Rein für #{mD.out?.number}</div>{allP(mT!).filter(p=>p.id!==mD.out?.id).map(p=><PBtn key={p.id} p={p} onClick={(pl:any)=>revSub(mT!,mD.out,pl)}/>)}</div>}</Modal>}
    </div>);
  }

  /* ═══ REPORT ═══ */
  if(screen==="report"){
    const hz1=evts.filter(e=>e.half===1&&e.type!=="info"),hz2=evts.filter(e=>e.half===2&&e.type!=="info");
    const o1=evts.find(e=>e.half===1&&e.type==="info"),o2=evts.find(e=>e.half===2&&e.type==="info");
    const exportData={homeTeam:ht,awayTeam:at,homeScore:hS,awayScore:aS,htHomeScore:htH,htAwayScore:htA,homePlayers:hp,awayPlayers:ap,events:evts,notes,halfDuration:hd};

    async function doPdf(){setExporting("pdf");try{const{generatePDF}=await import('./utils/exportPdf');const{sharePDF}=await import('./utils/shareFile');const d=generatePDF(exportData);await sharePDF(d,`Spielbericht_${ht}_vs_${at}.pdf`);flash("ok");}catch(e){console.error(e);flash("pdf_err");}setExporting("");}
    async function doXls(){setExporting("xls");try{const{generateXLS}=await import('./utils/exportXls');const{shareXLS}=await import('./utils/shareFile');const d=generateXLS(exportData);await shareXLS(d,`Spielbericht_${ht}_vs_${at}.xlsx`);flash("ok");}catch(e){console.error(e);flash("xls_err");}setExporting("");}
    async function doSaveAndReset(){await saveMatchToArchive();resetAll();flash("ok");}

    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"20px clamp(12px, 4vw, 20px) 150px"}}>
        <NavBar title="Spielbericht" onBack={()=>navTo("review")}/>

        <div style={{background:C.card,borderRadius:16,padding:20,marginBottom:16,border:`1px solid ${C.bdr}`,textAlign:"center"}}>
          <div style={{fontSize:12,color:C.txd,marginBottom:10,textTransform:"uppercase",fontWeight:600}}>Endergebnis</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20}}>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,marginBottom:6}}>{ht}</div><div style={{fontSize:42,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{hS}</div></div>
            <div style={{fontSize:28,color:C.txd}}>:</div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,marginBottom:6}}>{at}</div><div style={{fontSize:42,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{aS}</div></div>
          </div>
          {htH!==null&&<div style={{fontSize:13,color:C.txd,marginTop:6}}>HZ: {htH}:{htA}</div>}
        </div>

        <div style={{background:C.card,borderRadius:14,padding:14,marginBottom:16,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.txd,marginBottom:8}}>Spielverlauf</div>
          {[...hz1,...hz2].map(ev=>(<div key={ev.id} style={{fontSize:12,padding:"4px 0",display:"flex",gap:6}}>
            <span style={{color:ev.half===1?C.grn:C.blu,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",minWidth:40}}>{ev.displayTime}</span>
            <span>{ev.type==="goal"?`⚽ ${ev.goalType!=='Tor'?'('+ev.goalType+') ':''}${ev.player?.number} ${ev.player?.name}`:ev.type==="card"?`${ev.cardType==='Gelb'?'🟨':'🟥'} ${ev.player?.number} ${ev.player?.name}`:`🔄 ${ev.outPlayer?.number}→${ev.inPlayer?.number} ${ev.inPlayer?.name}`} <span style={{color:C.txd}}>— {ev.team==="home"?ht:at}</span></span>
          </div>))}
          {hz1.length===0&&hz2.length===0&&<div style={{color:C.txd,fontSize:12,textAlign:"center",padding:8}}>Keine Aktionen</div>}
        </div>

        {notes&&<div style={{background:C.card,borderRadius:14,padding:14,marginBottom:16,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.txd,marginBottom:4}}>Bemerkungen</div>
          <div style={{fontSize:12,whiteSpace:"pre-wrap"}}>{notes}</div>
        </div>}

        <div style={{fontSize:15,fontWeight:700,marginBottom:10,textAlign:"center"}}>Exportieren</div>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <Btn full color={C.red} disabled={exporting==="pdf"} onClick={doPdf}><Download size={16}/> {exporting==="pdf"?"...":"PDF"}</Btn>
          <Btn full color={C.grn} disabled={exporting==="xls"} onClick={doXls}><FileSpreadsheet size={16}/> {exporting==="xls"?"...":"Excel"}</Btn>
        </div>

        {msg==="ok"&&<div style={{padding:10,background:`${C.grn}20`,borderRadius:10,fontSize:13,color:C.grn,textAlign:"center",marginBottom:12}}>✅ Erfolgreich!</div>}
        {(msg==="pdf_err"||msg==="xls_err")&&<div style={{padding:10,background:`${C.red}20`,borderRadius:10,fontSize:13,color:C.red,textAlign:"center",marginBottom:12}}>❌ Export fehlgeschlagen</div>}

        <div style={{marginTop:12}}><Btn full color={C.blu} onClick={doSaveAndReset}><Archive size={16}/> Archivieren & Neues Spiel</Btn></div>
      </div>
    </div>);
  }
  return null;
}
