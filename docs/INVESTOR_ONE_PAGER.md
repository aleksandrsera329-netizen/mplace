# Mplace Energy — investor one-pager

## What it is

Mplace is a B2B multi-vendor marketplace platform for industrial and oil & gas procurement.

## Core workflow

Buyer request → RFQ → merchant offers → award → order → payment → fulfillment → payout.

## Why it is valuable

The platform already contains the expensive operational primitives that normally require months of backend work:

- multi-tenant marketplace
- merchant and buyer workflows
- RFQ/procurement
- Stripe Connect and webhooks
- ledger/refunds/payouts
- inventory reservations
- KYC/media ACL
- search and background jobs
- security and observability
- Docker/Kubernetes deployment

## Technology

NestJS 11 · Next.js 16 · React 19 · PostgreSQL 16 · Prisma · Redis · BullMQ · Meilisearch · Stripe · Docker · Kubernetes.

## Current commercial position

Pilot-ready software asset. The production UI is consolidated on Next.js, legacy static UI is archived, tenant isolation is enforced globally, and security/E2E coverage has been strengthened.

## Acquisition thesis

A strategic buyer can acquire a substantial B2B marketplace foundation and focus engineering effort on vertical-specific integrations, customers, data and go-to-market instead of rebuilding the platform core.
