import "server-only";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AdminAllowlistConfigurationError extends Error {
  constructor() {
    super("Administrator authorization is unavailable.");
    this.name = "AdminAllowlistConfigurationError";
  }
}

export function parseAdminUserAllowlist(
  value: string | undefined = process.env.GONGGAMLINE_ADMIN_USER_IDS,
): ReadonlySet<string> {
  if (value === undefined || value.trim() === "") {
    throw new AdminAllowlistConfigurationError();
  }

  const identifiers = value.trim().split(",");
  const normalized = new Set<string>();

  for (const identifier of identifiers) {
    const candidate = identifier.trim();
    if (candidate === "" || !UUID_PATTERN.test(candidate)) {
      throw new AdminAllowlistConfigurationError();
    }
    normalized.add(candidate.toLowerCase());
  }

  return normalized;
}

export function isAllowlistedAdminUser(
  userId: string,
  allowlist: ReadonlySet<string> = parseAdminUserAllowlist(),
): boolean {
  return UUID_PATTERN.test(userId) && allowlist.has(userId.toLowerCase());
}
