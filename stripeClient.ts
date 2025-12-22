// stripeClient.ts - STUB
// Заглушка для отсутствующего модуля Stripe.

export function getStripeSync() {
  console.log("[STUB] getStripeSync called.");
  return {
    findOrCreateManagedWebhook: async () => ({ webhook: { url: "STUB_WEBHOOK_URL" } }),
    syncBackfill: () => Promise.resolve(),
  };
}

export function getStripePublishableKey(): string {
  return "STUB_PUBLISHABLE_KEY";
}

export function getUncachableStripeClient() {
  return {
    customers: {
      retrieve: async () => ({ id: "STUB_CUSTOMER_ID" }),
    },
    checkout: {
      sessions: {
        create: async () => ({ url: "STUB_CHECKOUT_URL" }),
      },
    },
  };
}
