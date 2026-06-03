export type SurveillanceStepIcon =
  | "scanning"
  | "relevant"
  | "filtered"
  | "none";

export interface SurveillanceStep {
  id: string;
  icon: SurveillanceStepIcon;
  description: string;
  muted?: boolean;
  positive?: boolean;
}

export interface SurveillanceScanSummary {
  message: string;
  newSignals: number;
  papersReviewed: number;
  tagsScanned: number;
  confidenceDelta: number;
  newCardIds: string[];
  positive: boolean;
}
