# Student Loop Protocol

This protocol describes the existing browser harness in `tests/e2e/`. Its policy,
scenario matrix, personas, actor restrictions, and oracle layers are stored as
JSON alongside the runners. Those files define the scenarios and thresholds;
this document explains how to execute and interpret them.

## Prerequisites and run isolation

Install the Node dependencies with `npm ci` and the Python dependencies with
`python -m pip install -r requirements-dev.txt`. Browser journeys also require
`python -m playwright install chromium`. Start Docker and build the runner image
as described in the README before testing real student-code execution.

Each local run owns `.app/student-loop/runs/<run-id>/`. The current run directory
contains `data/` for learning state and `artifacts/` for reports, screenshots,
and `server-startup.log`. The wrapper supplies `STUDENT_LOOP_RUN_ID`,
`APP_DATA_DIR`, `PROGRESS_DB_PATH`, and `STUDENT_LOOP_ARTIFACT_DIR`; do not point
these at a learner's existing database. Discovery runs use their own run IDs and
directories under `.app/student-loop/discovery-runs/`.

## Default Live Realistic Student Loop

`npm run test:student-loop` runs the realistic discovery profile. The explicit
equivalent is `npm run test:student-loop:realistic`. These journeys use the
configured live AI provider: configure credentials locally, never in reports or
tracked files. A provider outage or missing configuration is an unavailable run,
not evidence that a journey passed.

`npm run test:student-loop:realistic:until-clean` repeats the realistic profile
within its bounded repair budget. `npm run test:student-loop:discover` is an
alias for realistic discovery. `npm run test:student-loop:live-provider` runs
the explicit live-provider gate. Release and security profiles are exposed as
`npm run test:student-loop:release` and `npm run test:student-loop:security`.
The expanded persona coverage uses `npm run test:student-loop:full-realistic`
or `npm run test:student-loop:full-realistic:until-clean`.

## Local-only execution

`npm run test:student-loop:local` starts the local journey wrapper. It waits for
the local server and targets `127.0.0.1`. Its browser routes block external
requests; local-only fixture evidence must not be presented as live-provider
evidence. `npm run test:student-loop:strict` runs the declared local strict
matrix, and `npm run test:student-loop:until-clean` repeats that matrix within
its configured cycle limit. Neither command invokes live discovery implicitly.

## Repair Iteration Gate

The runner must never edit source code. A developer handles
one root cause per iteration, recording the finding, minimal reproduction, affected scenarios,
repair, and targeted verification in the repair ledger. Use the repair
checklist to connect the run artifacts to the change.

Synthetic scenarios use probe-only execution where the policy declares
`probe_only`; the full journey still exercises the learner's complete flow.
An unavailable environment is a failure to obtain evidence, not permission to
drop the scenario from the report.

## Final Closure Gate

Full strict matrix reruns are final closure evidence, not a required rerun after every repair iteration.
Before final closure, rerun the full required matrix and the applicable discovery
profile. Reports must distinguish scenario_coverage values such as `executed`,
`planned`, and `not_applicable`; a planned required scenario is not covered.
Keep terminal-facing summaries redacted and retain the detailed artifacts in
the run directory.

## Best-Boundary Strict Coverage Closure

Strict Coverage Closure records the coverage universe version, required clean
cycles, required scenarios, and coverage adequacy axes from the matrix policy.
Check learner progress, input profiles, model behavior, artifact safety, oracle
classes, and required high-risk pairings before making a closure claim.
The closure applies only inside the declared coverage universe. Reports
must not claim absolute absence of bugs. Real provider variation and scenarios
outside the declared universe remain residual risks.
