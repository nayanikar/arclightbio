"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardProgramView } from "@/lib/dashboardDisplay";
import { PROGRAM_TRUST_LABELS } from "@/lib/programTrustScore";
import { zoneAccentColor } from "@/lib/dashboardLayout";
import { ZoneBadge } from "./ZoneBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { ProgramStatusPill } from "./ProgramStatusPill";
import { cn } from "@/lib/utils";

interface ProgramQueueProps {
  programs: DashboardProgramView[];
}

function TrustLabelChip({ label }: { label: NonNullable<DashboardProgramView["trustLabel"]> }) {
  const meta = PROGRAM_TRUST_LABELS[label];
  return (
    <span
      className="inline-block max-w-[180px] truncate rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
      style={{
        background: "rgba(196, 132, 45, 0.08)",
        borderColor: "rgba(196, 132, 45, 0.25)",
        color: "var(--v3-amber)",
      }}
      title="Discovery confidence reflects funnel depth and evidence — not clinical readiness"
    >
      {meta.title}
    </span>
  );
}

function PhaseChip({ label }: { label: string }) {
  return (
    <span
      className="inline-block max-w-[160px] truncate rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
      style={{
        background: "rgba(26, 107, 99, 0.08)",
        borderColor: "rgba(26, 107, 99, 0.2)",
        color: "var(--v3-teal)",
      }}
      title={label}
    >
      {label}
    </span>
  );
}

