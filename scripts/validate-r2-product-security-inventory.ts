import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type InventoryRow = Readonly<{
  category: string;
  schemaName: string;
  parentName: string;
  objectName: string;
  definition: string;
}>;

const expectedMigrations = Array.from({ length: 23 }, (_, index) =>
  index.toString().padStart(3, "0"));

const expectedPolicies = new Map([
  ["Allow public insert products", "PERMISSIVE|anon|INSERT||true"],
  ["Allow public read products", "PERMISSIVE|anon|SELECT|true|"],
  ["Allow public update products", "PERMISSIVE|anon|UPDATE|true|true"],
]);

const expectedFunctions = new Map([
  ["product_mutation_claim_v1", "text, text, text, text, uuid"],
  ["product_mutation_complete_v1", "uuid, bigint, jsonb, uuid, text, text, uuid"],
  ["import_product_v1", "jsonb, text, text, uuid, uuid"],
  ["patch_product_operator_fields_v1", "bigint, timestamp with time zone, jsonb, text, text, uuid, uuid"],
  ["record_product_competition_v1", "bigint, timestamp with time zone, jsonb, text, text, text, uuid, uuid, text"],
  ["record_manual_competition_analysis_v1", "bigint, timestamp with time zone, jsonb, text, text, uuid, uuid"],
  ["record_automatic_competition_analysis_v1", "bigint, timestamp with time zone, jsonb, text, text, uuid, uuid, text"],
]);

const allowedCategories = new Set([
  "migration", "relation", "policy", "relation_acl", "function",
  "relation_privilege_state", "function_acl", "function_privilege_state",
  "default_acl", "default_acl_state", "public_owner", "public_function_owner",
  "extension", "product_rows",
]);

const roles = ["PUBLIC", "anon", "authenticated", "service_role"];
const tablePrivileges = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
const approvedServiceFunctions = new Set([
  "import_product_v1", "patch_product_operator_fields_v1",
  "record_manual_competition_analysis_v1", "record_automatic_competition_analysis_v1",
]);
const externalWorkExtensions = new Set(["pg_net", "pg_cron", "wrappers", "http"]);

const sensitivePattern = /(?:postgres(?:ql)?:\/\/|password=|service_role_key|anon_key|bearer\s+|eyJ[A-Za-z0-9_-]{10,}\.)/i;

export function parseInventoryCsv(source: string): InventoryRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted && char === '"' && source[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("Inventory CSV contains an unterminated quoted field.");
  record.push(field);
  if (record.some((value) => value.length > 0)) records.push(record);
  const [header, ...rows] = records;
  if (!header || header.join(",") !== "category,schema_name,parent_name,object_name,definition") {
    throw new Error("Inventory CSV header is not the approved v1 contract.");
  }
  return rows.map((values, index) => {
    if (values.length !== 5) throw new Error(`Inventory row ${index + 2} does not have five fields.`);
    return {
      category: values[0], schemaName: values[1], parentName: values[2],
      objectName: values[3], definition: values[4],
    };
  });
}

