/**
 * Billing is not built. SPEC section 11: no copy about price, trials or guarantees anywhere in
 * the app while this flag is off. The team decides pricing (OPEN_QUESTIONS, pricing model).
 */
export const PRICING_ENABLED = process.env.PRICING_ENABLED === 'true';

// TODO(team): plans, checkout and the copy that goes with them, once pricing is decided.
