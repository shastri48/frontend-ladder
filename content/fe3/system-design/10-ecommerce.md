---
title: Design an E-commerce Site (Amazon / Airbnb)
summary: Product listing with faceted search, product detail pages that load fast and rank in search engines, cart and checkout correctness, rendering strategy per page, and the Airbnb-style search with map and date picker.
minutes: 26
---

## The prompt

> "Design the frontend for an e-commerce site like Amazon" — often narrowed to *product listing + product details + cart + checkout*. Airbnb is the same shape with a map and date ranges.

E-commerce is where frontend architecture has **direct revenue impact**: Amazon famously found every 100ms of latency cost ~1% of sales. Expect deep dives on performance, SEO and checkout correctness.

## Requirements

**Functional**
- Search & browse: listing page (PLP) with filters (facets: brand, price, rating), sort, pagination.
- Product detail page (PDP): images, variants (size/colour), price, availability, reviews, add to cart.
- Cart: add/remove/update quantity, persists across sessions/devices.
- Checkout: address, delivery options, payment, order confirmation.

**Non-functional**
- **SEO** for PLP/PDP (organic traffic is huge) → server-rendered HTML with structured data.
- Fast on low-end mobile on slow networks (emerging markets): LCP < 2.5s, small JS.
- High traffic spikes (sales events) → CDN-heavy, cacheable pages.
- Checkout must be **correct** (no double orders, accurate prices), secure (PCI), accessible (WCAG — legal requirement in many regions), i18n/currencies.

## Rendering strategy per page

| Page | Strategy | Why |
|---|---|---|
| Home, category landing | SSG/ISR + edge cache, personalised slots hydrated client-side | Mostly same for everyone; fastest TTFB |
| Search/listing (PLP) | SSR (cacheable by query URL) + client-side updates when filters change | SEO for category URLs; dynamic data |
| Product detail (PDP) | ISR/SSR with short TTL; **price & stock fetched fresh** client-side or via streaming | SEO critical; price/stock change frequently |
| Cart, checkout, account | CSR (or SSR without caching), no indexing | Personalised, not SEO |

Modern frameworks (Next.js App Router / React Server Components, Remix) let you **stream**: send the static shell and product info immediately, stream in reviews/recommendations as they resolve (Suspense boundaries). Ship less JS by keeping non-interactive parts as server components.

:::visual rendering-strategies
:::

## Architecture

```text
CDN/edge (HTML cache by URL, image optimisation, A/B bucketing)
   ▼
Web server / BFF (SSR, aggregates catalog, pricing, inventory, reviews services)
   ▼
Client: route-level bundles
  PLP: <FacetSidebar/> <SortBar/> <ProductGrid/> <Pagination/>
  PDP: <Gallery/> <BuyBox price stock variants AddToCart/> <Reviews lazy/> <Recommendations lazy/>
  Cart: <CartItems/> <Summary/>          Checkout: <Stepper> Address → Delivery → Payment → Review
Global client state: cart (server-synced), user session, feature flags
```

## Data model & API (selected)

```ts
type ProductSummary = { id: string; title: string; image: Img; price: Money; rating: number; ratingCount: number; badge?: string }
type Money = { amount: string; currency: 'INR' | 'USD' }   // string/minor units — never floats
type Facet = { key: 'brand' | 'price' | 'rating'; options: { value: string; label: string; count: number; selected: boolean }[] }
type CartLine = { lineId: string; productId: string; variantId: string; qty: number; unitPrice: Money }
```

```http
GET /search?q=shoes&brand=nike,puma&price=1000-3000&sort=price_asc&page=2
  → { items: ProductSummary[], facets: Facet[], total, page }
GET /products/:id            → static-ish details (cacheable)
GET /products/:id/offer      → { price, stock, deliveryEstimate } (fresh, per pincode)
POST /cart/lines { productId, variantId, qty, idempotencyKey } → Cart
POST /checkout/orders { cartVersion, addressId, paymentMethodId, idempotencyKey } → Order
```

