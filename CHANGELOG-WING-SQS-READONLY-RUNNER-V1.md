# WING SQS Read-only Runner v1 changelog

## Added

- Exact `1.0.0` `wing.read.request` / `wing.read.response` queue contracts for
  Picktil Discovery.
- Strict `connection_test`, `list_seller_products`, and `category_meta`
  parameter validation with all unknown/write operations rejected.
- Stateless at-least-once read processing with no local automation ledger or
  persisted provider response.
- Bounded SQS FIFO consumer/response publisher behavior, poison fail-close,
  response-before-delete ordering, redacted logs, and graceful shutdown.
- Hermetic contract, duplicate-read, failure, DLQ, FIFO, redaction, and
  shutdown tests.

## Infrastructure ownership

Picktil Discovery 09-cloud-platform Terraform is the sole SQS source of truth
in `ap-northeast-2`. This repository consumes environment-provided queue URLs
only. No AWS resource, IAM assignment, secret, scheduled task, or WING call was
created or changed by this implementation.

## Risk and rollback

High-risk/manual. Apply `manual-merge-required`; never auto-merge. Roll back by
reverting the PR and stopping the worker after queued responses are reconciled.
