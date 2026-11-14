---
title: System Design Primer for Frontend Engineers
summary: The backend and infrastructure vocabulary senior frontend engineers are expected to speak — scalability, latency vs throughput, CAP, caching, CDNs, load balancing, rate limiting, queues and Kafka, databases, search, observability.
minutes: 30
---

## Why a frontend engineer needs this

Senior frontend interviews increasingly include "generic" system design (Reddit, Sprinklr, PhonePe rounds in the reference doc), and even frontend-only designs touch the backend: *where does the CDN go? how do real-time updates reach the browser? why is this API slow?* You don't need to design a database engine, but you must reason about the building blocks and their **trade-offs**. This lesson is a map — each section gives the mental model and the interview-ready one-liners.

## Scalability

**Vertical scaling** (bigger machine) is simple but has a ceiling and a single point of failure. **Horizontal scaling** (more machines) is near-unlimited but requires **stateless** services — any server can handle any request, so session data lives in a shared store (Redis) or in signed tokens, not in server memory.

The usual path for a web product:

```text
1 server ─▶ separate DB ─▶ load balancer + N stateless app servers ─▶ cache (Redis) ─▶
CDN for static/media ─▶ read replicas ─▶ async work via queues ─▶ sharding ─▶ multi-region
```

## Latency vs throughput

- **Latency**: time for one request (ms). Users feel it.
- **Throughput**: requests handled per second. Systems feel it.
- They trade off: batching raises throughput but adds latency; more parallelism raises throughput until a shared resource saturates.
- Watch **tail latency** (p95/p99), not averages: one slow dependency out of 20 calls per page makes most page loads slow.

Rough numbers worth knowing: memory access ~100ns, SSD read ~100µs, same-datacenter round trip ~0.5ms, cross-continent round trip ~150ms. That last one is why **CDNs and edge rendering** matter for the frontend.

## CAP and consistency

In a distributed data store, during a **network Partition** you must choose between **Consistency** (every read sees the latest write, or errors) and **Availability** (every request gets a response, possibly stale). Partitions happen, so the real choice is C vs A *when they do*.

- **CP**: banking ledgers, inventory decrements, payments — better to fail than to be wrong.
- **AP**: likes counters, feeds, presence — better to show slightly stale data.

Consistency models you'll name in interviews:
- **Strong**: read-after-write everywhere.
- **Eventual**: replicas converge "soon" (DNS, social counters).
- **Read-your-writes**: a user always sees their own updates (fake it on the client with optimistic updates!).

**ACID** (Atomicity, Consistency, Isolation, Durability) describes transactions in relational DBs: a payment debits and credits together or not at all.

## Caching

Caching is the single biggest performance lever, and it exists at every layer:

```text
Browser memory/disk cache → Service worker → CDN edge → reverse proxy → app cache (Redis) → DB buffer cache
```

:::visual cache-layers
:::

Patterns:
- **Cache-aside** (lazy loading): app reads cache; on miss reads DB and fills cache. Most common.
- **Write-through**: write to cache and DB together — fresher, slower writes.
- **Write-back**: write to cache, flush to DB later — fast, risk of loss.

The hard parts: **invalidation** (TTLs, explicit purge on write, versioned keys like `app.3f9a.js`), **stampede** (many misses at once → lock or serve stale while one request refreshes), **eviction** (LRU/LFU), and **what not to cache** (personalised or sensitive data at shared layers).

HTTP caching from the frontend side: `Cache-Control: public, max-age=31536000, immutable` for hashed assets; `no-cache` + `ETag` for HTML (revalidate every time); `stale-while-revalidate` for semi-fresh API data.

## CDN

A Content Delivery Network is a fleet of edge servers close to users that cache your content. First request in a region is a **miss** (fetched from origin); subsequent ones are served from the edge in ~10–30ms instead of ~150ms+. Use it for JS/CSS/fonts/images/video, and increasingly for HTML (SSG/ISR pages) and **edge compute** (auth checks, A/B bucketing, personalisation at the edge). Purging and cache keys (vary by `Accept-Encoding`, device, locale) are the operational concerns.

## Load balancing

Spreads requests across servers. **L4** (TCP-level, fast, no content awareness) vs **L7** (HTTP-aware: route `/api` vs `/static`, sticky sessions, TLS termination). Algorithms: round robin, least connections, consistent hashing (for caches — adding a node moves only ~1/N keys). Health checks remove dead servers. For WebSockets, connections are long-lived, so balancing is by connection count and you need a pub/sub backplane so a message for user A reaches whichever server holds A's socket.

## Rate limiting

Protects services from abuse and overload. Algorithms:

