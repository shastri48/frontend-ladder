---
title: Backend HLDs a Frontend Engineer May Get
summary: Concise, correct designs for the "generic" HLD rounds in the reference doc — PhonePe's alert monitoring system (simple count, bucketed and moving windows), Sprinklr's alert aggregation pipeline, URL shortener, unique ID generator and API rate limiter.
minutes: 30
---

## How to approach a backend HLD as a frontend engineer

Product companies (PhonePe, Sprinklr, Uber) often give every engineer the same HLD round. You won't be expected to tune Kafka, but you must show a clean method:

1. **Requirements**: functional + non-functional with numbers (QPS, latency, retention, consistency).
2. **Back-of-envelope estimates**: requests/sec, storage/day — they drive the design.
3. **API** and **data model**.
4. **High-level components** and data flow.
5. **Deep dives**: the one or two hard parts (windowed counting, ID uniqueness, hot keys).
6. **Scale, failure handling and trade-offs**.

Each design below follows that shape.

## 1. Alert monitoring system (PhonePe)

> Central system in a microservices environment to manage alerts from different systems. Support **SIMPLE_COUNT** (alert when the event count crosses a threshold), **BUCKETED_WINDOW** (count in fixed buckets, e.g. 10 events per 1-hour bucket) and **MOVING_WINDOW** (count in a sliding time window). Handle user/system events, trigger alerts based on configuration, support real-time monitoring.

**Requirements**
- Configurable alert rules per client/event type: `{ client, eventType, type, threshold, windowSizeSec, dispatch: [email, slack, pagerduty] }`.
- Ingest high event volume (say 50k events/s), evaluate rules in near real time (< few seconds), dispatch notifications, avoid alert storms (cool-down), show dashboards.
- This is a classic **machine-coding** (LLD) version too: implement the evaluators in code.

**Architecture**

```text
services ──events──▶ Ingestion API / SDK ──▶ Kafka topic "events" (partition by client+eventType)
                                                  │
                                    stream processors (consumer group)
                                    - load rules (cached, hot-reload on config change)
                                    - maintain window state per (rule, key) in memory + Redis/RocksDB checkpoint
                                    - evaluate → emit "alert" events
                                                  │
                                         Kafka topic "alerts" ──▶ dispatcher (email/Slack/PagerDuty, retries, dedupe, cool-down)
                                                  │
                                         alert store (DB) ──▶ dashboard (WS/SSE live view)
Config service (rules CRUD) ──▶ DB + publishes rule changes
```

Partitioning by `client+eventType` keeps all events for a rule on one consumer → counts are local and ordered; scale by adding partitions/consumers.

**The windowing logic** (the core of the question):

| Type | State | Evaluate |
|---|---|---|
| SIMPLE_COUNT | one counter | `count >= threshold` → alert (then reset or cool-down) |
| BUCKETED_WINDOW (tumbling) | counter + current bucket start | bucket = `floor(t / size)`; new bucket → reset counter; alert when the counter in the current bucket hits threshold (once per bucket) |
| MOVING_WINDOW (sliding) | deque of timestamps (or per-second sub-buckets) | drop timestamps `<= t - size`; alert when `len >= threshold` |

Memory optimisation for moving windows at high volume: instead of every timestamp, keep **sub-buckets** (e.g. per-second counts in a ring buffer of `windowSize` slots) — O(window/granularity) memory with small approximation.

**Reliability**: Kafka retention + consumer offsets give replay; checkpoint window state; at-least-once processing → dispatcher de-dupes by `alertId = rule + bucket/window-end`. Cool-down per rule to prevent storms. Late/out-of-order events: use event time with a small allowed lateness (watermarks in Flink).

## 2. Alert aggregation & notification pipeline (Sprinklr)

> Scalable alert aggregation and notification system for a social media pipeline. Millions of messages, thousands of accounts. Monitoring failures, deduplication, escalation, auto recovery.

Key additions over the previous design:
- **Deduplication**: fingerprint alerts (`hash(account, source, errorType)`); within an aggregation window, increment a counter instead of sending a new notification ("Twitter ingestion failing for 342 accounts").
- **Aggregation/grouping**: group by account/team/channel; summaries every N minutes (digest) for low severity, immediate for critical.
- **Escalation policy**: unacknowledged after 10 min → page on-call secondary → manager. State machine per incident: `open → acknowledged → resolved`, timers driven by a scheduler (delayed queue).
- **Auto recovery**: health checks / success events auto-resolve incidents (if the error rate drops below threshold for X minutes), send "resolved" notification; optional automated remediation (retry job, restart connector) with circuit breakers.
- **Monitoring failures in the alerting system itself**: dead-letter queues for undeliverable notifications, heartbeat ("dead man's switch") alerts if the pipeline stops producing, multi-channel fallback (Slack down → email/SMS).
- **Scale**: Kafka partitioned by account; stateless dispatchers horizontally scaled; rate limits per channel (Slack API limits) with token buckets; idempotent sends.

