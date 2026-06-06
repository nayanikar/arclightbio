import { randomUUID } from "crypto";
import type { HypothesisRecord, OpportunityObject, BlackboardState } from "@/types/OpportunityObject";
import type {
  CalibrationRegistryEntry,
  CohortParseResult,
  CohortRecord,
  CreateOpportunityObjectV3Input,
  DrugDiscoveryAssessment,
  DrugDiscoveryAssessmentRecord,
  IndRegulatoryPackageRecord,
  IndRegulatoryPackageV3,
  HypothesisStage,
  ModalityPathway,
  PatientCohort,
  RiskComponents,
  TppBlueprint,
  UndruggableTargetRecord,
  UpdateV3OpportunityFieldsInput,
  V3HypothesisRecord,
} from "@/types/V3Pipeline";
import {
  createOpportunityObject,
  getOpportunityObject,
  listHypotheses,
  updateHypothesis,
  updateOpportunityObject,
} from "@/lib/db";
import { placeholderHypothesis } from "@/lib/hypothesisContext";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { isV3SupabaseDbEnabled } from "@/lib/v3Storage";
import * as fileStore from "@/lib/fileStore";
import * as v3FileStore from "@/lib/v3FileStore";

const v3Memory = {
  drugAssessments: new Map<string, DrugDiscoveryAssessmentRecord>(),
  indPackages: new Map<string, IndRegulatoryPackageRecord>(),
  undruggable: new Map<string, UndruggableTargetRecord>(),
  calibration: [] as CalibrationRegistryEntry[],
};

function assessmentKey(opportunityId: string, hypothesisId: string): string {
  return `${opportunityId}:${hypothesisId}`;
}

function toCohortRecord(
  cohort: PatientCohort,
  patients: Array<{
    patient_id: string;
    primary_diagnosis: string;
    comorbidities: string[];
    biomarkers?: string | null;
    resistance_status?: string | null;
    notes?: string | null;
  }>
): CohortRecord {
  return {
    id: cohort.id,
    filename: cohort.file_name,
    patient_count: cohort.row_count,
    domain_summary: JSON.stringify(cohort.domain_summary),
    patients: patients.map((p) => ({
      patient_id: p.patient_id,
      primary_diagnosis: p.primary_diagnosis,
      comorbidities: p.comorbidities,
      biomarkers: p.biomarkers ? p.biomarkers.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [],
      resistance_status: p.resistance_status ?? "",
      notes: p.notes ?? "",
    })),
    created_at: cohort.uploaded_at,
  };
}

export async function saveCohort(
  parseResult: CohortParseResult
): Promise<{ cohort: PatientCohort; patients: CohortRecord["patients"] }> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const cohort: PatientCohort = {
    id,
    ...parseResult.cohort,
    uploaded_at: now,
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error: cohortError } = await supabase.from("patient_cohorts").insert({
      id: cohort.id,
      name: cohort.name ?? null,
      file_name: cohort.file_name,
      row_count: cohort.row_count,
      domain_summary: cohort.domain_summary,
      uploaded_at: cohort.uploaded_at,
    });
    if (cohortError) throw cohortError;

    if (parseResult.patients.length > 0) {
      const { error: patientsError } = await supabase.from("cohort_patients").insert(
        parseResult.patients.map((p) => ({
          id: randomUUID(),
          cohort_id: cohort.id,
          patient_id: p.patient_id,
          primary_diagnosis: p.primary_diagnosis,
          comorbidities: p.comorbidities,
          biomarkers: p.biomarkers ?? null,
          resistance_status: p.resistance_status ?? null,
          notes: p.notes ?? null,
        }))
      );
      if (patientsError) throw patientsError;
    }
  } else {
    const record = toCohortRecord(cohort, parseResult.patients);
    await fileStore.fileStoreSaveCohort(cohort, parseResult.patients.map((p) => ({
      id: randomUUID(),
      cohort_id: cohort.id,
      ...p,
      created_at: now,
    })));
    await v3FileStore.fileStoreSaveCohort(record);
  }

  return { cohort, patients: toCohortRecord(cohort, parseResult.patients).patients };
}

/** @deprecated Use saveCohort */
export const createPatientCohort = saveCohort;

export async function getCohortForOpportunity(
  _opportunityId: string,
  cohortId?: string | null
): Promise<CohortRecord | null> {
  if (!cohortId) return null;

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data: cohortRow, error } = await supabase
      .from("patient_cohorts")
      .select("*")
      .eq("id", cohortId)
      .single();
    if (error || !cohortRow) return null;

    const { data: patientRows } = await supabase
      .from("cohort_patients")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("patient_id", { ascending: true });

    return toCohortRecord(
      {
        id: cohortRow.id as string,
        name: (cohortRow.name as string | null) ?? null,
        file_name: cohortRow.file_name as string,
        row_count: cohortRow.row_count as number,
        domain_summary: cohortRow.domain_summary as PatientCohort["domain_summary"],
        uploaded_at: cohortRow.uploaded_at as string,
      },
      (patientRows ?? []).map((p) => ({
        patient_id: p.patient_id as string,
        primary_diagnosis: p.primary_diagnosis as string,
        comorbidities: (p.comorbidities as string[]) ?? [],
        biomarkers: (p.biomarkers as string | null) ?? null,
        resistance_status: (p.resistance_status as string | null) ?? null,
        notes: (p.notes as string | null) ?? null,
      }))
    );
  }

  const fromMain = await fileStore.fileStoreGetCohort(cohortId);
  if (fromMain) {
    return toCohortRecord(fromMain.cohort, fromMain.patients);
  }
  return v3FileStore.fileStoreGetCohort(cohortId);
}

