---
title: Trees — Traversals, BST Validation, Duplicate Subtrees & Flattening
summary: The DOM, the React tree, JSON and file explorers are all trees. Learn DFS and BFS traversals and the tree problems frontend interviews ask (Groww, PhonePe, Sprinklr).
minutes: 20
---

## You work with trees every day

- The **DOM** is a tree of nodes; `querySelectorAll` is a tree traversal.
- **React** builds a component tree and reconciles it against the previous one.
- **JSON** responses, nested comments (Reddit), file explorers, menus and org charts are trees.
- Bundlers build a **dependency graph** (a tree when there are no cycles).

So tree traversal isn't academic — it's how you'd implement `getElementsByStyle`, render nested comments, expand/collapse a file tree or diff virtual DOM.

## Vocabulary

```text
            1          ← root (depth 0)
          /   \
         2     3       ← 2 and 3 are children of 1, siblings of each other
        / \     \
       4   5     6     ← leaves (no children); height of tree = 2
```

- **Binary tree**: each node has at most two children, `left` and `right`.
- **Binary search tree (BST)**: for every node, all values in the left subtree are smaller and all in the right subtree are larger — so in-order traversal yields sorted values and search is O(height).
- **Balanced**: height ≈ log n. A degenerate (linked-list-shaped) tree has height n.

In JS we'll represent nodes as plain objects: `{ val, left, right }`.

## Depth-first search (DFS)

Go deep before going wide. Three orders, depending on when you "visit" the node:

| Order | Visit sequence | Example output for tree above | Use |
|---|---|---|---|
| Pre-order | node → left → right | 1 2 4 5 3 6 | Copy/serialise a tree, render parents before children |
| In-order | left → node → right | 4 2 5 1 3 6 | Sorted output of a BST |
| Post-order | left → right → node | 4 5 2 6 3 1 | Delete/free children first, compute subtree sizes/heights, bundle dependencies |

```js
function preorder(node, out = []) {
  if (!node) return out
  out.push(node.val)
  preorder(node.left, out)
  preorder(node.right, out)
  return out
}
```

Recursion uses the call stack — O(h) space. For very deep trees, convert to an explicit stack to avoid "Maximum call stack size exceeded".

## Breadth-first search (BFS)

Level by level, using a **queue**: process a node, enqueue its children. Output for the tree above: `[[1], [2, 3], [4, 5, 6]]`. Use BFS for "shortest path in an unweighted graph", "nodes at depth k", rendering levels, and finding the nearest match.

```js
function levelOrder(root) {
  if (!root) return []
  const result = []
  let queue = [root]
  while (queue.length) {
    result.push(queue.map((n) => n.val))
    queue = queue.flatMap((n) => [n.left, n.right].filter(Boolean)) // next level
  }
  return result
}
```

## Recursion template for tree problems

Most tree questions are "compute something for each subtree and combine":

```js
function solve(node) {
  if (!node) return BASE_CASE
  const left = solve(node.left)
  const right = solve(node.right)
  return COMBINE(node, left, right)
}
```

Max depth: base 0, combine `1 + Math.max(left, right)`. Count nodes: `1 + left + right`. Serialise: `` `(${left},${node.val},${right})` ``.

## Interview questions

:::question
difficulty: easy
companies: Groww
### Describe different tree traversal techniques.
DFS goes deep along one branch before backtracking — pre-order (node, left, right), in-order (left, node, right; sorted for a BST) and post-order (left, right, node). It's implemented recursively or with an explicit stack, using O(h) memory. BFS (level-order) visits nodes level by level using a queue, using O(w) memory for the widest level. Choose DFS for subtree computations and path problems, BFS for shortest-distance/level problems.
:::

:::question
difficulty: medium
### How is the DOM traversed by querySelectorAll?
Conceptually a pre-order depth-first traversal starting from the context element, testing each element against the selector, which is why results come back in **document order**. Browsers optimise selector matching right-to-left (match the key selector first, then check ancestors) and cache style/selector data.
:::

## Challenges

