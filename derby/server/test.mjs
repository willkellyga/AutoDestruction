// Lobby and relay test for derby/server (no browser): starts the server and plays the lobby messages through.
//   node derby/server/test.mjs
// Quick play per mode (countdown, the mode's own number of cars, bots fill), friends' rooms (code, the host picks the
// mode, start, a wrong code), a round's messages passed on, and the host leaving mid-round (the next player hosts).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 19000 + Math.floor(Math.random() * 1000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-reports-'));
const srv = spawn(process.execPath, [path.join(here, 'server.mjs')], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'inherit'] });
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
  console.log('Quick play');
  const a = [1, 2].map((i) => new Client('r' + i, 'Racer' + i, 'lobby', { room: 'quick:race', touch: i === 1 }));
  const z = new Client('z1', 'Zed', 'lobby', { room: 'quick:base' });
  await Promise.all([...a, z].map((c) => c.ready)); await wait(300);
  const l = a[0].last('lobby');
  ok(l && l.pick === 'race' && l.players.length === 2 && l.cars === 6, 'two racers share a race room of 6 cars');
  ok(z.last('lobby') && z.last('lobby').room.code !== l.room.code, 'zombie survival is a room of its own');
  ok(l && l.room.startIn > 8000, 'countdown about 10 s');
  const go = await a[0].until('go', 12000);
  ok(go && go.map === 'race' && go.bots === 4, 'the race starts with 4 bots (' + (go && go.bots) + ')');
  ok(go && go.host === 'r2', 'the computer, not the phone, hosts');
  const g = a.map((c) => new Client(c.id, c.id, 'game', { round: go.round }));
  await Promise.all(g.map((c) => c.ready));
  const w = await g[0].until('welcome');
  ok(w && w.players.length === 2 && w.players[0].slot === 0 && w.map === 'race', 'welcome lists the players and their seats');
  g.forEach((c) => c.send({ t: 'ready' }));
  ok(!!(await g[1].until('begin')), 'everyone ready: begin');
  g[0].send({ t: 's', c: [['r1.0', 1, 2]] });
  const s = await g[1].until('s');
  ok(s && s.from === 'r1' && s.c[0][0] === 'r1.0', 'a state is passed on with who sent it');
  g[0].send({ t: 'need', id: 'r2.0', to: 'r2' });
  ok(!!(await g[1].until('need')) && !(await g[0].until('need', 300, (m) => m.from !== 'r1')), 'a message with `to` goes to that player only');
  g[1].close(); await wait(300);
  const lf = await g[0].until('left');
  ok(lf && lf.host && lf.now === 'r1', 'the host left: the next player hosts');
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
  [...a, z, f1, f2, bad, fw, g[0]].forEach((c) => c.close());
} catch (e) { console.error(e); fails++; }
srv.kill();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
