# RFQ.md — Request for Quotation

## Lifecycle

```
DRAFT / OPEN → MATCHED / QUOTED → AWARDED
                      ↑ offers (PENDING)
                      ↓ award
              Order PENDING_PAYMENT (source=RFQ)
```

## Roles

| Actor | Actions |
|-------|---------|
| Customer (buyer) | Create RFQ, compare offers, **award** |
| Merchant | Create offer on RFQ |
| Admin | Full access |

## Numbering (Stage 13)

- Sequence: `rfq_number_seq`
- Format: `RFQ-YYYY-#####`
- **No** `count()+1` (race-safe)

## Award → Order (Stage 12)

`POST /rfq/:id/award` with `{ offerId }`:

1. `SELECT … FOR UPDATE` on RFQ
2. Offer → `ACCEPTED`, other pending offers → `REJECTED`
3. RFQ → `AWARDED`
4. Create `Order` with `status=PENDING_PAYMENT`, `source=RFQ`, links `rfqId` / `offerId`
5. Emit `DomainEvents.RfqAwarded` → notifications `RFQ_AWARDED`

Second award → **409 Conflict**.

## Offers

- `POST /rfq/:id/offers` (merchant)
- Notification to buyer: `RFQ_OFFER_RECEIVED`

## API (main)

| Method | Path |
|--------|------|
| POST | `/rfq` |
| GET | `/rfq`, `/rfq/:id`, `/rfq/:id/compare` |
| POST | `/rfq/:id/offers` |
| POST | `/rfq/:id/award` |
| POST | `/rfq/:id/messages` |

Buyer cabinet: `GET /buyer/rfqs`  
Merchant cabinet: `GET /merchant/rfqs`

## Tests

- `src/rfq/rfq-award.spec.ts` — award + race
- `src/rfq/rfq-number-concurrency.spec.ts` — numbers
- command handler unit tests under `src/rfq/commands/__tests__/`

## Code

- `apps/api/src/rfq/`
