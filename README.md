# Attendance System

## Local Development

This repository uses a development override file and Makefile shortcuts so you do not need to rebuild on every code change.

### Files Used

- `docker-compose.yml`: base services
- `docker-compose.dev.yml`: local dev overrides (bind mounts + reload)
- `Makefile`: simple local dev commands

### First Run (or after dependency changes)

```bash
make dev-build
```

### Daily Development

```bash
make dev
```

### Useful Commands

```bash
make dev-down    # stop containers
make dev-logs    # follow logs
make dev-config  # validate merged compose config
```

## What Changed for Faster Iteration

- Backend runs with `nodemon` (`npm run dev`) and bind mounts source code.
- Frontend uses bind mounts and polling-based file watch settings for reliable hot reload on Docker + macOS.
- ML service runs `uvicorn --reload` with mounted app code paths.

## Manual Docker Compose (without Makefile)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```
