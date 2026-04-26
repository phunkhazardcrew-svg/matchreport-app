import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, Square, Settings, FileText, ChevronLeft,
  Upload, Plus, Minus, Trash2, Download, Users, AlertTriangle,
  RotateCcw, Clock, CircleDot, RectangleHorizontal, ArrowLeftRight,
  X, Check, Shirt, ClipboardCopy, Eye
} from "lucide-react";

function fmt(sec) {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function playWhistle() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = ctx.createGain(); g.connect(ctx.destination); g.gain.value = 0.35;
    [3200, 3600].forEach(f => { const o = ctx.createOscillator(); o.connect(g); o.frequency.value = f; o.type = "sine"; o.start(); setTimeout(() => o.stop(), 1600); });
    setTimeout(() => (g.gain.value = 0), 300); setTimeout(() => (g.gain.value = 0.35), 400);
    setTimeout(() => (g.gain.value = 0), 700); setTimeout(() => (g.gain.value = 0.35), 800);
    setTimeout(() => (g.gain.value = 0.01), 1200);
  } catch (_) {}
}

function vibrate() { try { navigator.vibrate?.([300, 100, 300, 100, 500]); } catch (_) {} }

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;
  const hdr = lines[0].split(";"), val = lines[1].split(";");
  const g = (k) => { const i = hdr.indexOf(k); return i >= 0 ? (val[i] || "").trim() : ""; };
  const hp = [], ap = [];
  for (let i = 1; i <= 7; i++) { const n = g(`H-S${i}-Nr`), nm = g(`H-S${i}-Spieler`), h = g(`H-S${i}-Hinweis`); if (n && nm) hp.push({ number: n, name: nm, isGoalkeeper: h.includes("TW"), isCaptain: h.includes("C"), isStarter: true, id: `hs${i}-${Date.now()}` }); }
  for (let i = 1; i <= 6; i++) { const n = g(`H-A${i}-Nr`), nm = g(`H-A${i}-Spieler`), h = g(`H-A${i}-Hinweis`); if (n && nm) hp.push({ number: n, name: nm, isGoalkeeper: h.includes("TW"), isCaptain: h.includes("C"), isStarter: false, id: `ha${i}-${Date.now()}` }); }
  for (let i = 1; i <= 7; i++) { const n = g(`G-S${i}-Nr`), nm = g(`G-S${i}-Spieler`), h = g(`G-S${i}-Hinweis`); if (n && nm) ap.push({ number: n, name: nm, isGoalkeeper: h.includes("TW"), isCaptain: h.includes("C"), isStarter: true, id: `gs${i}-${Date.now()}` }); }
  for (let i = 1; i <= 6; i++) { const n = g(`G-A${i}-Nr`), nm = g(`G-A${i}-Spieler`), h = g(`G-A${i}-Hinweis`); if (n && nm) ap.push({ number: n, name: nm, isGoalkeeper: h.includes("TW"), isCaptain: h.includes("C"), isStarter: false, id: `ga${i}-${Date.now()}` }); }
  if (!hp.length && !ap.length) return null;
  return { homeTeam: g("Heimmannschaft"), awayTeam: g("Gastmannschaft"), homePlayers: hp, awayPlayers: ap };
}

const DEMO_H = [
  { id:"dh1",number:"1",name:"Schmidt, Lukas",isGoalkeeper:true,isCaptain:false,isStarter:true },
  { id:"dh2",number:"3",name:"Wagner, Tim",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"dh3",number:"5",name:"Fischer, Jonas",isGoalkeeper:false,isCaptain:true,isStarter:true },
  { id:"dh4",number:"7",name:"Weber, Elias",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"dh5",number:"8",name:"Becker, Leon",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"dh6",number:"9",name:"Hoffmann, Paul",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"dh7",number:"11",name:"Schulz, Finn",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"dh8",number:"14",name:"Meyer, Noah",isGoalkeeper:false,isCaptain:false,isStarter:false },
  { id:"dh9",number:"16",name:"Koch, Ben",isGoalkeeper:false,isCaptain:false,isStarter:false },
];
const DEMO_A = [
  { id:"da1",number:"1",name:"Klein, Max",isGoalkeeper:true,isCaptain:false,isStarter:true },
  { id:"da2",number:"2",name:"Wolf, Luca",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"da3",number:"4",name:"Schäfer, Jan",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"da4",number:"6",name:"Neumann, Erik",isGoalkeeper:false,isCaptain:true,isStarter:true },
  { id:"da5",number:"8",name:"Schwarz, Tom",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"da6",number:"10",name:"Zimmermann, Luis",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"da7",number:"12",name:"Krüger, Nico",isGoalkeeper:false,isCaptain:false,isStarter:true },
  { id:"da8",number:"13",name:"Braun, Felix",isGoalkeeper:false,isCaptain:false,isStarter:false },
  { id:"da9",number:"15",name:"Hartmann, Mika",isGoalkeeper:false,isCaptain:false,isStarter:false },
];

