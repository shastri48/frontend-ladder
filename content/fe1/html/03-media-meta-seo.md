---
title: Images, Media, Meta Tags & SEO
summary: Responsive images, lazy loading, the head section, Open Graph, structured data and the SEO fundamentals every frontend developer owns.
minutes: 14
---

## Images done right

Images are usually the heaviest part of a page and the most common **LCP** (Largest Contentful Paint) element. A good `<img>`:

```html
<img
  src="/img/keyboard-800.jpg"
  srcset="/img/keyboard-400.jpg 400w, /img/keyboard-800.jpg 800w, /img/keyboard-1600.jpg 1600w"
  sizes="(max-width: 600px) 100vw, 50vw"
  alt="White mechanical keyboard with wooden wrist rest"
  width="800" height="600"
  loading="lazy"
  decoding="async"
/>
```

| Attribute | Why |
|---|---|
| `alt` | Text alternative for screen readers, broken images and search engines. Decorative images use `alt=""` so they're skipped |
| `width`/`height` | Browser reserves space before download → no **layout shift** (CLS) |
| `srcset` + `sizes` | Browser picks the smallest file that looks sharp on this screen and DPR |
| `loading="lazy"` | Defer off-screen images until near the viewport. **Never** lazy-load the hero/LCP image |
| `fetchpriority="high"` | Hint to fetch the LCP image first |
| `decoding="async"` | Decode off the critical path |

### Art direction and modern formats with `<picture>`

```html
<picture>
  <source type="image/avif" srcset="hero.avif" />
  <source type="image/webp" srcset="hero.webp" />
  <source media="(max-width: 600px)" srcset="hero-portrait.jpg" />
  <img src="hero.jpg" alt="…" width="1200" height="600" fetchpriority="high" />
</picture>
```

The browser picks the first `<source>` it supports. AVIF and WebP are typically 30–50% smaller than JPEG.

### Writing good alt text

- Describe the **purpose**, not "image of…". For a product photo: "Blue running shoe, side view".
- For an image inside a link/button, describe the **destination/action**: `alt="Go to cart"`.
- Decorative → `alt=""` (empty, not missing — missing makes screen readers read the filename).
- Complex charts → short alt + a longer description nearby.

## Video and audio

```html
<video controls width="640" poster="poster.jpg" preload="metadata" playsinline>
  <source src="demo.webm" type="video/webm" />
  <source src="demo.mp4" type="video/mp4" />
  <track kind="captions" src="demo.en.vtt" srclang="en" label="English" default />
</video>
```

Captions (`<track>`) are an accessibility requirement for speech. Autoplay only works when `muted`.

## The `<head>`: metadata that matters

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mechanical Keyboards | KeyCo</title>
  <meta name="description" content="Hand-built mechanical keyboards with hot-swap switches. Free shipping in India." />
  <link rel="canonical" href="https://keyco.in/keyboards" />

  <!-- Social sharing previews -->
  <meta property="og:title" content="Mechanical Keyboards | KeyCo" />
  <meta property="og:description" content="Hand-built, hot-swap, free shipping." />
  <meta property="og:image" content="https://keyco.in/og/keyboards.jpg" />
  <meta property="og:url" content="https://keyco.in/keyboards" />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <meta name="theme-color" content="#0f172a" />

  <!-- Performance hints -->
  <link rel="preconnect" href="https://cdn.keyco.in" crossorigin />
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
</head>
```

| Tag | Purpose |
|---|---|
| `<title>` | Search result headline, tab title — unique per page, ~50–60 chars |
| `meta description` | Often used as the search snippet, ~150 chars |
| `canonical` | "This is the original URL" — prevents duplicate-content issues (`?utm=`, sort params) |
| Open Graph / Twitter | Preview cards on WhatsApp, LinkedIn, Slack, X |
| `robots` meta | `noindex`, `nofollow` for pages that shouldn't be indexed |
| `preconnect` / `preload` / `prefetch` | Resource hints for performance |

## SEO fundamentals for frontend developers

Search engines crawl, render, and index. Your job:

1. **Content must be in the HTML (or rendered quickly).** Googlebot renders JS, but with a delay and a budget; other crawlers and social preview bots often don't run JS at all. That's a major reason for **SSR/SSG** (Next.js) on content sites.
2. **Semantic structure** — one `h1`, logical headings, real links (`<a href>`) so crawlers can discover pages. Links via `onClick` + `div` are invisible to crawlers.
3. **Unique titles and descriptions** per page; canonical URLs.
4. **Performance** — Core Web Vitals are a ranking signal.
5. **Mobile-friendly** — Google uses mobile-first indexing.
6. **Structured data** (JSON-LD) for rich results:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "K1 Mechanical Keyboard",
  "offers": { "@type": "Offer", "price": "4999", "priceCurrency": "INR" }
}
</script>
```

