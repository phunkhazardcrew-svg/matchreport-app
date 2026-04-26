import { registerPlugin } from '@capacitor/core';
import type { RingtonesPlugin } from './definitions';

const Ringtones = registerPlugin<RingtonesPlugin>('Ringtones', {
  web: () => import('./web').then(m => new m.RingtonesWeb()),
});

export * from './definitions';
export { Ringtones };