export async function createOpportunityObjectV3(
  input: CreateOpportunityObjectV3Input
): Promise<OpportunityObject> {
  const placeholder = placeholderHypothesis(input.search_query);
  const obj = await createOpportunityObject({
    anchor_type: input.anchor_type,
    org_context_id: input.org_context_id,
    search_query: input.search_query,
    hypothesis: placeholder,
    mode: input.mode,
  });

  const innovationLevel = input.innovation_level ?? "medium";

  const v3Fields = {
    schema_version: 3 as const,
    innovation_level: innovationLevel,
    parent_domain: input.parent_domain,
    cohort_id: input.cohort_id,
    program_hypothesis_sentence: null,
    anchor_profiles: null,
    expert_domains: null,
    selected_phase2_hypothesis_id: null,
    v3_phase: "phase1:population" as const,
    top_hypothesis_id: null,
    outgroup_validation: null,
    hypotheses: [] as HypothesisRecord[],
    blackboard_state: { completedSteps: [] },
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("opportunity_objects")
      .update({
        schema_version: 3,
        innovation_level: innovationLevel,
        parent_domain: input.parent_domain,
        cohort_id: input.cohort_id,
        program_hypothesis_sentence: null,
        anchor_profiles: null,
        expert_domains: null,
        selected_phase2_hypothesis_id: null,
        v3_phase: v3Fields.v3_phase,
        top_hypothesis_id: null,
        outgroup_validation: null,
        blackboard_state: v3Fields.blackboard_state,
      })
      .eq("id", obj.id);
    if (error) throw error;
  } else {
    await fileStore.fileStoreUpdateOpportunity(obj.id, v3Fields);
    await v3FileStore.fileStoreUpdateV3OpportunityFields(obj.id, {
      parent_domain: input.parent_domain,
      cohort_id: input.cohort_id,
      v3_phase: v3Fields.v3_phase,
    });
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("opportunity_objects")
        .update({
          schema_version: 3,
          blackboard_state: v3Fields.blackboard_state,
          last_updated: new Date().toISOString(),
        })
        .eq("id", obj.id);
    }
  }

  return { ...obj, ...v3Fields };
}

export async function loadV3Context(obj: OpportunityObject): Promise<OpportunityObject> {
  if ((obj.schema_version ?? 1) !== 3) return obj;
  if (await isV3SupabaseDbEnabled()) {
    const fresh = await getOpportunityObject(obj.id);
    return fresh ?? obj;
  }
  const fields = await v3FileStore.fileStoreGetV3OpportunityFields(obj.id);
  return { ...obj, ...fields };
}

export async function updateV3OpportunityFields(
  opportunityId: string,
  updates: UpdateV3OpportunityFieldsInput
): Promise<void> {
  const payload: Record<string, unknown> = {
    last_updated: new Date().toISOString(),
    ...updates,
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("opportunity_objects")
      .update(payload)
      .eq("id", opportunityId);
    if (error) throw error;
  } else {
    await fileStore.fileStoreUpdateOpportunity(
      opportunityId,
      payload as Partial<OpportunityObject>
    );
    await v3FileStore.fileStoreUpdateV3OpportunityFields(opportunityId, updates);
  }
}

export async function listHypothesesByStage(
  opportunityId: string,
  stage: HypothesisStage
): Promise<HypothesisRecord[]> {
  const all = await listHypotheses(opportunityId);
  return all
    .filter((h) => h.hypothesis_stage === stage)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
}

export async function updateV3Hypothesis(
  _opportunityId: string,
  hypothesisId: string,
  updates: Partial<HypothesisRecord>
): Promise<void> {
  await updateHypothesis(hypothesisId, updates);
}

