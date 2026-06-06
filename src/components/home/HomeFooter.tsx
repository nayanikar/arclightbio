import Link from "next/link";
import { pageShell } from "@/components/layout/pageLayout";
import { primaryNavItems } from "@/components/layout/navConfig";
import { homeCopy } from "./homeCopy";

export function HomeFooter() {
  return (
    <footer
      className="border-t py-12"
      style={{
        borderColor: "rgba(15, 26, 46, 0.08)",
        background: "var(--v3-paper)",
      }}
    >
      <div className={pageShell}>
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p
              className="font-brand text-lg"
              style={{ color: "var(--v3-navy)" }}
            >
              Arclight Bio
            </p>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {homeCopy.footer.tagline}
            </p>
            <p
              className="mt-4 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {homeCopy.footer.copyright}
            </p>
          </div>

          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "var(--v3-teal)" }}
            >
              Product
            </p>
            <ul className="mt-3 space-y-2">
              {primaryNavItems.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm hover:underline"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