const C = { bg:"#0a0f1a",card:"#111827",card2:"#1a2236",bdr:"#1e293b",tx:"#e2e8f0",txd:"#64748b",grn:"#10b981",grnD:"#065f46",yel:"#eab308",red:"#ef4444",blu:"#3b82f6",org:"#f97316" };

function Btn({children,onClick,color=C.grn,disabled,full,small}){return(<button onClick={onClick} disabled={disabled} style={{background:disabled?"#334155":color,color:disabled?"#64748b":"#fff",border:"none",borderRadius:10,padding:small?"6px 12px":"12px 18px",fontSize:small?12:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:full?"100%":"auto",opacity:disabled?0.5:1,fontFamily:"'JetBrains Mono',monospace"}}>{children}</button>);}

function Modal({title,onClose,children}){return(<div onClick={onClose} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:20,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto",border:`1px solid ${C.bdr}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{color:C.tx,margin:0,fontSize:18,fontWeight:700}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:C.txd,cursor:"pointer"}}><X size={20}/></button></div>{children}</div></div>);}

function PBtn({p,onClick}){return(<button onClick={()=>onClick(p)} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:C.tx,textAlign:"left",width:"100%",marginBottom:4}}><span style={{background:C.grn,color:"#fff",borderRadius:6,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,fontFamily:"'JetBrains Mono',monospace"}}>{p.number}</span><span style={{fontSize:14,fontWeight:500}}>{p.name}{p.isGoalkeeper&&<span style={{color:C.yel,marginLeft:6,fontSize:11}}>TW</span>}{p.isCaptain&&<span style={{color:C.blu,marginLeft:6,fontSize:11}}>C</span>}</span></button>);}

