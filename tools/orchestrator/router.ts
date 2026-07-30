export interface PcRoute {
  readonly pcId: string;
  readonly taskClasses: readonly string[];
  readonly requiredCapabilities: readonly string[];
}

export interface RouteRequest {
  readonly taskClass: string;
  readonly requiredCapabilities: readonly string[];
  readonly availableCapabilitiesByPc: Readonly<Record<string, readonly string[]>>;
}

export function selectPc(
  routes: readonly PcRoute[],
  request: RouteRequest,
): string {
  for (const route of routes) {
    if (!route.taskClasses.includes(request.taskClass)) {
      continue;
    }
    const available = new Set(request.availableCapabilitiesByPc[route.pcId] ?? []);
    const required = new Set([
      ...route.requiredCapabilities,
      ...request.requiredCapabilities,
    ]);
    if ([...required].every((capability) => available.has(capability))) {
      return route.pcId;
    }
  }
  throw new Error(`No deterministic PC route for task class: ${request.taskClass}`);
}

export const defaultPcRoutes: readonly PcRoute[] = [
  {
    pcId: "N",
    taskClasses: ["ARCHITECTURE", "CONTRACT", "ORCHESTRATOR", "DOCUMENTATION"],
    requiredCapabilities: ["git", "node", "codex"],
  },
  {
    pcId: "D",
    taskClasses: ["APPROVED_PRODUCT_IMPLEMENTATION"],
    requiredCapabilities: ["git", "node", "codex"],
  },
];
