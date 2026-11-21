// Last one standing: every car for itself while the dead close in. (Runs as waves until the rules are written.)
import { makeWaves } from './waves.js';

export function makeSurvival(G) {
  return { ...makeWaves(G), go: 'Survive', note: 'Every car for itself, and the dead are coming. Be the last car running.' };
}
