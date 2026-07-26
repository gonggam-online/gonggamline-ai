# API policy

Public routes under `app/api/**/route.ts` are contract boundaries.

- Keep handlers thin: authenticate/authorize where applicable, validate input,
  delegate once, map typed output, and choose explicit HTTP status.
- Preserve existing response shapes unless a Story explicitly authorizes a
  contract change and supplies compatibility/migration evidence.
- Never expose raw database rows, provider payloads, stacks, secrets, or unsafe
  error details.
- Optional read-only features may expose documented, observable, recoverable
  unavailable states. Unexpected errors remain failures; writes never degrade
  to false success.
- Test success, validation, expected unavailability, and unexpected failure.
- Add safe public routes to the typed browser manifest when appropriate.

A new Public API requires a completed Architecture Story before implementation,
including consumers, auth, DTO, versioning, errors, observability, abuse limits,
tests, rollout, and rollback.
