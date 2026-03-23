import { Polar } from "@polar-sh/sdk";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound";

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});

export const getPolarCustomerState = async (
  externalId: string,
): Promise<CustomerState | null> => {
  try {
    return await polarClient.customers.getStateExternal({
      externalId,
    });
  } catch (error) {
    if (error instanceof ResourceNotFound) {
      return null;
    }

    throw error;
  }
};

export const getActiveSubscription = (customer: CustomerState | null) => {
  return customer?.activeSubscriptions[0] ?? null;
};