export async function createV3Hypothesis(
  opportunityId: string,
  input: Omit<V3HypothesisRecord, "opportunity_object_id" | "created_at"> & {
    is_outgroup?: boolean;
    source?: HypothesisRecord["source"];
  }
): Promise<HypothesisRecord> {
  const record: HypothesisRecord = {
    id: input.id,
    opportunity_object_id: opportunityId,
    rank: input.rank ?? null,
    is_outgroup: input.is_outgroup ?? false,
    statement: input.statement,
    patient_population: input.patient_population,
    unmet_need: input.unmet_need,
    org_positioning: input.org_positioning ?? "",
    source: input.source,
    cross_domain_score: null,
    declared_modality: null,
    regulatory_pathway: null,
    confidence_score: null,
    actionability_score: null,
    actionability_zone: null,
    created_at: new Date().toISOString(),
    hypothesis_stage: input.hypothesis_stage ?? null,
    parent_hypothesis_id: input.parent_hypothesis_id ?? null,
    falsifiability_statement: input.falsifiability_statement ?? null,
    anchor_type: input.anchor_type ?? null,
    anchor_linkage: input.anchor_linkage ?? null,
    dropped_links: input.dropped_links ?? [],
    new_moa_requires_experiment: input.new_moa_requires_experiment ?? false,
    mechanistic_chain: input.mechanistic_chain ?? null,
    intervention_direction_hypothesis: input.intervention_direction_hypothesis ?? null,
    direction_status: input.direction_status ?? null,
    direction_hypotheses: input.direction_hypotheses ?? [],
    rank_decomposition: input.rank_decomposition ?? null,
    ranking_rationale: input.ranking_rationale ?? null,
    ranked_targets: input.ranked_targets ?? null,
    falsification_experiment: input.falsification_experiment ?? null,
    target_family_context: input.target_family_context ?? null,
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("hypotheses").insert({
      id: record.id,
      opportunity_object_id: opportunityId,
      rank: record.rank,
      is_outgroup: record.is_outgroup,
      statement: record.statement,
      patient_population: record.patient_population,
      unmet_need: record.unmet_need,
      org_positioning: record.org_positioning,
      source: record.source ?? null,
      hypothesis_stage: record.hypothesis_stage,
      parent_hypothesis_id: record.parent_hypothesis_id,
      falsifiability_statement: record.falsifiability_statement,
      anchor_type: record.anchor_type,
      anchor_linkage: record.anchor_linkage,
      dropped_links: record.dropped_links,
      new_moa_requires_experiment: record.new_moa_requires_experiment,
      mechanistic_chain: record.mechanistic_chain,
      intervention_direction_hypothesis: record.intervention_direction_hypothesis,
      direction_status: record.direction_status,
      direction_hypotheses: record.direction_hypotheses,
      rank_decomposition: record.rank_decomposition,
      ranking_rationale: record.ranking_rationale,
      ranked_targets: record.ranked_targets,
      falsification_experiment: record.falsification_experiment,
      target_family_context: record.target_family_context,
    });
    if (error) throw error;
  } else {
    await fileStore.fileStoreCreateHypothesis(opportunityId, record);
  }

  return record;
}

export async function saveV3Hypotheses(
  opportunityId: string,
  records: V3HypothesisRecord[],
  stage?: HypothesisStage
): Promise<HypothesisRecord[]> {
  if (stage) {
    const existing = await listHypotheses(opportunityId);
    const toDelete = existing.filter((h) => h.hypothesis_stage === stage);
    if ((await isV3SupabaseDbEnabled()) && toDelete.length > 0) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("hypotheses")
        .delete()
        .eq("opportunity_object_id", opportunityId)
        .eq("hypothesis_stage", stage);
    } else if (!(await isV3SupabaseDbEnabled()) && toDelete.length > 0) {
      const kept = existing.filter((h) => h.hypothesis_stage !== stage);
      await fileStore.fileStoreClearHypotheses(opportunityId);
      for (const h of kept) {
        await fileStore.fileStoreCreateHypothesis(opportunityId, h);
      }
    }
  }

  const normalized =
    stage != null
      ? normalizeFunnelRecords(records, stage, opportunityId)
      : records;

  const saved: HypothesisRecord[] = [];
  for (const r of normalized) {
    saved.push(
      await createV3Hypothesis(opportunityId, {
        ...r,
        is_outgroup: false,
      })
    );
  }

  if (!(await isV3SupabaseDbEnabled())) {
    const existingV3 = await v3FileStore.fileStoreListV3Hypotheses(opportunityId);
    const kept =
      stage != null
        ? existingV3.filter((h) => h.hypothesis_stage !== stage)
        : existingV3;
    await v3FileStore.fileStoreSaveV3Hypotheses(opportunityId, [
      ...kept,
      ...normalized,
    ]);
  }

  return saved;
}

export async function getDrugDiscoveryAssessment(
  opportunityId: string,
  hypothesisId: string
): Promise<DrugDiscoveryAssessmentRecord | null> {
  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("drug_discovery_assessments")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .eq("hypothesis_id", hypothesisId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapDrugAssessmentRow(data as Record<string, unknown>);
  }
  return (
    v3Memory.drugAssessments.get(assessmentKey(opportunityId, hypothesisId)) ??
    (await fileStore.fileStoreGetDrugAssessment(hypothesisId))
  );
}

export async function saveDrugAssessment(input: {
  opportunity_object_id: string;
  hypothesis_id: string;
  drug_exists: boolean;
  branch: DrugDiscoveryAssessmentRecord["branch"];
  assessment: DrugDiscoveryAssessment;
  tpp_blueprint?: TppBlueprint | null;
}): Promise<DrugDiscoveryAssessmentRecord> {
  return upsertDrugDiscoveryAssessment(input.opportunity_object_id, input.hypothesis_id, {
    drug_exists: input.drug_exists,
    branch: input.branch,
    assessment: input.assessment,
    tpp_blueprint: input.tpp_blueprint,
  });
}

