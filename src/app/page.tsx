import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";

export const metadata: Metadata = {
  title: "Arclight Bio — Discovery Program",
  description:
    "The discovery engine that finds what your experts don't know to look for.",
};

export default function Page() {
  return <HomePage />;
}
