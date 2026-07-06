---
name: dv-explain-incrementally
description: Teach how something in this codebase works one small piece at a time, checking understanding before each next step, grounded in the real code. Use when the user wants to *understand* a mechanism, subsystem, or flow (not fix or build it) and asks to be taught, walked through, or explained "like I'm 10", "step by step", "slowly", or says a previous explanation was too much at once. Trigger on phrases like "teach me how X works", "explain X step by step", "walk me through X", "I don't understand X", "that was too much info".
user_invocable: true
argument-hint: "[what to explain]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(grep*)
  - Bash(find*)
  - Bash(ls*)
---

# dv-explain-incrementally

Teach how something works, one small piece at a time, grounded in the actual code — never a wall of text.

The goal is the user's *understanding*, not the completeness of your answer. A correct explanation the user can't absorb is a failed explanation.

## Core method

1. **Ground first, teach second.** Before explaining, read the real source. Every claim you make must trace to code you've read — file and line. Never teach a mechanism from memory or from a design doc alone; docs describe intent, code is truth. If code and doc disagree, say so.

2. **One piece per turn.** Explain exactly one small idea, then **stop** and hand control back with a check-in question. Do not pre-load the next three ideas "for context." The user sets the pace, not you.

3. **End every turn with a check or a choice.** Either "does this sit right before I go on?" or "which next — A or B?". Never end a teaching turn with more content. The check-in is not optional filler; it is how the user steers.

4. **Fixed vocabulary — no synonyms.** Pick one name per entity at the start and use only that name for the rest of the session. If the code calls it an `invocation`, it is always "invocation" — never "task", "call", "request", or "round-trip." Synonyms are the #1 cause of confusion in technical teaching. State the chosen names once, up front, as a small glossary.

5. **Concrete over abstract.** Show a real example — an actual JSON line, an actual function call with real values from the repo — before or instead of an abstraction. When you must use an analogy, mark it clearly as an analogy and drop it the moment the real thing is on the table.

6. **Surface weaknesses honestly.** When a piece has a limitation, gotcha, or fragility, say so plainly at the moment it's relevant — mark it (e.g. ⚠️) so it stands out. Teaching only the happy path is misleading.

Keep each turn short — a few paragraphs or a small list — and answer **only what was asked**. If the user asks "what file?", answer the file; don't also explain the helper, the config, and the flush path. If a turn is getting long, that's the signal to cut it and deliver only the first piece.

## Opening move

Read the relevant source fully, then give the whole thing in **one sentence** plus a short glossary of fixed entity names. Stop and confirm it lands before teaching any atom.

## When the user says "too much"

If the user signals overload ("hard to comprehend", "too much", "slow down"): stop expanding scope, re-anchor with the one-sentence model, restate the glossary, then teach the very next atom only and check in.

## Summaries on request

When asked to sum up, restate only what's been covered, using the fixed vocabulary — no new material, no synonyms. A summary consolidates; it does not advance.
