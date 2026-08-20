import {
  useQuery,
  useInfiniteQuery,
  useQueries,
  useSuspenseQueries,
} from "@tanstack/react-query";
import { queryKeys } from "@shared/queryKeys";
import type {
  TransactionTypeEnum,
  TransactionTimeFrame,
} from "@shared/ipc-schemas/transactions";

class ConcurrencyQueue {
  private concurrency: number;
  private running: number = 0;
  private queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

const transactionsQueue = new ConcurrencyQueue(2);

export const useTransactionTypes = (cookie?: string) => {
  return useQuery({
    queryKey: queryKeys.transactions.types(cookie || ""),
    queryFn: () =>
      transactionsQueue.enqueue(() => window.api.getTransactionTypes(cookie!)),
    enabled: !!cookie,
    staleTime: 5 * 60 * 1000,
  });
};

export const useTransactions = (
  cookie: string | undefined,
  transactionType: TransactionTypeEnum,
  enabled: boolean = true,
) => {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(cookie || "", transactionType),
    queryFn: async ({ pageParam }) => {
      return transactionsQueue.enqueue(() =>
        window.api.getTransactions(cookie!, transactionType, pageParam, 100),
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageCursor ?? undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.previousPageCursor ?? undefined,
    enabled: !!cookie && enabled,
    staleTime: 2 * 60 * 1000,
  });
};

export const useTransactionTotals = (
  cookie?: string,
  timeFrame: TransactionTimeFrame = "Month",
) => {
  return useQuery({
    queryKey: queryKeys.transactions.totals(cookie || "", timeFrame),
    queryFn: () =>
      transactionsQueue.enqueue(() =>
        window.api.getTransactionTotals(cookie!, timeFrame),
      ),
    enabled: !!cookie,
    staleTime: 2 * 60 * 1000,
  });
};

export const useBatchTransactionTotals = (
  cookies: string[],
  timeFrame: TransactionTimeFrame = "Month",
) => {
  return useQueries({
    queries: cookies.map((cookie) => ({
      queryKey: queryKeys.transactions.totals(cookie, timeFrame),
      queryFn: () =>
        transactionsQueue.enqueue(() =>
          window.api.getTransactionTotals(cookie, timeFrame),
        ),
      enabled: !!cookie,
      staleTime: 2 * 60 * 1000,
    })),
    combine: (results) => {
      const isPending = results.some((r) => r.isPending);
      const isError = results.some((r) => r.isError);
      const isLoading = results.some((r) => r.isLoading);
      const loadedCount = results.filter((r) => r.isSuccess).length;
      const totalCount = results.length;

      const combinedData = results.reduce((acc, result) => {
        if (!result.data) return acc;
        const data = result.data as any;
        for (const key in data) {
          if (typeof data[key] === "number") {
            acc[key] = (acc[key] || 0) + data[key];
          }
        }
        return acc;
      }, {} as any);

      return {
        data: Object.keys(combinedData).length > 0 ? combinedData : undefined,
        isLoading,
        isPending,
        isError,
        loadedCount,
        totalCount,
        error: results.find((r) => r.error)?.error,
        refetch: () => results.forEach((r) => r.refetch()),
      };
    },
  });
};

export const useBatchTransactions = (
  cookies: string[],
  transactionType: TransactionTypeEnum,
  enabled: boolean = true,
) => {
  return useQueries({
    queries: cookies.map((cookie) => ({
      queryKey: queryKeys.transactions.list(cookie, transactionType),
      queryFn: () =>
        transactionsQueue.enqueue(() =>
          window.api.getTransactions(cookie, transactionType, undefined, 100),
        ),
      enabled: !!cookie && enabled,
      staleTime: 2 * 60 * 1000,
    })),
    combine: (results) => {
      const isPending = results.some((r) => r.isPending);
      const isLoading = results.some((r) => r.isLoading);
      const loadedCount = results.filter((r) => r.isSuccess).length;
      const totalCount = results.length;

      const combinedPages = results.flatMap((r) => {
        if (!r.data) return [];
        return r.data.data || [];
      });

      return {
        data: { pages: [{ data: combinedPages }] },
        isLoading,
        isPending,
        loadedCount,
        totalCount,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: () => {},
        refetch: () => results.forEach((r) => r.refetch()),
        error: results.find((r) => r.error)?.error,
      };
    },
  });
};

export const useBatchTransactionTypes = (cookies: string[]) => {
  return useQueries({
    queries: cookies.map((cookie) => ({
      queryKey: queryKeys.transactions.types(cookie),
      queryFn: () =>
        transactionsQueue.enqueue(() => window.api.getTransactionTypes(cookie)),
      enabled: !!cookie,
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => {
      const combinedData = results.reduce((acc, result) => {
        if (!result.data) return acc;
        const data = result.data as any;
        for (const key in data) {
          if (data[key] === true) {
            acc[key] = true;
          }
        }
        return acc;
      }, {} as any);

      return {
        data: Object.keys(combinedData).length > 0 ? combinedData : undefined,
        isLoading: results.some((r) => r.isLoading),
        error: results.find((r) => r.error)?.error,
      };
    },
  });
};
