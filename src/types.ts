// ============================================================
// Causal Loop Dynamics — Type Definitions
// ============================================================

export type Polarity = 'same' | 'opposite';
export type Delay = 'immediate' | 'weeks' | 'months' | 'years';
export type Strength = 'weak' | 'moderate' | 'strong';
export type Provenance = 'field_observation' | 'human_assertion' | 'model_inference';
export type SessionStatus = 'draft' | 'saved' | 'promoted';
export type VariationOperator = 'boundary' | 'timescale' | 'polarity' | 'actor' | 'delay';

export interface Theme {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  active: boolean;
}

export interface Variable {
  id: string;
  name: string;
  definition: string;
  isBoundary: boolean;
}

export interface Edge {
  id: string;
  fromVariableId: string;
  toVariableId: string;
  polarity: Polarity;
  delay: Delay;
  strength: Strength;
  provenance: Provenance;
  assertedBy?: string;
  observationCount?: number;
}

export interface GraphNode {
  id: string;
  type: 'variable';
  position: { x: number; y: number };
  data: {
    variable: Variable;
    isSelected?: boolean;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'causal';
  data: {
    edge: Edge;
  };
}

export interface CriticalQuestion {
  id: string;
  question: string;
}

export interface CriticalAnswer {
  questionId: string;
  answer: string;
  answeredBy: string;
}

export interface AnalysisResult {
  generalDescription: string;
  nodeExplanations: { variableId: string; explanation: string }[];
  enablers: string[];
  blockers: string[];
  leverageDistribution: {
    level: string;
    count: number;
  }[];
}

export interface Simulation {
  id: string;
  themeId: string;
  title: string;
  signalText: string;
  criticalQuestions: CriticalQuestion[];
  criticalAnswers: CriticalAnswer[];
  variables: Variable[];
  edges: Edge[];
  analysis: AnalysisResult | null;
  status: SessionStatus;
  createdAt: string;
}

export interface Variation {
  id: string;
  simulationId: string;
  operator: VariationOperator;
  operatorParams: Record<string, unknown>;
  variables: Variable[];
  edges: Edge[];
  note: string;
}

export interface AppSettings {
  openRouterApiKey: string;
  modelSelections: {
    criticalQuestioner: string;
    diagramBuilder: string;
    variationGenerator: string;
    interpreter: string;
  };
  helpLanguage: 'en' | 'pt';
  autosaveEnabled: boolean;
}