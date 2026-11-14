// Runs user code (+ optional tests) inside a sandboxed, throw-away iframe.

export interface LogLine {
  level: 'log' | 'warn' | 'error' | 'info'
  text: string
}
export interface TestResult {
  name: string
  pass: boolean
  error?: string
  ms: number
}
export interface RunResult {
  logs: LogLine[]
  tests: TestResult[]
  error?: string
  timedOut?: boolean
}

const HARNESS = String.raw`
const __logs = [];
const __fmt = (v, d = 0) => {
  try {
    if (typeof v === 'string') return d ? JSON.stringify(v) : v;
    if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
    if (typeof v === 'symbol' || typeof v === 'bigint') return String(v) + (typeof v === 'bigint' ? 'n' : '');
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (v instanceof Promise) return 'Promise {…}';
    if (v instanceof Map) return 'Map(' + v.size + ') {' + [...v].map(([k, x]) => __fmt(k, 1) + ' => ' + __fmt(x, 1)).join(', ') + '}';
    if (v instanceof Set) return 'Set(' + v.size + ') {' + [...v].map(x => __fmt(x, 1)).join(', ') + '}';
    if (v && typeof v === 'object') {
      if (d > 3) return Array.isArray(v) ? '[…]' : '{…}';
      if (Array.isArray(v)) return '[' + v.map(x => __fmt(x, d + 1)).join(', ') + ']';
      const name = v.constructor && v.constructor.name !== 'Object' ? v.constructor.name + ' ' : '';
      return name + '{ ' + Object.keys(v).map(k => k + ': ' + __fmt(v[k], d + 1)).join(', ') + ' }';
    }
    return String(v);
  } catch (e) { return String(v); }
};
['log', 'warn', 'error', 'info'].forEach(level => {
  console[level] = (...a) => __logs.push({ level, text: a.map(x => __fmt(x)).join(' ') });
});
const __tests = [];
var test = (name, fn) => __tests.push({ name, fn });
var it = test;
var sleep = ms => new Promise(r => setTimeout(r, ms));
const __eq = (a, b) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Map && b instanceof Map) return a.size === b.size && [...a].every(([k, v]) => b.has(k) && __eq(v, b.get(k)));
  if (a instanceof Set && b instanceof Set) return a.size === b.size && [...a].every(v => b.has(v));
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && __eq(a[k], b[k]));
};
var expect = (actual) => {
  const fail = (m) => { throw new Error(m); };
  const api = {
    toBe: (e) => Object.is(actual, e) || fail('Expected ' + __fmt(e, 1) + ' but received ' + __fmt(actual, 1)),
    toEqual: (e) => __eq(actual, e) || fail('Expected ' + __fmt(e, 1) + ' but received ' + __fmt(actual, 1)),
    toStrictEqual: (e) => __eq(actual, e) || fail('Expected ' + __fmt(e, 1) + ' but received ' + __fmt(actual, 1)),
    toBeTruthy: () => !!actual || fail('Expected truthy but received ' + __fmt(actual, 1)),
    toBeFalsy: () => !actual || fail('Expected falsy but received ' + __fmt(actual, 1)),
    toBeNull: () => actual === null || fail('Expected null but received ' + __fmt(actual, 1)),
    toBeUndefined: () => actual === undefined || fail('Expected undefined but received ' + __fmt(actual, 1)),
    toBeDefined: () => actual !== undefined || fail('Expected value to be defined'),
    toBeGreaterThan: (n) => actual > n || fail('Expected ' + __fmt(actual, 1) + ' > ' + n),
    toBeGreaterThanOrEqual: (n) => actual >= n || fail('Expected ' + __fmt(actual, 1) + ' >= ' + n),
    toBeLessThan: (n) => actual < n || fail('Expected ' + __fmt(actual, 1) + ' < ' + n),
    toBeLessThanOrEqual: (n) => actual <= n || fail('Expected ' + __fmt(actual, 1) + ' <= ' + n),
    toBeCloseTo: (n, p = 2) => Math.abs(actual - n) < Math.pow(10, -p) / 2 || fail('Expected ' + actual + ' to be close to ' + n),
    toContain: (x) => (actual && actual.includes && actual.includes(x)) || fail('Expected ' + __fmt(actual, 1) + ' to contain ' + __fmt(x, 1)),
    toHaveLength: (n) => (actual && actual.length === n) || fail('Expected length ' + n + ' but got ' + (actual && actual.length)),
    toBeInstanceOf: (C) => actual instanceof C || fail('Expected instance of ' + (C && C.name)),
    toThrow: (msg) => {
      try { actual(); } catch (e) {
        if (msg && !String(e && e.message).includes(msg)) fail('Threw "' + (e && e.message) + '" — expected it to include "' + msg + '"');
        return true;
      }
      fail('Expected function to throw');
    },
  };
  api.not = {
    toBe: (e) => !Object.is(actual, e) || fail('Expected value not to be ' + __fmt(e, 1)),
    toEqual: (e) => !__eq(actual, e) || fail('Expected value not to equal ' + __fmt(e, 1)),
    toContain: (x) => !(actual && actual.includes && actual.includes(x)) || fail('Expected not to contain ' + __fmt(x, 1)),
    toThrow: () => { try { actual(); } catch (e) { fail('Expected not to throw, but threw ' + e.message); } return true; },
    toBeNull: () => actual !== null || fail('Expected not null'),
    toBeUndefined: () => actual !== undefined || fail('Expected not undefined'),
  };
  api.resolves = { toBe: async (e) => expect(await actual).toBe(e), toEqual: async (e) => expect(await actual).toEqual(e) };
  api.rejects = {
    toThrow: async (m) => { try { await actual; } catch (e) { if (m && !String(e && (e.message ?? e)).includes(m)) fail('Rejected with "' + (e && (e.message ?? e)) + '"'); return; } fail('Expected promise to reject'); },
    toBe: async (v) => { try { await actual; } catch (e) { expect(e).toBe(v); return; } fail('Expected promise to reject'); },
    toEqual: async (v) => { try { await actual; } catch (e) { expect(e).toEqual(v); return; } fail('Expected promise to reject'); },
  };
  return api;
};
window.addEventListener('error', (e) => { __logs.push({ level: 'error', text: 'Uncaught ' + (e.error ? (e.error.name + ': ' + e.error.message) : e.message) }); });
window.addEventListener('unhandledrejection', (e) => { __logs.push({ level: 'error', text: 'Unhandled rejection: ' + __fmt(e.reason) }); });
`

