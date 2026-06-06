"use client";

import { TopBar } from "@/components/layout/TopBar";
import { PageContent } from "@/components/layout/PageContent";
import { UndruggableRegistryView } from "@/components/undruggable/UndruggableRegistryView";

export default function UndruggableRegistryPage() {
  return (
    <>
      <TopBar
        title="Undruggable registry"
        subtitle="Cross-session targets blocked from direct modulation"
      />
      <PageContent flush className="space-y-5 pb-10">
        <UndruggableRegistryView />
      </PageContent>
    </>
  );
}
