-- Item Selection security vertical slice: immutable persistence and audited RPCs.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regprocedure('public.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto digest(bytea,text) is required';
  END IF;
END
$$;

CREATE TABLE public.item_selection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider = 'domeggook'),
  keyword text NOT NULL CHECK (keyword = btrim(keyword) AND char_length(keyword) BETWEEN 1 AND 200),
  requested_size integer NOT NULL CHECK (requested_size BETWEEN 1 AND 50),
  status text NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  ruleset_version text NOT NULL CHECK (ruleset_version = btrim(ruleset_version) AND char_length(ruleset_version) BETWEEN 1 AND 128),
  evaluator_version text NOT NULL CHECK (evaluator_version = btrim(evaluator_version) AND char_length(evaluator_version) BETWEEN 1 AND 128),
  profitability_policy_version text NOT NULL CHECK (profitability_policy_version = btrim(profitability_policy_version) AND char_length(profitability_policy_version) BETWEEN 1 AND 128),
  profitability_calculation_contract_version text NOT NULL CHECK (profitability_calculation_contract_version = btrim(profitability_calculation_contract_version) AND char_length(profitability_calculation_contract_version) BETWEEN 1 AND 128),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  idempotency_key_hash text NOT NULL CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  retry_of_run_id uuid REFERENCES public.item_selection_runs(id) ON DELETE RESTRICT,
  requested_by_principal_id text NOT NULL
    CHECK (requested_by_principal_id = (requested_by_principal_id::uuid)::text),
  started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  completed_at timestamptz,
  failure_code text CHECK (
    failure_code IS NULL OR
    (failure_code = btrim(failure_code) AND failure_code ~ '^[A-Z][A-Z0-9_]{0,63}$')
  ),
  observed_candidate_count integer NOT NULL DEFAULT 0 CHECK (observed_candidate_count >= 0),
  successfully_evaluated_count integer NOT NULL DEFAULT 0 CHECK (successfully_evaluated_count >= 0),
  persisted_evaluation_count integer NOT NULL DEFAULT 0 CHECK (persisted_evaluation_count >= 0),
  failed_candidate_count integer NOT NULL DEFAULT 0 CHECK (failed_candidate_count >= 0),
  skipped_candidate_count integer NOT NULL DEFAULT 0 CHECK (skipped_candidate_count >= 0),
  candidate_failures_canonical_text text NOT NULL DEFAULT '{"failures":[],"schemaVersion":"gonggamline-item-selection-candidate-failures-v1"}',
  candidate_failures_projection jsonb NOT NULL DEFAULT '{"failures":[],"schemaVersion":"gonggamline-item-selection-candidate-failures-v1"}'::jsonb,
  candidate_failures_sha256 text GENERATED ALWAYS AS (
    encode(public.digest(convert_to(candidate_failures_canonical_text, 'UTF8'), 'sha256'), 'hex')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT item_selection_runs_idempotency_unique
    UNIQUE (requested_by_principal_id, idempotency_key_hash),
  CONSTRAINT item_selection_runs_retry_not_self CHECK (retry_of_run_id IS NULL OR retry_of_run_id <> id),
  CONSTRAINT item_selection_runs_completion_state CHECK (
    (status = 'RUNNING' AND completed_at IS NULL) OR
    (status IN ('COMPLETED', 'PARTIAL', 'FAILED') AND completed_at IS NOT NULL)
  ),
  CONSTRAINT item_selection_runs_count_sum CHECK (
    observed_candidate_count =
      successfully_evaluated_count + failed_candidate_count + skipped_candidate_count
  ),
  CONSTRAINT item_selection_runs_persisted_success CHECK (
    persisted_evaluation_count = successfully_evaluated_count
  ),
  CONSTRAINT item_selection_runs_failure_projection CHECK (
    candidate_failures_projection = candidate_failures_canonical_text::jsonb
  ),
  CONSTRAINT item_selection_runs_terminal_shape CHECK (
    status = 'RUNNING' OR
    (status = 'COMPLETED' AND observed_candidate_count = successfully_evaluated_count
      AND failed_candidate_count = 0 AND skipped_candidate_count = 0
      AND failure_code IS NULL) OR
    (status = 'PARTIAL' AND successfully_evaluated_count > 0
      AND failed_candidate_count + skipped_candidate_count > 0) OR
    (status = 'FAILED' AND successfully_evaluated_count = 0)
  )
);

