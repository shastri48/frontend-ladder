---
title: Matrices & Graphs — Islands, Neighbours, Influencer & Union-Find
summary: Grids are graphs in disguise. Flood fill with DFS/BFS, encode island shapes, sum neighbours within distance k, update matrices in place, solve the "Influencer" (celebrity) problem and connect cities with union-find.
minutes: 22
---

## Grids are graphs

A 2D matrix is a graph where each cell is a node and edges connect it to its neighbours: 4-directional (up/down/left/right) or 8-directional (including diagonals). Frontend versions of grid problems are everywhere: game boards (tic-tac-toe, minesweeper, memory game), spreadsheets, image pixels (flood fill = paint bucket), calendar views, seat maps and Pinterest-style layouts.

```js
const DIRS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIRS_8 = [...DIRS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]]
const inBounds = (grid, r, c) => r >= 0 && c >= 0 && r < grid.length && c < grid[0].length
```

## Flood fill: DFS or BFS on a grid

To explore a connected region, start at a cell and visit every reachable neighbour that matches, **marking cells as visited** so you don't loop forever. Recursive DFS is shortest to write; BFS with a queue avoids stack overflows on huge grids (a 1000×1000 all-land grid would recurse 10⁶ deep).

## In-place vs out-of-place updates

Reddit asks about this explicitly. When each cell's new value depends on its **neighbours' old values** (Game of Life, blur filters, "set matrix zeroes"), updating in place can corrupt cells you haven't read yet.

| Approach | How | Space | Risk |
|---|---|---|---|
| Out-of-place | Write results into a new matrix, swap at the end | O(m·n) | None — simplest, and what React's immutable updates do |
| In-place with markers | Encode "old and new" in the same cell (e.g. 2 = was alive, now dead), then a second pass normalises | O(1) | Must ensure reads use the *old* meaning |
| In-place with transformations | Rotation = transpose + reverse rows | O(1) | Only works for specific operations |

## Graph representations

| | Adjacency list | Adjacency matrix |
|---|---|---|
| Storage | `Map<node, neighbours[]>` | `n × n` 0/1 matrix |
| Space | O(V + E) | O(V²) |
| "Is there an edge u→v?" | O(deg) | O(1) |
| Best for | Sparse graphs (most real ones) | Dense graphs, quick edge checks |

The "follows" matrix in the Influencer problem below is an adjacency matrix.

## Union-Find (Disjoint Set Union)

Union-find tracks which elements are in the same group, with two near-O(1) operations:

- `find(x)` — the representative (root) of x's group, with **path compression** (point nodes directly at the root as you go).
- `union(a, b)` — merge two groups, with **union by rank/size** (attach the smaller tree under the larger).

Uses: counting connected components, detecting cycles, Kruskal's minimum spanning tree ("minimum cost to connect cities"), grouping duplicate accounts.

## Interview questions

:::question
difficulty: medium
companies: Reddit
### In-place vs out-of-place matrix updates — trade-offs?
Out-of-place writes into a fresh matrix: simple, safe (reads always see old values), and naturally immutable — but O(m·n) extra memory. In-place saves memory but you must avoid reading values you've already overwritten: use multi-state encodings and a second normalisation pass, record decisions in the first row/column (set-matrix-zeroes trick), or use operations that compose safely (rotation = transpose + reverse). In UI state, prefer out-of-place (immutable) updates so React can detect changes by reference.
:::

## Challenges

:::challenge
difficulty: medium
### Number of islands
Given a grid of `'1'` (land) and `'0'` (water), count islands (groups of 4-directionally connected land). Don't mutate the input.
@@@starter
```js
function numIslands(grid) {
  // your code
}
```
@@@tests
```js
test('examples', () => {
  expect(numIslands([
    ['1', '1', '0', '0', '0'],
    ['1', '1', '0', '0', '0'],
    ['0', '0', '1', '0', '0'],
    ['0', '0', '0', '1', '1'],
  ])).toBe(3)
})
test('diagonal is not connected', () => {
  expect(numIslands([['1', '0'], ['0', '1']])).toBe(2)
})
test('empty and water', () => {
  expect(numIslands([])).toBe(0)
  expect(numIslands([['0']])).toBe(0)
})
test('input not mutated', () => {
  const g = [['1']]
  numIslands(g)
  expect(g).toEqual([['1']])
})
```
@@@solution
```js
function numIslands(grid) {
  if (!grid.length) return 0
  const rows = grid.length
  const cols = grid[0].length
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false))
  let count = 0

  const bfs = (sr, sc) => {
    const queue = [[sr, sc]]
    visited[sr][sc] = true
    for (let head = 0; head < queue.length; head++) {
      const [r, c] = queue[head]
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && !visited[nr][nc] && grid[nr][nc] === '1') {
          visited[nr][nc] = true // mark when enqueued, not when dequeued
          queue.push([nr, nc])
        }
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '1' && !visited[r][c]) {
        count++
        bfs(r, c)
      }
    }
  }
  return count
}
```
Every cell is visited once → O(m·n) time and space. Mark visited at **enqueue** time, otherwise the same cell can be queued many times.
:::

