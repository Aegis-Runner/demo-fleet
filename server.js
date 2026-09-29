// ATLAS FLEET — assets whose NEXT-SERVICE-DUE is derived from a maintenance log.
//   DERIVED DUE  next_due_km = last serviced odometer + interval. Nobody types it;
//               logging a service must move it. A bug that leaves it stale strands
//               a vehicle past due with a green dashboard.
//   FILTER      "Overdue" is a SUBSET (odometer >= next_due_km). A leak is unsound.
//   PERSISTENCE a new service log must survive an independent re-read.
// Faults (healthy when DEMO_BUGS empty):
//   phantomlog   the service log is confirmed but never recorded
//   staledue     next-due is not recomputed after a service
//   leakyoverdue the Overdue filter also returns vehicles that are not overdue
import express from "express";
import cookieParser from "cookie-parser";
import { DatabaseSync } from "node:sqlite";
const app = express();
app.use(express.urlencoded({ extended: true })); app.use(express.json()); app.use(cookieParser());
const BUGS = new Set(String(process.env.DEMO_BUGS || "").split(",").map(s => s.trim()).filter(Boolean));
const RESET_TOKEN = process.env.DEMO_RESET_TOKEN || "flt-reset";
const SESSION = "fleet_session_v1";
const USERS = { "dispatch@atlasfleet.test": { password: "disp12345", name: "Dispatch" } };
const b64 = s => Buffer.from(String(s)).toString("base64url");
const unb64 = s => { try { return Buffer.from(String(s || ""), "base64url").toString(); } catch { return ""; } };
const currentUser = req => USERS[unb64(req.cookies?.[SESSION])] ? { email: unb64(req.cookies[SESSION]) } : null;
const INTERVAL = 10000;
let seq = 200; const id = () => String(++seq);
const seed = () => ({
  vehicles: [
    { id: "201", plate: "NW-TRUCK-1", odo: 48000, lastService: 42000 },
    { id: "202", plate: "NW-TRUCK-2", odo: 61000, lastService: 60000 },
    { id: "203", plate: "NW-VAN-1", odo: 25000, lastService: 12000 },
  ],
  logs: [{ id: "210", vehicleId: "201", odo: 42000, work: "oil + filters" }, { id: "211", vehicleId: "202", odo: 60000, work: "brakes" }, { id: "212", vehicleId: "203", odo: 12000, work: "oil" }],
});
let { vehicles, logs } = seed();
const DB_PATH = process.env.DEMO_DB || "/data/app.db";
let db = null; try { db = new DatabaseSync(DB_PATH); db.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`); } catch { db = null; }
const persist = () => { if (db) try { db.prepare(`INSERT INTO kv(k,v) VALUES('s',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).run(JSON.stringify({ seq, vehicles, logs })); } catch {} };
(() => { if (db) try { const r = db.prepare(`SELECT v FROM kv WHERE k='s'`).get(); if (r?.v) { const s = JSON.parse(r.v); seq = s.seq; vehicles = s.vehicles; logs = s.logs; } } catch {} })();
const nextDue = v => v.lastService + INTERVAL;
const isOverdue = v => v.odo >= nextDue(v);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STYLE = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
:root {
  --primary: #475569;
  --primary-hover: #334155;
  --primary-light: #f1f5f9;
  --primary-text: #475569;
  --bg: #f8fafc;
  --card-bg: #ffffff;
  --text: #0f172a;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --success: #0d9488;
  --success-light: #ccfbf1;
  --success-text: #115e59;
  --warning-light: #fef3c7;
  --warning-text: #92400e;
  --danger: #e11d48;
  --danger-light: #ffe4e6;
  --danger-text: #9f1239;
}
body {
  font-family: 'Sora', system-ui, sans-serif;
  margin: 0;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
header {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: #fff;
  padding: 14px 20px;
  display: flex;
  gap: 18px;
  align-items: center;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
}
header strong {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(to right, #94a3b8, #cbd5e1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
header a {
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.925rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}
header a:hover {
  color: #fff;
  background: rgba(255,255,255,0.1);
}
header a.on {
  color: #fff;
  background: rgba(255,255,255,0.15);
  font-weight: 600;
}
main {
  max-width: 900px;
  width: 100%;
  margin: 22px auto;
  padding: 0 16px;
  box-sizing: border-box;
  flex-grow: 1;
}
h1 {
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #1e293b;
}
.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 18px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -2px rgba(0,0,0,0.05);
}
table {
  border-collapse: collapse;
  width: 100%;
}
th, td {
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}
th {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
td {
  font-size: 14px;
}
tr:last-child td {
  border-bottom: none;
}
label {
  display: block;
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
input, select {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 230px;
  font-size: 14px;
  transition: all 0.2s;
  background-color: #f1f5f9;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
}
input:focus, select:focus {
  outline: none;
  border-color: #475569;
  box-shadow: 0 0 0 3px #cbd5e1;
  background-color: #fff;
}
button, .btn {
  background: #1e293b;
  color: #fff;
  border: 0;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
  text-align: center;
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
}
button:hover, .btn:hover {
  background: #0f172a;
  transform: translateY(-1px);
}
button:active, .btn:active {
  transform: translateY(0);
}
.pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
  text-decoration: none;
  transition: all 0.2s;
}
.pill.due {
  background: var(--danger-light);
  color: var(--danger-text);
}
.err {
  background: var(--danger-light);
  border: 1px solid #fca5a5;
  color: var(--danger-text);
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
}
.muted {
  color: var(--text-muted);
  font-size: 13px;
}
.tot {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}
footer {
  margin-top: auto;
  text-align: center;
  padding: 24px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-muted);
  background: #fff;
}`;
const layout = (a, t, b) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(t)} · Atlas Fleet</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js"></script>
  <style>${STYLE}</style>
</head>
<body ng-app="fleetApp" class="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans">
  <div ng-controller="FleetController" class="flex flex-col min-h-screen">
    <header class="bg-gradient-to-r from-[#1e293b] to-[#0f172a] text-white p-4 flex items-center gap-6 shadow-lg">
      <strong class="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-300 to-slate-100">Atlas Fleet</strong>
      <nav class="flex gap-4 ml-4">
        <a href="/" class="text-sm font-semibold px-3 py-1.5 rounded-md transition-all ${a === '/' ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white'}">Dashboard</a>
        <a href="/vehicles" class="text-sm font-semibold px-3 py-1.5 rounded-md transition-all ${a === '/vehicles' ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white'}">Vehicles</a>
        <a href="/vehicles?filter=overdue" class="text-sm font-semibold px-3 py-1.5 rounded-md transition-all ${a === '/vehicles?filter=overdue' ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white'}">Overdue</a>
      </nav>
      <span class="ml-auto text-sm text-slate-300"><a href="/logout" class="hover:text-white transition-all">Sign out</a></span>
    </header>
    <main class="max-w-[900px] w-full mx-auto p-6 flex-grow flex flex-col">
      <h1 class="text-3xl font-black text-[#1e293b] mb-6">${esc(t)}</h1>
      <div id="angular-body-target"></div>
    </main>
    <footer class="mt-auto text-center py-6 border-t border-slate-200 bg-white text-xs text-slate-400">
      &copy; 2026 Atlas Fleet. Powered by <strong>AngularJS 1.8 Directive Engine</strong> and custom style bindings.
    </footer>
  </div>
  <div id="raw-fleet-content" style="display:none;">${b}</div>
  <script>
    angular.module('fleetApp', [])
      .controller('FleetController', ['$scope', function($scope) {
        document.getElementById('angular-body-target').innerHTML = document.getElementById('raw-fleet-content').innerHTML;
        console.log("[Angular] Bootstrapped module 'fleetApp' and linked FleetController.");
      }]);
  </script>
</body>
</html>`;
app.get("/healthz", (_q, r) => r.type("text").send("ok"));
app.use((req, res, next) => { if (["/login", "/healthz", "/api/reset"].includes(req.path)) return next(); if (!currentUser(req)) return res.redirect("/login"); next(); });
app.get("/login", (_q, res) => res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Sign in · Atlas Fleet</title><style>${STYLE}</style></head><body><main><div class="card" style="max-width:380px;margin:60px auto"><h1>Sign in</h1><form method="post" action="/login"><label for="email">Email</label><input id="email" name="email" type="email" value="dispatch@atlasfleet.test"><label for="password">Password</label><input id="password" name="password" type="password" value="disp12345"><p><button>Sign in</button></p></form></div></main></body></html>`));
app.post("/login", (req, res) => { const u = USERS[String(req.body.email || "").toLowerCase()]; if (!u || u.password !== req.body.password) return res.status(401).send(`<p class="err">Wrong email or password.</p><a href="/login">Back</a>`); res.cookie(SESSION, b64(String(req.body.email).toLowerCase()), { httpOnly: true }); res.redirect("/"); });
app.get("/logout", (_q, res) => { res.clearCookie(SESSION); res.redirect("/login"); });
app.get("/", (_q, res) => res.send(layout("/", "Dashboard", `<div class="card"><table><tr><th>Vehicles</th><td>${vehicles.length}</td></tr><tr><th>Overdue for service</th><td>${vehicles.filter(isOverdue).length}</td></tr></table></div>`)));
app.get("/vehicles", (req, res) => {
  const filter = String(req.query.filter || "");
  let rows = vehicles.slice();
  if (filter === "overdue") rows = BUGS.has("leakyoverdue") ? rows : rows.filter(isOverdue);
  res.send(layout(filter === "overdue" ? "/vehicles?filter=overdue" : "/vehicles", filter === "overdue" ? "Overdue vehicles" : "Vehicles",
    `<div class="card"><table><tr><th>Plate</th><th>Odometer</th><th>Next due</th><th>Status</th></tr>${rows.map(v => `<tr><td><a href="/vehicles/${v.id}">${esc(v.plate)}</a></td><td>${v.odo} km</td><td>${nextDue(v)} km</td><td>${isOverdue(v) ? `<span class="pill due">overdue</span>` : `<span class="pill">ok</span>`}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">None.</td></tr>`}</table></div>`));
});
app.get("/vehicles/:id", (req, res) => {
  const v = vehicles.find(x => x.id === req.params.id);
  if (!v) return res.status(404).send(layout("/vehicles", "Not found", `<div class="card">No such vehicle.</div>`));
  const hist = logs.filter(l => l.vehicleId === v.id);
  res.send(layout("/vehicles", v.plate, `<div class="card"><table><tr><th>Plate</th><td>${esc(v.plate)}</td></tr><tr><th>Odometer</th><td>${v.odo} km</td></tr><tr><th>Last serviced</th><td>${v.lastService} km</td></tr><tr><th>Next service due</th><td class="tot">${nextDue(v)} km${isOverdue(v) ? ` <span class="pill due">overdue</span>` : ""}</td></tr></table></div>
<div class="card"><h3>Log a service</h3><form method="post" action="/vehicles/${v.id}/service"><label for="odo">Odometer at service</label><input id="odo" name="odo" type="number" value="${v.odo}"><label for="work">Work done</label><input id="work" name="work" value="scheduled service"><p><button>Record service</button></p></form></div>
<div class="card"><h3>Service history</h3><table><tr><th>Ref</th><th>Odometer</th><th>Work</th></tr>${hist.map(l => `<tr><td>L${esc(l.id)}</td><td>${l.odo} km</td><td>${esc(l.work)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">None.</td></tr>`}</table></div>`));
});
app.post("/vehicles/:id/service", (req, res) => {
  const v = vehicles.find(x => x.id === req.params.id);
  if (!v) return res.status(404).send("no");
  const odo = Number(req.body.odo || v.odo);
  // PHANTOMLOG: confirm without recording.
  if (!BUGS.has("phantomlog")) {
    logs.push({ id: id(), vehicleId: v.id, odo, work: String(req.body.work || "").trim() || "service" });
    // STALEDUE: the log is recorded but next-due is not advanced.
    if (!BUGS.has("staledue")) v.lastService = odo;
    persist();
  }
  res.redirect(`/vehicles/${v.id}`);
});
app.post("/api/reset", (req, res) => { if (req.get("X-Reset-Token") !== RESET_TOKEN) return res.status(403).json({ error: "bad token" }); seq = 200; ({ vehicles, logs } = seed()); persist(); res.json({ ok: true, counts: { vehicles: vehicles.length, logs: logs.length } }); });
app.listen(Number(process.env.PORT || 3000), () => console.log(`atlas-fleet on ${process.env.PORT || 3000}; bugs=${[...BUGS].join(",") || "none"}`));