7. `robots.txt` and `sitemap.xml` to guide crawlers.

## Iframes and embeds

`<iframe>` embeds another document (maps, videos, payment widgets). Always give it a `title` (accessibility), consider `loading="lazy"`, and restrict it with `sandbox` and `allow` when embedding untrusted content. To stop *your* site being framed (clickjacking), the server sends `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`.

:::question
difficulty: easy
### What is the `alt` attribute for and how do you write a good one?
`alt` provides a text alternative for an image: read by screen readers, shown if the image fails, and used by search engines. Describe the image's purpose in context ("Add to cart" for an icon button, "Red sneaker, side view" for a product). Use `alt=""` for purely decorative images so assistive tech skips them; never omit it (screen readers may read the file name).
:::

:::question
difficulty: medium
### How do you make images load fast and avoid layout shift?
- Set `width` and `height` (or CSS `aspect-ratio`) so space is reserved → no CLS.
- Serve responsive sizes with `srcset`/`sizes` and modern formats (AVIF/WebP) via `<picture>`.
- Lazy-load below-the-fold images (`loading="lazy"`), but **eager-load and prioritize** the LCP/hero image (`fetchpriority="high"`, maybe `<link rel="preload">`).
- Compress, and serve from a CDN / image service that resizes on the fly.
- Use `decoding="async"`; avoid huge background images in CSS for key content (they're discovered late).
:::

:::question
difficulty: medium
### How does a single-page app (SPA) affect SEO and how do you fix it?
A client-rendered SPA ships an almost empty HTML shell; content appears only after JS downloads and runs. Google can render it but with delays and limits; social preview bots and many other crawlers won't execute JS, so they see nothing. Meta tags set by JS may be missed. Fixes: server-side rendering or static generation (Next.js, Remix, Astro), pre-rendering for marketing pages, real `<a href>` links, unique `<title>`/meta per route rendered on the server, sitemaps, and good performance.
:::

:::question
difficulty: easy
### What is the difference between `preload`, `prefetch` and `preconnect`?
- `preconnect` — open the DNS + TCP + TLS connection to an origin early (e.g. your CDN/API) without downloading anything.
- `preload` — fetch a resource needed **for this page** soon, at high priority (fonts, hero image, critical CSS). Requires `as=`.
- `prefetch` — fetch a resource likely needed for a **future navigation**, at low priority, into the cache.
- (`dns-prefetch` — only resolve DNS; cheaper, wider support.)
:::

:::quiz
### Which image should NOT get `loading="lazy"`?
- [x] The hero image at the top of the page
- [ ] A product image in the footer carousel
- [ ] Images in comments far below
@@@explain
Lazy-loading the hero delays the LCP element. Load it eagerly with high fetch priority.
:::

:::quiz
### What does `<link rel="canonical">` do?
- [ ] Makes the page load faster
- [x] Tells search engines the preferred URL among duplicates
- [ ] Prevents the page being framed
@@@explain
Canonical consolidates ranking signals from duplicate URLs (tracking params, sort orders) to one URL.
:::
