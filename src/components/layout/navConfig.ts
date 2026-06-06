import {
  Home,
  LayoutDashboard,
  Search,
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
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/undruggable", label: "Undruggable", icon: ShieldOff },
];
