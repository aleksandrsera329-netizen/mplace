-- Stage 13: atomic RFQ number generation (no count()+1 races)

CREATE SEQUENCE IF NOT EXISTS rfq_number_seq START WITH 1 INCREMENT BY 1;

-- Align sequence with existing RFQ count so new numbers stay monotonic-ish
SELECT setval(
  'rfq_number_seq',
  GREATEST(
    (SELECT COUNT(*)::bigint FROM "RfqRequest"),
    1
  )
);
