export const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_profile (
  id TEXT PRIMARY KEY CHECK (id = 'local'),
  display_name TEXT,
  profile_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  kb_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS mistake_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  pi_session_id TEXT NOT NULL,
  pi_session_file TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  summary TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE(pi_session_id)
);

CREATE TABLE IF NOT EXISTS session_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'streaming', 'done', 'error', 'cancelled')),
  user_message_summary TEXT,
  code_ref TEXT,
  assistant_message_summary TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE(session_id, id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id)
);

CREATE TABLE IF NOT EXISTS session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content_redacted_text TEXT NOT NULL DEFAULT '',
  code_ref TEXT,
  tool_call_id TEXT,
  tool_name TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, message_id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS session_sse_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_redacted_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(session_id, seq),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS session_practice_outcomes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  outcome_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS model_context_compactions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source_turn_count INTEGER NOT NULL CHECK (source_turn_count >= 0),
  summary_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id)
);

CREATE TABLE IF NOT EXISTS concept_mastery (
  concept_id TEXT PRIMARY KEY,
  mastery_level INTEGER NOT NULL CHECK (mastery_level BETWEEN 0 AND 100),
  confidence REAL NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  readiness REAL NOT NULL DEFAULT 0 CHECK (readiness BETWEEN 0 AND 100),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  review_priority INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  last_practiced_at TEXT,
  last_evidence_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (concept_id) REFERENCES concepts(id)
);

CREATE TABLE IF NOT EXISTS learning_evidence (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('diagnostic', 'exercise', 'project', 'tutor_review', 'mistake')),
  source_id TEXT NOT NULL,
  session_id TEXT,
  turn_id TEXT,
  concept_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 5),
  score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  evaluator_confidence REAL CHECK (evaluator_confidence IS NULL OR evaluator_confidence BETWEEN 0 AND 1),
  evidence_weight REAL NOT NULL DEFAULT 1 CHECK (evidence_weight >= 0),
  validity_state TEXT NOT NULL DEFAULT 'valid' CHECK (validity_state IN ('valid', 'invalid', 'corrected')),
  catalog_version TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(source_type, source_id, concept_id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id),
  FOREIGN KEY (concept_id) REFERENCES concepts(id)
);

CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  turn_id TEXT,
  tool_call_id TEXT,
  event_type TEXT NOT NULL,
  concept_ids_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(idempotency_key),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  concept_ids_json TEXT NOT NULL DEFAULT '[]',
  prompt_md TEXT NOT NULL,
  public_tests TEXT,
  hidden_tests_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  session_id TEXT,
  turn_id TEXT,
  code_hash TEXT NOT NULL,
  code_snapshot TEXT,
  status TEXT NOT NULL,
  score INTEGER,
  hint_count INTEGER NOT NULL DEFAULT 0,
  result_summary_json TEXT NOT NULL DEFAULT '{}',
  mistake_tag_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS diagnostic_questions (
  id TEXT PRIMARY KEY,
  concept_ids_json TEXT NOT NULL DEFAULT '[]',
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'code_prediction', 'short_answer')),
  prompt_md TEXT NOT NULL,
  choices_json TEXT NOT NULL DEFAULT '[]',
  answer_key_ref TEXT,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diagnostic_attempts (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  session_id TEXT,
  turn_id TEXT,
  answer_json TEXT NOT NULL DEFAULT '{}',
  result_summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(question_id),
  FOREIGN KEY (question_id) REFERENCES diagnostic_questions(id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  recommendation_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'shown',
  created_at TEXT NOT NULL,
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS project_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_steps (
  id TEXT PRIMARY KEY,
  project_plan_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  concept_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  acceptance_criteria_json TEXT NOT NULL DEFAULT '[]',
  latest_submission_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_plan_id, step_order),
  UNIQUE(id, project_plan_id),
  FOREIGN KEY (project_plan_id) REFERENCES project_plans(id)
);

CREATE TABLE IF NOT EXISTS project_step_submissions (
  id TEXT PRIMARY KEY,
  project_plan_id TEXT NOT NULL,
  project_step_id TEXT NOT NULL,
  session_id TEXT,
  turn_id TEXT,
  code_hash TEXT NOT NULL,
  code_snapshot TEXT,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'passed', 'needs_revision', 'error')),
  review_summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_plan_id) REFERENCES project_plans(id),
  FOREIGN KEY (project_step_id, project_plan_id) REFERENCES project_steps(id, project_plan_id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS tool_audit_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  turn_id TEXT,
  tool_name TEXT NOT NULL,
  params_hash TEXT NOT NULL,
  params_redacted_json TEXT NOT NULL DEFAULT '{}',
  result_code TEXT NOT NULL,
  result_summary TEXT,
  duration_ms INTEGER NOT NULL,
  model_provider TEXT,
  model_name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source TEXT NOT NULL,
  description TEXT NOT NULL,
  payload_redacted_json TEXT NOT NULL DEFAULT '{}',
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_started ON agent_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_session_turns_session_started ON session_turns(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_session_messages_turn_created ON session_messages(session_id, turn_id, created_at);
CREATE INDEX IF NOT EXISTS idx_session_sse_events_session_seq ON session_sse_events(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_model_context_compactions_session_created ON model_context_compactions(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name);
CREATE INDEX IF NOT EXISTS idx_concept_mastery_concept ON concept_mastery(concept_id);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_concept_created ON learning_evidence(concept_id, created_at);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_source ON learning_evidence(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_created ON learning_events(created_at);
CREATE INDEX IF NOT EXISTS idx_learning_events_session ON learning_events(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_turn ON learning_events(turn_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_attempts_question ON diagnostic_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_attempts_session ON diagnostic_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_attempts_turn ON diagnostic_attempts(turn_id);

CREATE TABLE IF NOT EXISTS intent_routes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  target_concept_ids_json TEXT NOT NULL DEFAULT '[]',
  evidence_signals_json TEXT NOT NULL DEFAULT '[]',
  has_code INTEGER NOT NULL CHECK (has_code IN (0, 1)),
  requires_tool INTEGER NOT NULL CHECK (requires_tool IN (0, 1)),
  allowed_tool_group TEXT NOT NULL,
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  context_builder TEXT NOT NULL,
  router_model_version TEXT NOT NULL,
  router_prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, turn_id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE TABLE IF NOT EXISTS context_traces (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  builder TEXT NOT NULL,
  included_sources_json TEXT NOT NULL DEFAULT '[]',
  omitted_sections_json TEXT NOT NULL DEFAULT '[]',
  estimated_chars INTEGER NOT NULL CHECK (estimated_chars >= 0),
  redaction_applied INTEGER NOT NULL CHECK (redaction_applied IN (0, 1)),
  provider_trace_id TEXT,
  trace_contains_sensitive_data INTEGER NOT NULL DEFAULT 0 CHECK (trace_contains_sensitive_data IN (0, 1)),
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, turn_id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id),
  FOREIGN KEY (route_id) REFERENCES intent_routes(id)
);

CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'paused', 'failed')),
  target_concepts_json TEXT NOT NULL DEFAULT '[]',
  stop_reason TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id)
);

CREATE TABLE IF NOT EXISTS diagnostic_concept_state (
  diagnostic_session_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  mastery INTEGER NOT NULL CHECK (mastery BETWEEN 0 AND 100),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_count INTEGER NOT NULL CHECK (evidence_count >= 0),
  uncertainty REAL NOT NULL CHECK (uncertainty BETWEEN 0 AND 1),
  band TEXT NOT NULL CHECK (band IN ('unknown', 'weak', 'learning', 'proficient', 'unknown_needs_more_evidence')),
  last_item_id TEXT,
  conflicting_evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (conflicting_evidence_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (diagnostic_session_id, concept_id),
  FOREIGN KEY (diagnostic_session_id) REFERENCES diagnostic_sessions(id),
  FOREIGN KEY (concept_id) REFERENCES concepts(id)
);

CREATE TABLE IF NOT EXISTS generated_items (
  id TEXT PRIMARY KEY,
  diagnostic_session_id TEXT,
  concept_ids_json TEXT NOT NULL DEFAULT '[]',
  item_type TEXT NOT NULL CHECK (item_type IN ('multiple_choice', 'code_prediction', 'short_answer', 'code_reading')),
  prompt_md TEXT NOT NULL,
  choices_json TEXT NOT NULL DEFAULT '[]',
  answer_key_private_json TEXT NOT NULL DEFAULT '{}',
  rubric_private TEXT NOT NULL DEFAULT '',
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  expected_evidence TEXT NOT NULL DEFAULT 'recognition',
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'validated', 'rejected')),
  generator_model_version TEXT NOT NULL,
  generator_prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (diagnostic_session_id) REFERENCES diagnostic_sessions(id)
);

