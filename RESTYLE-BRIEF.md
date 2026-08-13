# Restyle brief — Atlas Fleet

> **New look, same behaviour.** This app is an automated-testing **target** for AegisRunner's
> crawler, which grounds real assertions against its DOM and URLs. You may freely replace the CSS,
> the HTML structure, the templating, and even the framework — but every **contract** in
> "Preserve exactly" below must survive unchanged, or the tests that run against this app break silently.

## What this app is (verbatim from `server.js`)
> ATLAS FLEET — assets whose NEXT-SERVICE-DUE is derived from a maintenance log.
>   DERIVED DUE  next_due_km = last serviced odometer + interval. Nobody types it;
>               logging a service must move it. A bug that leaves it stale strands
>               a vehicle past due with a green dashboard.
>   FILTER      "Overdue" is a SUBSET (odometer >= next_due_km). A leak is unsound.
>   PERSISTENCE a new service log must survive an independent re-read.
> Faults (healthy when DEMO_BUGS empty):
>   phantomlog   the service log is confirmed but never recorded
>   staledue     next-due is not recomputed after a service
>   leakyoverdue the Overdue filter also returns vehicles that are not overdue

## Preserve EXACTLY (load-bearing for the crawler)

**Routes** — keep every path + method (paths and `:id` shape are part of the contract):
```
GET  /login
POST /login
GET  /logout
GET  /
GET  /vehicles
GET  /vehicles/:id
POST /vehicles/:id/service
POST /api/reset
```

**Create → detail flow**
- Create form field `name=` attributes (keep these names): `odo`, `work`
- On a successful create the server **redirects to the new record's detail URL** (e.g. `/vehicles/${v.id}`) — keep the redirect, not an inline success page.
- The **listing** must render each record's **visible identity** (its ref/name) as a **link to its detail page**.
- A detail URL for a record that does not exist must return **HTTP 404** (not a generic 200).

**Auth** — login form `POST /login` with fields `email` + `password`; session cookie **`fleet_session_v1`**; demo creds `dispatch@atlasfleet.test / disp12345`. Everything except `/login`, `/healthz`, `/api/reset` requires the session.

**Reset + fault injection** — DO NOT remove or rename:
- `POST /api/reset` guarded by request header **`X-Reset-Token`** (default `flt-reset`) → restores seed data.
- `GET /healthz` → `ok`.
- `DEMO_BUGS` env toggles faults: `leakyoverdue`, `phantomlog`, `staledue`. Healthy when empty. Keep **every** `BUGS.has("…")` branch and its exact flag name.

## Free to change
The stylesheet / design system, HTML markup + class names, the templating engine, the framework
(Express → Next / Fastify / Astro / Remix / …), and any client-side interactivity — provided the server
still serves the routes above with the **same field names, redirect targets, visible record identities,
404s, auth, `/api/reset`, `/healthz`, and `DEMO_BUGS` toggles**.

## Ship
- Keep a `Dockerfile` that builds a container listening on `PORT` and serving `/healthz`.
- Push to this repo's own remote: `https://github.com/Aegis-Runner/demo-fleet.git`.

---
_Auto-generated from `server.js`; if anything here disagrees with the code, the code wins — re-read it._
