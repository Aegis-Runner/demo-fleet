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
const STYLE = `body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#1b2430}header{background:#3a3f52;color:#fff;padding:12px 20px;display:flex;gap:18px;align-items:center}header a{color:#d0d3e0;text-decoration:none;font-weight:500}header a.on{color:#fff;text-decoration:underline}main{max-width:900px;margin:22px auto;padding:0 16px}.card{background:#fff;border:1px solid #dde0e8;border-radius:8px;padding:18px;margin-bottom:18px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eaecf1}th{font-size:12px;text-transform:uppercase;color:#5b6172}label{display:block;margin:10px 0 4px;font-size:13px;color:#41465a}input{padding:8px 10px;border:1px solid #c9cdd8;border-radius:6px;min-width:230px;font-size:14px}button,.btn{background:#3a3f52;color:#fff;border:0;border-radius:6px;padding:9px 16px;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block}.pill{display:inline-block;padding:2px 9px;border-radius:12px;font-size:12px;background:#e7e9f0}.pill.due{background:#fdecea;color:#8a1c10}.muted{color:#6b7a89;font-size:13px}.err{background:#fdecea;border:1px solid #f5b3ab;color:#8a1c10;padding:9px 12px;border-radius:6px;margin-bottom:12px}.tot{font-size:20px;font-weight:600}`;
const layout = (a, t, b) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t)} · Atlas Fleet</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${STYLE}</style></head><body><header><strong>Atlas Fleet</strong>${[["/", "Dashboard"], ["/vehicles", "Vehicles"], ["/vehicles?filter=overdue", "Overdue"]].map(([h, l]) => `<a href="${h}" class="${a === h ? "on" : ""}">${l}</a>`).join("")}<span style="margin-left:auto"><a href="/logout">Sign out</a></span></header><main><h1>${esc(t)}</h1>${b}</main></body></html>`;
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
