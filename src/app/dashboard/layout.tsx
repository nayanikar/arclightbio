import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Arclight Bio",
  description: "Discovery programs across your portfolio",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
