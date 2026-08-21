---
name: dv-explaining-as-html
description: Produces a rich, interactive HTML explanation of a topic, diff, branch, or PR, with background, intuition, code walkthrough, and a quiz. Use when the user asks to explain a diff, branch, or PR in detail, or wants an interactive/visual walkthrough of a topic.
argument-hint: "[what to explain]"
user-invocable: true
disable-model-invocation: true
model: opus
---

# Explain Diff HTML

Make a rich, interactive explanation of the specified topic.

## Sections
 
- **TLDR** (mandatory, always first): A few sentences plus a short bullet list covering what, why, and the reader-visible impact. Self-contained — understandable without reading any other section.
- **Background**: Explain the existing system relevant to this change (broadly explore surrounding code for this). Include a deep background for beginners (skippable if reader is already familiar), then a narrower background directly relevant to the change.
- **Intuition**: Explain the core intuition for the topic. Focus on essence, not full detail. Use concrete examples with toy data. Use figures and diagrams liberally.
- **Code**: High-level walkthrough of the changes to the code. Group/order changes in an understandable way.
- **Quiz**: Up to ten interactive multiple-choice questions testing the reader's understanding of the PR, count depending on change scope. Medium difficulty — needs real understanding of the substance, not gotchas. On click, show correct/incorrect and feedback.

## Format

- Single self-contained HTML file with inline CSS and JavaScript. One long page with section headers and a table of contents. No tabs for top-level structure. Basic responsive styling for phone viewing.
- Save the file in a global location outside the code repo (e.g. `/tmp/`), filename starting with today's date in `YYYY-MM-DD-` format so files stay time-sorted and out of version control. Example: `/tmp/2026-01-12-explanation-<slug>.html`.
- Write with the clarity and flow of Martin Kleppmann — engaging, classic style, smooth transitions between sections.
- Diagrams:
  - Reuse a small number of diagram families throughout (e.g. simplified UI mockups for UI changes, system diagrams showing data flow between components with example data).
  - No ASCII diagrams — always simple HTML/CSS designs, HTML lists for lists of things.
  - Code blocks: always use `<pre>` tags. If using a custom styled div instead, it must have `white-space: pre-wrap` in its CSS or the browser collapses newlines. Before saving, scan every code block's CSS and confirm it includes `white-space: pre` or `pre-wrap`.
- Use callouts for key concepts, definitions, and important edge cases.

## Quality rules

### Quiz

Treat quiz design as part of the explanation, not decoration. Before emitting the page, inspect all five questions as a set.

- Randomize the option order independently for each question. Do not always place the correct answer first, second, or in any fixed position. A deterministic shuffle with a per-page seed is acceptable; the visible order must vary across questions.
- Balance correct-answer positions across the five questions as evenly as possible. Never let position, letter, punctuation, or a repeated pattern reveal the answer.
- Keep options comparable in length, grammar, specificity, and confidence. Do not make the correct option conspicuously longer, more qualified, or more technically precise than distractors. Shorten or enrich distractors as needed.
- Make every distractor plausible and tied to a real misunderstanding of the change. Avoid joke answers, obviously impossible claims, “all/none of the above,” and trivia that cannot be inferred from the page.
- Ask about behavior, causality, contracts, edge cases, or trade-offs. Avoid questions whose answer can be guessed from a single copied phrase.
- Keep the correct answer and explanation in the page’s JavaScript data or DOM so the interaction works offline. Reveal feedback only after selection. Mark the selected option and explain both the right reasoning and, when useful, the misconception behind the distractors.
- Ensure the UI does not expose the answer through styling before selection, DOM labels, `title` attributes, source ordering, or accessibility text. Accessibility labels should describe the option, not its correctness.

## Requirements

- **Can be read in ~5 minutes** by an average human reader without losing any important detail. Human will ask you to expand the first version with details if needed.
