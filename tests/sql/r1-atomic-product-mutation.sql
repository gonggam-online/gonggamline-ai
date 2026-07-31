\set ON_ERROR_STOP on

DO $verify$
DECLARE
  v_admin uuid := '10000000-0000-4000-8000-000000000001';
  v_correlation uuid := '20000000-0000-4000-8000-000000000001';
  v_key text := repeat('a', 64);
  v_fingerprint text := repeat('b', 64);
  v_first jsonb;
  v_replay jsonb;
  v_product_id bigint;
BEGIN
  IF has_function_privilege('anon',
      'public.import_product_v1(jsonb,text,text,uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated',
      'public.import_product_v1(jsonb,text,text,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'R1 role boundary permits direct RPC execution';
  END IF;
  IF has_table_privilege('anon', 'public.product_mutation_requests',
      'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated', 'public.product_mutation_requests',
      'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'R1 role boundary permits idempotency storage access';
  END IF;

  v_first := public.import_product_v1(
    jsonb_build_object(
      'productNo','9000000000001','keyword','r1-disposable',
      'title','R1 disposable product','thumbnail',NULL,'productUrl',NULL,
      'supplyPrice',1000,'minimumOrderQuantity',1,'initialPurchaseAmount',1000,
      'estimatedSalePrice',3000,'marketplaceFee',330,'advertisingCost',240,
      'logisticsCost',500,'returnReserve',90,'estimatedProfit',840,
      'marginRate',28,'breakEvenSalePrice',1924,'basicScore',70,
      'recommendation','disposable','sellerId',NULL,'sellerName',NULL,
      'availableOnDomeggook',true,'supplyAvailable',true
    ), v_key, v_fingerprint, v_admin, v_correlation
  );
  IF v_first->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'R1 first call was not committed as a first result';
  END IF;
  v_product_id := (v_first->>'productId')::bigint;
  IF (SELECT count(*) FROM public.products WHERE id=v_product_id) <> 1
    OR (SELECT count(*) FROM public.product_mutation_requests
        WHERE target_product_id=v_product_id AND status='SUCCEEDED') <> 1
    OR (SELECT count(*) FROM public.security_audit_events
        WHERE correlation_id=v_correlation AND event_code='PRODUCT_IMPORT') <> 1 THEN
    RAISE EXCEPTION 'R1 first call did not atomically commit three effects';
  END IF;

  v_replay := public.import_product_v1(
    jsonb_build_object(
      'productNo','9000000000001','keyword','r1-disposable',
      'title','R1 disposable product','thumbnail',NULL,'productUrl',NULL,
      'supplyPrice',1000,'minimumOrderQuantity',1,'initialPurchaseAmount',1000,
      'estimatedSalePrice',3000,'marketplaceFee',330,'advertisingCost',240,
      'logisticsCost',500,'returnReserve',90,'estimatedProfit',840,
      'marginRate',28,'breakEvenSalePrice',1924,'basicScore',70,
      'recommendation','disposable','sellerId',NULL,'sellerName',NULL,
      'availableOnDomeggook',true,'supplyAvailable',true
    ), v_key, v_fingerprint, v_admin,
    '20000000-0000-4000-8000-000000000002'
  );
  IF v_replay->>'replayed' <> 'true'
    OR (v_replay->>'productId')::bigint <> v_product_id
    OR (SELECT count(*) FROM public.security_audit_events
        WHERE event_code='PRODUCT_IMPORT' AND administrator_user_id=v_admin) <> 1 THEN
    RAISE EXCEPTION 'R1 identical replay duplicated effects';
  END IF;

  BEGIN
    PERFORM public.import_product_v1(
      jsonb_build_object(
        'productNo','9000000000002','keyword','divergent',
        'title','Divergent','thumbnail',NULL,'productUrl',NULL,
        'supplyPrice',1,'minimumOrderQuantity',1,'initialPurchaseAmount',1,
        'estimatedSalePrice',1,'marketplaceFee',0,'advertisingCost',0,
        'logisticsCost',0,'returnReserve',0,'estimatedProfit',0,
        'marginRate',0,'breakEvenSalePrice',1,'basicScore',0,
        'recommendation','none','sellerId',NULL,'sellerName',NULL,
        'availableOnDomeggook',false,'supplyAvailable',false
      ), v_key, repeat('c',64), v_admin,
      '20000000-0000-4000-8000-000000000003'
    );
    RAISE EXCEPTION 'R1 divergent replay unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$verify$;

CREATE FUNCTION public.r1_force_audit_failure() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_code = 'PRODUCT_IMPORT'
    AND NEW.correlation_id = '20000000-0000-4000-8000-000000000004'::uuid THEN
    RAISE EXCEPTION 'forced disposable audit failure';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER r1_force_audit_failure
  BEFORE INSERT ON public.security_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.r1_force_audit_failure();

DO $verify$
BEGIN
  BEGIN
    PERFORM public.import_product_v1(
      jsonb_build_object(
        'productNo','9000000000004','keyword','rollback',
        'title','Rollback product','thumbnail',NULL,'productUrl',NULL,
        'supplyPrice',1,'minimumOrderQuantity',1,'initialPurchaseAmount',1,
        'estimatedSalePrice',1,'marketplaceFee',0,'advertisingCost',0,
        'logisticsCost',0,'returnReserve',0,'estimatedProfit',0,
        'marginRate',0,'breakEvenSalePrice',1,'basicScore',0,
        'recommendation','none','sellerId',NULL,'sellerName',NULL,
        'availableOnDomeggook',false,'supplyAvailable',false
      ), repeat('d',64), repeat('e',64),
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000004'
    );
    RAISE EXCEPTION 'R1 forced audit failure unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;
  IF EXISTS (SELECT FROM public.products WHERE product_no='9000000000004')
    OR EXISTS (SELECT FROM public.product_mutation_requests
      WHERE idempotency_key_hash=repeat('d',64))
    OR EXISTS (SELECT FROM public.security_audit_events
      WHERE correlation_id='20000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'R1 audit failure did not roll back every effect';
  END IF;
END
$verify$;

DROP TRIGGER r1_force_audit_failure ON public.security_audit_events;
DROP FUNCTION public.r1_force_audit_failure();

SELECT 'R1 disposable atomic mutation evidence: PASS' AS result;
