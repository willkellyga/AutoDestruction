// Leaving the page. Every online round, map change and trip home loads the page again, and on iOS the old page was not
// let go before the new one started building its world: two cities' worth of memory at once, and iOS stops the page
// (Monster Mayhem saw the heap climb to 3 GB across loads on a Mac, and iPads reload themselves 4 to 7 s into a city).
// So on the way out the page stops its frame loop, its meshing worker and its clocks, and gives back its drawing
// contexts and its sound, before the next page begins (Monster Mayhem's leavePage, src/main.js).
// The game's own ways out call leavePage() just before they navigate; pagehide covers the rest (closing, the back button).
const jobs = [];
let left = false;
export const leaving = () => left;
export function onLeave(f) { jobs.push(f); }
export function leavePage() {
  if (left) return; left = true;
  for (const f of jobs) { try { f(); } catch (e) { /* gone already */ } }
}
addEventListener('pagehide', leavePage);
// come back to with the back button (kept in the browser's page cache): it was taken apart on the way out, so start it again
addEventListener('pageshow', (e) => { if (e.persisted && left) location.reload(); });
