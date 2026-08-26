import { rankDiscoveryPortfolio, type EvaluatedDiscoveryCandidate, type TrendDiscoveryCandidate } from "../lib/market/discovery-portfolio-ranking";
import { getItemDiscoveryFinder } from "./item-discovery-finder.service";
import { listDecisionRuns, listRecommendations } from "./discovery.service";

export async function getUnifiedItemDiscoveryDashboard() {
  const finder = await getItemDiscoveryFinder();
  const warnings: string[] = [];
  const [recommendationsResult, runsResult] = await Promise.allSettled([listRecommendations(), listDecisionRuns()]);
  const recommendations = recommendationsResult.status === "fulfilled" ? recommendationsResult.value : [];
  const runs = runsResult.status === "fulfilled" ? runsResult.value : [];
  if (recommendationsResult.status === "rejected") warnings.push("EVALUATED_PRODUCTS_UNAVAILABLE");
  if (runsResult.status === "rejected") warnings.push("DECISION_RUNS_UNAVAILABLE");
  const trends = Array.isArray(finder.recommendations) ? finder.recommendations as unknown as TrendDiscoveryCandidate[] : [];
  return Object.freeze({
    generatedAt: new Date().toISOString(), finder,
    portfolio: rankDiscoveryPortfolio({ trends, evaluated: recommendations as unknown as EvaluatedDiscoveryCandidate[] }),
    decisionRuns: runs, warnings,
  });
}