## 3. URL shortener (bit.ly)

**Requirements**: create short URL for a long URL (optionally custom alias, expiry), redirect fast (p99 < 50ms), very read-heavy (100:1), analytics (click counts).

**Estimates**: 100M new URLs/month ≈ 40 writes/s; 4k reads/s average, peaks 10×. 7 base62 chars = 62⁷ ≈ 3.5 trillion codes — plenty.

**API**: `POST /urls { longUrl, alias?, expiresAt? } → { code }`, `GET /:code → 301/302 Location: longUrl`.

**Generating codes**:
- **Counter + base62** (unique ids from a distributed ID generator or pre-allocated ranges per server) → no collisions, but codes are guessable/sequential (can shuffle with a bijective scramble).
- **Hash** (MD5/SHA of URL, take 7 chars) → collisions must be checked and resolved.
- Pre-generated key service (KGS) handing out unused random keys.

**Storage**: key-value store `code → { longUrl, createdAt, expiresAt, userId }` (DynamoDB/Cassandra), sharded by code. **Cache** hot codes in Redis/CDN. Redirect: **301** (cached by browsers — fewer hits, but analytics lost) vs **302** (every click hits you — accurate analytics). Analytics written asynchronously to Kafka → aggregated.

## 4. Unique ID generator

**Requirements**: globally unique 64-bit ids, roughly time-sortable, 10k+ ids/s per node, no central coordination on the hot path.

Options:
- DB auto-increment — single point of failure/bottleneck (multi-master with step offsets helps but is fragile).
- **UUID v4** — 128-bit random, no coordination, but not sortable and bad for B-tree index locality. **UUID v7** fixes sortability (timestamp prefix).
- **Twitter Snowflake** (64 bits):

```text
| 1 bit sign | 41 bits ms timestamp (custom epoch, ~69 years) | 10 bits machine id | 12 bits sequence |
```

Per millisecond each machine can generate 4096 ids; sequence resets each ms; if exhausted, wait for the next ms. Machine ids assigned via config/ZooKeeper. Concern: **clock going backwards** (NTP) → refuse to generate until the clock catches up, or use a logical last-timestamp.

In JavaScript, 64-bit ids exceed `Number.MAX_SAFE_INTEGER` (2⁵³−1) — APIs should send them as **strings** or the frontend must use `BigInt` (classic bug: Twitter ids rounded in JS).

## 5. API rate limiter

**Requirements**: limit requests per user/API key/IP (e.g. 100 req/min), low latency overhead (< 1ms), distributed across many API servers, clear 429 responses with `Retry-After` and `X-RateLimit-*` headers.

**Where**: API gateway / middleware (also client-side throttling as a courtesy).

**Algorithm**: token bucket (bursty but bounded) or sliding-window counter. **Distributed state** in Redis with atomic operations (Lua script or `INCR` + `EXPIRE`) so all API nodes share counts; local in-memory pre-check for very hot keys. Fail-open vs fail-closed if Redis is unavailable (usually fail-open with local limits). Different tiers per plan, separate limits per endpoint cost.

## Interview questions

:::question
difficulty: medium
companies: PhonePe
### What's the difference between a bucketed (tumbling) window and a moving (sliding) window?
A **tumbling/bucketed** window divides time into fixed, non-overlapping intervals (10:00–11:00, 11:00–12:00); counts reset at each boundary, so 9 events at 10:59 and 9 at 11:01 never trigger a threshold of 10 even though 18 occurred within 2 minutes. A **sliding/moving** window always looks at the last N seconds relative to now, catching such bursts at the cost of more state (timestamps or sub-buckets). Tumbling is cheaper and good for reporting; sliding is more accurate for alerting and rate limiting.
:::

:::question
difficulty: medium
### Why do 64-bit IDs cause bugs in JavaScript frontends?
JS numbers are IEEE-754 doubles with 53 bits of integer precision. A Snowflake id like `1427694302583922689` gets rounded when parsed by `JSON.parse`, so the frontend requests the wrong resource. Send ids as strings in JSON (or parse with a BigInt-aware parser) and treat them as opaque identifiers.
:::

:::question
difficulty: medium
### 301 or 302 for a URL shortener redirect?
301 (permanent) is cached by browsers and proxies, so repeat clicks don't reach your servers — cheaper and faster, but you lose click analytics and can't change the destination. 302 (or 307) means every click hits your service, enabling accurate analytics, expiry and edits at higher load. Most commercial shorteners use 302 for analytics.
:::

