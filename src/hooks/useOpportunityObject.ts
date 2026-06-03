"use client";

import { useOpportunityStore } from "@/store/opportunityStore";

export function useOpportunityObject() {
  return useOpportunityStore();
}
