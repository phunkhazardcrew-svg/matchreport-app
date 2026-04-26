import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, Square, Settings as SettingsIcon, FileText, ChevronLeft,
  Upload, Plus, Minus, Trash2, Download, Users, AlertTriangle,
  RotateCcw, Clock, CircleDot, RectangleHorizontal, ArrowLeftRight,
  X, Check, Shirt, Eye, Edit, Save, FileSpreadsheet, Home,
  Volume2, VolumeX, Archive, Music
} from "lucide-react";
import { generatePDF } from './utils/exportPdf';
import { generateXLS } from './utils/exportXls';
import { sharePDF, shareXLS } from './utils/shareFile';
import { db, initSoundDefaults, requestPersistentStorage } from './db';
import type { Match, SoundConfig } from './db';
import { Ringtones } from './plugins/ringtones';

function fmt(sec:number){const m=Math.floor(Math.abs(sec)/60);const s=Math.abs(sec)%60;return`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}

function playWebTone(freq=3200){try{const ctx=new AudioContext();const g=ctx.createGain();g.connect(ctx.destination);g.gain.value=0.3;[freq,freq+400].forEach(f=>{const o=ctx.createOscillator();o.connect(g);o.frequency.value=f;o.type="sine";o.start();setTimeout(()=>o.stop(),600);});setTimeout(()=>g.gain.value=0,300);setTimeout(()=>g.gain.value=0.3,400);setTimeout(()=>g.gain.value=0.01,550);}catch(_){}}
function vibrate(){try{navigator.vibrate?.([300,100,300]);}catch(_){}}

async function playEventSound(eventType:string){
  try{
    const cfg=await db.soundConfigs.get(eventType);
    if(cfg?.uri){await Ringtones.play({uri:cfg.uri});return;}
    playWebTone(eventType==='goal'?2400:eventType==='halftime'||eventType==='fulltime'?3200:1800);
  }catch(_){playWebTone();}
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

function NavBar({onHome,title,onBack}:any){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>{onBack?<button onClick={onBack} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13}}><ChevronLeft size={18}/> Zurück</button>:<div/>}{title&&<span style={{fontSize:13,fontWeight:700,color:C.grn}}>{title}</span>}<button onClick={onHome} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:12}}><Home size={16}/></button></div>);}

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
  const tmr=useRef<any>(null);
  const inp:any={width:"100%",boxSizing:"border-box",padding:"10px 14px",background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,color:C.tx,fontSize:15,outline:"none"};

  // Init DB on mount
  useEffect(()=>{
    initSoundDefaults().then(()=>db.soundConfigs.toArray().then(setSoundCfgs));
    requestPersistentStorage();
    loadArchive();
  },[]);

  async function loadArchive(){const m=await db.matches.orderBy('createdAt').reverse().toArray();setArchivedMatches(m);}
  async function loadSounds(){const s=await db.soundConfigs.toArray();setSoundCfgs(s);}

  useEffect(()=>{if(started&&hOn.length===0){setHOn(hp.filter(p=>p.isStarter).map(p=>p.id));setAOn(ap.filter(p=>p.isStarter).map(p=>p.id));}},[started]);

  useEffect(()=>{
    if(run&&!pau){tmr.current=setInterval(()=>{if(!isOt){setTl(p=>{if(!p||p<=1){setIsOt(true);if(!whistled){playEventSound(half===1?'halftime':'fulltime');vibrate();setWhistled(true);}return 0;}return p-1;});}else{setOtS(p=>p+1);}},1000);}
    return()=>clearInterval(tmr.current);
  },[run,pau,isOt,whistled,half]);

  const getDispMin=useCallback(()=>{
    const elapsed=hd*60-(tl||0);const m=Math.floor(elapsed/60)+(half===2?hd:0);
    if(isOt)return`${hd*half}+${Math.floor(otS/60)+1}'`;
    return`${m+1}'`;
  },[tl,half,hd,isOt,otS]);

  function flash(m:string){setMsg(m);setTimeout(()=>setMsg(""),3000);}
  function goHome(){setScreen("home");}

  function applyCSV(t:string){const r=parseCSV(t);if(r){if(r.homeTeam)setHt(r.homeTeam);if(r.awayTeam)setAt(r.awayTeam);if(r.homePlayers.length)setHp(r.homePlayers);if(r.awayPlayers.length)setAp(r.awayPlayers);flash("ok");return true;}flash("err");return false;}
  function onFile(e:any){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>applyCSV(ev.target?.result as string);r.readAsText(f);e.target.value="";}
  function loadDemo(){setHt("FC Teststadt");setAt("SV Musterheim");setHp([...DEMO_H]);setAp([...DEMO_A]);flash("ok");}
  function startT(){if(tl===null)setTl(hd*60);setRun(true);setPau(false);setStarted(true);}
  function confirmHT(){setRun(false);setPau(false);setIsOt(false);if(otS>0)setEvts(p=>[...p,{type:"info",half:1,text:`Nachspielzeit: ${fmt(otS)}`,id:`ot1-${Date.now()}`}]);setHtH(hS);setHtA(aS);setOtS(0);setWhistled(false);setHalf(2);setTl(hd*60);setModal(null);}
  function confirmFT(){setRun(false);setPau(false);if(otS>0)setEvts(p=>[...p,{type:"info",half:2,text:`Nachspielzeit: ${fmt(otS)}`,id:`ot2-${Date.now()}`}]);setModal(null);setScreen("review");}

  function openAct(t:string,tm:string){setMT(tm);setMS(0);setMD({});setModal(t);}
  function selGT(t:string){setMD({gt:t});setMS(1);}
  function selGP(p:any){const gt=mD.gt;const own=gt==="Eigentor";if(own){if(mT==="home")setAS(s=>s+1);else setHS(s=>s+1);}else{if(mT==="home")setHS(s=>s+1);else setAS(s=>s+1);}setEvts(x=>[...x,{type:"goal",goalType:gt,half,player:p,team:mT,id:`g-${Date.now()}`,displayTime:getDispMin()}]);playEventSound(gt==='Eigentor'?'eigentor':gt==='Elfmeter'?'elfmeter':'goal');vibrate();setModal(null);}
  function selCT(t:string){setMD({ct:t});setMS(1);}
  function selCP(p:any){setEvts(x=>[...x,{type:"card",cardType:mD.ct,half,player:p,team:mT,id:`c-${Date.now()}`,displayTime:getDispMin()}]);playEventSound(mD.ct==='Gelb'?'yellow':'red');setModal(null);}
  function selSO(p:any){setMD({out:p});setMS(1);}
  function selSI(p:any){const fn=mT==="home"?setHOn:setAOn;fn(x=>x.filter(id=>id!==mD.out.id).concat(p.id));setEvts(x=>[...x,{type:"sub",half,outPlayer:mD.out,inPlayer:p,team:mT,id:`s-${Date.now()}`,displayTime:getDispMin()}]);playEventSound('sub');setModal(null);}
  function delEv(ev:any){setEvts(x=>x.filter(e=>e.id!==ev.id));if(ev.type==="goal"){const own=ev.goalType==="Eigentor";if(own){if(ev.team==="home")setAS(s=>Math.max(0,s-1));else setHS(s=>Math.max(0,s-1));}else{if(ev.team==="home")setHS(s=>Math.max(0,s-1));else setAS(s=>Math.max(0,s-1));}}}
  function resetAll(){setHalf(1);setTl(null);setRun(false);setPau(false);setIsOt(false);setOtS(0);setHS(0);setAS(0);setHtH(null);setHtA(null);setEvts([]);setWhistled(false);setStarted(false);setHOn([]);setAOn([]);setNotes("");setExporting("");setModal(null);setScreen("home");}

  async function saveMatchToArchive(){
    const match:Match={id:crypto.randomUUID(),homeTeam:ht,awayTeam:at,homePlayers:hp,awayPlayers:ap,homeScore:hS,awayScore:aS,htHomeScore:htH,htAwayScore:htA,halfDuration:hd,playerCount:pc,events:evts,notes,status:'finished',createdAt:Date.now(),updatedAt:Date.now()};
    await db.matches.put(match);
    await loadArchive();
  }

  async function deleteArchivedMatch(id:string){await db.matches.delete(id);await loadArchive();}

  const onF=(tm:string)=>(tm==="home"?hp:ap).filter(p=>(tm==="home"?hOn:aOn).includes(p.id));
  const bnch=(tm:string)=>(tm==="home"?hp:ap).filter(p=>!(tm==="home"?hOn:aOn).includes(p.id));
  const allP=(tm:string)=>tm==="home"?hp:ap;

  /* ═══ HOME ═══ */
  if(screen==="home"){
    const hasActive=started&&!evts.some(e=>e.type==="info"&&e.half===2);
    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"24px 16px",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontSize:36,fontWeight:800,color:C.grn,marginTop:40,marginBottom:4}}>⚽</div>
        <div style={{fontSize:28,fontWeight:800,color:C.grn,marginBottom:4}}>Matchreport</div>
        <div style={{color:C.txd,fontSize:13,marginBottom:40}}>Fußball-Spielbericht</div>

        <div style={{width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:12}}>
          {hasActive&&<Btn full color={C.org} onClick={()=>setScreen("game")}><Play size={18}/> Laufendes Spiel fortsetzen</Btn>}
          <Btn full color={C.grn} onClick={()=>setScreen("settings")}><Plus size={18}/> Neues Spiel</Btn>
          <Btn full color={C.blu} onClick={()=>{loadArchive();setScreen("archive");}}><Archive size={18}/> Spielarchiv ({archivedMatches.length})</Btn>
          <Btn full color={C.card2} onClick={()=>{loadSounds();setScreen("sounds");}}><Music size={18}/> Sound-Einstellungen</Btn>
        </div>

        <div style={{marginTop:60,color:C.txd,fontSize:11,textAlign:"center"}}>Version 2.0 • Offline-fähig</div>
      </div>
    </div>);
  }

  /* ═══ SOUNDS ═══ */
  if(screen==="sounds"){
    const labels:Record<string,string>={goal:"⚽ Tor",eigentor:"⚽ Eigentor",elfmeter:"⚽ Elfmeter",yellow:"🟨 Gelbe Karte",red:"🟥 Rote Karte",sub:"🔄 Wechsel",halftime:"⏱ Halbzeit",fulltime:"🏁 Spielende"};

    async function pickSound(id:string){
      try{
        const existing=soundCfgs.find(s=>s.id===id);
        const result=await Ringtones.pick({type:"notification",title:`Sound: ${labels[id]||id}`,existingUri:existing?.uri||undefined});
        if(!result.cancelled&&result.uri){
          await db.soundConfigs.update(id,{uri:result.uri});
          await loadSounds();
        }
      }catch(e){
        // On web, Ringtones.pick returns cancelled
        flash("err");
      }
    }

    async function testSound(id:string){
      const cfg=soundCfgs.find(s=>s.id===id);
      if(cfg?.uri){try{await Ringtones.play({uri:cfg.uri});}catch(_){playWebTone();}}
      else playWebTone();
    }

    async function clearSound(id:string){
      await db.soundConfigs.update(id,{uri:null});
      await loadSounds();
    }

    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"16px 16px 100px"}}>
        <NavBar onHome={goHome} title="Sound-Einstellungen"/>

        <div style={{fontSize:13,color:C.txd,marginBottom:16}}>Wähle für jedes Ereignis einen Geräte-Sound. Ohne Auswahl wird ein Standard-Ton verwendet.</div>

        {Object.entries(labels).map(([id,label])=>{
          const cfg=soundCfgs.find(s=>s.id===id);
          const hasSound=!!cfg?.uri;
          return(
            <div key={id} style={{background:C.card,borderRadius:12,padding:14,marginBottom:10,border:`1px solid ${C.bdr}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:14,fontWeight:600}}>{label}</span>
                <span style={{fontSize:11,color:hasSound?C.grn:C.txd}}>{hasSound?"Zugewiesen":"Standard"}</span>
              </div>
              <div style={{display:"flex",gap:6}}>
                <Btn small color={C.blu} onClick={()=>pickSound(id)}><Music size={14}/> Wählen</Btn>
                <Btn small color={C.card2} onClick={()=>testSound(id)}><Volume2 size={14}/> Test</Btn>
                {hasSound&&<Btn small color={C.red} onClick={()=>clearSound(id)}><VolumeX size={14}/></Btn>}
              </div>
            </div>
          );
        })}
      </div>
    </div>);
  }

  /* ═══ ARCHIVE ═══ */
  if(screen==="archive"){
    if(viewMatch){
      const m=viewMatch;
      const exportData={homeTeam:m.homeTeam,awayTeam:m.awayTeam,homeScore:m.homeScore,awayScore:m.awayScore,htHomeScore:m.htHomeScore,htAwayScore:m.htAwayScore,homePlayers:m.homePlayers,awayPlayers:m.awayPlayers,events:m.events,notes:m.notes,halfDuration:m.halfDuration};
      async function reExportPdf(){setExporting("pdf");try{const d=generatePDF(exportData);await sharePDF(d,`Spielbericht_${m.homeTeam}_vs_${m.awayTeam}.pdf`);flash("pdf_ok");}catch(_){flash("pdf_err");}setExporting("");}
      async function reExportXls(){setExporting("xls");try{const d=generateXLS(exportData);await shareXLS(d,`Spielbericht_${m.homeTeam}_vs_${m.awayTeam}.xlsx`);flash("xls_ok");}catch(_){flash("xls_err");}setExporting("");}

      const hz1=m.events.filter(e=>e.half===1&&e.type!=="info"),hz2=m.events.filter(e=>e.half===2&&e.type!=="info");
      return(
      <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
        <div style={{padding:"16px 16px 100px"}}>
          <NavBar onHome={goHome} title="Archiv" onBack={()=>setViewMatch(null)}/>
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
      <div style={{padding:"16px 16px 100px"}}>
        <NavBar onHome={goHome} title="Spielarchiv"/>
        {archivedMatches.length===0?<div style={{textAlign:"center",color:C.txd,padding:40}}>Noch keine archivierten Spiele</div>:
          archivedMatches.map(m=>(<div key={m.id} style={{background:C.card,borderRadius:12,padding:14,marginBottom:10,border:`1px solid ${C.bdr}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <button onClick={()=>setViewMatch(m)} style={{background:"none",border:"none",color:C.tx,cursor:"pointer",textAlign:"left",flex:1}}>
              <div style={{fontSize:14,fontWeight:700}}>{m.homeTeam} {m.homeScore}:{m.awayScore} {m.awayTeam}</div>
              <div style={{fontSize:11,color:C.txd}}>{new Date(m.createdAt).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})} • {m.halfDuration*2} min • {m.events.filter(e=>e.type!=='info').length} Aktionen</div>
            </button>
            <button onClick={()=>{if(confirm('Spiel löschen?'))deleteArchivedMatch(m.id);}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",padding:8,opacity:0.6}}><Trash2 size={16}/></button>
          </div>))
        }
      </div>
    </div>);
  }

  /* ═══ SETTINGS ═══ */
  if(screen==="settings"){return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"16px 16px 100px"}}>
        <NavBar onHome={goHome} title="Spieleinstellungen"/>

        <div style={{background:C.card,borderRadius:14,padding:18,marginBottom:14,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.txd,textTransform:"uppercase",marginBottom:14}}><Clock size={14} style={{verticalAlign:"middle",marginRight:6}}/>Spielparameter</div>
          {[{l:"Halbzeitdauer",v:`${hd} min`,d:()=>setHd(x=>Math.max(5,x-5)),i:()=>setHd(x=>Math.min(45,x+5))},{l:"Spieler (inkl. TW)",v:pc,d:()=>setPc(x=>Math.max(3,x-1)),i:()=>setPc(x=>Math.min(11,x+1))}].map(({l,v,d,i})=>(
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
                      <span style={{fontSize:13}}>{p.name}{p.isGoalkeeper&&<span style={{color:C.yel,marginLeft:4,fontSize:10}}>TW</span>}{p.isCaptain&&<span style={{color:C.blu,marginLeft:4,fontSize:10}}>C</span>}</span>
                    </div>
                    <button onClick={()=>{if(k==="home")setHp(x=>x.filter(q=>q.id!==p.id));else setAp(x=>x.filter(q=>q.id!==p.id));}} style={{background:"none",border:"none",color:C.red,cursor:"pointer",padding:4}}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            );})}
            {!pl.length&&<div style={{textAlign:"center",color:C.txd,fontSize:13,padding:16}}>Keine Spieler</div>}
          </div>
        ))}

        <Btn full color={C.grn} onClick={()=>{if(!ht||!at){alert("Bitte Mannschaftsnamen eingeben!");return;}setScreen("game");}}><Play size={18}/> Zum Spielfeld</Btn>
      </div>

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
    <div style={{background:C.bg,height:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:"0 0 auto",padding:"12px 16px",textAlign:"center",background:`linear-gradient(180deg,${C.card} 0%,${C.bg} 100%)`,borderBottom:`1px solid ${C.bdr}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <button onClick={()=>setScreen("settings")} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}><SettingsIcon size={15}/> Einstellungen</button>
          <div style={{fontSize:12,fontWeight:700,color:half===1?C.grn:C.blu,background:half===1?`${C.grn}20`:`${C.blu}20`,padding:"4px 12px",borderRadius:20}}>{half}. Halbzeit</div>
          <button onClick={goHome} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Home size={15}/></button>
        </div>
        <div style={{fontSize:isOt?28:48,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",color:isOt?C.red:C.tx,padding:"8px 0"}}>{isOt?`${fmt(0)} +${fmt(otS)}`:fmt(tl??hd*60)}</div>
        <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:4}}>
          {!run&&!pau&&<Btn color={C.grn} onClick={startT}><Play size={18}/> Start</Btn>}
          {run&&!pau&&<div style={{display:"flex",gap:12}}><Btn color={C.yel} onClick={()=>setPau(true)}><Pause size={18}/> Pause</Btn><Btn color={C.red} onClick={()=>setModal(half===1?"ht":"ft")}><Square size={18}/> Stopp</Btn></div>}
          {pau&&<div style={{display:"flex",gap:12}}><Btn color={C.grn} onClick={()=>setPau(false)}><Play size={18}/> Weiter</Btn><Btn color={C.red} onClick={()=>setModal(half===1?"ht":"ft")}><Square size={18}/> Stopp</Btn></div>}
        </div>
      </div>

      <div style={{flex:"0 0 auto",padding:16,display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
        <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:C.txd,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ht}</div><div style={{fontSize:48,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{hS}</div>{htH!==null&&<div style={{fontSize:14,color:C.txd,fontFamily:"'JetBrains Mono',monospace"}}>({htH})</div>}</div>
        <div style={{fontSize:28,color:C.txd,fontWeight:300}}>:</div>
        <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:C.txd,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{at}</div><div style={{fontSize:48,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{aS}</div>{htA!==null&&<div style={{fontSize:14,color:C.txd,fontFamily:"'JetBrains Mono',monospace"}}>({htA})</div>}</div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"0 16px 16px",display:"flex",flexDirection:"column"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,flex:1}}>
          {[{k:"home",l:ht},{k:"away",l:at}].map(({k,l})=>(
            <div key={k} style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:11,fontWeight:700,color:C.txd,textAlign:"center",textTransform:"uppercase"}}>{l}</div>
              <Btn full color={C.grn} onClick={()=>openAct("goal",k)} disabled={!run}><CircleDot size={15}/> Tor</Btn>
              <Btn full color={C.yel} onClick={()=>openAct("card",k)} disabled={!run}><RectangleHorizontal size={15}/> Karte</Btn>
              <Btn full color={C.blu} onClick={()=>openAct("sub",k)} disabled={!run}><ArrowLeftRight size={15}/> Wechsel</Btn>
            </div>
          ))}
        </div>
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
  if(screen==="review"){
    const hz1r=evts.filter(e=>e.half===1&&e.type!=="info"),hz2r=evts.filter(e=>e.half===2&&e.type!=="info");
    const o1r=evts.find(e=>e.half===1&&e.type==="info"),o2r=evts.find(e=>e.half===2&&e.type==="info");
    const evRowR=(ev:any)=>(<div key={ev.id} style={{fontSize:13,padding:"8px 0",display:"flex",gap:8,alignItems:"center",borderBottom:`1px solid ${C.bdr}40`}}>
      <span style={{color:ev.half===1?C.grn:C.blu,fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,minWidth:44}}>{ev.displayTime}</span>
      <span style={{flex:1}}>{ev.type==="goal"&&<span>⚽ {ev.goalType!=="Tor"&&<span style={{color:C.yel}}>({ev.goalType}) </span>}{ev.player.number} {ev.player.name}</span>}{ev.type==="card"&&<span>{ev.cardType==="Gelb"?"🟨":ev.cardType==="Rot"?"🟥":"⏱️"} {ev.player.number} {ev.player.name}</span>}{ev.type==="sub"&&<span>🔄 {ev.outPlayer.number} → {ev.inPlayer.number} {ev.inPlayer.name}</span>}<span style={{color:C.txd}}> — {ev.team==="home"?ht:at}</span></span>
      <button onClick={()=>delEv(ev)} style={{background:C.red,border:"none",color:"#fff",cursor:"pointer",padding:"6px 10px",borderRadius:8,fontSize:11,fontWeight:600,flexShrink:0}}>Löschen</button>
    </div>);
    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"16px 16px 100px"}}>
        <NavBar onHome={goHome} title="Korrektur" onBack={()=>setScreen("game")}/>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:20,fontWeight:800,color:C.org}}><Edit size={18} style={{verticalAlign:"middle",marginRight:6}}/>Überprüfung</div>
          <div style={{fontSize:12,color:C.txd,marginTop:4}}>Korrigiere Einträge vor dem Export</div>
        </div>
        <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${C.bdr}`,textAlign:"center"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20}}>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.txd}}>{ht}</div><div style={{fontSize:40,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{hS}</div></div>
            <div style={{fontSize:24,color:C.txd}}>:</div>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.txd}}>{at}</div><div style={{fontSize:40,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{aS}</div></div>
          </div>
          {htH!==null&&<div style={{fontSize:13,color:C.txd,marginTop:4}}>HZ: {htH}:{htA}</div>}
          <div style={{fontSize:10,color:C.org,marginTop:6}}>Tore löschen korrigiert den Spielstand automatisch</div>
        </div>
        <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>Ereignisse ({hz1r.length+hz2r.length})</div>
          {hz1r.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.grn,marginBottom:6,borderBottom:`1px solid ${C.bdr}`,paddingBottom:4}}>1. Halbzeit{o1r&&<span style={{fontWeight:400,color:C.txd,marginLeft:8}}>{o1r.text}</span>}</div>{hz1r.map(evRowR)}</div>}
          {hz2r.length>0&&<div><div style={{fontSize:12,fontWeight:700,color:C.blu,marginBottom:6,borderBottom:`1px solid ${C.bdr}`,paddingBottom:4}}>2. Halbzeit{o2r&&<span style={{fontWeight:400,color:C.txd,marginLeft:8}}>{o2r.text}</span>}</div>{hz2r.map(evRowR)}</div>}
          {hz1r.length===0&&hz2r.length===0&&<div style={{textAlign:"center",color:C.txd,padding:16}}>Keine Ereignisse</div>}
        </div>
        <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Bemerkungen</div>
          <textarea value={notes} onChange={(e:any)=>setNotes(e.target.value)} placeholder="Besondere Vorkommnisse..." style={{...inp,minHeight:90,resize:"vertical",fontSize:14}}/>
        </div>
        <Btn full color={C.grn} onClick={()=>setScreen("report")}><Save size={18}/> Alles korrekt — Spielbericht</Btn>
      </div>
    </div>);
  }

  /* ═══ REPORT ═══ */
  if(screen==="report"){
    const hz1=evts.filter(e=>e.half===1&&e.type!=="info"),hz2=evts.filter(e=>e.half===2&&e.type!=="info");
    const o1=evts.find(e=>e.half===1&&e.type==="info"),o2=evts.find(e=>e.half===2&&e.type==="info");
    const exportData={homeTeam:ht,awayTeam:at,homeScore:hS,awayScore:aS,htHomeScore:htH,htAwayScore:htA,homePlayers:hp,awayPlayers:ap,events:evts,notes,halfDuration:hd};

    async function doPdf(){setExporting("pdf");try{const d=generatePDF(exportData);await sharePDF(d,`Spielbericht_${ht}_vs_${at}.pdf`);flash("ok");}catch(e){console.error(e);flash("pdf_err");}setExporting("");}
    async function doXls(){setExporting("xls");try{const d=generateXLS(exportData);await shareXLS(d,`Spielbericht_${ht}_vs_${at}.xlsx`);flash("ok");}catch(e){console.error(e);flash("xls_err");}setExporting("");}
    async function doSaveAndReset(){await saveMatchToArchive();resetAll();flash("ok");}

    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"16px 16px 100px"}}>
        <NavBar onHome={goHome} title="Spielbericht" onBack={()=>setScreen("review")}/>

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