CREATE TABLE public.item_selection_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.item_selection_runs(id) ON DELETE RESTRICT,
  provider_item_number text NOT NULL CHECK (provider_item_number ~ '^[0-9]{1,20}$'),
  original_position integer NOT NULL CHECK (original_position >= 0),
  verdict text NOT NULL CHECK (verdict IN ('RECOMMEND', 'CONDITIONAL', 'MANUAL_REVIEW', 'REJECT')),
  total_score_units integer CHECK (total_score_units BETWEEN 0 AND 1000000),
  coverage_units integer NOT NULL CHECK (coverage_units BETWEEN 0 AND 1000000),
  normalized_margin_units integer CHECK (normalized_margin_units BETWEEN -1000000000 AND 1000000000),
  normalized_profit_krw_micros bigint,
  canonical_snapshot_text text NOT NULL,
  snapshot_projection jsonb NOT NULL,
  snapshot_sha256 text GENERATED ALWAYS AS (
    encode(public.digest(convert_to(canonical_snapshot_text, 'UTF8'), 'sha256'), 'hex')
  ) STORED,
  canonical_evidence_text text NOT NULL,
  evidence_projection jsonb NOT NULL,
  provider_evidence_sha256 text GENERATED ALWAYS AS (
    encode(public.digest(convert_to(canonical_evidence_text, 'UTF8'), 'sha256'), 'hex')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT item_selection_evaluations_run_item_unique UNIQUE (run_id, provider_item_number),
  CONSTRAINT item_selection_evaluations_snapshot_projection CHECK (
    snapshot_projection = canonical_snapshot_text::jsonb
  ),
  CONSTRAINT item_selection_evaluations_evidence_projection CHECK (
    evidence_projection = canonical_evidence_text::jsonb
  )
);

