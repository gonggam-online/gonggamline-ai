-- R1 Atomic Product Mutation DB v1.
-- Additive only: migrations 000-021 remain immutable.

CREATE TABLE public.product_mutation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_scope text NOT NULL CHECK (
    principal_scope ~ '^(admin:[0-9a-f-]{36}|worker:competition-v1)$'
  ),
  operation_code text NOT NULL CHECK (operation_code IN (
    'IMPORT_PRODUCT', 'PATCH_PRODUCT_OPERATOR_FIELDS',
    'RECORD_MANUAL_COMPETITION', 'RECORD_AUTOMATIC_COMPETITION'
  )),
  idempotency_key_hash text NOT NULL CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUCCEEDED')),
  target_product_id bigint REFERENCES public.products(id),
  result_canonical_text text,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  completed_at timestamptz,
  CONSTRAINT product_mutation_requests_scope_key_unique
    UNIQUE (principal_scope, operation_code, idempotency_key_hash),
  CONSTRAINT product_mutation_requests_completion_check CHECK (
    (status = 'IN_PROGRESS' AND target_product_id IS NULL
      AND result_canonical_text IS NULL AND completed_at IS NULL)
    OR
    (status = 'SUCCEEDED' AND target_product_id IS NOT NULL
      AND result_canonical_text IS NOT NULL AND completed_at IS NOT NULL)
  ),
  CONSTRAINT product_mutation_requests_result_is_json CHECK (
    result_canonical_text IS NULL OR
    (result_canonical_text::jsonb)::text = result_canonical_text
  )
);

CREATE INDEX product_mutation_requests_target_idx
  ON public.product_mutation_requests (target_product_id, created_at DESC);
CREATE INDEX product_mutation_requests_correlation_idx
  ON public.product_mutation_requests (correlation_id);

ALTER TABLE public.security_audit_events
  DROP CONSTRAINT security_audit_events_event_code_check,
  DROP CONSTRAINT security_audit_events_route_check;
ALTER TABLE public.security_audit_events
  ADD CONSTRAINT security_audit_events_event_code_check CHECK (event_code IN (
    'ITEM_SELECTION_CREATE', 'ITEM_SELECTION_FINALIZE',
    'PRODUCT_IMPORT', 'PRODUCT_OPERATOR_PATCH',
    'PRODUCT_MANUAL_COMPETITION', 'PRODUCT_AUTOMATIC_COMPETITION'
  )),
  ADD CONSTRAINT security_audit_events_route_check CHECK (route IN (
    '/api/admin/item-selection/runs',
    '/api/admin/item-selection/runs/[id]/finalize',
    '/api/admin/products/import',
    '/api/products/[id]',
    '/api/products/[id]/competition',
    '/api/products/[id]/competition/auto',
    '/api/competition/analyze-batch'
  ));

CREATE FUNCTION public.product_mutation_claim_v1(
  p_principal_scope text, p_operation_code text, p_idempotency_key_hash text,
  p_request_fingerprint text, p_correlation_id uuid
) RETURNS public.product_mutation_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_request public.product_mutation_requests;
BEGIN
  IF p_principal_scope !~ '^(admin:[0-9a-f-]{36}|worker:competition-v1)$'
    OR p_operation_code NOT IN (
      'IMPORT_PRODUCT', 'PATCH_PRODUCT_OPERATOR_FIELDS',
      'RECORD_MANUAL_COMPETITION', 'RECORD_AUTOMATIC_COMPETITION')
    OR p_idempotency_key_hash !~ '^[0-9a-f]{64}$'
    OR p_request_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'invalid product mutation claim' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.product_mutation_requests (
    principal_scope, operation_code, idempotency_key_hash,
    request_fingerprint, status, correlation_id
  ) VALUES (
    p_principal_scope, p_operation_code, p_idempotency_key_hash,
    p_request_fingerprint, 'IN_PROGRESS', p_correlation_id
  ) ON CONFLICT (principal_scope, operation_code, idempotency_key_hash)
    DO NOTHING;
  SELECT * INTO v_request FROM public.product_mutation_requests
   WHERE principal_scope = p_principal_scope
     AND operation_code = p_operation_code
     AND idempotency_key_hash = p_idempotency_key_hash
   FOR UPDATE;
  IF v_request.request_fingerprint <> p_request_fingerprint
    OR v_request.status = 'IN_PROGRESS'
      AND v_request.correlation_id <> p_correlation_id THEN
    RAISE EXCEPTION 'product mutation conflict' USING ERRCODE = '23505';
  END IF;
  RETURN v_request;
