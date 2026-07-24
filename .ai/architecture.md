# Architecture

The App Router application uses Next.js, React, TypeScript, Supabase, domain services, engine modules, a Runtime Queue, AI Workers, Revenue Engine, Marketplace Intelligence, Memory, and Decision Engine.

Keep route handlers thin, domain behavior in typed services/engines, and external failures sanitized but observable. Treat marketplace writes, pricing, inventory, orders, fulfillment, payments, and production data mutations as high-risk boundaries.

This document is part of the permanent Mandatory Codex Task Protocol in `AGENTS.md`.
