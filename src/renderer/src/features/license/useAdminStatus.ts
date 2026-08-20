import { useQuery } from "@tanstack/react-query";

export interface AdminStatus {
  isAdmin: boolean;
  message: string;
  subscriptions?: any[];
}

export function useAdminStatus() {
  return useQuery<AdminStatus>({
    queryKey: ["adminStatus"],
    queryFn: async () => {
      return { isAdmin: false, message: "", subscriptions: [] };
    },
    staleTime: Infinity,
  });
}
