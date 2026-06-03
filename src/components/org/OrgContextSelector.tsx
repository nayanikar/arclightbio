"use client";

import type { OrganizationContext } from "@/types/OrganizationContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrgContextSelectorProps {
  contexts: OrganizationContext[];
  value: string;
  onChange: (id: string) => void;
}

export function OrgContextSelector({
  contexts,
  value,
  onChange,
}: OrgContextSelectorProps) {
  const selected = contexts.find((c) => c.id === value);
  const sortedContexts = [...contexts].sort((a, b) => {
    const aPfizer = /pfizer/i.test(a.org_name);
    const bPfizer = /pfizer/i.test(b.org_name);
    if (aPfizer !== bPfizer) return aPfizer ? -1 : 1;
    return a.org_name.localeCompare(b.org_name);
  });

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">
        Organization Context
      </label>
      <Select
        value={value}
        onValueChange={(id) => id && onChange(id)}
      >
        <SelectTrigger className="w-full bg-white">
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          {sortedContexts.map((ctx) => (
            <SelectItem key={ctx.id} value={ctx.id}>
              {ctx.org_name} ({ctx.org_type.replace(/_/g, " ")})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <p className="text-xs text-gray-500">
          Actionability thresholds: {selected.risk_tolerance.actionability_lower_threshold}–
          {selected.risk_tolerance.actionability_upper_threshold} ·{" "}
          {selected.portfolio.therapeutic_areas.join(", ")}
        </p>
      )}
    </div>
  );
}