:::challenge
difficulty: hard
companies: Uber
### Number of distinct island shapes (DFS + shape encoding)
Count islands of `1`s with **distinct shapes** (translation only — no rotation/reflection). Grid values are numbers `0/1`.
@@@hint
Record each island's cells relative to its first cell (`r - r0, c - c0`), sort or keep a deterministic traversal order, join into a string, and add to a Set.
@@@starter
```js
function numDistinctIslands(grid) {
  // your code
}
```
@@@tests
```js
test('two identical shapes', () => {
  expect(numDistinctIslands([
    [1, 1, 0, 0, 0],
    [1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1],
  ])).toBe(1)
})
test('different shapes', () => {
  expect(numDistinctIslands([
    [1, 1, 0, 1, 1],
    [1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1],
    [1, 1, 0, 1, 1],
  ])).toBe(3)
})
test('no land', () => {
  expect(numDistinctIslands([[0, 0]])).toBe(0)
})
```
@@@solution
```js
function numDistinctIslands(grid) {
  const rows = grid.length
  const cols = rows ? grid[0].length : 0
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false))
  const shapes = new Set()

  for (let r0 = 0; r0 < rows; r0++) {
    for (let c0 = 0; c0 < cols; c0++) {
      if (grid[r0][c0] !== 1 || seen[r0][c0]) continue
      const cells = []
      const stack = [[r0, c0]]
      seen[r0][c0] = true
      while (stack.length) {
        const [r, c] = stack.pop()
        cells.push(`${r - r0}:${c - c0}`) // position relative to the island's origin
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && grid[nr][nc] === 1 && !seen[nr][nc]) {
            seen[nr][nc] = true
            stack.push([nr, nc])
          }
        }
      }
      shapes.add(cells.sort().join('|')) // canonical key independent of visit order
    }
  }
  return shapes.size
}
```
The origin is the first cell found in row-major scan (top-most, then left-most), so identical shapes always get identical relative coordinates. Sorting makes the key independent of traversal order. O(m·n·log) because of sorting per island; the alternative "path signature" (record direction moves + backtrack markers during DFS) avoids sorting.

In the second test the islands are: top-left `(0,0),(0,1),(1,0)` (an L), top-right `(0,3),(0,4)` (a horizontal pair), bottom-left `(3,0),(3,1)` (the same horizontal pair shape) and bottom-right `(2,4),(3,3),(3,4)` (a mirrored L, encoded as `0:0|1:-1|1:0`) — so 3 distinct shapes.
:::

:::challenge
difficulty: medium
companies: PhonePe
### Sum of a cell and its neighbours within distance k
Given a matrix, a position `(r, c)` and `k`, return the sum of all elements whose row and column are each within `k` of `(r, c)` (i.e. the square around it, diagonals included), clipped to the matrix bounds.
@@@starter
```js
function neighbourSum(matrix, r, c, k) {
  // your code
}
```
@@@tests
```js
const m = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]
test('k = 1 at centre covers everything', () => {
  expect(neighbourSum(m, 1, 1, 1)).toBe(45)
})
test('corner is clipped', () => {
  expect(neighbourSum(m, 0, 0, 1)).toBe(1 + 2 + 4 + 5)
})
test('k = 0 is the cell itself', () => {
  expect(neighbourSum(m, 2, 1, 0)).toBe(8)
})
test('large k', () => {
  expect(neighbourSum(m, 0, 2, 10)).toBe(45)
})
```
@@@solution
Direct (good for a single query):
```js
function neighbourSum(matrix, r, c, k) {
  const r1 = Math.max(0, r - k)
  const r2 = Math.min(matrix.length - 1, r + k)
  const c1 = Math.max(0, c - k)
  const c2 = Math.min(matrix[0].length - 1, c + k)
  let sum = 0
  for (let i = r1; i <= r2; i++) {
    for (let j = c1; j <= c2; j++) sum += matrix[i][j]
  }
  return sum
}
```
Clamping the bounds first avoids per-cell bounds checks. O(k²) per query.

