// The ways to play, by the name a map gives in its `mode`.
import { makeWaves } from './waves.js';
import { makeRace } from './race.js';
import { makeSurvival } from './survival.js';
import { makeBrawl } from './brawl.js';

export const MODES = { waves: makeWaves, race: makeRace, survival: makeSurvival, brawl: makeBrawl };