CREATE TABLE IF NOT EXISTS diagnostic_rationales (
  id TEXT PRIMARY KEY,
  diagnostic_session_id TEXT NOT NULL,
  generated_item_id TEXT,
  rationale_type TEXT NOT NULL CHECK (rationale_type IN ('selection', 'stop')),
  target_concept_id TEXT,
  difficulty_direction TEXT CHECK (difficulty_direction IN ('lower', 'same', 'higher') OR difficulty_direction IS NULL),
  rationale_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (diagnostic_session_id) REFERENCES diagnostic_sessions(id),
  FOREIGN KEY (generated_item_id) REFERENCES generated_items(id)
);

CREATE TABLE IF NOT EXISTS generated_exercises (
  id TEXT PRIMARY KEY,
  concept_ids_json TEXT NOT NULL DEFAULT '[]',
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  prompt_md TEXT NOT NULL,
  starter_code TEXT,
  sample_cases_json TEXT NOT NULL DEFAULT '[]',
  evaluator_type TEXT NOT NULL CHECK (evaluator_type IN ('io_tests', 'unit_tests', 'property_checks', 'rubric')),
  evaluator_private_ref TEXT NOT NULL,
  reference_solution_private_ref TEXT,
  evaluator_hash TEXT NOT NULL,
  validation_report_json TEXT NOT NULL DEFAULT '{}',
  common_mistake_probes_json TEXT NOT NULL DEFAULT '[]',
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'validated', 'rejected')),
  context_trace_id TEXT,
  generator_model_version TEXT NOT NULL,
  generator_prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  sandbox_image_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (context_trace_id) REFERENCES context_traces(id)
);

CREATE TABLE IF NOT EXISTS generated_exercise_evaluators (
  id TEXT PRIMARY KEY,
  generated_exercise_id TEXT NOT NULL,
  evaluator_private TEXT NOT NULL,
  reference_solution_private TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(generated_exercise_id),
  FOREIGN KEY (generated_exercise_id) REFERENCES generated_exercises(id)
);