| Algorithm | Idea | Trade-off |
|---|---|---|
| Fixed window | Count per minute bucket | Burst at window edges (2× limit) |
| Sliding window log | Keep timestamps, count those in last N sec | Accurate, memory heavy |
| Sliding window counter | Weighted current + previous window | Good approximation, cheap |
| Token bucket | Tokens refill at rate r, capacity b | Allows bursts up to b, smooth average — most common |
| Leaky bucket | Queue drained at fixed rate | Smooths output, adds latency |

Clients receive **429 Too Many Requests** with `Retry-After`. Frontend role: debounce, back off with jitter, and show friendly messaging.

## API gateway and BFF

An **API gateway** is the single entry point: routing, auth, rate limiting, TLS, request logging. A **Backend-for-Frontend (BFF)** is a thin server owned by the frontend team that aggregates several microservice calls into the exact shape one screen needs (one round trip instead of five) — also where Next.js route handlers / server components often live. GraphQL gateways play a similar role.

## Synchronous vs asynchronous communication, queues and Kafka

Synchronous (HTTP/gRPC) calls chain latencies and failures: if service C is down, A→B→C fails. **Asynchronous** messaging decouples them: the producer publishes and moves on; consumers process at their own pace.

- **Message queue** (RabbitMQ, SQS): each message is consumed by **one** worker; great for jobs (send email, resize image). Supports retries and dead-letter queues.
- **Kafka** is a distributed, append-only **log**. Producers append events to **topics**, split into **partitions** (ordering is guaranteed *within* a partition — choose the partition key, e.g. `userId`, so a user's events stay ordered). Events are retained for days, so many **consumer groups** can read the same stream independently, each tracking its **offset**, and you can replay history. Used for event-driven architectures, activity feeds, analytics pipelines, change-data-capture.

```text
producers ─▶ topic "orders" [p0][p1][p2] ─▶ consumer group "billing"   (each partition → one consumer)
                                        └─▶ consumer group "analytics" (independent offsets)
```

**Batch vs stream processing**: batch processes bounded data periodically (nightly reports); stream processes unbounded events continuously (fraud detection, live dashboards).

## Real-time delivery to browsers

| Technique | Direction | Notes |
|---|---|---|
| Short polling | client → server every N s | Simple, wasteful, delayed |
| Long polling | server holds request until data | Works everywhere, reconnection overhead |
| **SSE** (`EventSource`) | server → client | HTTP, auto-reconnect, `Last-Event-ID` resume, text only |
| **WebSocket** | bi-directional | Lowest latency; needs sticky LB + pub/sub backplane; you build heartbeats & reconnection |
| WebTransport / WebRTC | bi-directional, UDP-ish | Media, games, P2P |

## Databases

**SQL** (Postgres, MySQL): schemas, joins, ACID transactions, strong consistency — default choice for relational business data (orders, payments). **NoSQL** families: key-value (Redis, DynamoDB — simple fast lookups), document (MongoDB — flexible nested JSON), wide-column (Cassandra — massive write throughput, time series), graph (Neo4j — relationships).

Scaling a database:
- **Indexes**: B-tree indexes turn O(n) scans into O(log n) lookups; they cost write speed and storage. Index what you filter and sort by (`(user_id, created_at)` for a feed).
- **Replication**: leader handles writes, followers serve reads (read replicas); followers lag → eventual consistency for reads. Also gives failover.
- **Sharding / partitioning**: split data across machines by a key (user id hash). Enables huge scale; cross-shard queries and re-sharding are painful; avoid hot shards (a celebrity's posts).
- **Redundancy** and backups for durability.

## Search: Elasticsearch

Elasticsearch (built on Lucene) stores JSON documents and builds an **inverted index** (term → list of documents containing it), like the index at the back of a book. That makes full-text search, fuzzy matching, relevance scoring (BM25), filters and aggregations fast. Analyzers tokenize text (lowercasing, stemming, **edge n-grams** for prefix/autocomplete). It's typically a **secondary** store: the source of truth is a database, and changes are streamed into ES (often via Kafka/CDC). It's eventually consistent (refresh interval ~1s).

## Observability

You can't fix what you can't see. Three pillars:

- **Metrics** (numbers over time: request rate, error rate, latency percentiles, CPU) — Prometheus scrapes, Grafana visualises; alerts on SLO breaches.
- **Logs** (discrete events with context) — ELK/OpenSearch, Loki.
- **Traces** (one request's journey across services as spans with timings) — **distributed tracing** via OpenTelemetry; a trace id propagates in headers (`traceparent`) so you can see that 900ms of a 1s page load was one slow downstream call.

**SigNoz** is an open-source, OpenTelemetry-native platform that combines metrics, logs and traces in one UI (an alternative to Datadog/New Relic). Frontend equivalent: **RUM** (real user monitoring: Web Vitals, JS errors via Sentry, session replays) and propagating trace ids from the browser so frontend spans connect to backend traces.

## Fault tolerance

Assume everything fails. Techniques: redundancy (N+1 instances, multi-AZ), **timeouts** everywhere, **retries with backoff + jitter** (only idempotent ops), **circuit breakers** (stop calling a failing dependency for a while, fail fast), **bulkheads** (isolate resources so one slow dependency can't exhaust all threads), graceful degradation (show cached feed if recommendations service is down), idempotency keys for payments.

## Architectural patterns (one-liners)

- **Client–server**: the web's default.
- **Microservices**: independently deployable services per domain; scaling and team autonomy vs operational complexity and network failures.
- **Event-driven**: services react to events on a bus (Kafka); loose coupling, harder to trace.
- **Serverless**: functions run on demand (Lambda, Vercel/Cloudflare functions); no servers to manage, cold starts, per-invocation pricing.

## Interview questions

:::question
difficulty: medium
### Explain Kafka in two minutes.
Kafka is a distributed, durable, append-only log. Producers write events to **topics**; each topic is split into **partitions** spread across brokers for scale, and each partition is replicated for durability. Ordering is guaranteed within a partition, so you choose a partition key (e.g. `orderId`) to keep related events ordered. Consumers read sequentially and track their position (**offset**); consumers in the same **group** share partitions (each partition to one consumer → parallelism), and different groups read the same data independently. Because data is retained, you can replay events, add new consumers later, and build event-driven systems, analytics and CDC pipelines. Compared with a classic queue, messages aren't deleted when consumed and many subscribers can process the same stream.
:::

:::question
difficulty: medium
### What does CAP mean for a product you'd build?
During a network partition you choose consistency or availability. For a likes counter or a feed, choose **availability** — show slightly stale counts and reconcile later (eventual consistency, optimistic UI). For a wallet balance or seat booking, choose **consistency** — reject or delay the operation rather than allow double spending/booking. Many systems mix both per feature.
:::

:::question
difficulty: medium
### What's the difference between SQL and NoSQL, and how do you choose?
SQL databases have fixed schemas, relations with joins, and ACID transactions — great for structured, relational, consistency-critical data. NoSQL trades some of that for flexible schemas and easier horizontal scaling: key-value for simple lookups/caching, document for nested aggregates read together, wide-column for very high write volume/time series, graph for relationship traversal. Choose based on access patterns, consistency needs and scale; many products use both (Postgres as source of truth, Redis cache, Elasticsearch for search).
:::

:::question
difficulty: easy
### What is a CDN and how does it improve performance?
A geographically distributed network of edge servers that cache content close to users. It cuts round-trip latency (serving from ~20ms away instead of ~150ms+), offloads traffic from the origin, absorbs spikes/DDoS, and often provides TLS termination, compression and image optimisation. Best for static assets with long cache lifetimes (content-hashed filenames), media, and static/ISR pages; edge functions add compute near users.
:::

:::question
difficulty: medium
### What is distributed tracing and why do frontend engineers care?
A trace follows one request across services; each step is a **span** with timing and metadata, linked by a trace id propagated in headers (W3C `traceparent`). It pinpoints *where* latency comes from in a microservice call graph. Frontend engineers care because a slow page often hides a slow downstream call; by starting a trace in the browser (OpenTelemetry web SDK) and propagating its id, you can connect a user's slow interaction to the exact backend span. Tools: Jaeger, Tempo, SigNoz, Datadog APM.
:::

## Quick check

:::quiz
### Kafka guarantees message ordering…
- [ ] Across the whole topic
- [x] Within a single partition
- [ ] Only for consumers in the same group
- [ ] Never
@@@explain
Order is per partition; pick a partition key to keep related events together.
:::

:::quiz
### Which rate-limiting algorithm allows short bursts while enforcing an average rate?
- [ ] Fixed window
- [x] Token bucket
- [ ] Leaky bucket
- [ ] Round robin
@@@explain
Tokens accumulate up to the bucket capacity (burst), refilling at the average rate.
:::

:::quiz
### Elasticsearch search is fast mainly because of…
- [ ] Storing everything in Redis
- [x] An inverted index mapping terms to documents
- [ ] B-tree indexes on every column
- [ ] Sharding alone
@@@explain
The inverted index lets it find documents containing terms without scanning all documents.
:::
