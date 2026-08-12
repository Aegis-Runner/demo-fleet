# Atlas Fleet

A fictional demo application used as an AegisRunner testing target (no third-party IP).

## What it exercises

```
ATLAS FLEET — assets whose NEXT-SERVICE-DUE is derived from a maintenance log.
  DERIVED DUE  next_due_km = last serviced odometer + interval. Nobody types it;
              logging a service must move it. A bug that leaves it stale strands
              a vehicle past due with a green dashboard.
  FILTER      "Overdue" is a SUBSET (odometer >= next_due_km). A leak is unsound.
  PERSISTENCE a new service log must survive an independent re-read.
Faults (healthy when DEMO_BUGS empty):
  phantomlog   the service log is confirmed but never recorded
  staledue     next-due is not recomputed after a service
  leakyoverdue the Overdue filter also returns vehicles that are not overdue
```

## Run

```sh
docker build -t demo-fleet .
docker run -p 3000:3000 -e DEMO_RESET_TOKEN=changeme demo-fleet
```

Fault injection is env-gated via `DEMO_BUGS` (comma-separated); healthy when empty. Reset via `POST /api/reset` with header `X-Reset-Token`.
