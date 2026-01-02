import { MeetingStatus } from '@prisma/client';

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string | null;
}

export interface Evidence {
  startMs: number;
  endMs: number;
  quote: string;
}

export interface Decision {
  decision: string;
  evidence: Evidence[];
}

export interface ActionItem {
  task: string;
  assigneeCandidate: string | null;
  dueDate: string | null;
  priority: string;
  evidence: Evidence[];
}

export interface SummaryResult {
  overallSummary: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Array<{ description: string; severity: string; evidence: Evidence[] }>;
  openQuestions: Array<{ question: string; evidence: Evidence[] }>;
}

export class MeetingResponseDto {
  id: string;
  title: string | null;
  status: MeetingStatus;
  languageHint: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // 전사 결과 (ASR_DONE 이상)
  transcript?: {
    segments: TranscriptSegment[];
  };
  
  // 요약 결과 (SUMMARY_DONE 이상)
  summary?: SummaryResult;
  
  // 마크다운 콘텐츠 (MD_DONE/READY)
  mdContent?: string;
}

export class MeetingListResponseDto {
  meetings: MeetingListItemDto[];
  total: number;
  page: number;
  limit: number;
}

export class MeetingListItemDto {
  id: string;
  title: string | null;
  status: MeetingStatus;
  createdAt: Date;
  updatedAt: Date;
}