:::challenge
difficulty: easy
companies: Groww
### Tree traversals
Implement `inorder(root)`, `postorder(root)` (both returning arrays of values; use any method) and `levelOrder(root)` returning an array of levels.
@@@starter
```js
function inorder(root) {
  // your code
}
function postorder(root) {
  // your code
}
function levelOrder(root) {
  // your code
}
```
@@@tests
```js
const node = (val, left = null, right = null) => ({ val, left, right })
const tree = node(1, node(2, node(4), node(5)), node(3, null, node(6)))
test('inorder', () => {
  expect(inorder(tree)).toEqual([4, 2, 5, 1, 3, 6])
})
test('postorder', () => {
  expect(postorder(tree)).toEqual([4, 5, 2, 6, 3, 1])
})
test('levelOrder', () => {
  expect(levelOrder(tree)).toEqual([[1], [2, 3], [4, 5, 6]])
})
test('empty tree', () => {
  expect(inorder(null)).toEqual([])
  expect(levelOrder(null)).toEqual([])
})
```
@@@solution
Iterative in-order with a stack (shows you can avoid recursion):
```js
function inorder(root) {
  const out = []
  const stack = []
  let cur = root
  while (cur || stack.length) {
    while (cur) { stack.push(cur); cur = cur.left } // go as left as possible
    cur = stack.pop()
    out.push(cur.val)                               // visit
    cur = cur.right                                 // then the right subtree
  }
  return out
}

function postorder(root, out = []) {
  if (!root) return out
  postorder(root.left, out)
  postorder(root.right, out)
  out.push(root.val)
  return out
}

function levelOrder(root) {
  if (!root) return []
  const result = []
  const queue = [root]
  let head = 0                         // index pointer instead of O(n) shift()
  while (head < queue.length) {
    const levelSize = queue.length - head
    const level = []
    for (let i = 0; i < levelSize; i++) {
      const n = queue[head++]
      level.push(n.val)
      if (n.left) queue.push(n.left)
      if (n.right) queue.push(n.right)
    }
    result.push(level)
  }
  return result
}
```
All O(n) time. DFS uses O(h) space; BFS uses O(w). Using a head index avoids `shift()`, which is O(n) on arrays.
:::

:::challenge
difficulty: easy
### Maximum depth of a binary tree
@@@starter
```js
function maxDepth(root) {
  // your code
}
```
@@@tests
```js
const node = (val, left = null, right = null) => ({ val, left, right })
test('depths', () => {
  expect(maxDepth(null)).toBe(0)
  expect(maxDepth(node(1))).toBe(1)
  expect(maxDepth(node(3, node(9), node(20, node(15), node(7))))).toBe(3)
})
```
@@@solution
```js
function maxDepth(root) {
  if (!root) return 0
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right))
}
```
The recursion template in its purest form. O(n) time, O(h) space. Real-world twin: computing the nesting depth of comments or a JSON payload.
:::

:::challenge
difficulty: medium
companies: Groww
### Validate a binary search tree
Return `true` if the tree is a valid BST (strictly smaller values on the left, strictly larger on the right, for **every** ancestor — not just the parent).
@@@hint
Pass down the allowed `(min, max)` range for each node.
@@@starter
```js
function isValidBST(root) {
  // your code
}
```
@@@tests
```js
const node = (val, left = null, right = null) => ({ val, left, right })
test('valid', () => {
  expect(isValidBST(node(2, node(1), node(3)))).toBe(true)
  expect(isValidBST(null)).toBe(true)
})
test('child violates grandparent', () => {
  // 5 → right 6 → left 4 : 4 < 5 but in the right subtree of 5
  expect(isValidBST(node(5, node(1), node(6, node(4), node(7))))).toBe(false)
})
test('duplicates are invalid', () => {
  expect(isValidBST(node(2, node(2), null))).toBe(false)
})
```
@@@solution
```js
function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true
  if (root.val <= min || root.val >= max) return false
  return (
    isValidBST(root.left, min, root.val) &&  // left subtree must stay below root
    isValidBST(root.right, root.val, max)    // right subtree must stay above root
  )
}
```
The common bug is only comparing a node with its direct children — which accepts the second test tree. Alternative: in-order traversal must be strictly increasing. O(n) time, O(h) space.
:::

