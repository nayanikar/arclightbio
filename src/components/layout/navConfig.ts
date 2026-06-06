import {
  LayoutDashboard,
  Search,
  ExternalLink,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";

export interface NavItemConfig {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

export const primaryNavItems: NavItemConfig[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/undruggable", label: "Undruggable", icon: ShieldOff },
];

export function observatoryNavItem(url: string): NavItemConfig {
  return {
    href: url,
    label: "Open Observatory",
    icon: ExternalLink,
    external: true,
  };
}
