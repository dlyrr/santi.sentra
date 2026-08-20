import { request, RequestError } from "@main/lib/request";
import {
  transactionTypesSchema,
  transactionsResponseSchema,
  transactionTotalsSchema,
  TransactionTypes,
  TransactionsResponse,
  TransactionTotals,
  TransactionTypeEnum,
  TransactionTimeFrame,
} from "@shared/ipc-schemas/transactions";

export class RateLimitError extends Error {
  resetSeconds: number;

  constructor(resetSeconds: number) {
    super(`Rate limited. Try again in ${resetSeconds} seconds.`);
    this.name = "RateLimitError";
    this.resetSeconds = resetSeconds;
  }
}

export class TransactionService {
  private static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 2,
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (error instanceof RequestError && error.statusCode === 429) {
          if (i === maxRetries) {
            const resetHeader =
              error.headers?.["retry-after"] ||
              error.headers?.["x-ratelimit-reset"];
            const resetSeconds = resetHeader
              ? parseInt(
                  Array.isArray(resetHeader) ? resetHeader[0] : resetHeader,
                  10,
                )
              : 60;
            throw new RateLimitError(resetSeconds);
          }

          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, i + 1) * 1000),
          );
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  static async getTransactionTypes(
    cookie: string,
    userId: number,
  ): Promise<TransactionTypes> {
    return this.withRetry(async () => {
      return await request(transactionTypesSchema, {
        url: `https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-types`,
        cookie,
      });
    });
  }

  static async getTransactions(
    cookie: string,
    userId: number,
    transactionType: TransactionTypeEnum,
    cursor?: string,
    limit: number = 100,
  ): Promise<TransactionsResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
      transactionType,
      itemPricingType: "PaidAndLimited",
    });

    if (cursor) {
      params.set("cursor", cursor);
    }

    return this.withRetry(async () => {
      return await request(transactionsResponseSchema, {
        url: `https://apis.roblox.com/transaction-records/v1/users/${userId}/transactions?${params.toString()}`,
        cookie,
      });
    });
  }

  static async getTransactionTotals(
    cookie: string,
    userId: number,
    timeFrame: TransactionTimeFrame = "Month",
  ): Promise<TransactionTotals> {
    const usedTypes = 6735032;

    return this.withRetry(async () => {
      return await request(transactionTotalsSchema, {
        url: `https://apis.roblox.com/transaction-records/v1/users/${userId}/transaction-totals?usedTypes=${usedTypes}&timeFrame=${timeFrame}&transactionType=summary`,
        cookie,
      });
    });
  }
}
