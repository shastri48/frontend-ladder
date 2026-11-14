import { Marked, type Tokens } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import plaintext from 'highlight.js/lib/languages/plaintext'
import { slugify } from './parser'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('plaintext', plaintext)

const ALIAS: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  svg: 'xml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  text: 'plaintext',
  txt: 'plaintext',
  scss: 'css',
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function highlight(code: string, lang?: string): string {
  const l = (lang || '').toLowerCase()
  const name = ALIAS[l] || l
  if (name && hljs.getLanguage(name)) {
    try {
      return hljs.highlight(code, { language: name, ignoreIllegals: true }).value
    } catch {
      /* fall through */
    }
  }
  return escapeHtml(code)
}

const md = new Marked({ gfm: true, breaks: false })

md.use({
  renderer: {
    heading(this: { parser: { parseInline: (t: Tokens.Heading['tokens']) => string } }, token: Tokens.Heading) {
      const html = this.parser.parseInline(token.tokens)
      const id = slugify(token.text)
      return `<h${token.depth} id="${id}">${html}</h${token.depth}>\n`
    },
    code(token: Tokens.Code) {
      const lang = (token.lang || '').split(/\s+/)[0]
      const label = lang && lang !== 'text' ? `<span class="code-lang">${escapeHtml(lang)}</span>` : ''
      return `<div class="code-wrap">${label}<button class="copy-btn" type="button" data-copy>copy</button><pre><code class="hljs">${highlight(
        token.text,
        lang,
      )}</code></pre></div>\n`
    },
    link(this: { parser: { parseInline: (t: Tokens.Link['tokens']) => string } }, token: Tokens.Link) {
      const text = this.parser.parseInline(token.tokens)
      const ext = /^https?:\/\//.test(token.href)
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
      return `<a href="${escapeHtml(token.href)}"${title}${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
    },
  },
})

const cache = new Map<string, string>()

export function renderMarkdown(src: string): string {
  let out = cache.get(src)
  if (out === undefined) {
    out = md.parse(src, { async: false }) as string
    if (cache.size > 500) cache.clear()
    cache.set(src, out)
  }
  return out
}

export function renderInline(src: string): string {
  return md.parseInline(src, { async: false }) as string
}

/** Extracts `##` headings of a markdown string for a table of contents. */
export function headingsOf(src: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = []
  let fence = false
  for (const line of src.split('\n')) {
    if (/^\s{0,3}(```|~~~)/.test(line)) fence = !fence
    if (fence) continue
    const m = line.match(/^##\s+(.+)$/)
    if (m) {
      const text = m[1].replace(/`/g, '').replace(/\*\*/g, '').trim()
      out.push({ id: slugify(m[1].trim()), text })
    }
  }
  return out
}
