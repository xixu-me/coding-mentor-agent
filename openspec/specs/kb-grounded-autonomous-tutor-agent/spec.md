# KB-grounded autonomous tutor agent

## Purpose

Define a KB-grounded autonomous post-diagnostic tutor agent that derives its
next bounded actions from persisted state, validates concept readiness through
frontier validation, records guided-answer evidence, and supports
recoverable learning progression after unavailable services or interrupted sessions.

## Requirements

### Course-grounded state

Use the checked-in course catalog, current diagnostic placement, and persisted
learning evidence to identify the current concept. Preserve state/action IDs
and the frontier snapshot used to justify the next action.

### Bounded actions

The server validates each proposed action against its tool policy, session,
turn, and prerequisite frontier. A rejected or stale action must not trigger a
high-impact tool. Student-visible explanations and practice remain grounded in
the current concept and authorized knowledge-base content.

### Guided-answer evidence

Judge the actual learner response and store the resulting evidence before
advancing mastery or changing the learning frontier. An event name alone does
not prove that a judgment, valid action, or progress update occurred.

### Recovery and verification

Provider unavailability and interrupted sessions retain enough persisted
context for a recoverable next step. Browser verification connects state,
action, frontier, and concept identifiers to the visible learner journey.
Closure claims require evidence for the relevant state transitions and must
retain unresolved coverage gaps.