export default function MatchReport() {
  const [screen,setScreen]=useState("settings");
  const [hd,setHd]=useState(20);
  const [pc,setPc]=useState(7);
  const [ht,setHt]=useState("");
  const [at,setAt]=useState("");
  const [hp,setHp]=useState([]);
  const [ap,setAp]=useState([]);
  const [addNum,setAddNum]=useState("");
  const [addName,setAddName]=useState("");
  const [addTeam,setAddTeam]=useState("home");
  const [addSt,setAddSt]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [showPaste,setShowPaste]=useState(false);
  const [pasteText,setPasteText]=useState("");
  const [msg,setMsg]=useState("");
  const csvRef=useRef(null);
  const [half,setHalf]=useState(1);
  const [tl,setTl]=useState(null);
  const [run,setRun]=useState(false);
  const [pau,setPau]=useState(false);
  const [isOt,setIsOt]=useState(false);
  const [otS,setOtS]=useState(0);
  const [hS,setHS]=useState(0);
  const [aS,setAS]=useState(0);
  const [htH,setHtH]=useState(null);
  const [htA,setHtA]=useState(null);
  const [evts,setEvts]=useState([]);
  const [whistled,setWhistled]=useState(false);
  const [started,setStarted]=useState(false);
  const [hOn,setHOn]=useState([]);
  const [aOn,setAOn]=useState([]);
  const [notes,setNotes]=useState("");
  const [prev,setPrev]=useState("");
  const [modal,setModal]=useState(null);
  const [mT,setMT]=useState(null);
  const [mS,setMS]=useState(0);
  const [mD,setMD]=useState({});
  const tmr=useRef(null);
  const inp={width:"100%",boxSizing:"border-box",padding:"10px 14px",background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,color:C.tx,fontSize:15,outline:"none"};

  useEffect(()=>{if(started&&hOn.length===0){setHOn(hp.filter(p=>p.isStarter).map(p=>p.id));setAOn(ap.filter(p=>p.isStarter).map(p=>p.id));}},[started]);

  useEffect(()=>{
    if(run&&!pau){tmr.current=setInterval(()=>{if(!isOt){setTl(p=>{if(p<=1){setIsOt(true);if(!whistled){playWhistle();vibrate();setWhistled(true);}return 0;}return p-1;});}else{setOtS(p=>p+1);}},1000);}
    return()=>clearInterval(tmr.current);
  },[run,pau,isOt,whistled]);

  const getDispMin=useCallback(()=>{
    const elapsed=hd*60-(tl||0);
    const m=Math.floor(elapsed/60)+(half===2?hd:0);
    if(isOt)return`${hd*half}+${Math.floor(otS/60)+1}'`;
    return`${m+1}'`;
  },[tl,half,hd,isOt,otS]);

  function flash(m){setMsg(m);setTimeout(()=>setMsg(""),3000);}
  function applyCSV(t){const r=parseCSV(t);if(r){if(r.homeTeam)setHt(r.homeTeam);if(r.awayTeam)setAt(r.awayTeam);if(r.homePlayers.length)setHp(r.homePlayers);if(r.awayPlayers.length)setAp(r.awayPlayers);flash("ok");return true;}flash("err");return false;}
  function onFile(e){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>applyCSV(ev.target.result);r.readAsText(f);e.target.value="";}
  function loadDemo(){setHt("FC Teststadt");setAt("SV Musterheim");setHp([...DEMO_H]);setAp([...DEMO_A]);flash("ok");}
  function startT(){if(tl===null)setTl(hd*60);setRun(true);setPau(false);setStarted(true);}
  function confirmHT(){setRun(false);setPau(false);setIsOt(false);if(otS>0)setEvts(p=>[...p,{type:"info",half:1,text:`Nachspielzeit: ${fmt(otS)}`,id:`ot1-${Date.now()}`}]);setHtH(hS);setHtA(aS);setOtS(0);setWhistled(false);setHalf(2);setTl(hd*60);setModal(null);}
  function confirmFT(){setRun(false);setPau(false);if(otS>0)setEvts(p=>[...p,{type:"info",half:2,text:`Nachspielzeit: ${fmt(otS)}`,id:`ot2-${Date.now()}`}]);setModal(null);setScreen("report");}

  function openAct(t,tm){setMT(tm);setMS(0);setMD({});setModal(t);}
  function selGT(t){setMD({gt:t});setMS(1);}
  function selGP(p){const gt=mD.gt;const own=gt==="Eigentor";if(own){if(mT==="home")setAS(s=>s+1);else setHS(s=>s+1);}else{if(mT==="home")setHS(s=>s+1);else setAS(s=>s+1);}setEvts(x=>[...x,{type:"goal",goalType:gt,half,player:p,team:mT,id:`g-${Date.now()}`,displayTime:getDispMin()}]);setModal(null);}
  function selCT(t){setMD({ct:t});setMS(1);}
  function selCP(p){setEvts(x=>[...x,{type:"card",cardType:mD.ct,half,player:p,team:mT,id:`c-${Date.now()}`,displayTime:getDispMin()}]);setModal(null);}
  function selSO(p){setMD({out:p});setMS(1);}
  function selSI(p){const fn=mT==="home"?setHOn:setAOn;fn(x=>x.filter(id=>id!==mD.out.id).concat(p.id));setEvts(x=>[...x,{type:"sub",half,outPlayer:mD.out,inPlayer:p,team:mT,id:`s-${Date.now()}`,displayTime:getDispMin()}]);setModal(null);}
  function delEv(ev){setEvts(x=>x.filter(e=>e.id!==ev.id));if(ev.type==="goal"){const own=ev.goalType==="Eigentor";if(own){if(ev.team==="home")setAS(s=>Math.max(0,s-1));else setHS(s=>Math.max(0,s-1));}else{if(ev.team==="home")setHS(s=>Math.max(0,s-1));else setAS(s=>Math.max(0,s-1));}}}
  function resetAll(){setHalf(1);setTl(null);setRun(false);setPau(false);setIsOt(false);setOtS(0);setHS(0);setAS(0);setHtH(null);setHtA(null);setEvts([]);setWhistled(false);setStarted(false);setHOn([]);setAOn([]);setNotes("");setPrev("");setModal(null);setScreen("game");}

  const onF=(tm)=>(tm==="home"?hp:ap).filter(p=>(tm==="home"?hOn:aOn).includes(p.id));
  const bnch=(tm)=>(tm==="home"?hp:ap).filter(p=>!(tm==="home"?hOn:aOn).includes(p.id));
  const allP=(tm)=>tm==="home"?hp:ap;

  function buildHTML(){
    const all=evts.filter(e=>e.type!=="info");const h1=all.filter(e=>e.half===1),h2=all.filter(e=>e.half===2);
    const o1=evts.find(e=>e.half===1&&e.type==="info"),o2=evts.find(e=>e.half===2&&e.type==="info");
    const row=ev=>{if(ev.type==="goal")return`<tr><td><b>${ev.displayTime}</b></td><td>⚽ ${ev.goalType!=="Tor"?"("+ev.goalType+") ":""}${ev.player.number} ${ev.player.name}</td><td>${ev.team==="home"?ht:at}</td></tr>`;if(ev.type==="card")return`<tr><td><b>${ev.displayTime}</b></td><td>${ev.cardType==="Gelb"?"🟨":ev.cardType==="Rot"?"🟥":"⏱"} ${ev.cardType} — ${ev.player.number} ${ev.player.name}</td><td>${ev.team==="home"?ht:at}</td></tr>`;if(ev.type==="sub")return`<tr><td><b>${ev.displayTime}</b></td><td>🔄 ${ev.outPlayer.number} ${ev.outPlayer.name} → ${ev.inPlayer.number} ${ev.inPlayer.name}</td><td>${ev.team==="home"?ht:at}</td></tr>`;return"";};
    const pl=(p)=>{let x="";evts.filter(e=>e.type==="goal"&&e.player?.id===p.id).forEach(g=>x+=` ⚽ ${g.displayTime}`);evts.filter(e=>e.type==="card"&&e.player?.id===p.id).forEach(c=>x+=` ${c.cardType==="Gelb"?"🟨":c.cardType==="Rot"?"🟥":"⏱"} ${c.displayTime}`);evts.filter(e=>e.type==="sub"&&e.outPlayer?.id===p.id).forEach(s=>x+=` 🔄↓ ${s.displayTime}`);evts.filter(e=>e.type==="sub"&&e.inPlayer?.id===p.id).forEach(s=>x+=` 🔄↑ ${s.displayTime}`);return`${p.number} ${p.name}${p.isGoalkeeper?" (TW)":""}${p.isCaptain?" (C)":""}${x}`;};
    return`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Spielbericht</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;max-width:700px;margin:20px auto;color:#222;font-size:13px}h1{text-align:center;font-size:22px;margin-bottom:4px}h2{font-size:15px;border-bottom:2px solid #333;padding-bottom:4px;margin-top:24px}h3{font-size:13px;color:#555;margin:12px 0 6px}.sc{text-align:center;font-size:40px;font-weight:900;margin:8px 0}.hz{text-align:center;color:#666;font-size:14px}.tm{display:flex;gap:24px}.t{flex:1}.t ul{list-style:none;padding:0;margin:0}.t li{padding:2px 0;font-size:12px}.t li.s{color:#888}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #ddd}th{background:#f5f5f5;font-weight:700}.n{margin-top:16px;padding:10px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:12px;white-space:pre-wrap}</style></head><body><h1>⚽ Spielbericht</h1><div class="sc">${ht} ${hS} : ${aS} ${at}</div>${htH!==null?`<div class="hz">Halbzeit: ${htH} : ${htA}</div>`:""}<h2>Aufstellung</h2><div class="tm"><div class="t"><strong>${ht}</strong><ul>${hp.filter(p=>p.isStarter).map(p=>`<li>${pl(p)}</li>`).join("")}${hp.filter(p=>!p.isStarter).length?`<li style="color:#999;margin-top:6px;font-weight:700;font-size:11px">Ersatzbank</li>`+hp.filter(p=>!p.isStarter).map(p=>`<li class="s">${pl(p)}</li>`).join(""):""}</ul></div><div class="t"><strong>${at}</strong><ul>${ap.filter(p=>p.isStarter).map(p=>`<li>${pl(p)}</li>`).join("")}${ap.filter(p=>!p.isStarter).length?`<li style="color:#999;margin-top:6px;font-weight:700;font-size:11px">Ersatzbank</li>`+ap.filter(p=>!p.isStarter).map(p=>`<li class="s">${pl(p)}</li>`).join(""):""}</ul></div></div><h2>Spielverlauf</h2><h3>1. Halbzeit${o1?" — "+o1.text:""}</h3>${h1.length?`<table><tr><th style="width:50px">Min.</th><th>Aktion</th><th style="width:140px">Mannschaft</th></tr>${h1.map(row).join("")}</table>`:"<p style='color:#888'>Keine Aktionen</p>"}<h3>2. Halbzeit${o2?" — "+o2.text:""}</h3>${h2.length?`<table><tr><th style="width:50px">Min.</th><th>Aktion</th><th style="width:140px">Mannschaft</th></tr>${h2.map(row).join("")}</table>`:"<p style='color:#888'>Keine Aktionen</p>"}${notes?`<h2>Bemerkungen</h2><div class="n">${notes.replace(/</g,"&lt;")}</div>`:""}<div style="margin-top:30px;text-align:center;color:#bbb;font-size:10px">Erstellt mit Matchreport App</div></body></html>`;
  }

  /* ═══ SETTINGS ═══ */
  if(screen==="settings"){return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"16px 16px 100px"}}>
        <div style={{textAlign:"center",padding:"20px 0 24px"}}><div style={{fontSize:28,fontWeight:800,color:C.grn}}>⚽ Matchreport</div><div style={{color:C.txd,fontSize:13,marginTop:4}}>Spieleinstellungen</div></div>

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
          <div style={{marginBottom:12}}><label style={{fontSize:12,color:C.txd,display:"block",marginBottom:4}}>Heimmannschaft</label><input value={ht} onChange={e=>setHt(e.target.value)} placeholder="z.B. JSG Prümer Land" style={inp}/></div>
          <div><label style={{fontSize:12,color:C.txd,display:"block",marginBottom:4}}>Gastmannschaft</label><input value={at} onChange={e=>setAt(e.target.value)} placeholder="z.B. JSG Pronsfeld" style={inp}/></div>
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
            {["Startaufstellung","Ersatzbank"].map(cat=>{const isSt=cat==="Startaufstellung";const f=pl.filter(p=>p.isStarter===isSt);if(!f.length)return null;return(
              <div key={cat} style={{marginBottom:8}}>
                <div style={{fontSize:11,color:isSt?C.grn:C.org,fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>{cat}</div>
                {f.map(p=>(
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
        <div style={{display:"flex",gap:8,marginBottom:12}}><input value={addNum} onChange={e=>setAddNum(e.target.value)} placeholder="Nr." type="number" style={{...inp,width:70,textAlign:"center"}}/><input value={addName} onChange={e=>setAddName(e.target.value)} placeholder="Nachname, Vorname" style={{...inp,flex:1}}/></div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>{[{s:true,l:"Starter",c:C.grn},{s:false,l:"Ersatz",c:C.org}].map(({s,l,c})=>(<button key={l} onClick={()=>setAddSt(s)} style={{flex:1,padding:8,borderRadius:8,cursor:"pointer",background:addSt===s?c:C.card2,color:"#fff",border:`1px solid ${addSt===s?c:C.bdr}`,fontWeight:600,fontSize:13}}>{l}</button>))}</div>
        <Btn full disabled={!addNum||!addName} onClick={()=>{const p={number:addNum,name:addName,isGoalkeeper:false,isCaptain:false,isStarter:addSt,id:`${addTeam}-${addNum}-${Date.now()}`};if(addTeam==="home")setHp(x=>[...x,p]);else setAp(x=>[...x,p]);setAddNum("");setAddName("");}}><Plus size={16}/> Hinzufügen</Btn>
      </Modal>}

      {showPaste&&<Modal title="CSV einfügen" onClose={()=>{setShowPaste(false);setPasteText("");}}>
        <p style={{fontSize:12,color:C.txd,margin:"0 0 12px"}}>CSV-Inhalt hier einfügen:</p>
        <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder="Semikolon-getrennte Daten..." style={{...inp,minHeight:120,resize:"vertical",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}/>
        <div style={{marginTop:12}}><Btn full disabled={!pasteText.trim()} onClick={()=>{if(applyCSV(pasteText)){setShowPaste(false);setPasteText("");}}}><Check size={16}/> Importieren</Btn></div>
      </Modal>}
    </div>
  );}

  /* ═══ GAME ═══ */
  if(screen==="game"){return(
    <div style={{background:C.bg,height:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:"0 0 auto",padding:"12px 16px",textAlign:"center",background:`linear-gradient(180deg,${C.card} 0%,${C.bg} 100%)`,borderBottom:`1px solid ${C.bdr}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <button onClick={()=>setScreen("settings")} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Settings size={15}/> Einstellungen</button>
          <div style={{fontSize:12,fontWeight:700,color:half===1?C.grn:C.blu,background:half===1?`${C.grn}20`:`${C.blu}20`,padding:"4px 12px",borderRadius:20}}>{half}. Halbzeit</div>
          <button onClick={()=>setScreen("report")} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}><FileText size={15}/> Bericht</button>
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
          {[...evts].filter(e=>e.type!=="info").reverse().slice(0,5).map(ev=>(<div key={ev.id} style={{fontSize:12,padding:"3px 0",display:"flex",gap:8,alignItems:"center"}}><span style={{color:C.txd,fontFamily:"'JetBrains Mono',monospace",fontSize:11,minWidth:36}}>{ev.displayTime}</span><span>{ev.type==="goal"&&<span>⚽ {ev.goalType!=="Tor"&&`(${ev.goalType}) `}{ev.player.number} {ev.player.name}</span>}{ev.type==="card"&&<span>{ev.cardType==="Gelb"?"🟨":ev.cardType==="Rot"?"🟥":"⏱️"} {ev.player.number} {ev.player.name}</span>}{ev.type==="sub"&&<span>🔄 {ev.outPlayer.number} ↔ {ev.inPlayer.number}</span>}<span style={{color:C.txd}}> — {ev.team==="home"?ht:at}</span></span></div>))}
        </div>}
      </div>

      {modal==="goal"&&<Modal title={`Tor — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:8}}><Btn full color={C.grn} onClick={()=>selGT("Tor")}>⚽ Tor</Btn><Btn full color={C.yel} onClick={()=>selGT("Elfmeter")}>⚽ Elfmeter</Btn><Btn full color={C.red} onClick={()=>selGT("Eigentor")}>⚽ Eigentor</Btn></div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Torschütze ({mD.gt})</div>{allP(mT).map(p=><PBtn key={p.id} p={p} onClick={selGP}/>)}</div>}</Modal>}
      {modal==="card"&&<Modal title={`Karte — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:8}}><Btn full color={C.yel} onClick={()=>selCT("Gelb")}>🟨 Gelb</Btn><Btn full color={C.red} onClick={()=>selCT("Rot")}>🟥 Rot</Btn><Btn full color={C.org} onClick={()=>selCT("Zeitstrafe")}>⏱️ Zeitstrafe</Btn></div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Spieler ({mD.ct})</div>{allP(mT).map(p=><PBtn key={p.id} p={p} onClick={selCP}/>)}</div>}</Modal>}
      {modal==="sub"&&<Modal title={`Wechsel — ${mT==="home"?ht:at}`} onClose={()=>setModal(null)}>{mS===0?<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Auswechslung (raus)</div>{onF(mT).map(p=><PBtn key={p.id} p={p} onClick={selSO}/>)}</div>:<div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{color:C.txd,fontSize:13,marginBottom:4}}>Einwechslung für #{mD.out?.number}</div>{bnch(mT).map(p=><PBtn key={p.id} p={p} onClick={selSI}/>)}</div>}</Modal>}
      {modal==="ht"&&<Modal title="Halbzeit beenden?" onClose={()=>setModal(null)}><p style={{color:C.txd,fontSize:14,margin:"0 0 16px"}}>2. Halbzeit starten?</p><div style={{display:"flex",gap:10}}><Btn full color={C.txd} onClick={()=>setModal(null)}>Abbrechen</Btn><Btn full color={C.grn} onClick={confirmHT}><Check size={16}/> Bestätigen</Btn></div></Modal>}
      {modal==="ft"&&<Modal title="Spiel beenden?" onClose={()=>setModal(null)}><p style={{color:C.txd,fontSize:14,margin:"0 0 16px"}}>Endstand: {hS} : {aS}</p><div style={{display:"flex",gap:10}}><Btn full color={C.txd} onClick={()=>setModal(null)}>Abbrechen</Btn><Btn full color={C.grn} onClick={confirmFT}><Check size={16}/> Spielbericht</Btn></div></Modal>}
    </div>
  );}

  /* ═══ REPORT ═══ */
  if(screen==="report"){
    const hg=evts.filter(e=>e.type==="goal"&&((e.team==="home"&&e.goalType!=="Eigentor")||(e.team==="away"&&e.goalType==="Eigentor")));
    const ag=evts.filter(e=>e.type==="goal"&&((e.team==="away"&&e.goalType!=="Eigentor")||(e.team==="home"&&e.goalType==="Eigentor")));
    const hc=evts.filter(e=>e.type==="card"&&e.team==="home");
    const ac=evts.filter(e=>e.type==="card"&&e.team==="away");
    const hz1=evts.filter(e=>e.half===1&&e.type!=="info"),hz2=evts.filter(e=>e.half===2&&e.type!=="info");
    const o1=evts.find(e=>e.half===1&&e.type==="info"),o2=evts.find(e=>e.half===2&&e.type==="info");

    const evRow=(ev)=>(<div key={ev.id} style={{fontSize:13,padding:"6px 0",display:"flex",gap:8,alignItems:"center",borderBottom:`1px solid ${C.bdr}30`}}>
      <span style={{color:ev.half===1?C.grn:C.blu,fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,minWidth:44}}>{ev.displayTime}</span>
      <span style={{flex:1}}>{ev.type==="goal"&&<span>⚽ {ev.goalType!=="Tor"&&<span style={{color:C.yel}}>({ev.goalType}) </span>}{ev.player.number} {ev.player.name} <span style={{color:C.txd}}>— {ev.team==="home"?ht:at}</span></span>}{ev.type==="card"&&<span>{ev.cardType==="Gelb"?"🟨":ev.cardType==="Rot"?"🟥":"⏱️"} {ev.cardType} — {ev.player.number} {ev.player.name} <span style={{color:C.txd}}>— {ev.team==="home"?ht:at}</span></span>}{ev.type==="sub"&&<span>🔄 {ev.outPlayer.number} {ev.outPlayer.name} → {ev.inPlayer.number} {ev.inPlayer.name} <span style={{color:C.txd}}>— {ev.team==="home"?ht:at}</span></span>}</span>
      <button onClick={()=>delEv(ev)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",padding:4,opacity:0.6,flexShrink:0}}><Trash2 size={14}/></button>
    </div>);

    return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{padding:"16px 16px 100px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={()=>setScreen("game")} style={{background:"none",border:"none",color:C.txd,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontSize:13}}><ChevronLeft size={18}/> Zurück</button>
          <span style={{fontSize:13,fontWeight:700,color:C.grn}}>Spielbericht</span>
        </div>

        <div style={{background:C.card,borderRadius:16,padding:20,marginBottom:16,border:`1px solid ${C.bdr}`,textAlign:"center"}}>
          <div style={{fontSize:12,color:C.txd,marginBottom:12,textTransform:"uppercase",fontWeight:600}}>Endergebnis</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20}}>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{ht}</div><div style={{fontSize:44,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{hS}</div></div>
            <div style={{fontSize:28,color:C.txd}}>:</div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{at}</div><div style={{fontSize:44,fontWeight:900,fontFamily:"'JetBrains Mono',monospace"}}>{aS}</div></div>
          </div>
          {htH!==null&&<div style={{fontSize:14,color:C.txd,marginTop:8,fontFamily:"'JetBrains Mono',monospace"}}>Halbzeit: {htH} : {htA}</div>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[{t:"home",l:ht,pl:hp,gs:hg,cs:hc},{t:"away",l:at,pl:ap,gs:ag,cs:ac}].map(({t,l,pl,gs,cs})=>(<div key={t} style={{background:C.card,borderRadius:14,padding:14,border:`1px solid ${C.bdr}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.grn,marginBottom:8,textTransform:"uppercase"}}>{l}</div>
            {pl.filter(p=>p.isStarter).map(p=>{const pg=gs.filter(x=>x.player?.id===p.id),pk=cs.filter(x=>x.player?.id===p.id),pso=evts.filter(x=>x.type==="sub"&&x.outPlayer?.id===p.id),psi=evts.filter(x=>x.type==="sub"&&x.inPlayer?.id===p.id);return(<div key={p.id} style={{fontSize:12,padding:"2px 0",display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}><span style={{fontFamily:"'JetBrains Mono',monospace",color:C.grn,fontWeight:700,minWidth:20}}>{p.number}</span><span>{p.name}</span>{p.isGoalkeeper&&<span style={{color:C.yel,fontSize:10}}>TW</span>}{p.isCaptain&&<span style={{color:C.blu,fontSize:10}}>C</span>}{pg.map((x,i)=><span key={`g${i}`} style={{fontSize:11}}>⚽<span style={{color:C.txd,fontSize:10}}>{x.displayTime}</span></span>)}{pk.map((x,i)=><span key={`c${i}`} style={{fontSize:11}}>{x.cardType==="Gelb"?"🟨":x.cardType==="Rot"?"🟥":"⏱️"}<span style={{color:C.txd,fontSize:10}}>{x.displayTime}</span></span>)}{pso.map((x,i)=><span key={`so${i}`} style={{fontSize:11,color:C.red}}>🔄↓<span style={{color:C.txd,fontSize:10}}>{x.displayTime}</span></span>)}{psi.map((x,i)=><span key={`si${i}`} style={{fontSize:11,color:C.grn}}>🔄↑<span style={{color:C.txd,fontSize:10}}>{x.displayTime}</span></span>)}</div>);})}
            {pl.filter(p=>!p.isStarter).length>0&&<div><div style={{fontSize:10,color:C.txd,marginTop:6,marginBottom:2,fontWeight:600}}>Ersatz</div>{pl.filter(p=>!p.isStarter).map(p=>{const pg=gs.filter(x=>x.player?.id===p.id),pk=cs.filter(x=>x.player?.id===p.id),pso=evts.filter(x=>x.type==="sub"&&x.outPlayer?.id===p.id),psi=evts.filter(x=>x.type==="sub"&&x.inPlayer?.id===p.id);return(<div key={p.id} style={{fontSize:12,padding:"2px 0",display:"flex",alignItems:"center",gap:4,color:C.txd,flexWrap:"wrap"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,minWidth:20}}>{p.number}</span><span>{p.name}</span>{pg.map((x,i)=><span key={`g${i}`} style={{fontSize:11}}>⚽<span style={{fontSize:10}}>{x.displayTime}</span></span>)}{pk.map((x,i)=><span key={`c${i}`} style={{fontSize:11}}>{x.cardType==="Gelb"?"🟨":x.cardType==="Rot"?"🟥":"⏱️"}<span style={{fontSize:10}}>{x.displayTime}</span></span>)}{psi.map((x,i)=><span key={`si${i}`} style={{fontSize:11,color:C.grn}}>🔄↑<span style={{fontSize:10}}>{x.displayTime}</span></span>)}{pso.map((x,i)=><span key={`so${i}`} style={{fontSize:11,color:C.red}}>🔄↓<span style={{fontSize:10}}>{x.displayTime}</span></span>)}</div>);})}</div>}
          </div>))}
        </div>

        <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.txd,marginBottom:12,textTransform:"uppercase"}}>Spielverlauf <span style={{fontSize:10,fontWeight:400}}>(🗑 = löschen)</span></div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:C.grn,marginBottom:8,borderBottom:`1px solid ${C.bdr}`,paddingBottom:4}}>1. Halbzeit{o1&&<span style={{fontWeight:400,color:C.txd,marginLeft:8}}>{o1.text}</span>}</div>
            {hz1.length===0?<div style={{fontSize:13,color:C.txd}}>Keine Aktionen</div>:hz1.map(evRow)}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:C.blu,marginBottom:8,borderBottom:`1px solid ${C.bdr}`,paddingBottom:4}}>2. Halbzeit{o2&&<span style={{fontWeight:400,color:C.txd,marginLeft:8}}>{o2.text}</span>}</div>
            {hz2.length===0?<div style={{fontSize:13,color:C.txd}}>Keine Aktionen</div>:hz2.map(evRow)}
          </div>
        </div>

        <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:16,border:`1px solid ${C.bdr}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.txd,marginBottom:8,textTransform:"uppercase"}}>Bemerkungen</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Besondere Vorkommnisse..." style={{...inp,minHeight:80,resize:"vertical",fontSize:13}}/>
        </div>

        <div style={{display:"flex",gap:10,marginBottom:10}}>
          <Btn full color={C.blu} onClick={()=>setPrev(buildHTML())}><Eye size={15}/> Vorschau</Btn>
          <Btn full color={C.grn} onClick={()=>{const h=buildHTML();navigator.clipboard?.writeText(h).then(()=>{flash("copied");}).catch(()=>setPrev(h));}}><ClipboardCopy size={15}/> HTML kopieren</Btn>
        </div>
        <Btn full color={C.red} onClick={()=>setModal("reset")}><RotateCcw size={15}/> Reset</Btn>

        {msg==="copied"&&<div style={{marginTop:10,padding:"8px 12px",background:`${C.grn}20`,borderRadius:8,fontSize:13,color:C.grn,textAlign:"center"}}>✅ HTML kopiert! → Texteditor → .html speichern → Browser → Drucken als PDF</div>}

        {prev&&<div style={{marginTop:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:13,fontWeight:700,color:C.grn}}>📄 Druckvorschau</span><button onClick={()=>setPrev("")} style={{background:"none",border:"none",color:C.txd,cursor:"pointer"}}><X size={18}/></button></div>
          <div style={{background:"#fff",borderRadius:10,padding:16,border:`1px solid ${C.bdr}`,maxHeight:500,overflowY:"auto"}} dangerouslySetInnerHTML={{__html:prev.replace(/<!DOCTYPE.*?<body>/s,"").replace(/<\/body>.*$/s,"")}}/>
        </div>}
      </div>

      {modal==="reset"&&<Modal title="Spiel zurücksetzen?" onClose={()=>setModal(null)}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:12,background:`${C.red}15`,borderRadius:10}}><AlertTriangle size={20} color={C.red}/><p style={{color:C.tx,fontSize:14,margin:0}}>Timer und Aktionen werden zurückgesetzt. Aufstellung bleibt.</p></div>
        <div style={{display:"flex",gap:10}}><Btn full color={C.txd} onClick={()=>setModal(null)}>Abbrechen</Btn><Btn full color={C.red} onClick={resetAll}><RotateCcw size={16}/> Zurücksetzen</Btn></div>
      </Modal>}
    </div>);
  }
  return null;
}
