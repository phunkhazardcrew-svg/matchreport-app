import { WebPlugin } from '@capacitor/core';
import type { RingtonesPlugin } from './definitions';

export class RingtonesWeb extends WebPlugin implements RingtonesPlugin {
  async list(): Promise<{ ringtones: { title: string; uri: string }[] }> {
    // Web fallback: return empty list, sounds handled via Web Audio API
    return { ringtones: [] };
  }
  async play(): Promise<void> {
    // Web fallback: generate tone
    try {
      const ctx = new AudioContext();
      const g = ctx.createGain(); g.connect(ctx.destination); g.gain.value = 0.3;
      const o = ctx.createOscillator(); o.connect(g); o.frequency.value = 800; o.start();
      setTimeout(() => o.stop(), 500);
    } catch (_) {}
  }
  async stop(): Promise<void> {}
  async scheduleAlarm(): Promise<void> {}
  async cancelAlarm(): Promise<void> {}
  async startGame(): Promise<void> {}
  async stopGame(): Promise<void> {}
  async playLoud(): Promise<void> { /* Web fallback: just play loud via AudioContext */ try{const c=new AudioContext();const g=c.createGain();g.connect(c.destination);g.gain.value=1.0;const o=c.createOscillator();o.connect(g);o.frequency.value=3200;o.start();setTimeout(()=>o.stop(),800);}catch(_){} }
  async pick(): Promise<{ uri: string | null; cancelled: boolean }> {
    return { uri: null, cancelled: true };
  }
  async getDefault(): Promise<{ uri: string | null }> {
    return { uri: null };
  }
}
