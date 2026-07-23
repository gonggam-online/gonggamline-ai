export type ProductKind = "single" | "set" | "bundle";
export type ProductLifecycle =
  | "candidate"
  | "reviewing"
  | "approved"
  | "sourcing"
  | "listing"
  | "active"
  | "paused"
  | "retired";

export interface CommerceProductRef {
  id: string;
  title: string;
  kind: ProductKind;
  lifecycle: ProductLifecycle;
  sourceProductIds: string[];
}