const RUNNER = String.raw`
(async () => {
  let __error;
  try {
    // user code and tests share one scope so tests can see const/let/class declarations
    (0, eval)(__USER__ + '\n;\n' + __TESTS__);
  } catch (e) { __error = (e && e.name ? e.name + ': ' + e.message : String(e)); }
  const results = [];
  if (!__error) {
    for (const t of __tests) {
      const s = performance.now();
      try {
        await Promise.race([Promise.resolve().then(() => t.fn()), new Promise((_, r) => setTimeout(() => r(new Error('Test timed out after 3s')), 3000))]);
        results.push({ name: t.name, pass: true, ms: Math.round(performance.now() - s) });
      } catch (e) {
        results.push({ name: t.name, pass: false, error: e && e.message ? e.message : String(e), ms: Math.round(performance.now() - s) });
      }
    }
  }
  await new Promise(r => setTimeout(r, 30));
  parent.postMessage({ __fl: __ID__, logs: __logs, tests: results, error: __error }, '*');
})();
`

let seq = 0

function asScript(code: string) {
  return JSON.stringify(code)
}

export function runCode(code: string, tests = '', timeoutMs = 8000): Promise<RunResult> {
  const id = ++seq
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.style.display = 'none'
  const script =
    HARNESS +
    RUNNER.replace('__USER__', () => asScript(code))
      .replace('__TESTS__', () => JSON.stringify(tests || ''))
      .replace('__ID__', () => String(id))
  iframe.srcdoc = `<!doctype html><html><body><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`

  return new Promise((resolve) => {
    const done = (r: RunResult) => {
      window.removeEventListener('message', onMsg)
      clearTimeout(timer)
      iframe.remove()
      resolve(r)
    }
    const onMsg = (e: MessageEvent) => {
      if (e.source === iframe.contentWindow && e.data && e.data.__fl === id) {
        done({ logs: e.data.logs, tests: e.data.tests, error: e.data.error })
      }
    }
    const timer = setTimeout(
      () =>
        done({
          logs: [],
          tests: [],
          timedOut: true,
          error: `Timed out after ${timeoutMs / 1000}s — is there an infinite loop?`,
        }),
      timeoutMs,
    )
    window.addEventListener('message', onMsg)
    document.body.appendChild(iframe)
  })
}