export async function upsertDrugDiscoveryAssessment(
  opportunityId: string,
  hypothesisId: string,
  patch: {
    drug_exists?: boolean | null;
    branch?: DrugDiscoveryAssessment["branch"] | null;
    assessment?: Partial<DrugDiscoveryAssessment>;
    tpp_blueprint?: TppBlueprint | null;
  }
): Promise<DrugDiscoveryAssessmentRecord> {
  const existing = await getDrugDiscoveryAssessment(opportunityId, hypothesisId);
  const now = new Date().toISOString();
  const mergedAssessment: DrugDiscoveryAssessment = {
    drug_exists: false,
    branch: "new",
    ...(existing?.assessment ?? {}),
    ...(patch.assessment ?? {}),
  };
  if (patch.drug_exists != null) mergedAssessment.drug_exists = patch.drug_exists;
  if (patch.branch !== undefined && patch.branch !== null) {
    mergedAssessment.branch = patch.branch;
  }

  const record: DrugDiscoveryAssessmentRecord = {
    id: existing?.id ?? randomUUID(),
    opportunity_object_id: opportunityId,
    hypothesis_id: hypothesisId,
    drug_exists: patch.drug_exists ?? existing?.drug_exists ?? null,
    branch: patch.branch ?? existing?.branch ?? null,
    assessment: mergedAssessment,
    tpp_blueprint:
      patch.tpp_blueprint !== undefined
        ? patch.tpp_blueprint
        : (existing?.tpp_blueprint ?? null),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("drug_discovery_assessments").upsert(
      {
        id: record.id,
        opportunity_object_id: opportunityId,
        hypothesis_id: hypothesisId,
        drug_exists: record.drug_exists,
        branch: record.branch,
        assessment: record.assessment,
        tpp_blueprint: record.tpp_blueprint,
        updated_at: record.updated_at,
      },
      { onConflict: "hypothesis_id" }
    );
    if (error) throw error;
  } else {
    v3Memory.drugAssessments.set(assessmentKey(opportunityId, hypothesisId), record);
    await fileStore.fileStoreSaveDrugAssessment(record);
  }

  return record;
}

export async function getIndRegulatoryPackage(
  opportunityId: string,
  hypothesisId: string
): Promise<IndRegulatoryPackageRecord | null> {
  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("ind_regulatory_packages")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .eq("hypothesis_id", hypothesisId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapIndPackageRow(data as Record<string, unknown>);
  }
  return (
    v3Memory.indPackages.get(assessmentKey(opportunityId, hypothesisId)) ??
    (await fileStore.fileStoreGetIndPackageV3(hypothesisId))
  );
}

export async function saveIndPackage(input: {
  opportunity_object_id: string;
  hypothesis_id: string;
  package: IndRegulatoryPackageV3;
  risk_of_failure?: number | null;
  risk_components?: RiskComponents;
  modality_pathway?: IndRegulatoryPackageRecord["modality_pathway"];
}): Promise<IndRegulatoryPackageRecord> {
  return upsertIndRegulatoryPackage(input.opportunity_object_id, input.hypothesis_id, {
    package: input.package,
    risk_of_failure: input.risk_of_failure,
    risk_components: input.risk_components,
    modality_pathway: input.modality_pathway,
  });
}

