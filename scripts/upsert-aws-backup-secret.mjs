import {
  CreateSecretCommand,
  DescribeSecretCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const region = process.env.AWS_REGION ?? "ap-southeast-1";
const secretName = "gonggamline/production/database-export-v1";
const password = process.env.SUPABASE_DB_PASSWORD;

if (region !== "ap-southeast-1") throw new Error("SINGAPORE_REGION_REQUIRED");
if (!password || password.length < 8) throw new Error("SUPABASE_DB_PASSWORD_REQUIRED");

const client = new SecretsManagerClient({ region });
try {
  try {
    const existing = await client.send(new DescribeSecretCommand({ SecretId: secretName }));
    if (!existing.ARN) throw new Error("EXISTING_SECRET_ARN_MISSING");
    process.stdout.write(`SECRET_STATUS=EXISTS\nSECRET_ARN=${existing.ARN}\n`);
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    const secretString = JSON.stringify({
      host: "aws-0-ap-southeast-1.pooler.supabase.com",
      port: 5432,
      database: "postgres",
      username: "postgres.sxvtznmoemrcwifungnb",
      password,
      sslmode: "require",
    });
    const created = await client.send(new CreateSecretCommand({
      Name: secretName,
      Description: "Read-only logical export credential for the GonggamLine independent backup worker",
      SecretString: secretString,
      Tags: [
        { Key: "gonggamline:system", Value: "independent-backup" },
        { Key: "gonggamline:data-class", Value: "secret" },
      ],
    }));
    if (!created.ARN) throw new Error("CREATED_SECRET_ARN_MISSING");
    process.stdout.write(`SECRET_STATUS=CREATED\nSECRET_ARN=${created.ARN}\n`);
  }
} finally {
  client.destroy();
}