function ProgramRowDesktop({
  program,
  index,
}: {
  program: DashboardProgramView;
  index: number;
}) {
  const zoneColor = zoneAccentColor(program.zone);
  const confidencePct = Math.round(program.confidence * 100);

  return (
    <tr
      className="dashboard-queue-row group border-b transition-colors last:border-b-0"
      style={{
        borderColor: "rgba(15, 26, 46, 0.08)",
        animationDelay: `${index * 40}ms`,
      }}
    >
      <td className="relative w-0 p-0">
        <div
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: zoneColor }}
        />
      </td>
      <td className="min-w-0 px-4 py-3.5">
        <Link href={`/opportunity/${program.id}`} className="block min-w-0">
          <div className="flex items-start gap-2">
            <p
              className="font-display text-[15px] font-semibold leading-snug"
              style={{ color: "var(--v3-navy)" }}
            >
              {program.title}
            </p>
            {program.sessionLabel && (
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]"
                style={{
                  background: "rgba(15, 26, 46, 0.06)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                …{program.sessionLabel}
              </span>
            )}
          </div>
          <p
            className="mt-1 line-clamp-1 text-xs leading-relaxed"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {program.subtitle}
          </p>
          {program.domainLabel && (
            <span
              className="mt-1.5 inline-block font-mono text-[10px] uppercase tracking-wide"
              style={{ color: "var(--v3-teal)" }}
            >
              {program.schemaVersion === 3 ? `V3 · ${program.domainLabel}` : ""}
            </span>
          )}
        </Link>
      </td>
      <td className="hidden px-3 py-3.5 lg:table-cell">
        <div className="flex flex-col gap-1.5">
          {program.schemaVersion === 3 && program.trustLabel ? (
            <TrustLabelChip label={program.trustLabel} />
          ) : (
            <ZoneBadge zone={program.zone} />
          )}
          {program.schemaVersion === 3 && program.trustLabel && (
            <ZoneBadge zone={program.zone} />
          )}
        </div>
      </td>
      <td className="hidden px-3 py-3.5 xl:table-cell">
        {program.phaseLabel ? (
          <PhaseChip label={program.phaseLabel} />
        ) : (
          <span
            className="text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            —
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3.5 md:table-cell">
        <ProgramStatusPill
          status={program.status}
          isRunning={program.isRunning}
        />
      </td>
      <td className="min-w-[120px] px-3 py-3.5">
        <div className="flex items-center gap-2">
          <ConfidenceBar
            score={program.confidence}
            color={zoneColor}
            height={4}
            className="hidden min-w-[60px] flex-1 sm:block"
          />
          <span
            className="shrink-0 text-sm font-semibold tabular-nums"
            style={{ color: zoneColor }}
          >
            {confidencePct}%
          </span>
        </div>
      </td>
      <td
        className="hidden px-3 py-3.5 text-xs lg:table-cell"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {program.challengeCount > 0 ? (
          <>
            {program.evidenceCount} cards ·{" "}
            <span style={{ color: "#D85A30" }}>
              {program.challengeCount} challenge
              {program.challengeCount === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <>{program.evidenceCount} cards</>
        )}
      </td>
      <td
        className="hidden whitespace-nowrap px-3 py-3.5 text-xs lg:table-cell"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {program.updatedAgo}
      </td>
      <td className="px-3 py-3.5">
        <Link
          href={`/opportunity/${program.id}`}
          className="inline-flex items-center justify-center"
          aria-label={`Open ${program.title}`}
        >
          <ArrowRight
            className="h-4 w-4 opacity-30 transition-opacity group-hover:opacity-100"
            style={{ color: "var(--v3-teal)" }}
          />
        </Link>
      </td>
    </tr>
  );
}

function ProgramCardMobile({
  program,
  index,
}: {
  program: DashboardProgramView;
  index: number;
}) {
  const zoneColor = zoneAccentColor(program.zone);
  const confidencePct = Math.round(program.confidence * 100);

  return (
    <Link
      href={`/opportunity/${program.id}`}
      className={cn(
        "dashboard-queue-row group block border-b px-4 py-4 transition-colors last:border-b-0"
      )}
      style={{
        borderColor: "rgba(15, 26, 46, 0.08)",
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderLeftColor: zoneColor,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {program.schemaVersion === 3 && program.trustLabel ? (
          <TrustLabelChip label={program.trustLabel} />
        ) : (
          <ZoneBadge zone={program.zone} />
        )}
        <ProgramStatusPill
          status={program.status}
          isRunning={program.isRunning}
        />
        {program.phaseLabel && <PhaseChip label={program.phaseLabel} />}
      </div>

      <div className="flex items-start gap-2">
        <h3
          className="font-display text-base font-semibold leading-snug"
          style={{ color: "var(--v3-navy)" }}
        >
          {program.title}
        </h3>
        {program.sessionLabel && (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{
              background: "rgba(15, 26, 46, 0.06)",
              color: "var(--color-text-tertiary)",
            }}
          >
            …{program.sessionLabel}
          </span>
        )}
      </div>

      <p
        className="mt-1 text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {program.subtitle}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <ConfidenceBar
          score={program.confidence}
          color={zoneColor}
          className="flex-1"
        />
        <span
          className="shrink-0 text-sm font-semibold tabular-nums"
          style={{ color: zoneColor }}
        >
          {confidencePct}%
        </span>
      </div>

      <div
        className="mt-2 flex items-center justify-between text-xs"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <span>
          {program.evidenceCount} cards
          {program.challengeCount > 0
            ? ` · ${program.challengeCount} challenges`
            : ""}
        </span>
        <span>{program.updatedAgo}</span>
      </div>
    </Link>
  );
}

export function ProgramQueue({ programs }: ProgramQueueProps) {
  if (programs.length === 0) return null;

  return (
    <div
      className="dashboard-queue w-full max-w-full rounded-xl border"
      style={{
        borderColor: "rgba(15, 26, 46, 0.1)",
        borderWidth: 0.5,
      }}
    >
      {/* Desktop table */}
      <div className="hidden w-full max-w-full overflow-x-auto overscroll-x-contain md:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr
              className="border-b font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{
                borderColor: "rgba(15, 26, 46, 0.08)",
                color: "var(--color-text-tertiary)",
                background: "rgba(26, 107, 99, 0.04)",
              }}
            >
              <th className="w-0 p-0" aria-hidden />
              <th className="px-4 py-2.5 font-semibold">Program</th>
              <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">
                Zone
              </th>
              <th className="hidden px-3 py-2.5 font-semibold xl:table-cell">
                Phase
              </th>
              <th className="hidden px-3 py-2.5 font-semibold md:table-cell">
                Status
              </th>
              <th className="px-3 py-2.5 font-semibold">Confidence</th>
              <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">
                Activity
              </th>
              <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">
                Updated
              </th>
              <th className="w-10 px-3 py-2.5" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {programs.map((program, index) => (
              <ProgramRowDesktop
                key={program.id}
                program={program}
                index={index}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {programs.map((program, index) => (
          <ProgramCardMobile
            key={program.id}
            program={program}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