export async function upsertIndRegulatoryPackage(
  opportunityId: string,
  hypothesisId: string,
  patch: {
    package?: Partial<IndRegulatoryPackageV3>;
    risk_of_failure?: number | null;
    risk_components?: Partial<RiskComponents>;
    modality_pathway?: ModalityPathway | null;
  }
): Promise<IndRegulatoryPackageRecord> {
  const existing = await getIndRegulatoryPackage(opportunityId, hypothesisId);
  const now = new Date().toISOString();
  const defaultPackage: IndRegulatoryPackageV3 = {
    preclinical_roadmap: [],
    cmc_requirements: [],
    tox_studies: [],
    clinical_development_plan: {
      trial_type: "",
      design: "",
      sample_size: 0,
      inclusion_criteria: [],
      exclusion_criteria: [],
      biomarkers: {
        predictive: [],
        target_engagement_pd: [],
        safety: [],
        surrogate: [],
      },
      primary_endpoint: "",
      secondary_endpoints: [],
    },
    target_agency: "FDA",
  };

  const record: IndRegulatoryPackageRecord = {
    id: existing?.id ?? randomUUID(),
    opportunity_object_id: opportunityId,
    hypothesis_id: hypothesisId,
    package: {
      ...defaultPackage,
      ...(existing?.package ?? {}),
      ...(patch.package ?? {}),
      clinical_development_plan: {
        ...defaultPackage.clinical_development_plan,
        ...(existing?.package?.clinical_development_plan ?? {}),
        ...(patch.package?.clinical_development_plan ?? {}),
        biomarkers: {
          ...defaultPackage.clinical_development_plan.biomarkers,
          ...(existing?.package?.clinical_development_plan?.biomarkers ?? {}),
          ...(patch.package?.clinical_development_plan?.biomarkers ?? {}),
        },
      },
    },
    risk_of_failure:
      patch.risk_of_failure !== undefined
        ? patch.risk_of_failure
        : (existing?.risk_of_failure ?? null),
    risk_components: {
      target: 0.5,
      ip: 0.5,
      modality_development: 0.5,
      market_penetration: 0.5,
      infrastructure: 0.5,
      competition: 0.5,
      other: 0.5,
      ...(existing?.risk_components ?? {}),
      ...(patch.risk_components ?? {}),
    },
    modality_pathway:
      patch.modality_pathway !== undefined
        ? patch.modality_pathway
        : (existing?.modality_pathway ?? null),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("ind_regulatory_packages").upsert(
      {
        id: record.id,
        opportunity_object_id: opportunityId,
        hypothesis_id: hypothesisId,
        package: record.package,
        risk_of_failure: record.risk_of_failure,
        risk_components: record.risk_components,
        modality_pathway: record.modality_pathway,
        updated_at: record.updated_at,
      },
      { onConflict: "hypothesis_id" }
    );
    if (error) throw error;
  } else {
    v3Memory.indPackages.set(assessmentKey(opportunityId, hypothesisId), record);
    await fileStore.fileStoreSaveIndPackageV3(record);
  }

  return record;
}

export async function saveUndruggableTarget(
  input: Omit<UndruggableTargetRecord, "id" | "created_at"> & { id?: string }
): Promise<UndruggableTargetRecord> {
  return insertUndruggableTarget(input);
}

export async function insertUndruggableTarget(
  input: Omit<UndruggableTargetRecord, "id" | "created_at"> & { id?: string }
): Promise<UndruggableTargetRecord> {
  const record: UndruggableTargetRecord = {
    id: input.id ?? randomUUID(),
    opportunity_object_id: input.opportunity_object_id ?? null,
    hypothesis_id: input.hypothesis_id ?? null,
    target_name: input.target_name,
    intervention_point: input.intervention_point ?? null,
    reasoning: input.reasoning,
    alternate_intervention: input.alternate_intervention ?? null,
    rescan_eligible: input.rescan_eligible ?? true,
    created_at: new Date().toISOString(),
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("undruggable_targets").insert({
      id: record.id,
      opportunity_object_id: record.opportunity_object_id,
      hypothesis_id: record.hypothesis_id,
      target_name: record.target_name,
      intervention_point: record.intervention_point,
      reasoning: record.reasoning,
      alternate_intervention: record.alternate_intervention,
      rescan_eligible: record.rescan_eligible ?? true,
      created_at: record.created_at,
    });
    if (error) throw error;
  } else {
    v3Memory.undruggable.set(record.id, record);
    await fileStore.fileStoreSaveUndruggableTarget(record);
  }

  return record;
}

export async function listUndruggableTargets(
  opportunityId: string
): Promise<UndruggableTargetRecord[]> {
  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("undruggable_targets")
      .select("*")
      .eq("opportunity_object_id", opportunityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) =>
      mapUndruggableRow(row as Record<string, unknown>)
    );
  }
  return fileStore.fileStoreListUndruggableTargets(opportunityId);
}

export async function listCalibrationRegistry(): Promise<CalibrationRegistryEntry[]> {
  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("calibration_registry")
      .select("*")
      .order("promoted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) =>
      mapCalibrationRow(row as Record<string, unknown>)
    );
  }
  const fileEntries = await fileStore.fileStoreListCalibrationRegistry();
  return fileEntries.length > 0 ? fileEntries : v3Memory.calibration;
}

export async function promoteToCalibrationRegistry(
  entry: Omit<CalibrationRegistryEntry, "id" | "promoted_at">
): Promise<CalibrationRegistryEntry> {
  const record: CalibrationRegistryEntry = {
    ...entry,
    id: randomUUID(),
    promoted_at: new Date().toISOString(),
  };

  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("calibration_registry").insert({
      id: record.id,
      source_opportunity_id: record.source_opportunity_id,
      source_hypothesis_id: record.source_hypothesis_id,
      domain_a: record.domain_a,
      domain_b: record.domain_b,
      association_claim: record.association_claim,
      rejection_reason: record.rejection_reason,
      notes: record.notes,
      promoted_at: record.promoted_at,
    });
    if (error) throw error;
  } else {
    v3Memory.calibration.unshift(record);
    await fileStore.fileStoreSaveCalibrationEntry(record);
  }

  return record;
}

export async function listSelectivityHypotheses(
  opportunityId: string
): Promise<HypothesisRecord[]> {
  return listHypothesesByStage(opportunityId, "selectivity");
}

