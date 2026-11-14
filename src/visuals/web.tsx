import { useState, type ReactNode } from 'react'
import { Btn, Frame, Stepper } from './Frame'
import { useSteps } from './useAutoplay'

/* ------------------------------------------------------------------ */
/* Generic sequence diagram                                             */
/* ------------------------------------------------------------------ */

interface Msg {
  from: number
  to: number
  label: string
  note: string
  tone?: 'ok' | 'bad' | 'info'
}

function Sequence({ actors, msgs, step }: { actors: { name: string; icon: string }[]; msgs: Msg[]; step: number }) {
  const n = actors.length
  const col = (i: number) => ((i + 0.5) / n) * 100
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[30rem]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {actors.map((a) => (
            <div key={a.name} className="flex flex-col items-center">
              <div className="text-2xl">{a.icon}</div>
              <div className="rounded-lg bg-surface-2 px-2 py-1 text-center text-xs font-semibold ring-1 ring-line">{a.name}</div>
            </div>
          ))}
        </div>
        <div className="relative mt-2">
          {actors.map((a, i) => (
            <div key={a.name} className="absolute inset-y-0 w-px border-l border-dashed border-line" style={{ left: `${col(i)}%` }} />
          ))}
          {msgs.map((m, i) => {
            const left = Math.min(col(m.from), col(m.to))
            const width = Math.abs(col(m.to) - col(m.from))
            const rtl = m.to < m.from
            const self = m.to === m.from
            const visible = i <= step
            const color = m.tone === 'bad' ? 'text-rose-500' : m.tone === 'ok' ? 'text-emerald-500' : 'text-violet-500'
            return (
              <div key={i} className={`relative h-11 transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${i === step ? 'scale-[1.01]' : ''}`}>
                {self ? (
                  <div className={`absolute top-1 rounded-md bg-surface px-1.5 text-[11px] font-semibold ring-1 ring-line ${color}`} style={{ left: `calc(${col(m.from)}% + 8px)` }}>
                    ⟲ {m.label}
                  </div>
                ) : (
                  <div className={`absolute top-0 ${color}`} style={{ left: `${left}%`, width: `${width}%` }}>
                    <div className={`truncate px-2 text-center text-[11px] font-semibold ${i === step ? 'text-ink' : ''}`}>{m.label}</div>
                    <div className="relative mt-0.5 h-0.5 bg-current">
                      <span className={`absolute -top-[5px] text-[10px] ${rtl ? '-left-1' : '-right-1'}`}>{rtl ? '◀' : '▶'}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SequenceFrame({ title, subtitle, actors, msgs }: { title: string; subtitle?: string; actors: { name: string; icon: string }[]; msgs: Msg[] }) {
  const s = useSteps(msgs.length, 1700)
  return (
    <Frame title={title} subtitle={subtitle} controls={<Stepper {...s} total={msgs.length} />}>
      <Sequence actors={actors} msgs={msgs} step={s.step} />
      <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.07] p-3 text-sm leading-relaxed">
        <b className="text-violet-600 dark:text-violet-300">{msgs[s.step].label}: </b>
        {msgs[s.step].note}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* URL journey                                                          */
/* ------------------------------------------------------------------ */

const URL_STEPS = [
  { icon: '⌨️', title: 'You type a URL', detail: 'The browser parses it (scheme, host, path). Not a URL? It becomes a search. It checks HSTS to force https, and the omnibox may already have pre-connected.' },
  { icon: '📖', title: 'DNS lookup', detail: 'example.com → 93.184.216.34. Checked in order: browser cache → OS cache → router → ISP recursive resolver → root → .com TLD → authoritative nameserver. Cached by TTL.' },
  { icon: '🤝', title: 'TCP handshake', detail: 'SYN → SYN-ACK → ACK: one round trip to open a reliable connection to port 443. (HTTP/3 uses QUIC over UDP and merges this with TLS.)' },
  { icon: '🔐', title: 'TLS handshake', detail: 'Client hello / server hello, certificate check against trusted CAs, key exchange → an encrypted channel. TLS 1.3 needs one round trip (0-RTT on resumption).' },
  { icon: '📨', title: 'HTTP request', detail: 'GET / with headers (Host, Cookie, Accept, User-Agent…). May hit a CDN edge first; the server or edge may return 200, a redirect (301/302) or 304 Not Modified.' },
  { icon: '📦', title: 'Response streams in', detail: 'Status + headers (Content-Type, Cache-Control, Set-Cookie) + HTML body, streamed in chunks. TTFB = time until the first byte arrives.' },
  { icon: '🌳', title: 'Parse HTML → DOM', detail: 'Bytes → characters → tokens → nodes → DOM tree. The preload scanner discovers CSS/JS/images early. A plain <script> blocks parsing.' },
  { icon: '🎨', title: 'CSS → CSSOM', detail: 'Stylesheets become the CSSOM. CSS is render-blocking: nothing paints until it is ready.' },
  { icon: '🧱', title: 'Render tree + layout', detail: 'DOM + CSSOM → render tree (only visible nodes). Layout computes exact geometry of every box.' },
  { icon: '🖌️', title: 'Paint + composite', detail: 'Paint fills pixels into layers; the compositor (GPU) assembles layers into the frame you see. First Contentful Paint!' },
  { icon: '⚡', title: 'JS runs, page becomes interactive', detail: 'Deferred scripts execute, event handlers attach, hydration happens in SPAs. Further fetches, images and fonts keep loading.' },
]

export function UrlJourney() {
  const s = useSteps(URL_STEPS.length, 1600)
  return (
    <Frame title="What happens when you type a URL and press Enter" controls={<Stepper {...s} total={URL_STEPS.length} />}>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {URL_STEPS.map((st, i) => (
          <button
            key={i}
            onClick={() => s.setStep(i)}
            className={`flex min-w-[4.4rem] flex-1 flex-col items-center gap-1 rounded-xl p-2 text-center transition ${i === s.step ? 'bg-violet-500/15 ring-2 ring-violet-500' : i < s.step ? 'bg-emerald-500/10' : 'bg-surface-2/60 opacity-70'}`}
          >
            <span className="text-xl">{st.icon}</span>
            <span className="text-[10.5px] font-semibold leading-tight">{st.title}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-violet-500 to-orange-400 transition-all duration-500" style={{ width: `${((s.step + 1) / URL_STEPS.length) * 100}%` }} />
      </div>
      <div key={s.step} className="animate-pop mt-4 flex gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
        <span className="text-3xl">{URL_STEPS[s.step].icon}</span>
        <div>
          <div className="font-semibold">
            {s.step + 1}. {URL_STEPS[s.step].title}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted">{URL_STEPS[s.step].detail}</p>
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* HTTP anatomy                                                          */
/* ------------------------------------------------------------------ */

const REQ = [
  { t: 'POST /api/orders HTTP/2', k: 'line', d: 'Request line: METHOD + path + protocol version. GET reads, POST creates, PUT replaces, PATCH updates, DELETE removes.' },
  { t: 'Host: shop.example.com', k: 'h', d: 'Which site on this server (required).' },
  { t: 'Content-Type: application/json', k: 'h', d: 'Format of the body you are sending.' },
  { t: 'Authorization: Bearer eyJhbGci…', k: 'h', d: 'Credentials, e.g. a JWT access token.' },
  { t: 'Cookie: session=abc123', k: 'h', d: 'Cookies the browser automatically attaches for this domain.' },
  { t: '', k: 'blank', d: 'An empty line separates headers from the body.' },
  { t: '{ "productId": 42, "qty": 1 }', k: 'body', d: 'Body (payload). GET requests normally have none.' },
]
const RES = [
  { t: 'HTTP/2 201 Created', k: 'line', d: 'Status line. 2xx success, 3xx redirect, 4xx client error, 5xx server error.' },
  { t: 'Content-Type: application/json', k: 'h', d: 'Format of the response body.' },
  { t: 'Cache-Control: no-store', k: 'h', d: 'Caching instructions for browsers and CDNs.' },
  { t: 'Set-Cookie: cart=7; HttpOnly; Secure; SameSite=Lax', k: 'h', d: 'Asks the browser to store a cookie. HttpOnly hides it from JS.' },
  { t: 'Access-Control-Allow-Origin: https://shop.example.com', k: 'h', d: 'CORS: which origins may read this response.' },
  { t: '', k: 'blank', d: 'Blank line.' },
  { t: '{ "orderId": 9001, "status": "PLACED" }', k: 'body', d: 'Response body.' },
]

export function HttpAnatomy() {
  const [hover, setHover] = useState<string>('Hover or tap any line to see what it does.')
  const Panel = ({ title, rows }: { title: string; rows: typeof REQ }) => (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">{title}</div>
      <div className="overflow-x-auto rounded-xl bg-[#0b0e1c] p-2 font-mono text-[12px] leading-6">
        {rows.map((r, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(r.d)}
            onClick={() => setHover(r.d)}
            className={`cursor-pointer whitespace-pre rounded px-2 hover:bg-white/10 ${r.k === 'line' ? 'font-bold text-amber-300' : r.k === 'h' ? 'text-sky-300' : r.k === 'body' ? 'text-emerald-300' : 'h-6'}`}
          >
            {r.t}
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <Frame title="Anatomy of an HTTP request & response">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Request (browser → server)" rows={REQ} />
        <Panel title="Response (server → browser)" rows={RES} />
      </div>
      <div className="mt-3 min-h-12 rounded-xl border border-violet-500/30 bg-violet-500/[0.07] p-3 text-sm">{hover}</div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Rendering pipeline                                                    */
/* ------------------------------------------------------------------ */

const STAGES = [
  { id: 'js', name: 'JavaScript', color: 'bg-amber-500', d: 'JS runs and may change the DOM or styles (classList, style, innerHTML…).' },
  { id: 'style', name: 'Style', color: 'bg-pink-500', d: 'Recalculate which CSS rules apply to which elements (DOM + CSSOM → computed styles → render tree).' },
  { id: 'layout', name: 'Layout', color: 'bg-violet-500', d: 'Reflow: compute the geometry (x, y, width, height) of every box. Expensive — one change can affect the whole tree.' },
  { id: 'paint', name: 'Paint', color: 'bg-sky-500', d: 'Repaint: fill in pixels — text, colours, borders, shadows, images — into layers.' },
  { id: 'composite', name: 'Composite', color: 'bg-emerald-500', d: 'The compositor thread (GPU) draws layers in the right order with transforms & opacity. Can run off the main thread.' },
]
const CHANGES: { label: string; prop: string; runs: string[]; why: string }[] = [
  { label: 'width / top / font-size', prop: 'el.style.width = "300px"', runs: ['js', 'style', 'layout', 'paint', 'composite'], why: 'Geometry changed → full reflow, then repaint and composite. Animating these causes jank.' },
  { label: 'color / background / box-shadow', prop: 'el.style.background = "red"', runs: ['js', 'style', 'paint', 'composite'], why: 'Looks changed but geometry didn’t → skip layout, repaint only.' },
  { label: 'transform / opacity', prop: 'el.style.transform = "translateX(100px)"', runs: ['js', 'style', 'composite'], why: 'Compositor-only: no layout, no paint. The GPU just moves a layer — this is why animations should use transform & opacity.' },
  { label: 'read offsetHeight after a write', prop: 'el.style.width = …; el.offsetHeight', runs: ['js', 'style', 'layout', 'js'], why: 'Forced synchronous layout: reading geometry after a write makes the browser lay out immediately. In a loop this is "layout thrashing".' },
]

export function RenderingPipeline() {
  const [ci, setCi] = useState(0)
  const [stage, setStage] = useState<string | null>(null)
  const c = CHANGES[ci]
  return (
    <Frame title="The rendering pipeline (pixel pipeline)" subtitle="What a change costs depends on which stages it triggers.">
      <div className="mb-3 grid gap-2 sm:grid-cols-5">
        <div className="rounded-xl bg-surface-2/60 p-2 text-center text-xs sm:col-span-2">
          <div className="font-mono font-semibold">HTML → DOM</div>
          <div className="font-mono font-semibold">CSS → CSSOM</div>
          <div className="text-faint">combined into the render tree</div>
        </div>
        <div className="flex items-center justify-center text-faint sm:col-span-3">
          <span className="text-xs">every frame (~16.7ms at 60fps) a change may flow through ↓</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {STAGES.map((s, i) => {
          const on = c.runs.includes(s.id)
          return (
            <button
              key={s.id}
              onClick={() => setStage(s.id === stage ? null : s.id)}
              className={`relative flex-1 rounded-xl px-3 py-3 text-left text-white transition-all ${s.color} ${on ? 'opacity-100 shadow-lg' : 'opacity-20 grayscale'} ${stage === s.id ? 'ring-4 ring-ink/30' : ''}`}
            >
              <div className="text-[10px] font-bold opacity-80">{i + 1}</div>
              <div className="text-sm font-bold">{s.name}</div>
            </button>
          )
        })}
      </div>
      {stage && <p className="animate-reveal mt-2 text-sm text-muted">{STAGES.find((s) => s.id === stage)!.d}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {CHANGES.map((x, i) => (
          <Btn key={x.label} active={ci === i} onClick={() => setCi(i)}>
            {x.label}
          </Btn>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-[#0b0e1c] p-3 font-mono text-[12px] text-sky-300">{c.prop}</div>
      <p className="mt-2 text-sm leading-relaxed">{c.why}</p>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Script loading                                                        */
/* ------------------------------------------------------------------ */

const MODES: { name: string; code: string; bars: { lane: 'html' | 'js'; kind: 'parse' | 'fetch' | 'exec' | 'idle'; from: number; to: number }[]; note: string }[] = [
  {
    name: '<script>',
    code: '<script src="app.js"></script>',
    bars: [
      { lane: 'html', kind: 'parse', from: 0, to: 25 },
      { lane: 'js', kind: 'fetch', from: 25, to: 55 },
      { lane: 'js', kind: 'exec', from: 55, to: 70 },
      { lane: 'html', kind: 'idle', from: 25, to: 70 },
      { lane: 'html', kind: 'parse', from: 70, to: 100 },
    ],
    note: 'Parser-blocking: HTML parsing stops while the script downloads AND executes. Put classic scripts at the end of <body>, or use defer.',
  },
  {
    name: 'async',
    code: '<script async src="analytics.js"></script>',
    bars: [
      { lane: 'html', kind: 'parse', from: 0, to: 55 },
      { lane: 'js', kind: 'fetch', from: 20, to: 55 },
      { lane: 'js', kind: 'exec', from: 55, to: 70 },
      { lane: 'html', kind: 'idle', from: 55, to: 70 },
      { lane: 'html', kind: 'parse', from: 70, to: 100 },
    ],
    note: 'Downloads in parallel, executes as soon as it arrives (pausing the parser). Order between async scripts is NOT guaranteed. Great for independent scripts (analytics, ads). Wrong for scripts that depend on each other or on the DOM.',
  },
  {
    name: 'defer',
    code: '<script defer src="app.js"></script>',
    bars: [
      { lane: 'html', kind: 'parse', from: 0, to: 80 },
      { lane: 'js', kind: 'fetch', from: 20, to: 50 },
      { lane: 'js', kind: 'exec', from: 80, to: 95 },
    ],
    note: 'Downloads in parallel, executes after parsing finishes, before DOMContentLoaded, in document order. The default best choice for app code. Wrong for code that must run before first paint (e.g. theme flicker fix).',
  },
  {
    name: 'type="module"',
    code: '<script type="module" src="main.js"></script>',
    bars: [
      { lane: 'html', kind: 'parse', from: 0, to: 80 },
      { lane: 'js', kind: 'fetch', from: 15, to: 60 },
      { lane: 'js', kind: 'exec', from: 80, to: 95 },
    ],
    note: 'Modules are deferred by default (add async to run ASAP). The import graph is fetched in parallel. Strict mode, own scope, runs once.',
  },
]

export function ScriptLoading() {
  const [m, setM] = useState(0)
  const mode = MODES[m]
  const color = { parse: 'bg-sky-500', fetch: 'bg-amber-400', exec: 'bg-rose-500', idle: 'bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(244,63,94,.35)_4px,rgba(244,63,94,.35)_8px)]' }
  return (
    <Frame
      title="<script> vs async vs defer vs module"
      controls={MODES.map((x, i) => (
        <Btn key={x.name} active={m === i} onClick={() => setM(i)}>
          {x.name}
        </Btn>
      ))}
    >
      <div className="rounded-xl bg-[#0b0e1c] p-3 font-mono text-[12px] text-emerald-300">{mode.code}</div>
      <div className="mt-4 space-y-2">
        {(['html', 'js'] as const).map((lane) => (
          <div key={lane} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-muted">{lane === 'html' ? 'HTML parser' : 'Script'}</span>
            <div className="relative h-7 flex-1 rounded-lg bg-surface-2">
              {mode.bars
                .filter((b) => b.lane === lane)
                .map((b, i) => (
                  <div key={i} className={`absolute top-1 h-5 rounded-md transition-all duration-500 ${color[b.kind]}`} style={{ left: `${b.from}%`, width: `${b.to - b.from}%` }} />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 pl-[5.5rem] text-[11px] text-muted">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-sky-500" /> parsing</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-amber-400" /> download</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-rose-500" /> execute</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded bg-rose-300" /> parser blocked</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{mode.note}</p>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Cache layers                                                          */
/* ------------------------------------------------------------------ */

const LAYERS_C = [
  { name: 'Memory cache', icon: '🧠', d: 'RAM, per tab/renderer. Super fast ("(memory cache)", 0ms). Holds resources used by the current page; cleared when the tab closes.' },
  { name: 'Service Worker', icon: '👷', d: 'Your JS proxy in a separate thread. Can answer from Cache Storage with any strategy. Ignores DevTools "Disable cache" — use Application → Service Workers → "Bypass for network" or a hard reload.' },
  { name: 'HTTP disk cache', icon: '💾', d: 'Persists across sessions. Obeys Cache-Control / ETag. Fresh → served without a request; stale → revalidated with If-None-Match → 304.' },
  { name: 'CDN edge', icon: '🌍', d: 'Cache close to the user (s-maxage, Cache-Control: public). Cuts latency and origin load.' },
  { name: 'Origin server', icon: '🏢', d: 'The source of truth. Every request reaching here costs full latency + compute.' },
]

export function CacheLayers() {
  const [hit, setHit] = useState(2)
  const [disabled, setDisabled] = useState(false)
  const effective = disabled && (hit === 0 || hit === 2) ? (hit === 0 ? 1 : 3) : hit
  return (
    <Frame
      title="Where does a response come from?"
      subtitle="A request walks down the layers until one can answer it."
      controls={
        <Btn active={disabled} onClick={() => setDisabled(!disabled)}>
          DevTools “Disable cache” {disabled ? 'ON' : 'OFF'}
        </Btn>
      }
    >
      <div className="flex flex-col gap-2">
        {LAYERS_C.map((l, i) => {
          const skipped = disabled && (i === 0 || i === 2)
          return (
            <button
              key={l.name}
              onClick={() => setHit(i)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${i === effective ? 'border-emerald-500 bg-emerald-500/10' : i < effective ? 'border-line opacity-60' : 'border-line opacity-30'} ${skipped ? 'line-through decoration-rose-500' : ''}`}
            >
              <span className="text-2xl">{l.icon}</span>
              <span>
                <span className="block text-sm font-semibold">
                  {l.name} {i === effective && <span className="ml-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] text-white no-underline">served here</span>}
                </span>
                <span className="text-xs leading-relaxed text-muted">{l.d}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Tap a layer to make it the one that has the response. Turn on “Disable cache” to see that it skips memory & disk caches but NOT the service worker.</p>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* CORS                                                                  */
/* ------------------------------------------------------------------ */

export function CorsPreflight() {
  const [pre, setPre] = useState(true)
  const actors = [
    { name: 'JS on app.com', icon: '🧑‍💻' },
    { name: 'Browser', icon: '🌐' },
    { name: 'api.other.com', icon: '🏢' },
  ]
  const simple: Msg[] = [
    { from: 0, to: 1, label: "fetch('https://api.other.com/items')", note: 'A "simple" request: GET/HEAD/POST with only safelisted headers and content types (no Authorization, JSON content-type, etc.).' },
    { from: 1, to: 2, label: 'GET /items  Origin: https://app.com', note: 'The browser always sends the request and adds an Origin header. CORS does not stop the request from reaching the server!' },
    { from: 2, to: 1, label: '200  Access-Control-Allow-Origin: https://app.com', note: 'The server opts in by echoing the allowed origin.' },
    { from: 1, to: 0, label: 'response exposed to JS ✓', note: 'Headers match → the browser lets your JS read the response. If they didn’t, fetch rejects with a CORS error — but the server already did the work.', tone: 'ok' },
  ]
  const preflight: Msg[] = [
    { from: 0, to: 1, label: "fetch(url, { method: 'PUT', headers: { Authorization, 'Content-Type': 'application/json' } })", note: 'Non-simple: a PUT method plus custom/unsafe headers.' },
    { from: 1, to: 2, label: 'OPTIONS /items (preflight)', note: 'Before sending the real request the browser asks permission: Access-Control-Request-Method: PUT, Access-Control-Request-Headers: authorization, content-type.' },
    { from: 2, to: 1, label: '204  Allow-Methods: PUT  Allow-Headers: …  Max-Age: 600', note: 'Server lists what it permits. Max-Age lets the browser cache this answer so it doesn’t preflight every time.' },
    { from: 1, to: 2, label: 'PUT /items  Origin: https://app.com', note: 'Permission granted → the actual request is sent.' },
    { from: 2, to: 1, label: '200  Access-Control-Allow-Origin: https://app.com', note: 'The real response must ALSO carry the CORS header (plus Allow-Credentials: true if cookies are involved — and then the origin cannot be *).' },
    { from: 1, to: 0, label: 'response exposed to JS ✓', note: 'CORS is a browser-enforced relaxation of the same-origin policy. Servers, curl and Postman don’t care about it.', tone: 'ok' },
  ]
  return (
    <div>
      <div className="not-prose -mb-6 flex justify-end gap-2">
        <Btn active={!pre} onClick={() => setPre(false)}>
          Simple request
        </Btn>
        <Btn active={pre} onClick={() => setPre(true)}>
          Preflighted
        </Btn>
      </div>
      <SequenceFrame key={String(pre)} title={pre ? 'CORS with a preflight (OPTIONS)' : 'CORS simple request'} actors={actors} msgs={pre ? preflight : simple} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Auth flow                                                             */
/* ------------------------------------------------------------------ */

export function AuthFlow() {
  const actors = [
    { name: 'SPA', icon: '💻' },
    { name: 'Auth API', icon: '🔑' },
    { name: 'Resource API', icon: '🗄️' },
  ]
  const msgs: Msg[] = [
    { from: 0, to: 1, label: 'POST /login {email, password}', note: 'User signs in over HTTPS.' },
    { from: 1, to: 0, label: 'access token (15 min) + refresh cookie', note: 'Short-lived access JWT in the response body (keep it in memory), long-lived refresh token in an HttpOnly, Secure, SameSite cookie that JS can’t read (XSS-resistant).' },
    { from: 0, to: 2, label: 'GET /orders  Authorization: Bearer <access>', note: 'Every API call carries the access token. The API verifies the signature and exp claim — no DB lookup needed.' },
    { from: 2, to: 0, label: '200 orders', note: 'Works until the access token expires.', tone: 'ok' },
    { from: 0, to: 2, label: 'GET /profile (token expired)', note: '15 minutes later…' },
    { from: 2, to: 0, label: '401 Unauthorized', note: 'An interceptor catches the 401 (or you refresh proactively before exp).', tone: 'bad' },
    { from: 0, to: 1, label: 'POST /refresh (cookie sent automatically)', note: 'Silent refresh. Queue other failing requests so only ONE refresh call is in flight.' },
    { from: 1, to: 0, label: 'new access token (+ rotated refresh cookie)', note: 'Refresh-token rotation: the old refresh token is invalidated; reuse = theft detected → revoke the session.' },
    { from: 0, to: 2, label: 'retry GET /profile with new token', note: 'Replay the queued requests. If refresh fails → clear state and redirect to /login (route guard).', tone: 'ok' },
  ]
  return <SequenceFrame title="JWT access + refresh token flow" subtitle="Short-lived access token in memory, refresh token in an HttpOnly cookie." actors={actors} msgs={msgs} />
}

/* ------------------------------------------------------------------ */
/* Storage comparison                                                    */
/* ------------------------------------------------------------------ */

const STORES = [
  { name: 'Cookies', cap: '~4 KB each', life: 'Until Expires/Max-Age (or session)', scope: 'Domain + path; sent to server on every request', api: 'document.cookie (sync, string)', js: 'Not if HttpOnly', use: 'Sessions, auth refresh tokens, server-read prefs' },
  { name: 'localStorage', cap: '~5–10 MB per origin', life: 'Forever (until cleared)', scope: 'Origin, shared by all tabs', api: 'Sync key/value strings', js: 'Yes (XSS can read it)', use: 'Theme, non-sensitive prefs, drafts' },
  { name: 'sessionStorage', cap: '~5 MB per origin', life: 'Until the tab closes', scope: 'Origin + single tab', api: 'Sync key/value strings', js: 'Yes', use: 'Multi-step form state, per-tab UI state' },
  { name: 'IndexedDB', cap: 'Large (% of disk)', life: 'Persistent (may be evicted)', scope: 'Origin', api: 'Async, transactional, structured data & blobs', js: 'Yes', use: 'Offline data, big caches, files' },
  { name: 'Cache Storage', cap: 'Large (quota shared)', life: 'Until deleted', scope: 'Origin (window + service worker)', api: 'Async Request → Response pairs', js: 'Yes', use: 'Offline assets/API responses (PWA)' },
  { name: 'In-memory', cap: 'RAM', life: 'Until reload', scope: 'Current JS context', api: 'Map / object / React state / Query cache', js: 'Yes', use: 'Fast caches with TTL, tokens in memory' },
]

export function StorageCompare() {
  const [sel, setSel] = useState(0)
  const s = STORES[sel]
  const rows: [string, keyof typeof s][] = [
    ['Capacity', 'cap'],
    ['Lifetime', 'life'],
    ['Scope', 'scope'],
    ['API', 'api'],
    ['Readable by JS?', 'js'],
    ['Good for', 'use'],
  ]
  return (
    <Frame title="Browser storage compared">
      <div className="flex flex-wrap gap-1.5">
        {STORES.map((x, i) => (
          <Btn key={x.name} active={sel === i} onClick={() => setSel(i)}>
            {x.name}
          </Btn>
        ))}
      </div>
      <dl key={sel} className="animate-pop mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_1fr]">
        {rows.map(([label, k]) => (
          <div key={k} className="contents">
            <dt className="text-xs font-bold uppercase tracking-wider text-faint sm:pt-0.5">{label}</dt>
            <dd className="text-sm">{s[k]}</dd>
          </div>
        ))}
      </dl>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Web vitals                                                            */
/* ------------------------------------------------------------------ */

const VITALS = [
  { k: 'LCP', name: 'Largest Contentful Paint', unit: 's', good: 2.5, poor: 4, max: 6, step: 0.1, d: 'Loading: when the biggest image/text block becomes visible. Fix: fast TTFB, preload hero image, avoid render-blocking resources, CDN, right-sized images.', core: true },
  { k: 'INP', name: 'Interaction to Next Paint', unit: 'ms', good: 200, poor: 500, max: 800, step: 10, d: 'Responsiveness: latency from a click/tap/key to the next frame, across the visit (replaced FID in 2024). Fix: break up long tasks, yield to the main thread, less JS, avoid heavy re-renders.', core: true },
  { k: 'CLS', name: 'Cumulative Layout Shift', unit: '', good: 0.1, poor: 0.25, max: 0.5, step: 0.01, d: 'Visual stability: how much content jumps. Fix: width/height or aspect-ratio on media, reserve space for ads/embeds, font-display + size-adjust.', core: true },
  { k: 'FCP', name: 'First Contentful Paint', unit: 's', good: 1.8, poor: 3, max: 5, step: 0.1, d: 'First text/image painted. Driven by TTFB and render-blocking CSS/JS.', core: false },
  { k: 'TTFB', name: 'Time to First Byte', unit: 'ms', good: 800, poor: 1800, max: 2500, step: 50, d: 'Server + network latency until the first byte. Fix: CDN, caching, edge rendering, fewer redirects.', core: false },
]

export function WebVitals() {
  const [vals, setVals] = useState<Record<string, number>>({ LCP: 2.1, INP: 320, CLS: 0.05, FCP: 1.4, TTFB: 600 })
  return (
    <Frame title="Core Web Vitals & friends" subtitle="Measured at the 75th percentile of real users (field data). Drag to see the thresholds.">
      <div className="grid gap-3 sm:grid-cols-2">
        {VITALS.map((v) => {
          const val = vals[v.k]
          const rating = val <= v.good ? 'good' : val <= v.poor ? 'ni' : 'poor'
          const pct = (val / v.max) * 100
          return (
            <div key={v.k} className="rounded-xl border border-line p-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-lg font-bold">{v.k}</span> {v.core && <span className="ml-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">CORE</span>}
                  <div className="text-xs text-muted">{v.name}</div>
                </div>
                <span className={`font-mono text-lg font-bold ${rating === 'good' ? 'text-emerald-500' : rating === 'ni' ? 'text-amber-500' : 'text-rose-500'}`}>
                  {val}
                  {v.unit}
                </span>
              </div>
              <div className="relative mt-2 h-2.5 overflow-hidden rounded-full">
                <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${(v.good / v.max) * 100}%` }} />
                <div className="absolute inset-y-0 bg-amber-400" style={{ left: `${(v.good / v.max) * 100}%`, width: `${((v.poor - v.good) / v.max) * 100}%` }} />
                <div className="absolute inset-y-0 right-0 bg-rose-500" style={{ left: `${(v.poor / v.max) * 100}%` }} />
                <div className="absolute -top-0.5 h-3.5 w-1.5 rounded-full bg-ink shadow" style={{ left: `calc(${Math.min(99, pct)}% - 3px)` }} />
              </div>
              <input type="range" min={0} max={v.max} step={v.step} value={val} onChange={(e) => setVals({ ...vals, [v.k]: +e.target.value })} className="mt-2 w-full accent-violet-500" aria-label={v.k} />
              <div className="flex justify-between font-mono text-[10px] text-faint">
                <span>good ≤ {v.good}{v.unit}</span>
                <span>poor &gt; {v.poor}{v.unit}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{v.d}</p>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Rendering strategies                                                  */
/* ------------------------------------------------------------------ */

type Seg = { label: string; w: number; c: string }
const STRATS: { name: string; segs: Seg[]; marks: { at: number; l: string }[]; pros: string; cons: string; use: string }[] = [
  {
    name: 'CSR',
    segs: [
      { label: 'empty HTML', w: 8, c: 'bg-slate-400' },
      { label: 'download JS bundle', w: 30, c: 'bg-amber-400' },
      { label: 'run JS + fetch data', w: 27, c: 'bg-rose-400' },
      { label: 'render', w: 10, c: 'bg-emerald-500' },
    ],
    marks: [{ at: 8, l: 'TTFB' }, { at: 75, l: 'FCP ≈ TTI' }],
    pros: 'Cheap static hosting, rich app-like interactivity after load, simple mental model.',
    cons: 'Blank screen until JS runs; poor LCP on slow devices; SEO relies on crawler executing JS.',
    use: 'Dashboards and apps behind login.',
  },
  {
    name: 'SSR',
    segs: [
      { label: 'server renders HTML', w: 22, c: 'bg-violet-500' },
      { label: 'HTML visible', w: 18, c: 'bg-emerald-500' },
      { label: 'download JS', w: 20, c: 'bg-amber-400' },
      { label: 'hydrate', w: 15, c: 'bg-rose-400' },
    ],
    marks: [{ at: 22, l: 'TTFB' }, { at: 28, l: 'FCP' }, { at: 75, l: 'TTI' }],
    pros: 'Content visible fast, great SEO, per-request personalised data.',
    cons: 'Slower TTFB (server work per request), server cost, "uncanny valley" between FCP and hydration.',
    use: 'Personalised or frequently changing pages that need SEO (product pages, feeds).',
  },
  {
    name: 'SSG',
    segs: [
      { label: 'CDN serves prebuilt HTML', w: 6, c: 'bg-sky-500' },
      { label: 'HTML visible', w: 24, c: 'bg-emerald-500' },
      { label: 'download JS', w: 20, c: 'bg-amber-400' },
      { label: 'hydrate', w: 12, c: 'bg-rose-400' },
    ],
    marks: [{ at: 6, l: 'TTFB' }, { at: 10, l: 'FCP' }, { at: 62, l: 'TTI' }],
    pros: 'Fastest TTFB (built at deploy time, cached at the edge), cheap, resilient.',
    cons: 'Data is as fresh as the last build; build time grows with page count.',
    use: 'Docs, blogs, marketing pages. ISR revalidates pages in the background to keep them fresh.',
  },
  {
    name: 'Streaming SSR',
    segs: [
      { label: 'shell', w: 6, c: 'bg-violet-500' },
      { label: 'shell visible', w: 14, c: 'bg-emerald-500' },
      { label: 'Suspense chunks stream in', w: 25, c: 'bg-violet-400' },
      { label: 'selective hydration', w: 20, c: 'bg-rose-400' },
    ],
    marks: [{ at: 6, l: 'TTFB' }, { at: 10, l: 'FCP' }, { at: 55, l: 'TTI (progressive)' }],
    pros: 'Fast TTFB like SSG with per-request data; slow parts don’t block fast parts; hydrate what the user touches first.',
    cons: 'More moving parts; needs a streaming-capable server/runtime; careful with headers once streaming starts.',
    use: 'React 18+/Next.js App Router pages with slow data (RSC + Suspense).',
  },
]

export function RenderingStrategies() {
  const [i, setI] = useState(0)
  const s = STRATS[i]
  return (
    <Frame
      title="CSR vs SSR vs SSG vs Streaming"
      controls={STRATS.map((x, j) => (
        <Btn key={x.name} active={i === j} onClick={() => setI(j)}>
          {x.name}
        </Btn>
      ))}
    >
      <div className="relative pb-6">
        <div className="flex h-10 overflow-hidden rounded-xl">
          {s.segs.map((g, k) => (
            <div key={k} className={`flex items-center justify-center overflow-hidden px-1 text-center text-[10.5px] font-semibold leading-tight text-white transition-all duration-500 ${g.c}`} style={{ width: `${g.w}%` }}>
              {g.label}
            </div>
          ))}
        </div>
        {s.marks.map((m) => (
          <div key={m.l} className="absolute top-10 flex -translate-x-1/2 flex-col items-center transition-all duration-500" style={{ left: `${m.at}%` }}>
            <div className="h-2 w-px bg-ink" />
            <span className="whitespace-nowrap font-mono text-[10px] text-muted">{m.l}</span>
          </div>
        ))}
      </div>
      <div key={i} className="animate-pop mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <Card t="Pros" c="text-emerald-600 dark:text-emerald-400">{s.pros}</Card>
        <Card t="Cons" c="text-rose-600 dark:text-rose-400">{s.cons}</Card>
        <Card t="Use for" c="text-violet-600 dark:text-violet-300">{s.use}</Card>
      </div>
    </Frame>
  )
}

function Card({ t, c, children }: { t: string; c: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className={`mb-1 text-[11px] font-bold uppercase tracking-wider ${c}`}>{t}</div>
      <div className="text-[13px] leading-relaxed">{children}</div>
    </div>
  )
}