END $$;

CREATE FUNCTION public.product_mutation_complete_v1(
  p_request_id uuid, p_target_product_id bigint, p_result jsonb,
  p_administrator_user_id uuid, p_event_code text, p_route text,
  p_correlation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.security_audit_events (
    administrator_user_id, event_code, route, correlation_id, result
  ) VALUES (
    p_administrator_user_id, p_event_code, p_route, p_correlation_id, 'SUCCEEDED'
  );
  UPDATE public.product_mutation_requests SET
    status = 'SUCCEEDED', target_product_id = p_target_product_id,
    result_canonical_text = p_result::text,
    completed_at = transaction_timestamp()
  WHERE id = p_request_id AND status = 'IN_PROGRESS';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product mutation completion conflict' USING ERRCODE = '23505';
  END IF;
  RETURN p_result;
END $$;

CREATE FUNCTION public.import_product_v1(
  p_payload jsonb, p_idempotency_key_hash text, p_request_fingerprint text,
  p_requested_by_principal_id uuid, p_correlation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_request public.product_mutation_requests; v_product public.products; v_result jsonb;
BEGIN
  IF jsonb_typeof(p_payload) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_payload)) <> 22
    OR p_payload - ARRAY[
      'productNo','keyword','title','thumbnail','productUrl','supplyPrice',
      'minimumOrderQuantity','initialPurchaseAmount','estimatedSalePrice',
      'marketplaceFee','advertisingCost','logisticsCost','returnReserve',
      'estimatedProfit','marginRate','breakEvenSalePrice','basicScore',
      'recommendation','sellerId','sellerName','availableOnDomeggook',
      'supplyAvailable'] <> '{}'::jsonb
    OR COALESCE(p_payload->>'productNo','') !~ '^[0-9]{1,20}$'
    OR length(COALESCE(p_payload->>'title','')) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'invalid import payload' USING ERRCODE = '22023';
  END IF;
  v_request := public.product_mutation_claim_v1(
    'admin:' || p_requested_by_principal_id::text, 'IMPORT_PRODUCT',
    p_idempotency_key_hash, p_request_fingerprint, p_correlation_id);
  IF v_request.status = 'SUCCEEDED' THEN
    RETURN jsonb_set(v_request.result_canonical_text::jsonb,'{replayed}','true'::jsonb);
  END IF;
  INSERT INTO public.products (
    product_no, keyword, title, thumbnail, product_url, supply_price,
    minimum_order_quantity, initial_purchase_amount, estimated_sale_price,
    marketplace_fee, advertising_cost, logistics_cost, return_reserve,
    estimated_profit, margin_rate, break_even_sale_price, basic_score,
    recommendation, seller_id, seller_name, available_on_domeggook,
    supply_available, updated_at
  ) VALUES (
    p_payload->>'productNo', p_payload->>'keyword', p_payload->>'title',
    NULLIF(p_payload->>'thumbnail',''), NULLIF(p_payload->>'productUrl',''),
    (p_payload->>'supplyPrice')::integer,
    (p_payload->>'minimumOrderQuantity')::integer,
    (p_payload->>'initialPurchaseAmount')::integer,
    (p_payload->>'estimatedSalePrice')::integer,
    (p_payload->>'marketplaceFee')::integer,
    (p_payload->>'advertisingCost')::integer,
    (p_payload->>'logisticsCost')::integer,
    (p_payload->>'returnReserve')::integer,
    (p_payload->>'estimatedProfit')::integer,
    (p_payload->>'marginRate')::numeric,
    (p_payload->>'breakEvenSalePrice')::integer,
    (p_payload->>'basicScore')::integer, p_payload->>'recommendation',
    NULLIF(p_payload->>'sellerId',''), NULLIF(p_payload->>'sellerName',''),
    (p_payload->>'availableOnDomeggook')::boolean,
    (p_payload->>'supplyAvailable')::boolean, transaction_timestamp()
  ) ON CONFLICT (product_no) DO UPDATE SET
    keyword=EXCLUDED.keyword, title=EXCLUDED.title, thumbnail=EXCLUDED.thumbnail,
    product_url=EXCLUDED.product_url, supply_price=EXCLUDED.supply_price,
    minimum_order_quantity=EXCLUDED.minimum_order_quantity,
    initial_purchase_amount=EXCLUDED.initial_purchase_amount,
    estimated_sale_price=EXCLUDED.estimated_sale_price,
    marketplace_fee=EXCLUDED.marketplace_fee,
    advertising_cost=EXCLUDED.advertising_cost,
    logistics_cost=EXCLUDED.logistics_cost, return_reserve=EXCLUDED.return_reserve,
    estimated_profit=EXCLUDED.estimated_profit, margin_rate=EXCLUDED.margin_rate,
    break_even_sale_price=EXCLUDED.break_even_sale_price,
    basic_score=EXCLUDED.basic_score, recommendation=EXCLUDED.recommendation,
    seller_id=EXCLUDED.seller_id, seller_name=EXCLUDED.seller_name,
    available_on_domeggook=EXCLUDED.available_on_domeggook,
    supply_available=EXCLUDED.supply_available, updated_at=transaction_timestamp()
  RETURNING * INTO v_product;
  v_result := jsonb_build_object('contractVersion','product-mutation-result-v1',
    'productId',v_product.id,'productNo',v_product.product_no,'replayed',false);
  RETURN public.product_mutation_complete_v1(v_request.id, v_product.id, v_result,
    p_requested_by_principal_id, 'PRODUCT_IMPORT',
    '/api/admin/products/import', p_correlation_id);