:::challenge
difficulty: hard
companies: PhonePe
### Does a binary tree contain a duplicate subtree?
Return `true` if the tree contains two identical subtrees (same structure and values) of **size 2 or more** (single leaves don't count).
@@@hint
Serialise every subtree in post-order (e.g. `"(left)val(right)"`), store serialisations in a Set, and check for repeats among non-leaf subtrees.
@@@starter
```js
function hasDuplicateSubtree(root) {
  // your code
}
```
@@@tests
```js
const node = (val, left = null, right = null) => ({ val, left, right })
test('has duplicate', () => {
  //        A
  //      /   \
  //     B     C
  //    / \     \
  //   D   E     B
  //            / \
  //           D   E
  const t = node('A', node('B', node('D'), node('E')), node('C', null, node('B', node('D'), node('E'))))
  expect(hasDuplicateSubtree(t)).toBe(true)
})
test('only duplicate leaves', () => {
  const t = node('A', node('B', node('D')), node('C', node('D')))
  expect(hasDuplicateSubtree(t)).toBe(false)
})
test('same values, different structure', () => {
  const t = node(1, node(2, node(3)), node(2, null, node(3)))
  expect(hasDuplicateSubtree(t)).toBe(false)
})
```
@@@solution
```js
function hasDuplicateSubtree(root) {
  const seen = new Set()
  let found = false

  function serialize(node) {
    if (!node) return '#'
    const s = `(${serialize(node.left)},${node.val},${serialize(node.right)})`
    const isLeaf = !node.left && !node.right
    if (!isLeaf) {
      if (seen.has(s)) found = true
      seen.add(s)
    }
    return s
  }

  serialize(root)
  return found
}
```
Post-order serialisation gives each subtree a unique string (the `#` markers for empty children distinguish `2→left 3` from `2→right 3`). Identical subtrees produce identical strings. This is O(n²) in the worst case due to string building; the optimal version assigns each unique serialisation a small integer id (`map.get(key) ?? map.set(...)`) so keys stay O(1) in size → O(n). Same idea as React keys and memo caches: canonical identity for structures.
:::

:::challenge
difficulty: medium
### Flatten a binary tree to a linked list (in place)
Rearrange the tree so each node's `right` points to the next node in **pre-order** and every `left` is `null`. Return nothing; modify in place.
@@@starter
```js
function flattenTree(root) {
  // your code
}
```
@@@tests
```js
const node = (val, left = null, right = null) => ({ val, left, right })
function toList(n) { const out = []; while (n) { out.push(n.val); if (n.left) out.push('LEFT!'); n = n.right } return out }
test('flattens in preorder', () => {
  const t = node(1, node(2, node(3), node(4)), node(5, null, node(6)))
  flattenTree(t)
  expect(toList(t)).toEqual([1, 2, 3, 4, 5, 6])
})
test('single and empty', () => {
  const t = node(1)
  flattenTree(t)
  expect(toList(t)).toEqual([1])
  flattenTree(null)
})
```
@@@solution
O(1) extra space ("Morris-like") approach:
```js
function flattenTree(root) {
  let cur = root
  while (cur) {
    if (cur.left) {
      // find the rightmost node of the left subtree
      let pred = cur.left
      while (pred.right) pred = pred.right
      // splice: left subtree goes between cur and cur.right
      pred.right = cur.right
      cur.right = cur.left
      cur.left = null
    }
    cur = cur.right
  }
}
```
For each node with a left child, the left subtree must come right after it in pre-order, followed by the old right subtree. So we attach the old right subtree to the end of the left subtree, then move the left subtree to the right. O(n) time (each edge walked a constant number of times), O(1) space. A recursive reverse-pre-order version (right, left, node with a `prev` pointer) is also common.
:::

## Quick check

:::quiz
### In-order traversal of a valid BST produces…
- [ ] Values in insertion order
- [x] Values in ascending sorted order
- [ ] Root first, then leaves
- [ ] Level by level
@@@explain
Left subtree < node < right subtree at every level, so left-node-right visits values in sorted order.
:::

:::quiz
### Which traversal processes children before the parent (e.g. computing subtree sizes)?
- [ ] Pre-order
- [ ] In-order
- [x] Post-order
- [ ] BFS
@@@explain
Post-order visits left, right, then node — children's results are ready when the parent is processed.
:::
