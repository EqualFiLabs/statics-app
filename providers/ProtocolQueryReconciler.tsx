"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  queryMatchesProtocolReconciliation,
  subscribeToProtocolReconciliation,
} from "@/lib/protocol/reconciliation";

/** Refreshes protocol state after every confirmed transaction. */
export function ProtocolQueryReconciler() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeToProtocolReconciliation(async (detail) => {
        const filters = {
          predicate: (query: { queryKey: readonly unknown[] }) =>
            queryMatchesProtocolReconciliation(query.queryKey, detail),
        };
        // A nested inactive read can still be in flight. Cancel it before refreshing
        // so its pre-confirmation result cannot repopulate the invalidated cache.
        await queryClient.cancelQueries(filters);
        await queryClient.invalidateQueries({ ...filters, refetchType: "active" });
      }),
    [queryClient]
  );

  return null;
}
