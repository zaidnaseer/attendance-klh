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

## Demo Data (Seeding)

A seed script loads demo data so the whole flow can be tried end to end: 3 faculty, 7 classes (some subjects have multiple sections, e.g. `CS101-A` / `CS101-B`), 25 students, class mappings, and past sessions with attendance history.

Start the stack first, then in a second terminal:

```bash
# add demo data (safe to run more than once)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm run seed

# wipe all data, then add demo data
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm run seed -- --reset
```

The Makefile also has `make seed` and `make seed-reset`, which run the same commands.

Use `--reset` after pulling changes that rename the seeded courses, otherwise old and new courses end up side by side.

| Role | Codes |
|------|-------|
| Faculty | `FAC001`, `FAC002`, `FAC003` |
| Student | `STU001` to `STU025` |

Seeded students are **not** face-enrolled. Enroll at least one at `/enroll/<student code>` (for example `/enroll/STU001`) before trying the face check.

## Demo Walkthrough

The app is served over HTTPS at `https://localhost:3000` (needed for camera access; accept the browser warning).

1. **Admin** (`/admin`): review faculty, courses and students. The **Mappings** tab lets you pick a course, then assign faculty and add students in bulk.
2. **Student enrollment**: open `/student`, enter `STU001`, choose "Start face enrollment" and capture the 5 poses.
3. **Teacher**: open `/faculty`, enter `FAC001`. Pick a class card (for example `CS101-A`) and click **Start session**. The Live tab shows the QR code, a 6-digit code, and a full-screen projector mode.
4. **Student attendance**: on `/student` (a second device or browser), open the class, click **Mark attendance**, scan the QR or type the code, then complete the face check.
5. **Back on the teacher screen**: the student moves to "Present" live. Use **Mark present / Mark absent** for manual overrides, then **End session**.
6. **Review**: the History and Reports tabs show per-session and per-student attendance, with CSV export.

## Faculty Dashboard Layout

- **Classes home**: cards grouped by subject, with live classes first.
- **Class view**: a class picker in the header, plus Live, Roster, History and Reports tabs. The selected class and tab are kept in the URL hash.
- **Sections**: courses have an optional `section` field (set in the admin Courses form) so one subject can run for several classes.
