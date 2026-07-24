export const DISCOVERY_RECOMMENDATIONS_SELECT =
  "*,market_products(id,title,category,brand,seller_name,thumbnail_url,url:product_url)";

export const DISCOVERY_BUNDLES_SELECT =
  "*,ai_bundle_items(*,market_products(id,title,category,brand,thumbnail_url,url:product_url))";

export const COUPANG_SELLER_JOBS_SELECT =
  "*, listing_drafts(coupang_title, product_name, status), commerce_workflows!workflow_id(workflow_code, workflow_name, current_stage)";