CREATE TABLE IF NOT EXISTS tool_evidence (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  turn_id TEXT,
  tool_name TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  result_code TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  redacted INTEGER NOT NULL CHECK (redacted IN (0, 1)),
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE INDEX IF NOT EXISTS idx_intent_routes_session_turn ON intent_routes(session_id, turn_id);
CREATE INDEX IF NOT EXISTS idx_context_traces_session_turn ON context_traces(session_id, turn_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_session ON diagnostic_sessions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_generated_items_session ON generated_items(diagnostic_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_diagnostic_rationales_session ON diagnostic_rationales(diagnostic_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_exercises_status ON generated_exercises(validation_status, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_exercise_evaluators_exercise ON generated_exercise_evaluators(generated_exercise_id);
CREATE INDEX IF NOT EXISTS idx_tool_evidence_session_turn ON tool_evidence(session_id, turn_id);

CREATE INDEX IF NOT EXISTS idx_attempts_exercise_created ON exercise_attempts(exercise_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON exercise_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_turn ON exercise_attempts(turn_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_project_steps_plan_order ON project_steps(project_plan_id, step_order);
CREATE INDEX IF NOT EXISTS idx_project_submissions_plan ON project_step_submissions(project_plan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_submissions_step_plan ON project_step_submissions(project_step_id, project_plan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_submissions_session ON project_step_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_project_submissions_turn ON project_step_submissions(turn_id);
CREATE INDEX IF NOT EXISTS idx_tool_audit_session_created ON tool_audit_logs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity_created ON security_events(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_session_messages_turn ON session_messages(turn_id);
CREATE INDEX IF NOT EXISTS idx_session_sse_events_turn ON session_sse_events(turn_id);
`;

export const MIGRATION_002_CATALOG = `
CREATE TABLE IF NOT EXISTS course_catalog_runs (
  id TEXT PRIMARY KEY,
  kb_root TEXT NOT NULL,
  kb_version TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  concept_count INTEGER NOT NULL DEFAULT 0 CHECK (concept_count >= 0),
  unit_count INTEGER NOT NULL DEFAULT 0 CHECK (unit_count >= 0),
  exercise_count INTEGER NOT NULL DEFAULT 0 CHECK (exercise_count >= 0),
  relation_count INTEGER NOT NULL DEFAULT 0 CHECK (relation_count >= 0),
  error_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS course_units (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  catalog_status TEXT NOT NULL DEFAULT 'active' CHECK (catalog_status IN ('active', 'inactive')),
  source_path TEXT,
  source_hash TEXT,
  catalog_version TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS concept_relations (
  source_concept_id TEXT NOT NULL,
  target_concept_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('prerequisite', 'related', 'reinforces', 'follows', 'progression', 'remediation')),
  weight REAL NOT NULL DEFAULT 1 CHECK (weight >= 0),
  source_type TEXT NOT NULL DEFAULT 'kb_catalog',
  source_path TEXT,
  source_hash TEXT,
  catalog_version TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source_concept_id, target_concept_id, relation_type),
  FOREIGN KEY (source_concept_id) REFERENCES concepts(id),
  FOREIGN KEY (target_concept_id) REFERENCES concepts(id)
);

CREATE INDEX IF NOT EXISTS idx_course_catalog_runs_created ON course_catalog_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_course_units_status_order ON course_units(catalog_status, order_index);
CREATE INDEX IF NOT EXISTS idx_concept_relations_source ON concept_relations(source_concept_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_concept_relations_target ON concept_relations(target_concept_id, relation_type);
`;

export const MIGRATION_003_TUTOR_AGENT = `
CREATE TABLE IF NOT EXISTS tutor_agent_states (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  diagnostic_session_id TEXT,
  catalog_run_id TEXT,
  catalog_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  current_concept_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (diagnostic_session_id) REFERENCES diagnostic_sessions(id),
  FOREIGN KEY (current_concept_id) REFERENCES concepts(id)
);

CREATE TABLE IF NOT EXISTS tutor_agent_actions (
  id TEXT PRIMARY KEY,
  state_id TEXT,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  action_kind TEXT NOT NULL,
  concept_id TEXT,
  action_json TEXT NOT NULL DEFAULT '{}',
  validation_status TEXT NOT NULL CHECK (validation_status IN ('accepted', 'rejected')),
  validation_code TEXT NOT NULL,
  validation_reason TEXT,
  learner_facing_response TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (state_id) REFERENCES tutor_agent_states(id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id),
  FOREIGN KEY (concept_id) REFERENCES concepts(id)
);

CREATE TABLE IF NOT EXISTS tutor_agent_frontier_snapshots (
  id TEXT PRIMARY KEY,
  state_id TEXT,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  frontier_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (state_id) REFERENCES tutor_agent_states(id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_agent_states_session ON tutor_agent_states(session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_agent_actions_session_created ON tutor_agent_actions(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tutor_agent_actions_turn ON tutor_agent_actions(turn_id);
CREATE INDEX IF NOT EXISTS idx_tutor_agent_frontier_session_created ON tutor_agent_frontier_snapshots(session_id, created_at);
`;
