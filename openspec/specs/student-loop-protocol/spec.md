# Student Loop Protocol

## Purpose

Provide a browser-driven student journey loop that detects and reproduces
learning-flow defects, isolates each run's state and artifacts, and supplies
bounded verification evidence for a developer-managed repair process.

## Requirements

### Run isolation

Each run uses a unique identifier, local database, and artifact directory.
Local-only runs allow the loopback application origin and block external
browser traffic. Reports redact private data and distinguish unavailable
infrastructure from a successful scenario.

### Repair and closure gates

The runner observes and reports; it does not edit application code. A developer
records one root cause, minimal reproduction, and affected strict scenarios per
repair. Targeted checks verify an iteration. Run the full required matrix and
applicable discovery profile before claiming coverage closure.

### Best-boundary coverage adequacy

Use the policy's versioned coverage universe, scenario axes, high-risk
pairings, and minimum clean-cycle count to determine closure eligibility.
Coverage claims are limited to the declared universe and do not assert the
absence of every possible defect.

### Expanded best-boundary strict scenarios

The strict matrix covers the full learner journey, completed-path fixtures,
slow network and rate-limit behavior, partial progress, adversarial input,
model anomalies, recovery/data faults, and artifact/oracle safety. Required
scenarios need executed evidence; a planned scenario does not satisfy closure.

### Persona-driven student journey discovery

Discovery uses the checked-in persona, prompt, actor, and oracle policies.
Preserve seeds and run identifiers for reproduction. Report failed-persona
coverage gaps and state-dependent closure eligibility.

### Live-provider student loop gate

The default realistic profile exercises the configured AI provider. Credentials
remain outside artifacts. A missing or unavailable provider cannot satisfy a
live gate, and local fixture runs cannot substitute for live-provider evidence.
