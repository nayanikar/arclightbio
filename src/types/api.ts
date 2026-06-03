export interface Paper {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  year: number;
  authors: string[];
  doi?: string;
  source_url: string;
  is_peer_reviewed?: boolean;
}

export interface Trial {
  nctId: string;
  title: string;
  phase: string;
  status: string;
  enrollment: number;
  startDate: string;
  primaryCompletionDate?: string;
  whyStopped?: string;
  condition: string;
  intervention: string;
  source_url: string;
}

export interface Patent {
  lensId: string;
  title: string;
  abstract: string;
  assignee: string;
  publicationDate: string;
  source_url: string;
}

export interface TargetDiseaseAssociation {
  targetId: string;
  targetName: string;
  diseaseId: string;
  diseaseName: string;
  score: number;
}

export interface AdverseEvent {
  drugName: string;
  reaction: string;
  count: number;
  indication?: string;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  partial?: boolean;
}
