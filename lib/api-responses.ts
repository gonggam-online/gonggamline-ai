export function unavailableListResponse<const K extends string>(field: K) {
  return {
    success: true as const,
    available: false as const,
    data: [] as unknown[],
    [field]: [] as unknown[],
    message: "No data available",
  } as {
    success: true;
    available: false;
    data: unknown[];
    message: "No data available";
  } & Record<K, unknown[]>;
}
