# Student-loop repair checklist

Use one entry per root cause. Keep identifiers and summaries redacted; link to
run-local evidence rather than copying private learner data or credentials.

## Finding and repair

| Field | Evidence to record |
| --- | --- |
| Issue class | Behavior, policy, infrastructure, artifact, or oracle failure. |
| Minimal reproduction | Smallest journey and input that demonstrate the issue. |
| Repair attempt count | Number of attempts within the configured repair budget. |
| Repair ledger entry | Ledger identifier and the specific fix being verified. |
| Student loop rerun report | Run-local report path and outcome after the fix. |
| Targeted verification | Checks covering the root cause and neighboring behavior. |

## Strict matrix evidence

| Field | Evidence to record |
| --- | --- |
| Strict scenario id | Scenario identifier from the matrix policy. |
| Coverage universe version | Policy version used to interpret coverage. |
| Failed matrix summary | Required scenarios and axes that did not pass. |
| Affected strict scenarios | Scenarios selected for iteration verification. |
| Full strict matrix rerun summary | Final required matrix results and clean cycles. |
| Final closure rerun status | Passed, failed, or unavailable, with remaining gaps. |

## Discovery evidence

| Field | Evidence to record |
| --- | --- |
| Discovery run id | Identifier of the isolated discovery run. |
| Issue cluster fingerprint | Stable grouping of the observed root cause. |
| Discovery seed | Seed used to reproduce persona/input selection. |
| Affected personas | Personas whose journeys exercise the changed behavior. |
| Final discovery closure status | Closure eligibility and uncovered persona axes. |

## Tutor-agent evidence

| Field | Evidence to record |
| --- | --- |
| Tutor-agent finding category | State, action, frontier, evidence, or recovery issue. |
| Tutor-agent state id | Persisted state associated with the finding. |
| Tutor-agent action id | Bounded action selected for that state. |
| Tutor-agent frontier snapshot id | Prerequisite/readiness snapshot used by validation. |
| Current tutor-agent concept id | Course concept being explained or practiced. |
| Tutor-agent targeted rerun summaries | Relevant transitions and evidence after repair. |

A completed targeted rerun closes the individual finding only. Claim final
coverage closure after the final matrix and applicable discovery reruns, with
all required evidence present and no unresolved required gaps.
