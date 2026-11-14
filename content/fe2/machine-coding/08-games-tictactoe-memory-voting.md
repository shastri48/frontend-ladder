---
title: Games and Mini-Apps — Tic-Tac-Toe, Memory Game, Would-You-Rather
summary: Three classic machine-coding builds that test state modelling, derived state, timers and clean component boundaries.
minutes: 20
---

## Why games show up in interviews

Games are small but full of state transitions: turns, win detection, timers, resets, history. They reveal whether you model state **minimally** and derive the rest, whether you handle timers without stale closures, and whether your logic is testable outside React.

A good pattern for all of them:

```text
pure game logic (functions, no React)  ←  unit-testable
        ▲
state (useState / useReducer) holds the minimal facts
        ▲
components render derived values and dispatch user intents
```

## Tic-tac-toe

Minimal state: the **board** (9 cells) — and for undo, a **history** of boards plus the current move index. `xIsNext`, the winner, and "is it a draw?" are all **derived**.

:::challenge
difficulty: medium
### Tic-tac-toe with N×N board, winner highlight and undo
Build tic-tac-toe where:
- Board size `n` is a prop (3 by default); a player wins with `n` in a row (row, column, both diagonals).
- Winning cells are highlighted; draws are detected.
- "Undo" and "Restart" buttons; a move list to jump back in time.
- Game logic is a pure function you could unit test.
@@@solution
```jsx
import { useMemo, useState } from 'react'

// Pure logic — O(n²), returns { winner, line } or null
export function getWinner(board, n) {
  const lines = []
  for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c))       // rows
  for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c))       // cols
  lines.push(Array.from({ length: n }, (_, i) => i * n + i))                                    // diag
  lines.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)))                          // anti-diag
  for (const line of lines) {
    const first = board[line[0]]
    if (first && line.every((i) => board[i] === first)) return { winner: first, line }
  }
  return null
}

export function TicTacToe({ n = 3 }) {
  const [history, setHistory] = useState(() => [Array(n * n).fill(null)])
  const [step, setStep] = useState(0)

  const board = history[step]
  const xIsNext = step % 2 === 0                        // derived from step, not stored
  const result = useMemo(() => getWinner(board, n), [board, n])
  const isDraw = !result && board.every(Boolean)

  function play(i) {
    if (board[i] || result) return
    const next = board.slice()
    next[i] = xIsNext ? 'X' : 'O'
    setHistory((h) => [...h.slice(0, step + 1), next])  // drop any "future" after time travel
    setStep((s) => s + 1)
  }

  const status = result ? `Winner: ${result.winner}` : isDraw ? 'Draw!' : `Next: ${xIsNext ? 'X' : 'O'}`

  return (
    <div className="ttt">
      <p role="status" aria-live="polite">{status}</p>
      <div className="ttt__grid" style={{ gridTemplateColumns: `repeat(${n}, 64px)` }} role="grid">
        {board.map((cell, i) => (
          <button
            key={i}
            className={`ttt__cell ${result?.line.includes(i) ? 'is-win' : ''}`}
            onClick={() => play(i)}
            disabled={!!cell || !!result}
            aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}: ${cell ?? 'empty'}`}
          >
            {cell}
          </button>
        ))}
      </div>
      <div className="ttt__controls">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Undo</button>
        <button onClick={() => { setHistory([Array(n * n).fill(null)]); setStep(0) }}>Restart</button>
      </div>
      <ol className="ttt__moves">
        {history.map((_, m) => (
          <li key={m}>
            <button onClick={() => setStep(m)} aria-current={m === step ? 'step' : undefined}>
              {m === 0 ? 'Go to start' : `Go to move #${m}`}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
```
```css
.ttt__grid { display: grid; gap: 4px; }
.ttt__cell { width: 64px; height: 64px; font-size: 28px; font-weight: 700; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; }
.ttt__cell.is-win { background: #bbf7d0; }
```
Discussion:
- Minimal state = history + step. Turn, winner and draw are derived → impossible to desync.
- `history.slice(0, step + 1)` handles playing after undo (branching discards the future).
- Win check is pure and generic for N; for very large boards check only lines through the **last move** (O(n) instead of O(n²)).
- Follow-ups: AI opponent (minimax for 3×3), K-in-a-row on N×N (Gomoku), online multiplayer (WebSocket, server is the source of truth).
:::

## Memory game (match the pairs)

:::challenge
difficulty: medium
### Memory card game
Build a memory game:
- 16 cards (8 pairs) shuffled; click to flip; two flipped non-matching cards flip back after 800 ms; matches stay face up.
- Block clicks while two unmatched cards are showing; count moves; show a timer and a "You won in N moves" message; Restart reshuffles.
@@@solution
```jsx
import { useEffect, useRef, useState } from 'react'

const EMOJIS = ['🍎', '🍌', '🍇', '🍉', '🍒', '🥝', '🍍', '🥥']

function shuffle(arr) {                       // Fisher–Yates — unbiased (sort(() => Math.random()-.5) is biased)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const newDeck = () => shuffle([...EMOJIS, ...EMOJIS]).map((face, i) => ({ id: i, face }))

export function MemoryGame() {
  const [deck, setDeck] = useState(newDeck)
  const [flipped, setFlipped] = useState([])       // ids of currently face-up unmatched cards (max 2)
  const [matched, setMatched] = useState(() => new Set())
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const timeoutRef = useRef(null)

  const won = matched.size === deck.length
  const started = moves > 0 || flipped.length > 0

  // Timer — runs while playing
  useEffect(() => {
    if (!started || won) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)   // functional update → no stale closure
    return () => clearInterval(id)
  }, [started, won])

  // Clear pending flip-back timeout on unmount
  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  function flip(card) {
    if (flipped.length === 2 || flipped.includes(card.id) || matched.has(card.id)) return
    const next = [...flipped, card.id]
    setFlipped(next)
    if (next.length < 2) return

    setMoves((m) => m + 1)
    const [a, b] = next.map((id) => deck.find((c) => c.id === id))
    if (a.face === b.face) {
      setMatched((prev) => new Set(prev).add(a.id).add(b.id))
      setFlipped([])
    } else {
      timeoutRef.current = setTimeout(() => setFlipped([]), 800)
    }
  }

  function restart() {
    clearTimeout(timeoutRef.current)
    setDeck(newDeck()); setFlipped([]); setMatched(new Set()); setMoves(0); setSeconds(0)
  }

  return (
    <div className="memory">
      <header>
        <span>Moves: {moves}</span> <span>Time: {seconds}s</span>
        <button onClick={restart}>Restart</button>
      </header>
      {won && <p role="status">🎉 You won in {moves} moves and {seconds}s!</p>}
      <div className="memory__grid">
        {deck.map((card) => {
          const faceUp = flipped.includes(card.id) || matched.has(card.id)
          return (
            <button
              key={card.id}
              className={`memory__card ${faceUp ? 'is-up' : ''} ${matched.has(card.id) ? 'is-matched' : ''}`}
              onClick={() => flip(card)}
              aria-label={faceUp ? card.face : 'Hidden card'}
              disabled={matched.has(card.id)}
            >
              <span className="memory__inner">
                <span className="memory__front">{card.face}</span>
                <span className="memory__back">?</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```
```css
.memory__grid { display: grid; grid-template-columns: repeat(4, 72px); gap: 8px; }
.memory__card { width: 72px; height: 72px; border: 0; background: none; perspective: 600px; padding: 0; }
.memory__inner { position: relative; display: block; width: 100%; height: 100%; transition: transform .4s; transform-style: preserve-3d; }
.memory__card.is-up .memory__inner { transform: rotateY(180deg); }
.memory__front, .memory__back { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 10px; font-size: 32px; backface-visibility: hidden; }
.memory__back { background: #6366f1; color: #fff; }
.memory__front { background: #fff; border: 1px solid #e2e8f0; transform: rotateY(180deg); }
.memory__card.is-matched .memory__front { background: #dcfce7; }
```
Points:
- State: deck, up-to-two `flipped` ids, `matched` Set, moves, seconds. "Won" and "started" are derived.
- **Input lock** while two cards are showing (`flipped.length === 2`).
- Timer uses a functional update (`s => s + 1`) so the interval callback never reads a stale `seconds`.
- Timeouts are tracked in a ref and cleared on restart/unmount (no state updates on unmounted components, no ghost flips after restart).
- **Fisher–Yates** shuffle; `sort(() => Math.random() - 0.5)` is biased.
- 3D flip with `transform` + `backface-visibility` (compositor-friendly).
- Follow-ups: difficulty levels (grid size), best score in localStorage, multiplayer turns.
:::

## Would-you-rather voting app

A popular take-home/live prompt: show a question with two options; users vote; show percentages; move to the next question.

:::challenge
difficulty: easy
### Would-you-rather
Given `questions = [{ id, optionA, optionB, votesA, votesB }]`:
- Show one question at a time with two big buttons.
- After voting, show each option's percentage (animated bar) and highlight the user's choice; disable re-voting.
- "Next" goes to the next unanswered question; show a summary at the end.
- Votes persist across reloads (localStorage).
@@@solution
```jsx
import { useEffect, useState } from 'react'

const QUESTIONS = [
  { id: 'q1', optionA: 'Have the ability to fly', optionB: 'Be invisible', votesA: 120, votesB: 80 },
  { id: 'q2', optionA: 'Work from home forever', optionB: 'Work from the office forever', votesA: 300, votesB: 45 },
  { id: 'q3', optionA: 'Only use tabs', optionB: 'Only use spaces', votesA: 50, votesB: 50 },
]

function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch {} }, [key, value])
  return [value, setValue]
}

export function WouldYouRather({ questions = QUESTIONS }) {
  const [answers, setAnswers] = useStoredState('wyr-answers', {})   // { [id]: 'A' | 'B' }
  const [index, setIndex] = useState(() => {
    const i = questions.findIndex((q) => !answers[q.id])
    return i === -1 ? questions.length : i
  })

  if (index >= questions.length) {
    return (
      <section>
        <h2>All done! 🎉</h2>
        <ul>{questions.map((q) => <li key={q.id}>You chose: {answers[q.id] === 'A' ? q.optionA : q.optionB}</li>)}</ul>
        <button onClick={() => { setAnswers({}); setIndex(0) }}>Start over</button>
      </section>
    )
  }

  const q = questions[index]
  const choice = answers[q.id]
  const a = q.votesA + (choice === 'A' ? 1 : 0)       // include the user's vote
  const b = q.votesB + (choice === 'B' ? 1 : 0)
  const pct = (v) => Math.round((v / (a + b)) * 100)

  const vote = (opt) => { if (!choice) setAnswers((prev) => ({ ...prev, [q.id]: opt })) }

  return (
    <section className="wyr">
      <h2>Would you rather…</h2>
      <div className="wyr__options">
        {[['A', q.optionA, a], ['B', q.optionB, b]].map(([key, label, votes]) => (
          <button
            key={key}
            className={`wyr__option ${choice === key ? 'is-chosen' : ''}`}
            onClick={() => vote(key)}
            disabled={!!choice}
            aria-pressed={choice === key}
          >
            <span>{label}</span>
            {choice && (
              <span className="wyr__result">
                <span className="wyr__bar" style={{ transform: `scaleX(${pct(votes) / 100})` }} />
                <strong>{pct(votes)}%</strong> ({votes} votes)
              </span>
            )}
          </button>
        ))}
      </div>
      {choice && <button onClick={() => setIndex((i) => i + 1)} autoFocus>Next question →</button>}
      <p>{index + 1} / {questions.length}</p>
    </section>
  )
}
```
```css
.wyr__options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.wyr__option { padding: 24px; border-radius: 16px; border: 2px solid #e2e8f0; background: #fff; font-size: 1.1rem; text-align: left; }
.wyr__option.is-chosen { border-color: #6366f1; }
.wyr__result { display: block; position: relative; margin-top: 12px; }
.wyr__bar { position: absolute; inset: 0; background: #e0e7ff; transform-origin: left; transition: transform .6s ease; z-index: -1; }
@media (max-width: 600px) { .wyr__options { grid-template-columns: 1fr; } }
```
Notes: answers keyed by question id (not index) so reordering questions doesn't corrupt them; percentages derived; bar animates with `scaleX` (compositor); persisted through a tiny `useStoredState` hook with try/catch. In a real app, votes go to an API with **optimistic update**, server-side dedupe per user, and percentages from the server response.
:::

## Quick check

:::quiz
### In tic-tac-toe with history, what should be stored in state?
- [ ] board, xIsNext, winner, isDraw
- [x] history of boards and the current step
- [ ] only the winner
- [ ] the DOM cells
@@@explain
Whose turn it is and the winner are derived from the board/step.
:::

:::quiz
### Why is `array.sort(() => Math.random() - 0.5)` a poor shuffle?
- [ ] It's too slow
- [x] It produces a biased (non-uniform) distribution
- [ ] It throws on objects
- [ ] It doesn't mutate the array
@@@explain
Comparison sorts assume a consistent comparator; random comparisons skew results. Use Fisher–Yates.
:::
