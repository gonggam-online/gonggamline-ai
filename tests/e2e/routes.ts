export const pageRoutes = [
  "/",
  "/competition",
  "/coupang",
  "/coupang/register",
  "/discovery",
  "/dashboard/revenue",
  "/listing",
  "/market",
  "/os",
  "/procurement",
  "/revenue",
  "/seller",
  "/sourcing",
  "/system",
  "/workflow",
  "/workspace",
] as const;

export const revenueCriticalRoutes = ["/", "/revenue", "/competition", "/discovery", "/os"] as const;

export const apiRoutes = [
  "/api/health/runtime",
  "/api/products",
  "/api/dashboard/revenue",
] as const;