export async function resolvePhase2Hypothesis(
  obj: OpportunityObject
): Promise<HypothesisRecord | null> {
  const selectivity = await listSelectivityHypotheses(obj.id);
  if (selectivity.length === 0) return null;

  if (obj.selected_phase2_hypothesis_id) {
    const found = selectivity.find((h) => h.id === obj.selected_phase2_hypothesis_id);
    if (found) return found;
  }

  return selectivity.find((h) => h.rank === 1) ?? selectivity[0];
}

export async function resetBlackboardFromStep(
  opportunityId: string,
  fromStep: string
): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return;

  const phaseOrder = [
    "phase1:population",
    "phase1:anchors",
    "phase1:market_size",
    "phase1:cd1",
    "phase1:cd2",
    "phase1:expert_domains",
    "phase1:biology_recurrence",
    "phase1:association_filter",
    "phase1:literature_review",
    "phase1:context_mine",
    "phase1:association_generate",
    "phase1:causation_filter",
    "phase1:selectivity_filter",
    "phase1:selectivity_rank",
    "phase1:selectivity_targets",
    "phase1:complete",
    "phase2:target_screen",
    "phase2:drug_check",
    "phase2:ip_fto",
    "phase2:druggability",
    "phase2:modality",
    "phase2:tpp",
    "phase2:risk_scores",
    "phase2:ind_package",
    "phase2:complete",
  ];

  const fromBase = fromStep.split(":").slice(0, 2).join(":");
  const cutoff = phaseOrder.findIndex((s) => s === fromBase || fromStep.startsWith(s));

  const completed = new Set(obj.blackboard_state?.completedSteps ?? []);
  for (const step of Array.from(completed)) {
    const stepBase = step.split(":").slice(0, 2).join(":");
    const stepIdx = phaseOrder.findIndex((s) => s === stepBase || step.startsWith(s));
    if (stepIdx >= cutoff && cutoff >= 0) {
      completed.delete(step);
    }
  }

  await updateOpportunityObject(opportunityId, {
    blackboard_state: {
      ...(obj.blackboard_state ?? { completedSteps: [] }),
      completedSteps: Array.from(completed),
      lastError: undefined,
    },
    status: "agents_running",
  });
  await updateV3OpportunityFields(opportunityId, { v3_phase: fromStep });
}

