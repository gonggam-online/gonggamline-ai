import { createHash } from "node:crypto";

const samples = [
  {
    input: "Authorization: Bearer phase0_fake_bearer_123",
    forbidden: "phase0_fake_bearer_123",
  },
  {
    input: "token=phase0_fake_query_token",
    forbidden: "phase0_fake_query_token",
  },
  {
    input: "api_key: phase0_fake_api_key",
    forbidden: "phase0_fake_api_key",
  },
  {
    input: "Cookie: session=phase0_fake_cookie",
    forbidden: "phase0_fake_cookie",
  },
  {
    input: "C:\\Users\\Phase0FixtureUser\\private\\rollout.jsonl",
    forbidden: "Phase0FixtureUser",
  },
];

function redact(line) {
  return line
    .replace(
      /authorization:\s*bearer\s+\S+/giu,
      "Authorization: Bearer <redacted>",
    )
    .replace(
      /\b(api[_-]?key|token|secret)\s*[:=]\s*\S+/giu,
      "$1=<redacted>",
    )
    .replace(/cookie:\s*\S+/giu, "Cookie: <redacted>")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gu, "<user-home>");
}

const sanitized = samples.map(({ input, forbidden }) => {
  const output = redact(input);

  if (output.includes(forbidden)) {
    throw new Error(`Redaction failed for marker ${forbidden}`);
  }

  return output;
});

const evidence = {
  schemaVersion: "1.0.0",
  sampleCount: samples.length,
  leakedMarkerCount: 0,
  outputCategories: sanitized.map((output) =>
    output.startsWith("<user-home>") ? "local-path" : "credential-like",
  ),
};

evidence.sha256 = createHash("sha256")
  .update(JSON.stringify(evidence))
  .digest("hex");

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
