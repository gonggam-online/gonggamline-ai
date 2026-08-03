-- Complete the approved Item Selection Story 3 persistence boundary with
-- audited, fail-closed recovery of abandoned RUNNING aggregates.

ALTER TABLE public.security_audit_events
  DROP CONSTRAINT security_audit_events_event_code_check,
  ADD CONSTRAINT security_audit_events_event_code_check CHECK (
    event_code IN (
      'ITEM_SELECTION_CREATE',
      'ITEM_SELECTION_FINALIZE',
      'ITEM_SELECTION_RECONCILE_STALE'
    )
  ),
  DROP CONSTRAINT security_audit_events_route_check,
  ADD CONSTRAINT security_audit_events_route_check CHECK (
    route IN (
      '/api/admin/item-selection/runs',
      '/api/admin/item-selection/runs/[id]/finalize',
      '/internal/item-selection/reconcile-stale'
    )
  );

CREATE FUNCTION public.reconcile_stale_item_selection_run_v1(
  p_run_id uuid,
  p_expected_request_fingerprint text,
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
BEGIN
  IF p_run_id IS NULL
    OR p_expected_request_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_requested_by_principal_id IS NULL
    OR p_requested_by_principal_id <> (p_requested_by_principal_id::uuid)::text THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid stale recovery request.';
  END IF;
  IF p_route IS DISTINCT FROM '/internal/item-selection/reconcile-stale'
    OR p_correlation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid audit context.';
  END IF;

  SELECT * INTO v_run
  FROM public.item_selection_runs
  WHERE id = p_run_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Item selection run not found.';
  END IF;
  IF v_run.requested_by_principal_id <> p_requested_by_principal_id
    OR v_run.request_fingerprint <> p_expected_request_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Stale recovery identity conflict.';
  END IF;

  IF v_run.status <> 'RUNNING' THEN
    IF v_run.status = 'FAILED'
      AND v_run.failure_code = 'STALE_RUN_RECOVERED'
      AND v_run.observed_candidate_count = 0
      AND v_run.successfully_evaluated_count = 0
      AND v_run.persisted_evaluation_count = 0
      AND v_run.failed_candidate_count = 0
      AND v_run.skipped_candidate_count = 0 THEN
      RETURN v_run;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Stale recovery terminal conflict.';
  END IF;

  -- Thirty minutes is the explicit v1 abandonment threshold. The database
  -- clock owns the decision so caller clock skew cannot recover a live run.
  IF v_run.started_at > statement_timestamp() - interval '30 minutes' THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Item selection run is not stale.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.item_selection_evaluations WHERE run_id = v_run.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Stale recovery found persisted evaluations.';
  END IF;

  UPDATE public.item_selection_runs
  SET status = 'FAILED',
      completed_at = transaction_timestamp(),
      failure_code = 'STALE_RUN_RECOVERED',
      observed_candidate_count = 0,
      successfully_evaluated_count = 0,
      persisted_evaluation_count = 0,
      failed_candidate_count = 0,
      skipped_candidate_count = 0,
      candidate_failures_canonical_text =
        '{"failures":[],"schemaVersion":"gonggamline-item-selection-candidate-failures-v1"}',
      candidate_failures_projection =
        '{"failures":[],"schemaVersion":"gonggamline-item-selection-candidate-failures-v1"}'::jsonb
  WHERE id = v_run.id
  RETURNING * INTO v_run;

  INSERT INTO public.security_audit_events (
    administrator_user_id, event_code, route, correlation_id, result
  ) VALUES (
    p_requested_by_principal_id::uuid, 'ITEM_SELECTION_RECONCILE_STALE',
    p_route, p_correlation_id, 'SUCCEEDED'
  );

  RETURN v_run;
END
$$;

ALTER FUNCTION public.reconcile_stale_item_selection_run_v1(
  uuid, text, text, text, uuid
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.reconcile_stale_item_selection_run_v1(
  uuid, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stale_item_selection_run_v1(
  uuid, text, text, text, uuid
) TO service_role;