END $$;

CREATE FUNCTION public.patch_product_operator_fields_v1(
  p_product_id bigint, p_expected_updated_at timestamptz, p_patch jsonb,
  p_idempotency_key_hash text, p_request_fingerprint text,
  p_requested_by_principal_id uuid, p_correlation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_request public.product_mutation_requests; v_product public.products; v_result jsonb;
BEGIN
  IF p_product_id <= 0 OR p_expected_updated_at IS NULL
    OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb
    OR (SELECT count(*) FROM jsonb_object_keys(p_patch)) > 12
    OR p_patch - ARRAY['isFavorite','reviewStatus','memo','manualSalePrice',
      'riskLevel','excludedReason','estimatedSalePrice','marketplaceFee',
      'advertisingCost','returnReserve','estimatedProfit','marginRate'] <> '{}'::jsonb
    OR (p_patch ? 'reviewStatus' AND p_patch->>'reviewStatus' NOT IN (
      'unreviewed','reviewing','sample_candidate','approved','excluded'))
    OR (p_patch ? 'riskLevel' AND p_patch->>'riskLevel' NOT IN (
      'unknown','low','medium','high')) THEN
    RAISE EXCEPTION 'invalid operator patch' USING ERRCODE = '22023';
  END IF;
  v_request := public.product_mutation_claim_v1(
    'admin:' || p_requested_by_principal_id::text, 'PATCH_PRODUCT_OPERATOR_FIELDS',
    p_idempotency_key_hash, p_request_fingerprint, p_correlation_id);
  IF v_request.status = 'SUCCEEDED' THEN
    RETURN jsonb_set(v_request.result_canonical_text::jsonb,'{replayed}','true'::jsonb);
  END IF;
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found' USING ERRCODE='P0002'; END IF;
  IF v_product.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'stale product' USING ERRCODE='40001';
  END IF;
  UPDATE public.products SET
    is_favorite=COALESCE((p_patch->>'isFavorite')::boolean,is_favorite),
    review_status=COALESCE(p_patch->>'reviewStatus',review_status),
    memo=CASE WHEN p_patch ? 'memo' THEN NULLIF(p_patch->>'memo','') ELSE memo END,
    manual_sale_price=CASE WHEN p_patch ? 'manualSalePrice' THEN (p_patch->>'manualSalePrice')::integer ELSE manual_sale_price END,
    risk_level=COALESCE(p_patch->>'riskLevel',risk_level),
    excluded_reason=CASE WHEN p_patch ? 'excludedReason' THEN NULLIF(p_patch->>'excludedReason','') ELSE excluded_reason END,
    estimated_sale_price=COALESCE((p_patch->>'estimatedSalePrice')::integer,estimated_sale_price),
    marketplace_fee=COALESCE((p_patch->>'marketplaceFee')::integer,marketplace_fee),
    advertising_cost=COALESCE((p_patch->>'advertisingCost')::integer,advertising_cost),
    return_reserve=COALESCE((p_patch->>'returnReserve')::integer,return_reserve),
    estimated_profit=COALESCE((p_patch->>'estimatedProfit')::integer,estimated_profit),
    margin_rate=COALESCE((p_patch->>'marginRate')::numeric,margin_rate),
    reviewed_at=CASE WHEN p_patch ? 'reviewStatus' THEN
      CASE WHEN p_patch->>'reviewStatus'='unreviewed' THEN NULL ELSE transaction_timestamp() END
      ELSE reviewed_at END,
    updated_at=transaction_timestamp()
  WHERE id=p_product_id RETURNING * INTO v_product;
  v_result := jsonb_build_object('contractVersion','product-mutation-result-v1',
    'productId',v_product.id,'updatedAt',v_product.updated_at,'replayed',false);
  RETURN public.product_mutation_complete_v1(v_request.id,v_product.id,v_result,
    p_requested_by_principal_id,'PRODUCT_OPERATOR_PATCH',
    '/api/products/[id]',p_correlation_id);
END $$;

CREATE FUNCTION public.record_product_competition_v1(
  p_product_id bigint, p_expected_updated_at timestamptz, p_analysis jsonb,
  p_operation_code text, p_idempotency_key_hash text, p_request_fingerprint text,
  p_requested_by_principal_id uuid, p_correlation_id uuid, p_route text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_request public.product_mutation_requests; v_product public.products; v_result jsonb;
  v_scope text; v_event text;
BEGIN
  IF p_product_id <= 0 OR p_expected_updated_at IS NULL
    OR p_operation_code NOT IN ('RECORD_MANUAL_COMPETITION','RECORD_AUTOMATIC_COMPETITION')
    OR jsonb_typeof(p_analysis) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_analysis)) <> 29
    OR p_analysis - ARRAY['keyword','marketPrice','top10AveragePrice','resultCount',
      'rocketRatio','averageReviewCount','averageRating','monthlySearchVolume',
      'competitionScore','marketabilityScore','priceCompetitivenessScore',
      'reviewEntryScore','rocketCompetitionScore','keywordDemandScore','grade',
      'status','source','confidence','note','summary','monthlyUnitsLow',
      'monthlyUnitsHigh','monthlySalesLow','monthlySalesHigh','analyzedAt',
      'runId','evidenceReference','analysisVersion','itemKey'] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid competition analysis' USING ERRCODE='22023';
  END IF;
  v_scope := CASE WHEN p_operation_code='RECORD_AUTOMATIC_COMPETITION'
    THEN 'worker:competition-v1' ELSE 'admin:'||p_requested_by_principal_id::text END;
  v_event := CASE WHEN p_operation_code='RECORD_AUTOMATIC_COMPETITION'
    THEN 'PRODUCT_AUTOMATIC_COMPETITION' ELSE 'PRODUCT_MANUAL_COMPETITION' END;
  v_request := public.product_mutation_claim_v1(v_scope,p_operation_code,
    p_idempotency_key_hash,p_request_fingerprint,p_correlation_id);
  IF v_request.status='SUCCEEDED' THEN
    RETURN jsonb_set(v_request.result_canonical_text::jsonb,'{replayed}','true'::jsonb);
  END IF;
  SELECT * INTO v_product FROM public.products WHERE id=p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found' USING ERRCODE='P0002'; END IF;
  IF v_product.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'stale product' USING ERRCODE='40001';
  END IF;
  IF (p_operation_code='RECORD_MANUAL_COMPETITION' AND p_analysis->>'source'<>'manual')
    OR (p_operation_code='RECORD_AUTOMATIC_COMPETITION'
      AND (p_analysis->>'source' NOT IN ('external','estimated')
        OR COALESCE(p_analysis->>'runId','')='' OR COALESCE(p_analysis->>'evidenceReference','')=''
        OR COALESCE(p_analysis->>'analysisVersion','')='' OR COALESCE(p_analysis->>'itemKey','')='')) THEN
    RAISE EXCEPTION 'invalid competition authority' USING ERRCODE='22023';
  END IF;
  UPDATE public.products SET
    coupang_analysis_keyword=NULLIF(p_analysis->>'keyword',''),
    coupang_market_price=(p_analysis->>'marketPrice')::numeric,
    coupang_top10_avg_price=(p_analysis->>'top10AveragePrice')::numeric,
    coupang_result_count=(p_analysis->>'resultCount')::integer,
    coupang_rocket_ratio=(p_analysis->>'rocketRatio')::numeric,
    coupang_avg_review_count=(p_analysis->>'averageReviewCount')::numeric,
    coupang_avg_rating=(p_analysis->>'averageRating')::numeric,
    coupang_keyword_search_volume=(p_analysis->>'monthlySearchVolume')::integer,
    competition_score=(p_analysis->>'competitionScore')::numeric,
    marketability_score=(p_analysis->>'marketabilityScore')::numeric,
    price_competitiveness_score=(p_analysis->>'priceCompetitivenessScore')::numeric,
    review_entry_score=(p_analysis->>'reviewEntryScore')::numeric,
    rocket_competition_score=(p_analysis->>'rocketCompetitionScore')::numeric,
    keyword_demand_score=(p_analysis->>'keywordDemandScore')::numeric,
    competition_grade=p_analysis->>'grade',
    competition_analysis_status=p_analysis->>'status',
    competition_data_source=p_analysis->>'source',
    competition_confidence=(p_analysis->>'confidence')::numeric,
    competition_data_note=NULLIF(p_analysis->>'note',''),
    competition_summary=NULLIF(p_analysis->>'summary',''),
    estimated_monthly_units_low=(p_analysis->>'monthlyUnitsLow')::integer,
    estimated_monthly_units_high=(p_analysis->>'monthlyUnitsHigh')::integer,
    estimated_monthly_sales_low=(p_analysis->>'monthlySalesLow')::numeric,
    estimated_monthly_sales_high=(p_analysis->>'monthlySalesHigh')::numeric,
    competition_analyzed_at=(p_analysis->>'analyzedAt')::timestamptz,
    updated_at=transaction_timestamp()
  WHERE id=p_product_id RETURNING * INTO v_product;
  v_result := jsonb_build_object('contractVersion','product-mutation-result-v1',
    'productId',v_product.id,'updatedAt',v_product.updated_at,'replayed',false);
  RETURN public.product_mutation_complete_v1(v_request.id,v_product.id,v_result,
    p_requested_by_principal_id,v_event,p_route,p_correlation_id);
