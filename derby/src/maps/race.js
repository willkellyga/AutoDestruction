// Scrapyard Speedway: a race round a walled circuit, guns on. (A placeholder yard until the track is built.)
import { openStub } from './common.js';

export default openStub({
  id: 'race', name: 'Speedway', mode: 'race',
  blurb: 'A race round a circuit with the guns on. Finish first, and wreck whoever gets in front.',
  loading: ['Building the speedway', 'Laying the track and the barriers'],
});
