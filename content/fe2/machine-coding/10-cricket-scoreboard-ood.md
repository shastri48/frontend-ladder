---
title: Cricket Scoreboard — Object-Oriented Design in JavaScript
summary: PhonePe's machine-coding round — model a cricket match with classes, handle extras, wickets and strike rotation, and print a scorecard every over.
minutes: 18
---

## The prompt (PhonePe, Software Engineer)

> Build a cricket scorecard system that displays the team score and each player's performance.
> - Inputs: number of players per team, number of overs, and batting order.
> - Ball-by-ball input includes runs, wides, no-balls or wickets.
> - At the end of every over, print individual scores, balls faced, number of 4s and 6s, total team score and wickets.
> - Implement strike changes, handle extras, and determine the match winner.

This is a **low-level design** (LLD) round in disguise. They want clean classes, single responsibilities, correct domain rules and code that's easy to extend (e.g. adding bowler figures).

## Clarify the domain rules first

| Ball | Runs to team | Ball counts toward over? | Batter's balls faced | Strike change? |
|---|---|---|---|---|
| `0`–`6` runs | +runs (to batter) | Yes | +1 | If runs are **odd** |
| `Wd` (wide) | +1 extra | **No** | No | No |
| `Nb` (no-ball) | +1 extra (+ runs hit, credited to batter) | **No** | +1 | If runs hit are odd |
| `W` (wicket) | 0 | Yes | +1 | New batter comes in **at the same end** |
| End of over (6 legal balls) | — | — | — | **Swap strike** |

The innings ends when overs are complete or the team is **all out** (players − 1 wickets). In the second innings, it also ends as soon as the target is passed.

## Design

```text
Match
 ├── teams: [Team, Team]
 ├── overs: number
 ├── innings: [Innings, Innings]
 └── result()
Team
 ├── name
 └── players: Player[]   (batting order)
Innings
 ├── battingTeam, totalOvers, target?
 ├── score, wickets, extras, legalBalls
 ├── striker, nonStriker, nextBatterIndex
 ├── bowl(ball)  ← parses one ball input and updates state
 ├── isOver()
 └── scorecard()
Player
 └── runs, balls, fours, sixes, isOut
```

Responsibilities:

- `Player` only tracks its own stats.
- `Innings` owns the rules of a single innings (strike, extras, wickets, end conditions).
- `Match` coordinates two innings and decides the winner.
- Parsing input (`"1"`, `"Wd"`, `"Nb4"`, `"W"`) is isolated in one function — easy to extend (byes, leg-byes, run-outs).

:::challenge
difficulty: hard
companies: PhonePe
### Implement the cricket scoreboard
Implement `Player`, `Team`, `Innings` and `Match` classes per the rules above. `Innings.bowl(input)` accepts `'0'..'6'`, `'Wd'`, `'Nb'` or `'Nb<runs>'` and `'W'`. Print the scorecard at the end of each over and determine the winner after both innings.
@@@solution
```js
class Player {
  constructor(name) {
    this.name = name
    this.runs = 0
    this.balls = 0
    this.fours = 0
    this.sixes = 0
    this.isOut = false
  }
  addRuns(runs) {
    this.runs += runs
    if (runs === 4) this.fours++
    if (runs === 6) this.sixes++
  }
  faceBall() { this.balls++ }
}

class Team {
  constructor(name, playerNames) {
    this.name = name
    this.players = playerNames.map((n) => new Player(n))
  }
}

function parseBall(input) {
  const s = String(input).trim()
  if (/^[0-6]$/.test(s)) return { kind: 'runs', runs: +s }
  if (s === 'Wd') return { kind: 'wide', runs: 0 }
  const nb = s.match(/^Nb([0-6])?$/)
  if (nb) return { kind: 'noball', runs: nb[1] ? +nb[1] : 0 }
  if (s === 'W') return { kind: 'wicket', runs: 0 }
  throw new Error(`Invalid ball input: "${input}"`)
}

class Innings {
  constructor(team, totalOvers, target = null, log = console.log) {
    this.team = team
    this.totalOvers = totalOvers
    this.target = target
    this.log = log
    this.score = 0
    this.wickets = 0
    this.extras = 0
    this.legalBalls = 0
    this.striker = team.players[0]
    this.nonStriker = team.players[1]
    this.nextBatter = 2
  }

  get maxWickets() { return this.team.players.length - 1 }
  get oversText() { return `${Math.floor(this.legalBalls / 6)}.${this.legalBalls % 6}` }

  isOver() {
    return (
      this.legalBalls >= this.totalOvers * 6 ||
      this.wickets >= this.maxWickets ||
      (this.target !== null && this.score >= this.target)
    )
  }

  swapStrike() { [this.striker, this.nonStriker] = [this.nonStriker, this.striker] }

  bowl(input) {
    if (this.isOver()) throw new Error('Innings is over')
    const ball = parseBall(input)

    switch (ball.kind) {
      case 'wide':
        this.score += 1
        this.extras += 1
        return                                   // not a legal ball, no strike change
      case 'noball':
        this.score += 1 + ball.runs
        this.extras += 1
        this.striker.faceBall()                  // batter faced it (common convention)
        this.striker.addRuns(ball.runs)
        if (ball.runs % 2 === 1) this.swapStrike()
        return                                   // not a legal ball
      case 'wicket':
        this.striker.faceBall()
        this.striker.isOut = true
        this.wickets++
        this.legalBalls++
        if (this.wickets < this.maxWickets) {
          this.striker = this.team.players[this.nextBatter++]   // new batter at the same end
        } else {
          this.striker = null
        }
        break
      case 'runs':
        this.striker.faceBall()
        this.striker.addRuns(ball.runs)
        this.score += ball.runs
        this.legalBalls++
        if (ball.runs % 2 === 1) this.swapStrike()
        break
    }

    const overComplete = this.legalBalls % 6 === 0
    if (overComplete || this.isOver()) this.printScorecard()
    if (overComplete && this.striker) this.swapStrike()        // ends change after each over
  }

  printScorecard() {
    const rows = this.team.players
      .filter((p) => p.balls > 0 || p === this.striker || p === this.nonStriker || p.isOut)
      .map((p) => {
        const mark = p === this.striker || p === this.nonStriker ? '*' : p.isOut ? '' : ''
        return `${(p.name + mark).padEnd(12)} ${String(p.runs).padStart(4)} ${String(p.balls).padStart(5)} ${String(p.fours).padStart(3)} ${String(p.sixes).padStart(3)}`
      })
    this.log(
      [
        `Scorecard for ${this.team.name}:`,
        `Player        Runs Balls  4s  6s`,
        ...rows,
        `Total: ${this.score}/${this.wickets}  (Extras: ${this.extras})`,
        `Overs: ${this.oversText}`,
      ].join('\n')
    )
  }
}

class Match {
  constructor(teamA, teamB, overs, log = console.log) {
    this.teams = [teamA, teamB]
    this.overs = overs
    this.log = log
    this.innings = [new Innings(teamA, overs, null, log)]
  }

  get current() { return this.innings[this.innings.length - 1] }

  bowl(input) {
    this.current.bowl(input)
    if (this.current.isOver() && this.innings.length === 1) {
      const target = this.innings[0].score + 1
      this.innings.push(new Innings(this.teams[1], this.overs, target, this.log))
    }
  }

  result() {
    if (this.innings.length < 2 || !this.innings[1].isOver()) return 'Match in progress'
    const [first, second] = this.innings
    if (second.score > first.score) {
      return `${second.team.name} won by ${second.maxWickets - second.wickets} wickets`
    }
    if (first.score > second.score) return `${first.team.name} won by ${first.score - second.score} runs`
    return 'Match tied'
  }
}

// ---- Example ----
const india = new Team('Team 1', ['P1', 'P2', 'P3', 'P4', 'P5'])
const aus = new Team('Team 2', ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'])
const match = new Match(india, aus, 2)

// First innings: 2 overs → 17/2
;['1', '1', '1', '1', '1', '2', 'W', '4', '4', 'Wd', 'W', '1', '0'].forEach((b) => match.bowl(b))
// Second innings (target 18): 2 overs → 11/3
;['4', '1', 'W', 'W', '1', '1', '2', '0', 'W', '1', '0', '1'].forEach((b) => match.bowl(b))
console.log(match.result())   // "Team 1 won by 6 runs"
```