END $$;

CREATE FUNCTION public.record_manual_competition_analysis_v1(
  p_product_id bigint, p_expected_updated_at timestamptz, p_analysis jsonb,
  p_idempotency_key_hash text, p_request_fingerprint text,
  p_requested_by_principal_id uuid, p_correlation_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT public.record_product_competition_v1($1,$2,$3,'RECORD_MANUAL_COMPETITION',
    $4,$5,$6,$7,'/api/products/[id]/competition') $$;

CREATE FUNCTION public.record_automatic_competition_analysis_v1(
  p_product_id bigint, p_expected_updated_at timestamptz, p_analysis jsonb,
  p_idempotency_key_hash text, p_request_fingerprint text,
  p_requested_by_principal_id uuid, p_correlation_id uuid, p_route text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_route NOT IN ('/api/products/[id]/competition/auto','/api/competition/analyze-batch') THEN
    RAISE EXCEPTION 'invalid automatic route' USING ERRCODE='22023';
  END IF;
  RETURN public.record_product_competition_v1($1,$2,$3,'RECORD_AUTOMATIC_COMPETITION',
    $4,$5,$6,$7,$8);
END $$;

ALTER FUNCTION public.product_mutation_claim_v1(text,text,text,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.product_mutation_complete_v1(uuid,bigint,jsonb,uuid,text,text,uuid) OWNER TO postgres;
ALTER FUNCTION public.import_product_v1(jsonb,text,text,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.patch_product_operator_fields_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.record_product_competition_v1(bigint,timestamptz,jsonb,text,text,text,uuid,uuid,text) OWNER TO postgres;
ALTER FUNCTION public.record_manual_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.record_automatic_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid,text) OWNER TO postgres;

ALTER TABLE public.product_mutation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_mutation_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_mutation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.product_mutation_requests TO service_role;
REVOKE ALL ON FUNCTION public.product_mutation_claim_v1(text,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.product_mutation_complete_v1(uuid,bigint,jsonb,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.record_product_competition_v1(bigint,timestamptz,jsonb,text,text,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.import_product_v1(jsonb,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.patch_product_operator_fields_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_manual_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_automatic_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.import_product_v1(jsonb,text,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.patch_product_operator_fields_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_manual_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_automatic_competition_analysis_v1(bigint,timestamptz,jsonb,text,text,uuid,uuid,text) TO service_role;