CREATE TABLE public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_user_id uuid NOT NULL,
  event_code text NOT NULL CHECK (event_code IN ('ITEM_SELECTION_CREATE', 'ITEM_SELECTION_FINALIZE')),
  route text NOT NULL CHECK (
    route IN ('/api/admin/item-selection/runs', '/api/admin/item-selection/runs/[id]/finalize')
  ),
  correlation_id uuid NOT NULL,
  result text NOT NULL CHECK (result = 'SUCCEEDED'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TYPE public.item_selection_evaluation_write_v1 AS (
  provider_item_number text,
  original_position integer,
  verdict text,
  total_score_units integer,
  coverage_units integer,
  normalized_margin_units integer,
  normalized_profit_krw_micros bigint,
  canonical_snapshot_text text,
  canonical_evidence_text text
);

CREATE INDEX item_selection_runs_retry_of_run_id_idx
  ON public.item_selection_runs (retry_of_run_id) WHERE retry_of_run_id IS NOT NULL;
CREATE INDEX item_selection_runs_created_at_idx
  ON public.item_selection_runs (created_at DESC, id);
CREATE INDEX item_selection_evaluations_run_position_idx
  ON public.item_selection_evaluations (run_id, original_position, provider_item_number);
CREATE INDEX security_audit_events_administrator_created_at_idx
  ON public.security_audit_events (administrator_user_id, created_at DESC, id);
CREATE INDEX security_audit_events_correlation_id_idx
  ON public.security_audit_events (correlation_id);

CREATE FUNCTION public.create_item_selection_run_v1(
  p_provider text,
  p_keyword text,
  p_requested_size integer,
  p_ruleset_version text,
  p_evaluator_version text,
  p_profitability_policy_version text,
  p_profitability_calculation_contract_version text,
  p_request_fingerprint text,
  p_idempotency_key_hash text,
  p_retry_of_run_id uuid,
  p_requested_by_principal_id text,
  p_route text,
  p_correlation_id uuid
) RETURNS public.item_selection_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing public.item_selection_runs;
  v_retry_status text;
  v_created public.item_selection_runs;
BEGIN
  IF p_requested_by_principal_id IS NULL
    OR p_requested_by_principal_id <> (p_requested_by_principal_id::uuid)::text THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid administrator principal.';
  END IF;
  IF p_route IS DISTINCT FROM '/api/admin/item-selection/runs' OR p_correlation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid audit context.';
  END IF;
  IF p_provider IS DISTINCT FROM 'domeggook'
    OR p_keyword IS NULL OR p_keyword <> btrim(p_keyword)
    OR char_length(p_keyword) NOT BETWEEN 1 AND 200
    OR p_requested_size NOT BETWEEN 1 AND 50
    OR p_ruleset_version IS NULL OR p_ruleset_version <> btrim(p_ruleset_version) OR char_length(p_ruleset_version) NOT BETWEEN 1 AND 128
    OR p_evaluator_version IS NULL OR p_evaluator_version <> btrim(p_evaluator_version) OR char_length(p_evaluator_version) NOT BETWEEN 1 AND 128
    OR p_profitability_policy_version IS NULL OR p_profitability_policy_version <> btrim(p_profitability_policy_version) OR char_length(p_profitability_policy_version) NOT BETWEEN 1 AND 128
    OR p_profitability_calculation_contract_version IS NULL OR p_profitability_calculation_contract_version <> btrim(p_profitability_calculation_contract_version) OR char_length(p_profitability_calculation_contract_version) NOT BETWEEN 1 AND 128
    OR p_request_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_idempotency_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid item selection request.';
  END IF;

  SELECT * INTO v_existing
  FROM public.item_selection_runs
  WHERE requested_by_principal_id = p_requested_by_principal_id
    AND idempotency_key_hash = p_idempotency_key_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> p_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Idempotency conflict.';
    END IF;
    IF v_existing.status <> 'RUNNING'
      OR v_existing.provider <> p_provider
      OR v_existing.keyword <> p_keyword
      OR v_existing.requested_size <> p_requested_size
      OR v_existing.ruleset_version <> p_ruleset_version
      OR v_existing.evaluator_version <> p_evaluator_version
      OR v_existing.profitability_policy_version <> p_profitability_policy_version
      OR v_existing.profitability_calculation_contract_version <> p_profitability_calculation_contract_version
      OR v_existing.retry_of_run_id IS DISTINCT FROM p_retry_of_run_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Idempotency conflict.';
    END IF;
    RETURN v_existing;
  END IF;

  IF p_retry_of_run_id IS NOT NULL THEN
    SELECT status INTO v_retry_status
    FROM public.item_selection_runs
    WHERE id = p_retry_of_run_id
    FOR SHARE;
    IF NOT FOUND OR v_retry_status NOT IN ('COMPLETED', 'PARTIAL', 'FAILED') THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Retry requires an existing terminal run.';
    END IF;
  END IF;

  INSERT INTO public.item_selection_runs (
    provider, keyword, requested_size, ruleset_version, evaluator_version,
    profitability_policy_version, profitability_calculation_contract_version,
    request_fingerprint, idempotency_key_hash, retry_of_run_id,
    requested_by_principal_id
  ) VALUES (
    p_provider, p_keyword, p_requested_size, p_ruleset_version, p_evaluator_version,
    p_profitability_policy_version, p_profitability_calculation_contract_version,
    p_request_fingerprint, p_idempotency_key_hash, p_retry_of_run_id,
    p_requested_by_principal_id
  ) RETURNING * INTO v_created;

  INSERT INTO public.security_audit_events (
    administrator_user_id, event_code, route, correlation_id, result
  ) VALUES (
    p_requested_by_principal_id::uuid, 'ITEM_SELECTION_CREATE', p_route,
    p_correlation_id, 'SUCCEEDED'
  );

  RETURN v_created;
END
$$;

CREATE FUNCTION public.finalize_item_selection_run_v1(
  p_run_id uuid,
  p_terminal_status text,
  p_expected_request_fingerprint text,
  p_expected_ruleset_version text,
  p_expected_evaluator_version text,
  p_expected_profitability_policy_version text,
  p_expected_profitability_calculation_contract_version text,
  p_evaluations public.item_selection_evaluation_write_v1[],
  p_candidate_failures_canonical_text text,
  p_observed_candidate_count integer,
  p_successfully_evaluated_count integer,
  p_failed_candidate_count integer,
  p_skipped_candidate_count integer,
  p_failure_code text,
  p_requested_by_principal_id text,
  p_route text,
  p_correlation_id uuid
) RETURNS public.item_selection_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_run public.item_selection_runs;
  v_evaluation public.item_selection_evaluation_write_v1;
  v_snapshot jsonb;
  v_evidence jsonb;
  v_failures jsonb;
  v_inserted_count integer := 0;
  v_expected_count integer;
  v_replay_matches boolean;
BEGIN
  IF p_run_id IS NULL
    OR p_requested_by_principal_id IS NULL
    OR p_requested_by_principal_id <> (p_requested_by_principal_id::uuid)::text THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid administrator principal.';
  END IF;
  IF p_route IS DISTINCT FROM '/api/admin/item-selection/runs/[id]/finalize'
    OR p_correlation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid audit context.';
  END IF;
  IF p_terminal_status NOT IN ('COMPLETED', 'PARTIAL', 'FAILED')
    OR p_expected_request_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_expected_ruleset_version IS NULL
    OR p_expected_evaluator_version IS NULL
    OR p_expected_profitability_policy_version IS NULL
    OR p_expected_profitability_calculation_contract_version IS NULL
    OR p_observed_candidate_count < 0
    OR p_successfully_evaluated_count < 0
    OR p_failed_candidate_count < 0
    OR p_skipped_candidate_count < 0
    OR p_observed_candidate_count <>
      p_successfully_evaluated_count + p_failed_candidate_count + p_skipped_candidate_count
    OR (p_failure_code IS NOT NULL AND (
      p_failure_code <> btrim(p_failure_code)
      OR p_failure_code !~ '^[A-Z][A-Z0-9_]{0,63}$'
    )) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid finalization request.';
  END IF;

  p_evaluations := COALESCE(p_evaluations, ARRAY[]::public.item_selection_evaluation_write_v1[]);
  v_expected_count := cardinality(p_evaluations);
  IF v_expected_count <> p_successfully_evaluated_count
    OR (p_terminal_status = 'COMPLETED' AND (
      p_observed_candidate_count <> p_successfully_evaluated_count
      OR p_failed_candidate_count <> 0 OR p_skipped_candidate_count <> 0
      OR p_failure_code IS NOT NULL
    ))
    OR (p_terminal_status = 'PARTIAL' AND (
      p_successfully_evaluated_count = 0
      OR p_failed_candidate_count + p_skipped_candidate_count = 0
    ))
    OR (p_terminal_status = 'FAILED' AND p_successfully_evaluated_count <> 0) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid terminal counts.';
  END IF;

  BEGIN
    v_failures := p_candidate_failures_canonical_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid candidate failure canonical text.';
  END;
  IF jsonb_typeof(v_failures) <> 'object'
    OR v_failures->>'schemaVersion' <> 'gonggamline-item-selection-candidate-failures-v1'
    OR jsonb_typeof(v_failures->'failures') <> 'array'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_failures) AS key
      WHERE key NOT IN ('schemaVersion', 'failures')
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_failures->'failures') AS failure
      WHERE jsonb_typeof(failure) <> 'object'
        OR jsonb_typeof(failure->'providerItemNumber') <> 'string'
        OR (failure->>'providerItemNumber') !~ '^[0-9]{1,20}$'
        OR jsonb_typeof(failure->'originalPosition') <> 'number'
        OR (failure->>'originalPosition') !~ '^(0|[1-9][0-9]*)$'
        OR jsonb_typeof(failure->'failureStage') <> 'string'
        OR jsonb_typeof(failure->'code') <> 'string'
        OR jsonb_typeof(failure->'retryable') <> 'boolean'
        OR (failure ? 'evidenceReference' AND jsonb_typeof(failure->'evidenceReference') NOT IN ('string', 'null'))
        OR EXISTS (
          SELECT 1 FROM jsonb_object_keys(failure) AS key
          WHERE key NOT IN ('providerItemNumber', 'originalPosition', 'failureStage', 'code', 'retryable', 'evidenceReference')
        )
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid candidate failure projection.';
  END IF;

  SELECT * INTO v_run
  FROM public.item_selection_runs
  WHERE id = p_run_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Item selection run not found.';
  END IF;
  IF v_run.requested_by_principal_id <> p_requested_by_principal_id
    OR v_run.request_fingerprint <> p_expected_request_fingerprint
    OR v_run.ruleset_version <> p_expected_ruleset_version
    OR v_run.evaluator_version <> p_expected_evaluator_version
    OR v_run.profitability_policy_version <> p_expected_profitability_policy_version
    OR v_run.profitability_calculation_contract_version <>
      p_expected_profitability_calculation_contract_version THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Finalization identity conflict.';
  END IF;

  FOR v_evaluation IN SELECT * FROM unnest(p_evaluations) LOOP
    IF v_evaluation.provider_item_number !~ '^[0-9]{1,20}$'
      OR v_evaluation.original_position < 0
      OR v_evaluation.verdict NOT IN ('RECOMMEND', 'CONDITIONAL', 'MANUAL_REVIEW', 'REJECT')
      OR (v_evaluation.total_score_units IS NOT NULL AND v_evaluation.total_score_units NOT BETWEEN 0 AND 1000000)
      OR v_evaluation.coverage_units NOT BETWEEN 0 AND 1000000
      OR (v_evaluation.normalized_margin_units IS NOT NULL AND v_evaluation.normalized_margin_units NOT BETWEEN -1000000000 AND 1000000000) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid evaluation projection.';
    END IF;
    BEGIN
      v_snapshot := v_evaluation.canonical_snapshot_text::jsonb;
      v_evidence := v_evaluation.canonical_evidence_text::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid evaluation canonical text.';
    END;
    IF jsonb_typeof(v_snapshot) <> 'object'
      OR v_snapshot->>'schemaVersion' <> 'gonggamline-item-selection-snapshot-v1'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_snapshot) AS key
        WHERE key NOT IN (
          'schemaVersion', 'rulesetVersion', 'evaluatorVersion',
          'profitabilityPolicyVersion', 'profitabilityCalculationContractVersion',
          'providerFacts', 'profitabilityInput', 'profitabilityResult',
          'evaluatorInput', 'evaluatorOutput', 'hashes', 'originalPosition'
        )
      )
      OR (SELECT count(*) FROM jsonb_object_keys(v_snapshot)) <> 12
      OR v_snapshot->>'rulesetVersion' <> p_expected_ruleset_version
      OR v_snapshot->>'evaluatorVersion' <> p_expected_evaluator_version
      OR v_snapshot->>'profitabilityPolicyVersion' <> p_expected_profitability_policy_version
      OR v_snapshot->>'profitabilityCalculationContractVersion' <>
        p_expected_profitability_calculation_contract_version
      OR v_snapshot->>'originalPosition' <> v_evaluation.original_position::text
      OR v_snapshot#>>'{providerFacts,providerItemNumber}' <> v_evaluation.provider_item_number
      OR jsonb_typeof(v_snapshot->'hashes') <> 'object'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_snapshot->'hashes') AS key
        WHERE key NOT IN ('providerFacts', 'profitabilityInput', 'profitabilityResult', 'evaluatorInput', 'evaluatorOutput', 'aggregate')
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_each_text(v_snapshot->'hashes') AS hash
        WHERE hash.value !~ '^[0-9a-f]{64}$'
      )
      OR (SELECT count(*) FROM jsonb_object_keys(v_snapshot->'hashes')) <> 6
      OR jsonb_typeof(v_evidence) <> 'object'
      OR v_evidence->>'schemaVersion' <> 'gonggamline-item-selection-evidence-v1'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_evidence) AS key
        WHERE key NOT IN ('schemaVersion', 'provider', 'providerItemNumber', 'observedAt', 'facts', 'rightsEvidence')
      )
      OR (SELECT count(*) FROM jsonb_object_keys(v_evidence)) <> 6
      OR v_evidence->>'provider' <> 'domeggook'
      OR v_evidence->>'providerItemNumber' <> v_evaluation.provider_item_number THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid evaluation canonical projection.';
    END IF;
  END LOOP;

  IF (
    SELECT count(DISTINCT (evaluation).provider_item_number)
    FROM unnest(p_evaluations) AS evaluation
  ) <> v_expected_count
    OR (
      SELECT count(DISTINCT (evaluation).original_position)
      FROM unnest(p_evaluations) AS evaluation
    ) <> v_expected_count
    OR EXISTS (
      SELECT 1
      FROM unnest(p_evaluations) WITH ORDINALITY AS evaluation(value, ordinal)
      WHERE ordinal > 1
        AND (value).original_position <=
          (p_evaluations[ordinal - 1]).original_position
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Evaluations must have unique, ordered identities.';
  END IF;

  IF v_run.status <> 'RUNNING' THEN
    SELECT
      v_run.status = p_terminal_status
      AND v_run.candidate_failures_canonical_text = p_candidate_failures_canonical_text
      AND v_run.observed_candidate_count = p_observed_candidate_count
      AND v_run.successfully_evaluated_count = p_successfully_evaluated_count
      AND v_run.persisted_evaluation_count = v_expected_count
      AND v_run.failed_candidate_count = p_failed_candidate_count
      AND v_run.skipped_candidate_count = p_skipped_candidate_count
      AND v_run.failure_code IS NOT DISTINCT FROM p_failure_code
      AND (SELECT count(*) FROM public.item_selection_evaluations WHERE run_id = v_run.id) = v_expected_count
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(p_evaluations) AS submitted
        LEFT JOIN public.item_selection_evaluations AS existing
          ON existing.run_id = v_run.id
          AND existing.original_position = (submitted).original_position
        WHERE existing.id IS NULL
          OR existing.provider_item_number <> (submitted).provider_item_number
          OR existing.verdict <> (submitted).verdict
          OR existing.total_score_units IS DISTINCT FROM (submitted).total_score_units
          OR existing.coverage_units <> (submitted).coverage_units
          OR existing.normalized_margin_units IS DISTINCT FROM (submitted).normalized_margin_units
          OR existing.normalized_profit_krw_micros IS DISTINCT FROM (submitted).normalized_profit_krw_micros
          OR existing.canonical_snapshot_text <> (submitted).canonical_snapshot_text
          OR existing.canonical_evidence_text <> (submitted).canonical_evidence_text
      )
    INTO v_replay_matches
    ;
    IF v_replay_matches THEN
      RETURN v_run;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Divergent finalization conflict.';
  END IF;

  INSERT INTO public.item_selection_evaluations (
    run_id, provider_item_number, original_position, verdict,
    total_score_units, coverage_units, normalized_margin_units,
    normalized_profit_krw_micros, canonical_snapshot_text, snapshot_projection,
    canonical_evidence_text, evidence_projection
  )
  SELECT
    p_run_id, (evaluation).provider_item_number, (evaluation).original_position,
    (evaluation).verdict, (evaluation).total_score_units, (evaluation).coverage_units,
    (evaluation).normalized_margin_units, (evaluation).normalized_profit_krw_micros,
    (evaluation).canonical_snapshot_text, (evaluation).canonical_snapshot_text::jsonb,
    (evaluation).canonical_evidence_text, (evaluation).canonical_evidence_text::jsonb
  FROM unnest(p_evaluations) AS evaluation;
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  UPDATE public.item_selection_runs
  SET status = p_terminal_status,
      completed_at = transaction_timestamp(),
      failure_code = p_failure_code,
      observed_candidate_count = p_observed_candidate_count,
      successfully_evaluated_count = p_successfully_evaluated_count,
      persisted_evaluation_count = v_inserted_count,
      failed_candidate_count = p_failed_candidate_count,
      skipped_candidate_count = p_skipped_candidate_count,
      candidate_failures_canonical_text = p_candidate_failures_canonical_text,
      candidate_failures_projection = v_failures
  WHERE id = p_run_id
  RETURNING * INTO v_run;

  INSERT INTO public.security_audit_events (
    administrator_user_id, event_code, route, correlation_id, result
  ) VALUES (
    p_requested_by_principal_id::uuid, 'ITEM_SELECTION_FINALIZE', p_route,
    p_correlation_id, 'SUCCEEDED'
  );

  RETURN v_run;
