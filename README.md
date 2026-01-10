# Debook — Backend Coding Challenge (NestJS + PostgreSQL)

This repository implements a **social interaction flow** (Like on a Post) with:
- **Idempotent interaction** (same user can’t like the same post twice)
- **Efficient counters** stored on the Post (no loading of relations to compute counts)
- **Async notification flow** using the **Outbox Pattern** (DB-backed queue + polling processor)
- **Unit tests for core services:**
  - `InteractionsService` (like idempotente + outbox)
  - `PostsService` (create / getAll / findById)
- **E2E test** for the interaction endpoint (`POST /posts/:id/like`)

---

## Tech Stack

- **NestJS** + **TypeScript**
- **PostgreSQL**
- **Prisma** (chosen as an equivalent alternative to TypeORM)
- **Jest** + **Supertest** for tests

### Why Prisma (instead of TypeORM)?
Prisma provides:
- Strong **type-safety** and a generated client
- First-class **migrations** workflow
- Clear, explicit queries and good developer experience
- Easy to implement **atomic counter updates** and enforce **DB constraints**

---

## Features Implemented

### Posts
- `POST /posts` — create a post (requires `x-user-id`)
- `GET /posts` — list posts (returns counters)
- `GET /posts/:id` — get post by id (returns counters)

### Interactions (Likes)
- `POST /posts/:id/like` — like a post (requires `x-user-id`)
  - **Idempotent**: if the user already liked, it returns `duplicated: true` and does **not** increment again
  - Updates `likesCount` using `increment: 1` (efficient)

### Async Notifications (Outbox)
When a like happens (and the liker is not the author), an outbox event is written **in the same DB transaction**:
- `NotificationOutbox` row with `type = POST_LIKED` and a JSON payload

A polling service (`OutboxProcessorService`) runs every 2 seconds and:
- reads `PENDING` events
- marks them as `PROCESSING`
- “handles” them (currently logs)
- marks them as `PROCESSED`
- retries failures up to `maxAttempts`

This demonstrates an async pipeline without external infra (Redis/Kafka), while keeping consistency.

---

## Database Design / Constraints

### Avoiding duplicate likes
The table `PostLike` has a unique constraint:
- `@@unique([postId, userId], name: "uniq_post_like")`

So the DB guarantees “one like per user per post”.
In the service, a duplicate like becomes an **idempotent success** by catching `P2002`.

### Efficient counters
Counters (`likesCount`, etc.) are stored on `Post` and updated with atomic increments:
- `data: { likesCount: { increment: 1 } }`

This avoids loading/aggregating relations to compute counts.

---

## Running Locally

### 1) Start Postgres with Docker

```bash
docker compose up -d
```

This project uses **port 5433** by default to avoid conflicts with local Postgres.

### 2) Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 3) Install dependencies

```bash
npm install
```

### 4) Run migrations

```bash
npx prisma migrate dev
```

(Optional) Open Prisma Studio:

```bash
npx prisma studio
```

### 5) Start the API

```bash
npm run start:dev
```

### 6) Health check

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

---

## Endpoints (Quick Reference)

### Create Post
```http
POST /posts
x-user-id: <author_id>
Content-Type: application/json

{ "content": "Hello Debook!" }
```

### List Posts
```http
GET /posts
```

### Get Post by Id (with counters)
```http
GET /posts/:id
```

### Like Post (idempotent)
```http
POST /posts/:id/like
x-user-id: <user_id>
```

Response example (first like):
```json
{
  "postId": "post_123",
  "userId": "user_abc",
  "duplicated": false,
  "likesCount": 1
}
```

Response example (duplicate like):
```json
{
  "postId": "post_123",
  "userId": "user_abc",
  "duplicated": true,
  "likesCount": 1
}
```

---

## Tests

### Unit tests
```bash
npm run test
```

### E2E tests
```bash
npm run test:e2e
```

> Note: The E2E interaction test cleans up the DB using `deleteMany()` after each run.

---

## Scripts

Typical scripts used in this repository:
- `npm run start`
- `npm run start:dev`
- `npm run test`
- `npm run test:e2e`
- `npm run lint`

---

## Notes / Trade-offs

- The outbox processor currently “delivers” notifications by logging; in a real system it would push to a queue, send a websocket event, call a notification service, etc.
- The Outbox Pattern is used to guarantee **consistency**: if the like is committed, the outbox event is committed too.
- Polling with `@Interval` is simple and sufficient for this challenge; production systems typically add leader election / distributed locks, or move to a dedicated queue.

---

## Repository Contents (Important)

- Prisma migrations **are committed** under `prisma/migrations/**`
- `migration_lock.toml` **is committed**
- `.env.example` is included to simplify setup
- `docker-compose.yml` is included for local Postgres