function mapDrugAssessmentRow(row: Record<string, unknown>): DrugDiscoveryAssessmentRecord {
  return {
    id: row.id as string,
    opportunity_object_id: row.opportunity_object_id as string,
    hypothesis_id: row.hypothesis_id as string,
    drug_exists: row.drug_exists as boolean | null,
    branch: row.branch as DrugDiscoveryAssessmentRecord["branch"],
    assessment: row.assessment as DrugDiscoveryAssessment,
    tpp_blueprint: (row.tpp_blueprint as TppBlueprint | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapIndPackageRow(row: Record<string, unknown>): IndRegulatoryPackageRecord {
  return {
    id: row.id as string,
    opportunity_object_id: row.opportunity_object_id as string,
    hypothesis_id: row.hypothesis_id as string,
    package: row.package as IndRegulatoryPackageV3,
    risk_of_failure: row.risk_of_failure as number | null,
    risk_components: row.risk_components as RiskComponents,
    modality_pathway: row.modality_pathway as ModalityPathway | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapUndruggableRow(row: Record<string, unknown>): UndruggableTargetRecord {
  return {
    id: row.id as string,
    opportunity_object_id: (row.opportunity_object_id as string | null) ?? null,
    hypothesis_id: (row.hypothesis_id as string | null) ?? null,
    target_name: row.target_name as string,
    intervention_point: (row.intervention_point as string | null) ?? null,
    reasoning: row.reasoning as string,
    alternate_intervention: (row.alternate_intervention as string | null) ?? null,
    rescan_eligible: (row.rescan_eligible as boolean | undefined) ?? true,
    created_at: row.created_at as string,
  };
}

function mapCalibrationRow(row: Record<string, unknown>): CalibrationRegistryEntry {
  return {
    id: row.id as string,
    source_opportunity_id: (row.source_opportunity_id as string | null) ?? null,
    source_hypothesis_id: (row.source_hypothesis_id as string | null) ?? null,
    domain_a: row.domain_a as string,
    domain_b: row.domain_b as string,
    association_claim: row.association_claim as string,
    rejection_reason: (row.rejection_reason as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    promoted_at: row.promoted_at as string,
  };
}

const FUNNEL_STAGE_COUNTS: Partial<Record<HypothesisStage, number>> = {
  association: 50,
  causation: 20,
  selectivity: 3,
};

function normalizeFunnelRecords(
  records: V3HypothesisRecord[],
  stage: HypothesisStage,
  opportunityId: string
): V3HypothesisRecord[] {
  const expected = FUNNEL_STAGE_COUNTS[stage];
  if (!expected) return records;

  const normalized = records.slice(0, expected);
  while (normalized.length < expected) {
    const idx = normalized.length;
    normalized.push({
      id: randomUUID(),
      opportunity_object_id: opportunityId,
      statement: `Placeholder ${stage} hypothesis ${idx + 1} — refine with additional cohort or literature data.`,
      patient_population: "Defined population pending refinement.",
      unmet_need: "Residual unmet need to be validated.",
      org_positioning: "",
      hypothesis_stage: stage,
      rank: idx + 1,
    });
  }
  return normalized;
}

export async function listGlobalUndruggableTargets(): Promise<UndruggableTargetRecord[]> {
  if (await isV3SupabaseDbEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("undruggable_targets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) =>
      mapUndruggableRow(row as Record<string, unknown>)
    );
  }
  return fileStore.fileStoreListUndruggableTargets();
}

export { isTargetUndraggable } from "@/lib/targetRegistryMatch";

export async function hydrateV3Phase2Artifacts(
  obj: OpportunityObject,
  hypothesisId: string
): Promise<OpportunityObject> {
  const [drug, ind] = await Promise.all([
    getDrugDiscoveryAssessment(obj.id, hypothesisId),
    getIndRegulatoryPackage(obj.id, hypothesisId),
  ]);
  return {
    ...obj,
    drug_discovery_assessment: drug,
    ind_package_v3: ind,
  };
}

/** Hypotheses persisted to `.data/` before V3 Supabase tables were ready. */
export async function readV3FileOverlayHypotheses(
  opportunityId: string
): Promise<HypothesisRecord[]> {
  const fromStore = await fileStore.fileStoreListHypotheses(opportunityId);
  const fromV3 = await v3FileStore.fileStoreListV3Hypotheses(opportunityId);
  const byId = new Map<string, HypothesisRecord>();
  for (const h of fromStore) byId.set(h.id, h);
  for (const h of fromV3) byId.set(h.id, h as HypothesisRecord);
  return Array.from(byId.values()).sort(
    (a, b) => (a.rank ?? 999) - (b.rank ?? 999)
  );
}

function hypothesisToSupabaseRow(
  opportunityId: string,
  h: HypothesisRecord
): Record<string, unknown> {
  return {
    id: h.id,
    opportunity_object_id: opportunityId,
    rank: h.rank,
    is_outgroup: h.is_outgroup ?? false,
    statement: h.statement,
    patient_population: h.patient_population,
    unmet_need: h.unmet_need,
    org_positioning: h.org_positioning ?? "",
    source: h.source ?? null,
    cross_domain_score: h.cross_domain_score,
    hypothesis_stage: h.hypothesis_stage,
    parent_hypothesis_id: h.parent_hypothesis_id,
    falsifiability_statement: h.falsifiability_statement,
    anchor_type: h.anchor_type,
    anchor_linkage: h.anchor_linkage,
    dropped_links: h.dropped_links ?? [],
    new_moa_requires_experiment: h.new_moa_requires_experiment ?? false,
    mechanistic_chain: h.mechanistic_chain,
    intervention_direction_hypothesis: h.intervention_direction_hypothesis,
    direction_status: h.direction_status,
    direction_hypotheses: h.direction_hypotheses ?? [],
    rank_decomposition: h.rank_decomposition,
    ranking_rationale: h.ranking_rationale,
    ranked_targets: h.ranked_targets,
    falsification_experiment: h.falsification_experiment,
    target_family_context: h.target_family_context,
  };
}

/** Backfill Supabase when V3 pipeline wrote hypotheses/fields to the local file overlay. */
export async function syncV3FileOverlayToSupabase(
  opportunityId: string
): Promise<boolean> {
  if (!(await isV3SupabaseDbEnabled())) return false;

  const supabase = getSupabaseAdmin();
  let synced = false;

  const { count, error: countErr } = await supabase
    .from("hypotheses")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_object_id", opportunityId);
  if (countErr) throw countErr;

  if ((count ?? 0) === 0) {
    const overlay = await readV3FileOverlayHypotheses(opportunityId);
    if (overlay.length > 0) {
      const { error: insertErr } = await supabase.from("hypotheses").upsert(
        overlay.map((h) => hypothesisToSupabaseRow(opportunityId, h)),
        { onConflict: "id" }
      );
      if (insertErr) throw insertErr;
      synced = true;
    }
  }

  const fields = await v3FileStore.fileStoreGetV3OpportunityFields(opportunityId);
  if (Object.keys(fields).length > 0) {
    const { data: row, error: rowErr } = await supabase
      .from("opportunity_objects")
      .select(
        "parent_domain, cohort_id, program_hypothesis_sentence, anchor_profiles, expert_domains, selected_phase2_hypothesis_id, v3_phase, population_definition, cd1_patterns, cd2_associations, cross_context_seeds"
      )
      .eq("id", opportunityId)
      .single();
    if (rowErr) throw rowErr;

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value != null && (row as Record<string, unknown>)[key] == null) {
        patch[key] = value;
      }
    }

    if (typeof patch.cohort_id === "string") {
      const { data: cohortRow } = await supabase
        .from("patient_cohorts")
        .select("id")
        .eq("id", patch.cohort_id as string)
        .maybeSingle();
      if (!cohortRow) delete patch.cohort_id;
    }

    if (Object.keys(patch).length > 0) {
      patch.last_updated = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("opportunity_objects")
        .update(patch)
        .eq("id", opportunityId);
      if (updateErr) throw updateErr;
      synced = true;
    }
  }

  return synced;
}

const REPAIR_RESET_FROM = "phase1:causation_filter";
const REPAIR_PHASE_ORDER = [
  "phase1:population",
  "phase1:anchors",
  "phase1:market_size",
  "phase1:cd1",
  "phase1:cd2",
  "phase1:expert_domains",
  "phase1:biology_recurrence",
  "phase1:association_filter",
  "phase1:literature_review",
  "phase1:context_mine",
  "phase1:association_generate",
  "phase1:causation_filter",
  "phase1:selectivity_filter",
  "phase1:selectivity_rank",
  "phase1:complete",
  "phase2:drug_check",
  "phase2:ip_fto",
  "phase2:druggability",
  "phase2:modality",
  "phase2:tpp",
  "phase2:risk_scores",
  "phase2:ind_package",
  "phase2:complete",
] as const;

/**
 * Fix V3 sessions marked agents_failed when Phase 1 data lived in the file overlay
 * but the pipeline read an empty Supabase hypotheses table.
 */
export async function repairV3MisclassifiedFailure(
  opportunityId: string
): Promise<{ repaired: boolean; synced: boolean }> {
  const synced = await syncV3FileOverlayToSupabase(opportunityId);

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("opportunity_objects")
    .select("status, schema_version, blackboard_state, actionability_zone")
    .eq("id", opportunityId)
    .single();
  if (error || !row || row.schema_version !== 3 || row.status !== "agents_failed") {
    return { repaired: false, synced };
  }

  const hyps = await listHypotheses(opportunityId);
  const selectivity = hyps.filter((h) => h.hypothesis_stage === "selectivity");
  const association = hyps.filter((h) => h.hypothesis_stage === "association");
  const completed = (row.blackboard_state as { completedSteps?: string[] })
    ?.completedSteps ?? [];

  if (selectivity.length > 0) {
    await updateOpportunityObject(opportunityId, {
      status: "complete",
      blackboard_state: {
        completedSteps: completed,
        ...(row.blackboard_state as Partial<BlackboardState>),
        lastError: undefined,
      },
    });
    return { repaired: true, synced };
  }

  if (
    association.length > 0 &&
    completed.includes("phase1:complete")
  ) {
    const cutoff = REPAIR_PHASE_ORDER.findIndex(
      (s) => s === REPAIR_RESET_FROM || REPAIR_RESET_FROM.startsWith(s)
    );
    const nextCompleted = completed.filter((step) => {
      const stepBase = step.split(":").slice(0, 2).join(":");
      const stepIdx = REPAIR_PHASE_ORDER.findIndex(
        (s) => s === stepBase || step.startsWith(s)
      );
      return stepIdx < cutoff || cutoff < 0;
    });

    await updateOpportunityObject(opportunityId, {
      status: "paused",
      blackboard_state: {
        ...(row.blackboard_state as object),
        completedSteps: nextCompleted,
        lastError: undefined,
        pauseReason: "user_stopped",
        repairNote:
          "Phase 1 funnel reset — association hypotheses restored from local cache; resume to continue.",
      },
    });
    await updateV3OpportunityFields(opportunityId, {
      v3_phase: REPAIR_RESET_FROM,
    });
    return { repaired: true, synced };
  }

  if (completed.includes("phase1:complete")) {
    await updateOpportunityObject(opportunityId, {
      status: "complete",
      actionability_zone: "too_early",
      blackboard_state: {
        completedSteps: completed,
        ...(row.blackboard_state as Partial<BlackboardState>),
        lastError: undefined,
        outcome: "phase1_complete_no_selectivity",
      },
    });
    return { repaired: true, synced };
  }

  return { repaired: false, synced };
}

export async function hydrateV3OpportunityObject(
  obj: OpportunityObject
): Promise<OpportunityObject> {
  if ((obj.schema_version ?? 1) !== 3) return obj;

  const fields = await v3FileStore.fileStoreGetV3OpportunityFields(obj.id);
  if (Object.keys(fields).length > 0) {
    for (const [key, value] of Object.entries(fields)) {
      const mutable = obj as unknown as Record<string, unknown>;
      if (value != null && mutable[key] == null) {
        mutable[key] = value;
      }
    }
  }

  const hypothesis = await resolvePhase2Hypothesis(obj);
  const hypothesisId =
    hypothesis?.id ??
    obj.selected_phase2_hypothesis_id ??
    obj.top_hypothesis_id ??
    null;

  let hydrated = obj;
  if (hypothesisId) {
    hydrated = await hydrateV3Phase2Artifacts(obj, hypothesisId);
  }

  const undruggable = await listUndruggableTargets(obj.id);
  hydrated.undruggable_targets = undruggable.map((u) => ({
    target_name: u.target_name,
    reasoning: u.reasoning,
  }));

  return hydrated;
}
