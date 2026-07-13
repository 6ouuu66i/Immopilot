import type { Agent, Contact, Deal, PipelineStage, Property, PropertyKey, Task } from '../types';

export type PipelineDataState = 'loading' | 'error' | 'empty' | 'ready';

export interface PipelineDeal extends Deal {
  stageId: string;
  closedAt: string | null;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineStageView extends PipelineStage {
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineRuntimeData {
  deals: PipelineDeal[];
  stages: PipelineStageView[];
  dealsById: ReadonlyMap<string, PipelineDeal>;
  dealsByReference: ReadonlyMap<string, PipelineDeal>;
  propertiesById: ReadonlyMap<PropertyKey, Property>;
  contactsById: ReadonlyMap<string, Contact>;
  agentsById: ReadonlyMap<string, Agent>;
  tasksByDealId: ReadonlyMap<string, Task[]>;
  properties: Property[];
  contacts: Contact[];
}

export interface PipelineDealLinks {
  contactId?: string;
  propertyId?: string;
}

export type MovePipelineDeal = (dealId: string, stageId: string) => Promise<void>;
export type UpdatePipelineDealLinks = (dealId: string, links: PipelineDealLinks) => Promise<void>;
export type ClosePipelineDeal = (dealId: string, outcome: 'won' | 'lost') => Promise<void>;
export type ReopenPipelineDeal = (dealId: string) => Promise<void>;
