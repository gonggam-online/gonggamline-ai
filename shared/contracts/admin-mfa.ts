export type AdminMfaAssuranceLevel = "aal1" | "aal2";
export type AdminMfaFactorStatus = "unverified" | "verified";

export type AdminMfaFactorDto = Readonly<{
  id: string;
  friendlyName: string | null;
  status: AdminMfaFactorStatus;
  createdAt: string;
}>;

export type AdminMfaStatusDto = Readonly<{
  assurance: Readonly<{
    current: AdminMfaAssuranceLevel;
    next: AdminMfaAssuranceLevel;
  }>;
  factors: ReadonlyArray<AdminMfaFactorDto>;
  enrollmentRequired: boolean;
  verificationRequired: boolean;
  recovery: Readonly<{
    automaticReset: false;
    mode: "owner-dashboard";
  }>;
}>;

export type AdminMfaEnrollmentDto = Readonly<{
  factorId: string;
  qrCodeDataUrl: string;
  secret: string;
}>;
