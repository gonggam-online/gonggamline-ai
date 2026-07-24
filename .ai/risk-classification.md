# Deterministic risk classification

Normal-risk: documentation, tests, monitoring, CI, browser tests, UI presentation, read-only pages/APIs, sanitized errors, non-destructive analytics, and behavior-equivalent internal refactoring.

High-risk: `supabase/migrations/**`, schema/RLS/auth/authz, secrets/environment configuration, pricing or margin calculation, marketplace/listing writes, product price changes, order/inventory/fulfillment, supplier purchases, returns/cancellations, settlement/payment, destructive operations, and production data mutation.

If any high-risk condition applies, the whole PR is high-risk, must receive `manual-merge-required`, and must never auto-merge. Normal-risk PRs are eligible only after every required gate passes. The automation-system bootstrap PR is always manual.

This document is part of the permanent Mandatory Codex Task Protocol in `AGENTS.md`.