END
$$;

ALTER FUNCTION public.create_item_selection_run_v1(
  text, text, integer, text, text, text, text, text, text, uuid, text, text, uuid
) OWNER TO postgres;
ALTER FUNCTION public.finalize_item_selection_run_v1(
  uuid, text, text, text, text, text, text,
  public.item_selection_evaluation_write_v1[], text,
  integer, integer, integer, integer, text, text, text, uuid
) OWNER TO postgres;

ALTER TABLE public.item_selection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_selection_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.item_selection_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_selection_evaluations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.item_selection_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.item_selection_evaluations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.security_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.item_selection_runs TO service_role;
GRANT SELECT ON TABLE public.item_selection_evaluations TO service_role;
GRANT SELECT ON TABLE public.security_audit_events TO service_role;

REVOKE ALL ON FUNCTION public.create_item_selection_run_v1(
  text, text, integer, text, text, text, text, text, text, uuid, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_item_selection_run_v1(
  uuid, text, text, text, text, text, text,
  public.item_selection_evaluation_write_v1[], text,
  integer, integer, integer, integer, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_item_selection_run_v1(
  text, text, integer, text, text, text, text, text, text, uuid, text, text, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_item_selection_run_v1(
  uuid, text, text, text, text, text, text,
  public.item_selection_evaluation_write_v1[], text,
  integer, integer, integer, integer, text, text, text, uuid
) TO service_role;
