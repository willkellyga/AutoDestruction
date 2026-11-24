// Lobby and relay test for derby/server (no browser): starts the server and plays the lobby messages through.
//   node derby/server/test.mjs
// One-tap quick play per mode (go at once, players added during the countdown, a computer hosts, begin when it is out),
// the race taking nobody once it has started, seat hold and rejoin (the key, the hold, the hand-over, the bots and scores
// kept), a late player taking a bot's seat in the arena, the server's clock, a lobby hello with no room, friends' rooms
// (code, the host picks the mode, start, a wrong code), a round's messages passed on, and the event log.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 19000 + Math.floor(Math.random() * 1000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-reports-'));
const srv = spawn(process.execPath, [path.join(here, 'server.mjs')], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, AD_WAIT: '1500', AD_LOAD: '1500', AD_HOLD: '1500', AD_HANDOVER: '1000', AD_AWAY: '600', AD_LATE: '3000' }, stdio: ['ignore', 'pipe', 'inherit'] });
let srvLog = ''; srv.stdout.on('data', (d) => { srvLog += d; if (process.env.V) process.stdout.write(d); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, what) => { console.log((c ? '  ok    ' : '  FAIL  ') + what); if (!c) fails++; };
class Client {
  constructor(id, name, where = 'lobby', extra = {}) {
    this.id = id; this.msgs = []; this.ws = new WebSocket('ws://localhost:' + PORT + '/ws');
    this.ready = new Promise((r) => { this.ws.onopen = () => { this.send({ t: 'hello', where, id, name, ...extra }); r(); }; });
    this.ws.onmessage = (e) => this.msgs.push(JSON.parse(e.data));
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  last(t) { for (let i = this.msgs.length - 1; i >= 0; i--) if (this.msgs[i].t === t) return this.msgs[i]; return null; }
  async until(t, ms = 3000, test = () => true) { const end = Date.now() + ms; for (;;) { const m = this.msgs.find((x) => x.t === t && test(x)); if (m) return m; if (Date.now() > end) return null; await wait(30); } }
  close() { this.ws.close(); }
}
try {
  for (let i = 0; i < 50 && !srvLog.includes('running'); i++) await wait(100);
  console.log('Device reports');
  const base = 'http://localhost:' + PORT;
  const post = (d) => fetch(base + '/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
  ok((await post({ id: 'ipad1', device: 'iPad', fps: 41, crashed: 1 })).status === 204, 'a report is taken');
  await post({ id: 'ipad1', device: 'iPad', fps: 44 }); await post('not a report'); await wait(200);
  const list = await (await fetch(base + '/reports')).json();
  ok(list.length === 1 && list[0].fps === 44 && list[0].crashes === 1, 'the host sees the last report and one crash');
  // (written through the same thread pool as the server's start-up Brotli of the page, so it can land a few seconds late)
  let lines = [];
  for (let i = 0; i < 150 && lines.length < 2; i++) { await wait(100); try { lines = fs.readFileSync(path.join(DATA, 'reports.jsonl'), 'utf8').trim().split('\n').filter(Boolean); } catch (e) { /* not yet */ } }
  ok(lines.length === 2, 'both reports are kept in reports.jsonl (' + lines.length + ')');
  ok((await fetch(base + '/host')).status === 200, 'the host page opens at home (no HOST_KEY)');
  console.log('Quick play, one tap');
  // (short waits: AD_WAIT etc. below)
  const a = [1, 2].map((i) => new Client('r' + i, 'Racer' + i, 'lobby', { key: 'k' + i, room: 'quick:race', touch: i === 1 }));
  await a[0].ready; const go1 = await a[0].until('go', 1000);
  ok(go1 && go1.map === 'race' && go1.bots === 5 && go1.host === 'r1', 'the first racer is sent go at once, with 5 bots for now');
  await a[1].ready; const go2 = await a[1].until('go', 1000);
  ok(go2 && go2.round === go1.round && go2.bots === 4, 'the second racer gets go for the same round (4 bots now)');
  const z = new Client('z1', 'Zed', 'lobby', { room: 'quick:base' }); await z.ready;
  const zgo = await z.until('go', 1000);
  ok(zgo && zgo.round !== go1.round && zgo.map === 'base', 'zombie survival is a round of its own');
  const g = a.map((c) => new Client(c.id, c.id, 'game', { key: 'k' + c.id.slice(1), round: go1.round, fresh: true }));
  await Promise.all(g.map((c) => c.ready));
  const w = await g[0].until('welcome');
  ok(w && w.players.length === 2 && w.players[0].slot === 0 && w.map === 'race' && w.startIn > 0, 'welcome lists the players and their seats, and when it starts');
  ok(w && w.host === 'r2', 'a computer that came second hosts before the phone that came first');
  g.forEach((c) => c.send({ t: 'ready' }));
  ok(!(await g[0].until('begin', 300)), 'everyone loaded, but the countdown is not out: no begin yet');
  const b1 = await g[1].until('begin', 4000);
  ok(b1 && b1.bots === 4 && b1.players.length === 2 && b1.host === 'r2', 'the countdown is out: begin, with the players, the host and the bots');
  const late = new Client('r3', 'Late', 'lobby', { room: 'quick:race' }); await late.ready;
  const lgo = await late.until('go', 1000);
  ok(lgo && lgo.round !== go1.round, 'a race that has started takes nobody else (no taking over bots mid-race)');
  late.close();
  g[0].send({ t: 's', c: [['r1.0', 1, 2]] });
  const s = await g[1].until('s');
  ok(s && s.from === 'r1' && s.c[0][0] === 'r1.0', 'a state is passed on with who sent it');
  g[0].send({ t: 'need', id: 'r2.0', to: 'r2' });
  ok(!!(await g[1].until('need')) && !(await g[0].until('need', 300, (m) => m.from !== 'r1')), 'a message with `to` goes to that player only');

  console.log('Seat hold and rejoin');
  const thief = new Client('r1', 'Thief', 'game', { key: 'nope', round: go1.round });
  await thief.ready; await wait(200);
  ok(thief.ws.readyState >= 2 && !thief.last('welcome'), 'a hello with the right id but the wrong key is refused');
  g[1].send({ t: 's', c: [], k: { mine: 3 }, b: [{ seat: 'b:Rusty', name: 'Rusty', x: 10, z: 20, yaw: 1, hp: 50 }] });
  await wait(150);
  g[1].close(); await wait(200);
  ok(!!(await g[0].until('left', 1000, (m) => m.id === 'r2' && !m.quit)), 'the host dropped: the others are told, and its seat is held');
  ok(!(await g[0].until('host', 300, (m) => m.now === 'r1')), '...the bots wait for it (no hand-over yet)');
  const back = new Client('r2', 'r2', 'game', { key: 'k2', round: go1.round, fresh: true }); await back.ready;
  const bw = await back.until('welcome', 1000);
  ok(bw && bw.back && bw.back.r2.mine === 3, 'the host reloaded: back in its seat, with the scores as the server last had them');
  ok(!!(await g[0].until('host', 500, (m) => m.now === 'r1')), '...it lost its bots in the reload, so the next player takes them at once');
  back.close(); await wait(100);
  g[0].send({ t: 'away', on: true }); await wait(100);
  g[0].close(); await wait(300);
  const again = new Client('r1', 'r1', 'game', { key: 'k1', round: go1.round, fresh: true }); await again.ready;
  ok(!!(await again.until('welcome', 1000)), 'with nobody on, the round waits AD_HOLD for someone to come back');
  again.close(); await wait(2200);
  const gone = new Client('r1', 'r1', 'game', { key: 'k1', round: go1.round }); await gone.ready;
  ok(!!(await gone.until('noround', 1000)), '...and is let go after it');
  gone.close();

  console.log('Late into a bot seat, the clock, the way home');
  const p1 = new Client('a1', 'Ann', 'lobby', { key: 'ka', room: 'quick:arena' }); await p1.ready;
  const ago = await p1.until('go', 1000);
  const pg = new Client('a1', 'Ann', 'game', { key: 'ka', round: ago.round, fresh: true }); await pg.ready; await pg.until('welcome');
  pg.send({ t: 'ready', len: 180 });
  const ab = await pg.until('begin', 4000);
  ok(ab && ab.bots === 7 && ab.left > 179000, 'the arena starts on its own with 7 bots, and the server keeps its 3-minute clock');
  pg.send({ t: 's', c: [], k: { rows: [['Ann', 2, 0]] }, b: [{ seat: 'b:Rusty', name: 'Rusty', x: 1, z: 2, yaw: 0, hp: 0, dead: true }] }); await wait(100);
  pg.close(); await wait(150);
  const pg2 = new Client('a1', 'Ann', 'game', { key: 'ka', round: ago.round, fresh: true }); await pg2.ready;
  const rw = await pg2.until('welcome', 1000);
  ok(rw && rw.host === 'a1' && rw.botList && rw.botList[0].seat === 'b:Rusty' && rw.back && rw.back.a1.rows[0][1] === 2, 'a host alone reloads mid-round: its seat, its scores and the bots as they were');
  pg2.close(); await wait(100);
  const p2 = new Client('a2', 'Bob', 'lobby', { key: 'kb', room: 'quick:arena' }); await p2.ready;
  const early = await p2.until('go', 500);
  ok(early && early.round !== ago.round, 'no bot seat to take before the host has said where its bots are: a new round');
  const pg3 = new Client('a1', 'Ann', 'game', { key: 'ka', round: ago.round }); await pg3.ready; await pg3.until('welcome');
  pg3.send({ t: 's', c: [], b: [{ seat: 'b:Rusty', name: 'Rusty', x: 1, z: 2, yaw: 0, hp: 9, dead: true }, { seat: 'b:Vex', name: 'Vex', x: 40, z: 50, yaw: 2, hp: 30 }] });
  await wait(100);
  const p3 = new Client('a3', 'Cy', 'lobby', { key: 'kc', room: 'quick:arena' }); await p3.ready;
  const lgo3 = await p3.until('go', 1000);
  ok(lgo3 && lgo3.round === ago.round, 'a player who comes in the first 30 s goes into the running arena round');
  const seat = await pg3.until('seat', 1000);
  ok(seat && seat.bot === 'b:Vex' && seat.id === 'a3' && seat.bots === 6, '...taking the seat of a bot still in it (not the wrecked one)');
  const lg = new Client('a3', 'Cy', 'game', { key: 'kc', round: ago.round, fresh: true }); await lg.ready;
  const lw = await lg.until('welcome');
  ok(lw && lw.begun >= 0 && lw.spawn && lw.spawn.x === 40 && lw.left > 170000, '...and starts where the bot was, on the server clock');
  const home = new Client('a3', 'Cy', 'lobby', { key: 'kc' }); await home.ready;
  ok(!!(await home.until('hub', 1000)), 'a lobby hello with no room is the menu (not pulled back into the room)');
  [p1, p2, p3, pg3, lg, home].forEach((c) => c.close());
  console.log("Friends' rooms");
  const f1 = new Client('f1', 'Will', 'lobby', { room: 'new:arena' }); await f1.ready; await wait(200);
  const code = f1.last('lobby') && f1.last('lobby').room.code;
  ok(/^[A-Z]{4}$/.test(code || ''), 'a room code: ' + code);
  const f2 = new Client('f2', 'Will', 'lobby', { room: code }); await f2.ready; await wait(200);
  ok(f1.last('lobby').players.length === 2, 'a friend joins with the code');
  const bad = new Client('f3', 'X', 'lobby', { room: 'QQQQ' }); await bad.ready;
  ok(!!(await bad.until('nosuch')), 'a wrong code is turned away');
  f2.send({ t: 'pick', map: 'race' }); await wait(150);
  ok(f1.last('lobby').pick === 'arena', 'only the host picks the mode');
  f1.send({ t: 'pick', map: 'base' }); await wait(150);
  ok(f2.last('lobby').pick === 'base', 'the host picks Zombie Survival');
  f1.send({ t: 'start' });
  const fg = await f2.until('go');
  ok(fg && fg.map === 'base' && fg.bots === 4 && fg.kind === 'friends', 'the round starts on the base with 4 bots');
  const fw = new Client('f2', 'x', 'game', { round: fg.round }); await fw.ready;
  const fwm = await fw.until('welcome');
  ok(fwm && fwm.players.map((p) => p.name).join() === 'Will,Will 2', 'two players with one name get told apart');
  [...a, z, f1, f2, bad, fw].forEach((c) => c.close());
  await wait(300);
  let ev = []; for (let i = 0; i < 30 && !ev.some((e) => e.e === 'seat'); i++) { await wait(100); try { ev = fs.readFileSync(path.join(DATA, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch (e) { /* not yet */ } }
  ok(['start', 'hello', 'round', 'begin', 'bye', 'host', 'seat', 'over'].every((k) => ev.some((e) => e.e === k)), 'the event log has hellos, rounds, goodbyes, hand-overs and seats (' + ev.length + ' lines)');
  ok(ev.some((e) => e.e === 'bye' && e.why === 'closed 1005' || e.why === 'gone (no goodbye)' || /closed/.test(e.why || '')), 'a goodbye says why');
} catch (e) { console.error(e); fails++; }
srv.kill();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