Design talking points:
- **Single responsibility**: parsing, player stats, innings rules and match orchestration are separate; adding "bowler figures" means a `Bowler` class and an innings hook, not rewriting everything.
- **Encapsulated rules**: legal-ball counting, strike rotation on odd runs, swap at end of over, new batter at the same end, extras not counting as balls.
- **Termination conditions** centralised in `isOver()` (overs, all out, target chased).
- **Injected logger** (`log`) makes output testable — tests can capture lines instead of reading `console`.
- Input validation throws clear errors.
- Edge cases: a wicket on the last ball of an over (strike swap with the new batter), the last legal ball being a wide (innings continues), chasing team passing the target mid-over (stops immediately), all out with overs remaining.
- Extensions to discuss: byes/leg-byes (runs to team but not batter), run-outs at the non-striker's end, free hit after no-ball, undo last ball (store an event log and recompute — **event sourcing**), a React UI that renders the scorecard from the same model.
:::

## Interview questions

:::question
difficulty: medium
### How do you approach an LLD / OOP machine-coding round?
1. **Clarify requirements and rules** — write examples of inputs and expected outputs.
2. **Identify entities** (nouns → classes) and **behaviours** (verbs → methods); decide which class owns which rule.
3. Keep classes small with single responsibilities; prefer composition; inject dependencies (logger, clock, storage) for testability.
4. Implement the happy path end to end, then edge cases and validation.
5. Write a quick driver/test with sample input.
6. Discuss extensibility: what changes if a new rule is added (open/closed principle), and how you'd persist/undo (event log).
:::

:::question
difficulty: medium
### Why store an event log of balls instead of only mutable totals?
Totals are a **projection** of the ball-by-ball history. Keeping the events (event sourcing) lets you **undo** a mistaken entry, replay to rebuild any view (scorecard, bowler stats, run-rate graph), audit corrections, and sync clients by sending events. The current state can still be cached for speed; it's recomputed from the log when needed.
:::

## Quick check

:::quiz
### A batter on strike hits 1 run off the last ball of the over. Who faces the next over's first ball?
- [x] The same batter (they swap for the run, then swap back at over end)
- [ ] The other batter
- [ ] A new batter
- [ ] Depends on the bowler
@@@explain
Odd run → swap; end of over → swap again. Net effect: the same batter is on strike.
:::

:::quiz
### Does a wide count as one of the six balls of an over?
- [ ] Yes
- [x] No
- [ ] Only in T20
- [ ] Only if runs are scored
@@@explain
Wides and no-balls are illegal deliveries and must be re-bowled.
:::