## Challenges

:::challenge
difficulty: hard
companies: PhonePe
### Implement the alert evaluators: SIMPLE_COUNT, BUCKETED_WINDOW, MOVING_WINDOW
Implement `createAlertMonitor(config)` where config is `{ type, threshold, windowSizeMs }` (`windowSizeMs` unused for SIMPLE_COUNT). It returns `record(timestampMs)` which records one event and returns `true` **exactly when this event causes an alert**, else `false`.

- `SIMPLE_COUNT`: alert when the total count reaches `threshold`; then the counter resets to 0.
- `BUCKETED_WINDOW`: buckets are `[k·size, (k+1)·size)`. Alert when the count in the current bucket reaches `threshold` — at most once per bucket.
- `MOVING_WINDOW`: alert when the number of events in `(t - windowSizeMs, t]` reaches `threshold`; after alerting, clear the window (start fresh).

Timestamps are non-decreasing.
@@@starter
```js
function createAlertMonitor({ type, threshold, windowSizeMs }) {
  return function record(t) {
    // your code
  }
}
```
@@@tests
```js
test('SIMPLE_COUNT alerts every threshold events', () => {
  const r = createAlertMonitor({ type: 'SIMPLE_COUNT', threshold: 3 })
  expect([1, 2, 3, 4, 5, 6, 7].map(r)).toEqual([false, false, true, false, false, true, false])
})

test('BUCKETED_WINDOW resets per bucket and alerts once per bucket', () => {
  const r = createAlertMonitor({ type: 'BUCKETED_WINDOW', threshold: 3, windowSizeMs: 1000 })
  const out = [100, 200, 999, 1000, 1500, 1999, 2000].map(r)
  // bucket0: 3 events -> alert on 3rd; bucket1: 3 events -> alert; bucket2: 1
  expect(out).toEqual([false, false, true, false, false, true, false])
  const r2 = createAlertMonitor({ type: 'BUCKETED_WINDOW', threshold: 2, windowSizeMs: 1000 })
  expect([10, 20, 30, 40].map(r2)).toEqual([false, true, false, false])
})

test('BUCKETED_WINDOW misses bursts across a boundary', () => {
  const r = createAlertMonitor({ type: 'BUCKETED_WINDOW', threshold: 3, windowSizeMs: 1000 })
  expect([900, 950, 1050, 1100].map(r)).toEqual([false, false, false, false])
})

test('MOVING_WINDOW catches the same burst', () => {
  const r = createAlertMonitor({ type: 'MOVING_WINDOW', threshold: 3, windowSizeMs: 1000 })
  expect([900, 950, 1050, 1100].map(r)).toEqual([false, false, true, false])
})

test('MOVING_WINDOW expires old events', () => {
  const r = createAlertMonitor({ type: 'MOVING_WINDOW', threshold: 3, windowSizeMs: 1000 })
  expect([0, 500, 1000, 1500, 1600].map(r)).toEqual([false, false, false, false, true])
})
```
@@@solution
```js
function createAlertMonitor({ type, threshold, windowSizeMs }) {
  if (type === 'SIMPLE_COUNT') {
    let count = 0
    return function record() {
      count++
      if (count >= threshold) { count = 0; return true }
      return false
    }
  }

  if (type === 'BUCKETED_WINDOW') {
    let bucket = null
    let count = 0
    let alerted = false
    return function record(t) {
      const b = Math.floor(t / windowSizeMs)
      if (b !== bucket) { bucket = b; count = 0; alerted = false }
      count++
      if (!alerted && count >= threshold) { alerted = true; return true }
      return false
    }
  }

  if (type === 'MOVING_WINDOW') {
    const times = [] // queue of timestamps inside the window
    let head = 0     // index of the oldest live element (avoids O(n) shift)
    return function record(t) {
      times.push(t)
      while (times[head] <= t - windowSizeMs) head++
      if (times.length - head >= threshold) {
        times.length = 0
        head = 0
        return true
      }
      if (head > 1024 && head > times.length / 2) { times.splice(0, head); head = 0 } // compact
      return false
    }
  }

  throw new Error(`Unknown alert type ${type}`)
}
```

- **SIMPLE_COUNT**: a counter that resets after alerting.
- **BUCKETED_WINDOW**: compute the bucket from the timestamp; a new bucket resets the count and the "already alerted" flag.
- **MOVING_WINDOW**: a queue of timestamps; evict those that fell out of `(t - size, t]` and compare the live count. Eviction is amortised O(1) per event using a head pointer.
- At high volume, replace the timestamp queue with per-second sub-bucket counters in a ring buffer to bound memory.

