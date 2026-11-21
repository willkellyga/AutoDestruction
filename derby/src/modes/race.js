// The race: laps of the map's circuit with the guns on. (Runs as waves until the race rules are written.)
import { makeWaves } from './waves.js';

export function makeRace(G) {
  return { ...makeWaves(G), go: 'Start the race', note: 'Race round the circuit with the guns on. Finish first.' };
}