**Filters in the URL** (`?brand=nike&price=1000-3000`) — shareable, crawlable, back button works. Offset pagination (page numbers) is fine and expected here (users jump to page 3, SEO likes stable page URLs) — unlike feeds.

## Deep dive 1: listing page performance

- Server renders the first page; filter changes fetch JSON and update client-side (no full reload), updating the URL with `history.pushState` / router.
- Facet counts come from the search engine (Elasticsearch aggregations).
- Debounce price-range sliders; cancel stale searches; keep previous results visible with a subtle loading state (don't flash skeletons on every filter tweak).
- Product images: responsive `srcset`, lazy below the fold, first row `fetchpriority="high"`, fixed aspect ratio.
- Prefetch the PDP data/route on hover or when a card enters the viewport (on fast connections only — check `navigator.connection.saveData`).

## Deep dive 2: product detail page

- LCP is usually the main product image: preload it, serve the right size, avoid client-side-only rendering of the gallery.
- The buy box (price, stock, delivery date for the user's pincode) must be **fresh**: render cached PDP HTML and fill the offer via a fast API/stream; show skeleton only for that box.
- Variant selection updates URL (`?color=red&size=9`) so it's shareable and back works; preload variant images.
- Reviews and recommendations are below the fold → lazy-load (IntersectionObserver / Suspense streaming).
- **Structured data** (JSON-LD `Product`, `Offer`, `AggregateRating`) for rich search results; canonical URLs for variants; meta tags for social sharing.

## Deep dive 3: cart correctness

- Guest carts live in localStorage + a server cart id cookie; on login, **merge** the guest cart into the user's cart (sum quantities, respect stock limits).
- Optimistic add-to-cart with mini-cart animation; rollback with message if the server rejects (out of stock).
- **Idempotency keys** on add-to-cart and order placement — double clicks or retries must not double-add or double-order. Disable the "Place order" button while submitting *and* rely on the server key.
- The server recalculates totals: prices, discounts, taxes and shipping are never trusted from the client. The client displays server-computed values and re-validates when entering checkout (prices may have changed — show a clear notice).
- Multi-tab: listen to `storage` events / BroadcastChannel to sync cart badge.

## Deep dive 4: checkout

- **Multi-step form** with step-wise validation (address → delivery → payment → review); persist progress so a refresh doesn't lose data (session storage for non-sensitive fields; never store card data).
- **Payments**: use the payment provider's hosted fields / iframe / redirect (Stripe Elements, Razorpay/Cashfree checkout) so card data never touches your servers (PCI DSS scope reduction). Handle 3-D Secure / OTP challenges, UPI intents/QR on mobile, and asynchronous confirmation (webhooks → poll order status endpoint; show "processing" not "failed" on timeouts).
- Autofill-friendly forms: correct `autocomplete` attributes (`shipping street-address`, `postal-code`, `cc-number` within provider fields), `inputmode="numeric"` for pincode/phone.
- Clear error messages tied to fields (`aria-describedby`), focus moved to the first error on submit, no CAPTCHAs that block assistive tech.
- Analytics on funnel drop-off per step.

## Airbnb variant: search with map and dates

- **Search state** (location, dates, guests, map bounds, filters) in the URL.
- **Map + list sync**: moving the map triggers a debounced search by bounds ("Search as I move the map"); hovering a card highlights its marker. Render thousands of markers with clustering (Supercluster) on a canvas/WebGL map (Mapbox GL); lazy-load the map library — it's large — and don't load it on mobile until the user opens the map view.
- **Date range picker**: accessible grid (`role="grid"`, arrow keys move by day, PageUp/Down by month), disabled unavailable dates from an availability API, two months side by side on desktop, full-screen on mobile.
- Listing cards with image carousels: lazy-load only the first image; load the rest on interaction.
- Price display includes fees/taxes per locale regulations; currency formatting via `Intl.NumberFormat`.

## Interview questions

:::question
difficulty: medium
companies: Walmart, Accenture
### The home page takes 5 seconds to load. How would you reduce it?
Measure first (Lighthouse + WebPageTest + RUM; look at TTFB, LCP element, JS execution, waterfall). Then by bottleneck:
- **Server/TTFB**: cache HTML at the CDN (SSG/ISR), stream SSR, fix slow APIs, move closer to users (edge).
- **Render-blocking**: inline critical CSS, `defer` scripts, preconnect to critical origins, self-host fonts with `font-display: swap` and preload.
- **LCP image**: preload, correct size/format, `fetchpriority="high"`, no lazy-loading above the fold.
- **JS**: code-split by route, remove unused dependencies (bundle analyzer), lazy-load below-the-fold widgets and third-party scripts (chat, analytics) after load, ship less via server components.
- **Data waterfalls**: fetch in parallel on the server; avoid client-side fetch chains.
- Verify gains and add performance budgets in CI.
:::

:::question
difficulty: medium
### How do you prevent duplicate orders when the user double-clicks "Place order" or the network retries?
Generate an **idempotency key** when the checkout attempt starts and send it with the order request; the server stores the key with the result and returns the same order for repeated requests with that key. On the client, also disable the button and show progress while submitting, and on timeouts **poll the order status** using the key rather than resubmitting blindly.
:::

:::question
difficulty: medium
### Which rendering strategy would you use for product pages and why?
SSR or ISR so crawlers and users get full HTML quickly (SEO + LCP), cached at the CDN with short revalidation. Volatile parts (price, stock, delivery estimate, personalised recommendations) are fetched fresh or streamed separately so the cached HTML never shows a wrong price for long. Hydrate only interactive islands (buy box, gallery) to limit JS.
:::

## Practice

:::challenge
difficulty: medium
### Merge a guest cart into a user cart on login
Write `mergeCarts(userLines, guestLines, stockByVariant)` where lines are `{ variantId, qty }`. Combine quantities per variant, cap each at available stock (and at a max of 10 per line), keep lines in user-cart order followed by new guest-only variants, drop lines whose final qty is 0, and return `{ lines, adjustments }` where `adjustments` lists variants whose qty was capped.
@@@solution
```js
function mergeCarts(userLines, guestLines, stockByVariant, maxPerLine = 10) {
  const merged = new Map() // Map keeps insertion order: user lines first
  for (const l of userLines) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.qty)
  for (const l of guestLines) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.qty)

  const lines = []
  const adjustments = []
  for (const [variantId, wanted] of merged) {
    const cap = Math.min(maxPerLine, stockByVariant[variantId] ?? 0)
    const qty = Math.min(wanted, cap)
    if (qty < wanted) adjustments.push({ variantId, requested: wanted, applied: qty })
    if (qty > 0) lines.push({ variantId, qty })
  }
  return { lines, adjustments }
}
```

- A `Map` gives O(n) merging and preserves order (user lines, then new guest variants).
- Capping by stock and per-line limits happens **after** summing, and every reduction is reported so the UI can say "We updated quantities for 2 items based on availability".
- In production the **server** performs this merge (it has authoritative stock and prices) and returns the new cart plus messages; the client just displays them.
:::

## Quick check

:::quiz
### Why is offset/page-number pagination acceptable for product listings but not for social feeds?
- [ ] Product data never changes
- [x] Users and crawlers need stable, jumpable page URLs, and listings don't get new items inserted at the top every second
- [ ] Cursor pagination doesn't work with filters
- [ ] Offsets are faster in all databases
@@@explain
Listings are relatively stable and benefit from page URLs; feeds change constantly at the head.
:::

:::quiz
### Where should final order totals (price, tax, discount) be computed?
- [ ] In the browser, to save server load
- [x] On the server; the client only displays server-computed values
- [ ] In localStorage
- [ ] In the payment provider's iframe
@@@explain
Never trust client-side prices — they can be tampered with or stale.
:::