export function validateInventory(rows: readonly InventoryRow[]): string[] {
  const errors: string[] = [];
  const serialized = JSON.stringify(rows);
  if (sensitivePattern.test(serialized)) errors.push("Inventory contains secret-like material.");
  for (const row of rows) {
    if (!allowedCategories.has(row.category)) errors.push(`Unknown inventory category: ${row.category}`);
  }

  const migrations = rows.filter((row) => row.category === "migration").map((row) => row.objectName);
  if (JSON.stringify(migrations) !== JSON.stringify(expectedMigrations)) {
    errors.push("Migration history must be exactly 000 through 022 with no gaps or additions.");
  }

  const policies = rows.filter((row) => row.category === "policy" && row.parentName === "products");
  if (policies.length !== expectedPolicies.size) errors.push("Product policy inventory is incomplete or contains unknown policies.");
  for (const [name, definition] of expectedPolicies) {
    if (!policies.some((row) => row.objectName === name && row.definition === definition)) {
      errors.push(`Product policy drift: ${name}`);
    }
  }

  const functions = rows.filter((row) => row.category === "function");
  if (functions.length !== expectedFunctions.size) errors.push("R1 function inventory is incomplete or contains overload drift.");
  for (const [name, signature] of expectedFunctions) {
    const match = functions.find((row) => row.parentName === name && row.objectName === signature);
    if (!match) errors.push(`R1 function signature drift: ${name}`);
    else if (!/^([^|]+)\|true\|.*search_path=.*pg_catalog.*public/i.test(match.definition)) {
      errors.push(`R1 function owner/security/search_path drift: ${name}`);
    }
  }

  const relations = new Set(rows.filter((row) => row.category === "relation").map((row) => row.parentName));
  for (const relation of ["products", "product_mutation_requests", "security_audit_events"]) {
    if (!relations.has(relation)) errors.push(`Missing required relation inventory: ${relation}`);
  }

  const tableStates = rows.filter((row) => row.category === "relation_privilege_state");
  for (const role of roles) {
    for (const privilege of tablePrivileges) {
      const states = tableStates.filter((row) => row.parentName === "products" &&
        row.objectName === role && row.definition.match(new RegExp(`^${privilege}\\|(?:true|false)$`)));
      if (states.length !== 1) errors.push(`Missing or duplicate Product privilege state: ${role}/${privilege}.`);
    }
  }

  const functionStates = rows.filter((row) => row.category === "function_privilege_state");
  for (const [name, signature] of expectedFunctions) {
    for (const role of roles) {
      const states = functionStates.filter((row) => row.parentName === name &&
        row.objectName === signature && row.definition.match(new RegExp(`^${role}\\|EXECUTE\\|(?:true|false)$`)));
      if (states.length !== 1) {
        errors.push(`Missing or duplicate R1 execute state: ${name}/${role}.`);
        continue;
      }
      const expected = role === "service_role" && approvedServiceFunctions.has(name);
      if (states[0].definition.endsWith(`|${String(!expected)}`)) {
        errors.push(`R1 execute matrix drift: ${name}/${role}.`);
      }
    }
  }

  const creatorRoles = new Set(rows
    .filter((row) => row.category === "public_owner" || row.category === "public_function_owner")
    .map((row) => row.parentName));
  if (creatorRoles.size === 0) errors.push("No public-schema creator roles were inventoried.");
  for (const role of creatorRoles) {
    for (const objectType of ["r", "S", "f"]) {
      if (!rows.some((row) => row.category === "default_acl_state" &&
          row.parentName === role && row.objectName === objectType)) {
        errors.push(`Missing default ACL state for ${role}/${objectType}.`);
      }
    }
  }
  if (!rows.some((row) => row.category === "product_rows" &&
      /^(?:0|1-99|100-999|1000-9999|10000\+)$/.test(row.definition))) {
    errors.push("Missing sanitized Product row-count range.");
  }
  const unsafeExtensions = rows.filter((row) => row.category === "extension" &&
    externalWorkExtensions.has(row.parentName)).map((row) => row.parentName);
  if (unsafeExtensions.length > 0) {
    errors.push(`External-work extensions require quarantine review: ${unsafeExtensions.sort().join(", ")}.`);
  }
  return [...new Set(errors)];
}

export function buildInventoryReport(rows: readonly InventoryRow[]) {
  const errors = validateInventory(rows);
  const canonicalRows = [...rows].sort((left, right) =>
    [left.category, left.schemaName, left.parentName, left.objectName, left.definition].join("\u001f")
      .localeCompare([right.category, right.schemaName, right.parentName, right.objectName, right.definition].join("\u001f")));
  const canonicalText = JSON.stringify(canonicalRows);
  return {
    schemaVersion: "gonggamline-r2-product-security-inventory-report-v1",
    accepted: errors.length === 0,
    fingerprintSha256: createHash("sha256").update(canonicalText, "utf8").digest("hex"),
    errors,
    creatorRoles: [...new Set(rows.filter((row) =>
      row.category === "public_owner" || row.category === "public_function_owner")
      .map((row) => row.parentName))].sort(),
    productPolicies: rows.filter((row) => row.category === "policy")
      .map((row) => row.objectName).sort(),
    productRowRange: rows.find((row) => row.category === "product_rows")?.definition ?? null,
  } as const;
}

if (process.argv[1]?.endsWith("validate-r2-product-security-inventory.ts")) {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Pass the sanitized inventory CSV path.");
  const report = buildInventoryReport(parseInventoryCsv(readFileSync(inputPath, "utf8")));
  const errors = report.errors;
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`BLOCKED: ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}