**Follow-up — many queries:** build a 2D prefix-sum table once in O(m·n), then each query is O(1):
```js
function buildPrefix(matrix) {
  const m = matrix.length, n = matrix[0].length
  const P = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      P[i + 1][j + 1] = matrix[i][j] + P[i][j + 1] + P[i + 1][j] - P[i][j]
  return P
}
// sum of rectangle (r1,c1)-(r2,c2) = P[r2+1][c2+1] - P[r1][c2+1] - P[r2+1][c1] + P[r1][c1]
```
:::

:::challenge
difficulty: medium
### Rotate a matrix 90° clockwise in place
Rotate an `n × n` matrix in place (mutate it, O(1) extra space).
@@@starter
```js
function rotate(matrix) {
  // your code
}
```
@@@tests
```js
test('3x3', () => {
  const m = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
  rotate(m)
  expect(m).toEqual([[7, 4, 1], [8, 5, 2], [9, 6, 3]])
})
test('2x2 and 1x1', () => {
  const a = [[1, 2], [3, 4]]
  rotate(a)
  expect(a).toEqual([[3, 1], [4, 2]])
  const b = [[1]]
  rotate(b)
  expect(b).toEqual([[1]])
})
```
@@@solution
```js
function rotate(matrix) {
  const n = matrix.length
  // 1. transpose (swap across the main diagonal)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      ;[matrix[i][j], matrix[j][i]] = [matrix[j][i], matrix[i][j]]
    }
  }
  // 2. reverse each row
  for (const row of matrix) row.reverse()
}
```
Clockwise rotation = transpose + reverse rows (counter-clockwise = transpose + reverse columns). Each step only swaps pairs, so no value is lost — a safe in-place transformation. O(n²) time, O(1) space. The out-of-place version: `matrix[0].map((_, c) => matrix.map(row => row[c]).reverse())`.
:::

:::challenge
difficulty: medium
companies: Stable Money
### Find the Influencer (celebrity problem)
`follows[i][j] === 1` means user i follows user j; `follows[i][i] === 1`. An **Influencer** is followed by every other user and follows nobody else. Return the influencer's index, or `-1`. Aim for O(n).
@@@hint
Elimination: compare candidate `c` with `i`. If `c` follows `i`, `c` can't be the influencer → `c = i`. Otherwise `i` can't be. One pass leaves a single candidate; verify it.
@@@starter
```js
function findInfluencer(follows) {
  // your code
}
```
@@@tests
```js
test('example from the doc', () => {
  expect(findInfluencer([
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 1],
  ])).toBe(1)
})
test('no influencer', () => {
  expect(findInfluencer([
    [1, 1],
    [1, 1],
  ])).toBe(-1)
  expect(findInfluencer([
    [1, 0, 0],
    [0, 1, 0],
    [0, 1, 1],
  ])).toBe(-1)
})
test('single user', () => {
  expect(findInfluencer([[1]])).toBe(0)
})
```
@@@solution
```js
function findInfluencer(follows) {
  const n = follows.length
  let candidate = 0
  // 1. elimination pass: each comparison rules out one person
  for (let i = 1; i < n; i++) {
    if (follows[candidate][i] === 1) candidate = i // candidate follows someone → not influencer
    // else: i isn't followed by candidate → i is not influencer
  }
  // 2. verification pass
  for (let i = 0; i < n; i++) {
    if (i === candidate) continue
    if (follows[candidate][i] === 1 || follows[i][candidate] !== 1) return -1
  }
  return candidate
}
```
**Brute force** checks each person's row and column: O(n²). **Elimination** needs n − 1 comparisons to find the only possible candidate, then O(n) to verify — **O(n) time, O(1) space**. The verification is essential: the elimination always leaves *someone* even when no influencer exists (second test). In the doc's example, user 0 follows 1 → candidate becomes 1; 1 doesn't follow 2 → stays 1; verify: 0 and 2 follow 1, 1 follows nobody else ✓.
:::

