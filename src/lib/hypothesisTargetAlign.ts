import type { RankedTarget } from "@/lib/targetList";
import type { TargetAlignment } from "@/types/MechanisticChain";

const RECEPTOR_ALIASES: Record<string, string[]> = {
  ESR2: ["ERβ", "ER-BETA", "ESTROGEN RECEPTOR BETA", "ESR-2"],
  ESR1: ["ERα", "ER-ALPHA", "ESTROGEN RECEPTOR ALPHA", "ESR-1"],
  TNF: ["TNF-ALPHA", "TNFα", "TNFA"],
};

const GENE_SYMBOL_RE = /\b([A-Z][A-Z0-9]{1,9})\b/g;

function normalizeToken(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function extractDeclaredEntities(statement: string): string[] {
  const entities = new Set<string>();
  const upper = statement.toUpperCase();

  for (const [symbol, aliases] of Object.entries(RECEPTOR_ALIASES)) {
    if (upper.includes(symbol)) entities.add(symbol);
    for (const alias of aliases) {
      if (upper.includes(normalizeToken(alias))) entities.add(symbol);
    }
  }

  let match: RegExpExecArray | null;
  const re = new RegExp(GENE_SYMBOL_RE.source, "g");
  while ((match = re.exec(statement)) !== null) {
    const sym = match[1];
    if (sym.length >= 2 && sym.length <= 6) entities.add(sym);
  }

  const receptorMatch = statement.match(
    /estrogen receptor (alpha|beta|α|β)/i
  );
  if (receptorMatch) {
    entities.add(
      receptorMatch[1].toLowerCase().startsWith("b") ? "ESR2" : "ESR1"
    );
  }

  return Array.from(entities);
}

function entityMatchesTarget(entity: string, target: RankedTarget): boolean {
  const gene = normalizeToken(target.gene_symbol);
  const name = normalizeToken(target.target_name);
  const ent = normalizeToken(entity);

  if (gene === ent || name.includes(ent) || ent.includes(gene)) return true;

  const aliases = RECEPTOR_ALIASES[entity] ?? [];
  return aliases.some(
    (a) => name.includes(normalizeToken(a)) || gene.includes(normalizeToken(a))
  );
}

export function evaluateTargetAlignment(
  statement: string,
  rankedTargets: RankedTarget[]
): TargetAlignment {
  const declared = extractDeclaredEntities(statement);

  if (rankedTargets.length === 0) {
    return {
      status: "no_targets",
      declared_entities: declared,
      message: "No ranked targets to compare against hypothesis entities.",
    };
  }

  const top = rankedTargets[0];
  if (declared.length === 0) {
    return {
      status: "aligned",
      declared_entities: declared,
      top_ranked_target: top.target_name,
      top_ranked_gene: top.gene_symbol,
      message: "No explicit gene entities extracted — target list accepted with caution.",
    };
  }

  const aligned = declared.some((e) => entityMatchesTarget(e, top));
  if (aligned) {
    return {
      status: "aligned",
      declared_entities: declared,
      top_ranked_target: top.target_name,
      top_ranked_gene: top.gene_symbol,
      message: `Top target ${top.gene_symbol} aligns with declared entities (${declared.join(", ")}).`,
    };
  }

  return {
    status: "mismatch",
    declared_entities: declared,
    top_ranked_target: top.target_name,
    top_ranked_gene: top.gene_symbol,
    message: `Target-hypothesis mismatch: thesis declares ${declared.join(", ")} but top ranked target is ${top.gene_symbol} (${top.target_name}). Causal chain from hypothesis to target is not established.`,
  };
}

export function filterAlignedTargets(
  statement: string,
  rankedTargets: RankedTarget[]
): RankedTarget[] {
  const declared = extractDeclaredEntities(statement);
  if (declared.length === 0) return rankedTargets;

  const aligned = rankedTargets.filter((t) =>
    declared.some((e) => entityMatchesTarget(e, t))
  );
  return aligned.length > 0 ? aligned : rankedTargets;
}
