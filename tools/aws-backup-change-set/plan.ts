import { createHash } from "node:crypto";

type JsonObject = Readonly<Record<string, unknown>>;

type CloudFormationResource = Readonly<{
  Type: string;
  Condition?: string;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
}>;

type CloudFormationTemplate = Readonly<{
  Metadata: JsonObject;
  Parameters: Readonly<Record<string, JsonObject>>;
  Resources: Readonly<Record<string, CloudFormationResource>>;
}>;

const templateRepositoryPath = "infra/aws-backup/cloudformation.json";
const stackName = "gonggamline-independent-backup-v1";
const changeSetName = "base-boundary-review-v1";
const region = "ap-southeast-1";
const workerCondition = "CreateWorkerResources";
const maximumInlineTemplateBytes = 51_200;

function objectValue(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label.toUpperCase()}_MUST_BE_AN_OBJECT`);
  }
  return value as JsonObject;
}

function parseTemplate(templateSource: string): CloudFormationTemplate {
  const parsed = JSON.parse(templateSource) as unknown;
  const root = objectValue(parsed, "template");
  return {
    Metadata: objectValue(root.Metadata, "metadata"),
    Parameters: objectValue(root.Parameters, "parameters") as Readonly<
      Record<string, JsonObject>
    >,
    Resources: objectValue(root.Resources, "resources") as Readonly<
      Record<string, CloudFormationResource>
    >,
  };
}

function parameterDefault(template: CloudFormationTemplate, name: string): unknown {
  return objectValue(template.Parameters[name], `parameter_${name}`).Default;
}

function sortedResourceNames(
  resources: Readonly<Record<string, CloudFormationResource>>,
  predicate: (resource: CloudFormationResource) => boolean,
): readonly string[] {
  return Object.entries(resources)
    .filter(([, resource]) => predicate(resource))
    .map(([name]) => name)
    .sort();
}

export function buildDisabledWorkerChangeSetPlan(templateSource: string) {
  const template = parseTemplate(templateSource);
  const sourceBytes = Buffer.byteLength(templateSource, "utf8");
  if (sourceBytes > maximumInlineTemplateBytes) {
    throw new Error("TEMPLATE_EXCEEDS_INLINE_BODY_LIMIT");
  }
  if (parameterDefault(template, "EnableWorkerResources") !== "false") {
    throw new Error("WORKER_RESOURCES_MUST_DEFAULT_FALSE");
  }
  if (parameterDefault(template, "BackupWorkerImageUri") !== "") {
    throw new Error("WORKER_IMAGE_MUST_DEFAULT_EMPTY");
  }
  if (parameterDefault(template, "ProductionDatabaseSecretArn") !== "") {
    throw new Error("PRODUCTION_SECRET_ARN_MUST_DEFAULT_EMPTY");
  }

  const createdResourceLogicalIds = sortedResourceNames(
    template.Resources,
    (resource) => resource.Condition !== workerCondition,
  );
  const omittedResourceLogicalIds = sortedResourceNames(
    template.Resources,
    (resource) => resource.Condition === workerCondition,
  );
  const retainedResourceLogicalIds = sortedResourceNames(
    template.Resources,
    (resource) =>
      resource.Condition !== workerCondition &&
      resource.DeletionPolicy === "Retain" &&
      resource.UpdateReplacePolicy === "Retain",
  );

  if (createdResourceLogicalIds.length !== 6 || omittedResourceLogicalIds.length !== 8) {
    throw new Error("DISABLED_WORKER_RESOURCE_BOUNDARY_DRIFTED");
  }

  return Object.freeze({
    schemaVersion: "gonggamline-aws-backup-disabled-worker-change-set-v1",
    status: "READY_FOR_NO_EXECUTE_CHANGE_SET_CREATION",
    risk: "HIGH_MANUAL",
    target: {
      provider: "AWS_CLOUDFORMATION",
      region,
      stackName,
      changeSetName,
      changeSetType: "CREATE",
    },
    template: {
      repositoryPath: templateRepositoryPath,
      sha256: createHash("sha256").update(templateSource).digest("hex"),
      bytes: sourceBytes,
      inlineTemplateBodyEligible: true,
      inlineTemplateBodyMaximumBytes: maximumInlineTemplateBytes,
    },
    parameters: {
      EnableWorkerResources: "false",
      BackupWorkerImageUri: "",
      ProductionDatabaseSecretArn: "",
    },
    capabilities: ["CAPABILITY_NAMED_IAM"],
    expectedChanges: {
      action: "Add",
      createdResourceLogicalIds,
      omittedResourceLogicalIds,
      retainedResourceLogicalIds,
      workerResourcesCreated: false,
      scheduleCreated: false,
      productionSecretReferenced: false,
    },
    safety: {
      requiresTemporaryOrFederatedAdministrativeSessionWithMfa: true,
      rootIdentityProhibited: true,
      longLivedAccessKeyProhibited: true,
      createChangeSetCreatesCloudFormationMetadataOnly: true,
      createChangeSetProvisionsResources: false,
      executeChangeSetAuthorized: false,
      infrastructureProvisioningAuthorized: false,
      productionExportAuthorized: false,
      paidResourceCreationAuthorized: false,
      rollbackBeforeExecution: "DELETE_UNEXECUTED_CHANGE_SET_AND_REVIEW_IN_PROGRESS_STACK_ONLY",
    },
    exactAwsCliArguments: [
      "cloudformation",
      "create-change-set",
      "--region",
      region,
      "--stack-name",
      stackName,
      "--change-set-name",
      changeSetName,
      "--change-set-type",
      "CREATE",
      "--template-body",
      `file://${templateRepositoryPath}`,
      "--parameters",
      "ParameterKey=EnableWorkerResources,ParameterValue=false",
      "--capabilities",
      "CAPABILITY_NAMED_IAM",
      "--description",
      "GonggamLine Singapore independent backup base boundary; worker omitted; do not execute",
    ],
    forbiddenAwsCliOperations: [
      "cloudformation execute-change-set",
      "cloudformation create-stack",
      "cloudformation deploy",
      "cloudformation update-stack",
    ],
  } as const);
}
