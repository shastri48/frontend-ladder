import { memo, useCallback } from 'react'
import { renderMarkdown } from '../lib/markdown'

function onClick(e: React.MouseEvent<HTMLDivElement>) {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]')
  if (!btn) return
  const code = btn.parentElement?.querySelector('code')?.textContent ?? ''
  navigator.clipboard?.writeText(code).then(
    () => {
      btn.textContent = 'copied ✓'
      setTimeout(() => (btn.textContent = 'copy'), 1400)
    },
    () => {},
  )
}

export const Markdown = memo(function Markdown({
  text,
  className = '',
  compact,
}: {
  text: string
  className?: string
  compact?: boolean
}) {
  const handle = useCallback(onClick, [])
  return (
    <div
      className={`lesson-prose prose dark:prose-invert ${compact ? 'compact' : ''} ${className}`}
      onClick={handle}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  )
})