:::challenge
difficulty: hard
companies: Uber
### Minimum cost to connect cities (Kruskal + Union-Find, with forced & restricted edges)
Cities are `0..n-1`. `edges` is a list of `[u, v, cost]`. Return the minimum total cost to connect all cities, or `-1` if impossible.
Constraints: every edge listed in `forced` (as `[u, v, cost]`) **must** be used; edges in `restricted` (as `[u, v]`, either direction) **cannot** be used.
@@@hint
Union-find with path compression. Add forced edges first (their cost counts even if they create a cycle — they're mandatory). Then run Kruskal on the remaining allowed edges sorted by cost.
@@@starter
```js
function minCostConnect(n, edges, forced = [], restricted = []) {
  // your code
}
```
@@@tests
```js
test('plain MST', () => {
  expect(minCostConnect(4, [[0, 1, 1], [1, 2, 2], [2, 3, 3], [0, 3, 10], [0, 2, 5]])).toBe(6)
})
test('impossible', () => {
  expect(minCostConnect(3, [[0, 1, 1]])).toBe(-1)
})
test('forced edge is included', () => {
  expect(minCostConnect(4, [[0, 1, 1], [1, 2, 2], [2, 3, 3], [0, 3, 10]], [[0, 3, 10]])).toBe(13)
})
test('restricted edge is skipped', () => {
  expect(minCostConnect(3, [[0, 1, 1], [1, 2, 1], [0, 2, 5]], [], [[2, 1]])).toBe(6)
})
test('single city', () => {
  expect(minCostConnect(1, [])).toBe(0)
})
```
@@@solution
```js
class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i)
    this.size = new Array(n).fill(1)
    this.components = n
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]] // path compression (halving)
      x = this.parent[x]
    }
    return x
  }
  union(a, b) {
    let ra = this.find(a)
    let rb = this.find(b)
    if (ra === rb) return false
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra] // union by size
    this.parent[rb] = ra
    this.size[ra] += this.size[rb]
    this.components--
    return true
  }
}

function minCostConnect(n, edges, forced = [], restricted = []) {
  const key = (u, v) => (u < v ? `${u}-${v}` : `${v}-${u}`)
  const banned = new Set(restricted.map(([u, v]) => key(u, v)))
  const forcedKeys = new Set(forced.map(([u, v]) => key(u, v)))
  const uf = new UnionFind(n)
  let cost = 0

  for (const [u, v, w] of forced) {       // mandatory edges first
    if (banned.has(key(u, v))) return -1  // contradictory constraints
    uf.union(u, v)
    cost += w
  }

  const candidates = edges
    .filter(([u, v]) => !banned.has(key(u, v)) && !forcedKeys.has(key(u, v)))
    .sort((a, b) => a[2] - b[2])

  for (const [u, v, w] of candidates) {
    if (uf.union(u, v)) cost += w          // only take edges joining two components
    if (uf.components === 1) break
  }

  return uf.components === 1 ? cost : -1
}
```
**Kruskal's greedy idea:** always take the cheapest edge that connects two different components; skip edges that would form a cycle. Union-find answers "same component?" in near-O(1) (inverse Ackermann). **O(E log E)** for sorting.

The forced/restricted twist (the Uber round-2 question that "struggled with edge cases") reduces to: pre-union forced edges and count their cost, filter banned ones, then run normal Kruskal. Edge cases: contradictory constraints, forced edges forming a cycle (still paid for), disconnected graph → −1, n = 1 → 0.
:::

## Quick check

:::quiz
### Why mark grid cells visited when enqueuing in BFS instead of when dequeuing?
- [ ] It's required by JavaScript
- [x] Otherwise the same cell can be enqueued many times by different neighbours
- [ ] To get DFS order
- [ ] It doesn't matter
@@@explain
Marking early guarantees each cell enters the queue once, keeping BFS O(cells).
:::

:::quiz
### The celebrity/influencer elimination pass works because…
- [ ] The matrix is symmetric
- [x] Every comparison rules out at least one of the two people
- [ ] Influencers always have the highest index
- [ ] It sorts users by followers
@@@explain
If A follows B, A is out; if A doesn't follow B, B is out. n − 1 comparisons leave one candidate to verify.
:::
