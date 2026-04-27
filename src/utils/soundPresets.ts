// Built-in sound presets using Web Audio API
export interface SoundPreset {
  id: string;
  name: string;
  category: string;
  play: () => void;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3) {
  try {
    const ctx = new AudioContext();
    const g = ctx.createGain(); g.connect(ctx.destination); g.gain.value = vol;
    const o = ctx.createOscillator(); o.connect(g); o.frequency.value = freq; o.type = type;
    o.start(); setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); }, dur - 100);
    setTimeout(() => o.stop(), dur);
  } catch (_) {}
}

function multiTone(notes: [number, number, number][], type: OscillatorType = 'sine', vol = 0.3) {
  notes.forEach(([freq, start, dur]) => setTimeout(() => tone(freq, dur, type, vol), start));
}

export const PRESETS: SoundPreset[] = [
  // GOAL sounds
  { id: 'goal-fanfare', name: 'Fanfare', category: 'goal', play: () => multiTone([[523,0,200],[659,150,200],[784,300,200],[1047,450,400]]) },
  { id: 'goal-horn', name: 'Stadionhorn', category: 'goal', play: () => { tone(220, 800, 'sawtooth', 0.2); tone(330, 800, 'sawtooth', 0.15); } },
  { id: 'goal-chime', name: 'Glockenspiel', category: 'goal', play: () => multiTone([[880,0,300],[1109,100,300],[1319,200,500]]) },
  { id: 'goal-whistle', name: 'Trillerpfeife kurz', category: 'goal', play: () => tone(3200, 400, 'sine', 0.25) },

  // EIGENTOR sounds
  { id: 'eigen-sad', name: 'Traurig', category: 'eigentor', play: () => multiTone([[440,0,300],[349,300,300],[294,600,500]]) },
  { id: 'eigen-buzz', name: 'Buzzer', category: 'eigentor', play: () => tone(150, 600, 'square', 0.15) },

  // ELFMETER sounds
  { id: 'elf-drum', name: 'Trommelwirbel', category: 'elfmeter', play: () => { for(let i=0;i<8;i++) setTimeout(()=>tone(200,80,'triangle',0.2), i*80); } },
  { id: 'elf-tension', name: 'Spannung', category: 'elfmeter', play: () => multiTone([[330,0,200],[349,200,200],[370,400,200],[392,600,400]]) },

  // CARD sounds
  { id: 'card-short', name: 'Kurzer Pfiff', category: 'yellow', play: () => tone(2000, 250, 'sine', 0.2) },
  { id: 'card-double', name: 'Doppelpfiff', category: 'yellow', play: () => { tone(2500,200); setTimeout(()=>tone(2500,200),300); } },
  { id: 'card-harsh', name: 'Scharfer Ton', category: 'red', play: () => tone(1500, 500, 'sawtooth', 0.15) },
  { id: 'card-alarm', name: 'Alarm', category: 'red', play: () => { tone(800,200,'square',0.15); setTimeout(()=>tone(600,200,'square',0.15),250); setTimeout(()=>tone(800,200,'square',0.15),500); } },

  // SUB sounds
  { id: 'sub-bell', name: 'Glocke', category: 'sub', play: () => tone(1047, 400, 'sine', 0.2) },
  { id: 'sub-click', name: 'Klick', category: 'sub', play: () => tone(600, 100, 'triangle', 0.25) },

  // HALFTIME sounds
  { id: 'ht-whistle', name: 'Schlusspfiff lang', category: 'halftime', play: () => { tone(3200,300); setTimeout(()=>tone(3200,300),400); setTimeout(()=>tone(3200,600),800); } },
  { id: 'ht-horn', name: 'Horn', category: 'halftime', play: () => tone(440, 1000, 'sawtooth', 0.2) },

  // FULLTIME sounds
  { id: 'ft-triple', name: 'Dreifachpfiff', category: 'fulltime', play: () => { tone(3200,200); setTimeout(()=>tone(3200,200),300); setTimeout(()=>tone(3600,200),500); setTimeout(()=>tone(3200,200),700); setTimeout(()=>tone(3600,400),900); } },
  { id: 'ft-siren', name: 'Sirene', category: 'fulltime', play: () => { try{const ctx=new AudioContext();const g=ctx.createGain();g.connect(ctx.destination);g.gain.value=0.2;const o=ctx.createOscillator();o.connect(g);o.type='sine';o.frequency.setValueAtTime(400,ctx.currentTime);o.frequency.linearRampToValueAtTime(800,ctx.currentTime+0.5);o.frequency.linearRampToValueAtTime(400,ctx.currentTime+1);o.start();setTimeout(()=>o.stop(),1200);}catch(_){} } },
];

export function getPresetsForCategory(cat: string): SoundPreset[] {
  return PRESETS.filter(p => p.category === cat);
}

export function playPresetById(id: string) {
  const p = PRESETS.find(x => x.id === id);
  if (p) p.play();
}
