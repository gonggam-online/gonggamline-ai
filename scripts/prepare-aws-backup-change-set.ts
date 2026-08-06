import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildDisabledWorkerChangeSetPlan } from "../tools/aws-backup-change-set/plan";

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error("ARGUMENTS_NOT_ACCEPTED_NO_AWS_OPERATION_IS_AUTHORIZED");
  }
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const templatePath = path.join(repositoryRoot, "infra", "aws-backup", "cloudformation.json");
  const templateSource = await readFile(templatePath, "utf8");
  const plan = buildDisabledWorkerChangeSetPlan(templateSource);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

void main();