In the full system these evaluators run inside stream processors, keyed by `(ruleId, client)`, with state checkpointed and alerts de-duplicated downstream.
:::

:::challenge
difficulty: medium
### Implement a token bucket rate limiter
Implement `createTokenBucket({ capacity, refillPerSec, now = () => Date.now() })` returning `tryRemove(tokens = 1)` → `true` if allowed (and consumes tokens) or `false`. The bucket starts full; tokens refill continuously at `refillPerSec`, never above `capacity`. Use the injected `now()` for time.
@@@starter
```js
function createTokenBucket({ capacity, refillPerSec, now = () => Date.now() }) {
  return function tryRemove(tokens = 1) {
    // your code
  }
}
```
@@@tests
```js
test('allows a burst up to capacity then blocks', () => {
  let t = 0
  const take = createTokenBucket({ capacity: 3, refillPerSec: 1, now: () => t })
  expect([take(), take(), take(), take()]).toEqual([true, true, true, false])
})

test('refills over time but not above capacity', () => {
  let t = 0
  const take = createTokenBucket({ capacity: 2, refillPerSec: 2, now: () => t })
  take(); take()
  expect(take()).toBe(false)
  t = 500 // +1 token
  expect(take()).toBe(true)
  expect(take()).toBe(false)
  t = 10_000 // would be +19, capped at 2
  expect([take(), take(), take()]).toEqual([true, true, false])
})

test('multi-token requests', () => {
  let t = 0
  const take = createTokenBucket({ capacity: 5, refillPerSec: 1, now: () => t })
  expect(take(4)).toBe(true)
  expect(take(2)).toBe(false)
  t = 1000
  expect(take(2)).toBe(true)
})
```
@@@solution
```js
function createTokenBucket({ capacity, refillPerSec, now = () => Date.now() }) {
  let tokens = capacity
  let last = now()

  return function tryRemove(cost = 1) {
    const current = now()
    const elapsedSec = (current - last) / 1000
    last = current
    tokens = Math.min(capacity, tokens + elapsedSec * refillPerSec) // lazy refill
    if (tokens >= cost) {
      tokens -= cost
      return true
    }
    return false
  }
}
```

- **Lazy refill**: no timers — on each call we add `elapsed × rate` tokens, capped at capacity. O(1) time and memory per key.
- Bursts up to `capacity` are allowed; the long-run average is bounded by `refillPerSec`.
- Distributed version: store `{ tokens, last }` per key in Redis and run this logic atomically in a Lua script; respond with 429 + `Retry-After = ceil((cost - tokens) / refillPerSec)`.
:::

:::challenge
difficulty: easy
### Base62 encode/decode for a URL shortener
Implement `encode(n)` (non-negative integer → base62 string using `0-9a-zA-Z`) and `decode(s)` (inverse). `encode(0)` is `'0'`.
@@@starter
```js
function encode(n) {}
function decode(s) {}
```
@@@tests
```js
test('known values', () => {
  expect(encode(0)).toBe('0')
  expect(encode(61)).toBe('Z')
  expect(encode(62)).toBe('10')
  expect(encode(125)).toBe('21')
})

test('round trip', () => {
  for (const n of [1, 9, 10, 35, 36, 3843, 3844, 1234567890, 56800235583]) {
    expect(decode(encode(n))).toBe(n)
  }
})
```
@@@solution
```js
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function encode(n) {
  if (n === 0) return '0'
  let out = ''
  while (n > 0) {
    out = ALPHABET[n % 62] + out
    n = Math.floor(n / 62)
  }
  return out
}

function decode(s) {
  let n = 0
  for (const ch of s) n = n * 62 + ALPHABET.indexOf(ch)
  return n
}
```

Repeated division by 62 yields digits from least to most significant. 7 characters cover 62⁷ ≈ 3.5 × 10¹² ids. For ids beyond 2⁵³ use `BigInt` (`n % 62n`). To avoid guessable sequential codes, apply a reversible permutation to the counter before encoding.
:::

## Quick check

:::quiz
### Why partition the events topic by `client + eventType` in the alert system?
- [ ] To encrypt events
- [x] So all events for a rule land on the same consumer, keeping counts local and ordered
- [ ] To reduce Kafka storage
- [ ] It's required by Kafka
@@@explain
Co-locating a rule's events avoids distributed counters and preserves per-partition ordering.
:::

:::quiz
### In a Snowflake ID, what limits throughput per machine per millisecond?
- [ ] The timestamp bits
- [ ] The machine id bits
- [x] The sequence bits (12 bits → 4096 ids/ms)
- [ ] The sign bit
@@@explain
The sequence counter resets each millisecond; 12 bits allow 4096 ids before waiting for the next ms.
:::
