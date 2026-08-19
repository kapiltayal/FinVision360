import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function getPlaidClient(): PlaidApi {
  const environmentName = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  const environments: Record<string, string> = {
    sandbox: PlaidEnvironments.sandbox,
    development: PlaidEnvironments.development,
    production: PlaidEnvironments.production,
  };
  const basePath = environments[environmentName];
  if (!basePath) {
    throw new Error(`Unsupported PLAID_ENV "${environmentName}"`);
  }

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });

  return new PlaidApi(configuration);
}