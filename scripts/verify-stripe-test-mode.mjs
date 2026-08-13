import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const Stripe = require("stripe");

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(2);
}
if (!secret.startsWith("sk_test_")) {
  console.error("Refusing to run: STRIPE_SECRET_KEY must be a Stripe test key (sk_test_*)");
  process.exit(2);
}

const stripe = new Stripe(secret);
const account = await stripe.accounts.retrieve();
console.log(`Stripe test-mode connection OK: account=${account.id}`);
console.log("Next: execute docs/STRIPE_TEST_MODE.md against the target environment.");
