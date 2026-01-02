/**
 * LLM (Large Language Model) Provider 인터페이스
 * 회의록 분석 및 요약
 */

export const LLM_PROVIDER = 'LLM_PROVIDER';

/**
 * 근거 정보 (타임스탬프 + 인용)
 */
export interface Evidence {
  startMs: number;
  endMs: number;
  quote: string;
}

/**
 * 결정사항
 */
export interface Decision {
  decision: string;
  evidence: Evidence[];
}

/**
 * 액션 아이템
 */
export interface ActionItem {
  task: string;
  assigneeCandidate: string | null;
  dueDate: string | null;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  evidence: Evidence[];
}

/**
 * 리스크/이슈
 */
export interface Risk {
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: Evidence[];
}

/**
 * 미결 질문
 */
export interface OpenQuestion {
  question: string;
  evidence: Evidence[];
}

/**
 * LLM 분석 결과
 */
export interface LlmAnalysisResult {
  overallSummary: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Risk[];
  openQuestions: OpenQuestion[];
}

/**
 * LLM 요청 옵션
 */
export interface LlmOptions {
  language?: string;
  meetingTitle?: string;
}

/**
 * LLM Provider 인터페이스
 */
export interface LlmProvider {
  /**
   * Provider 이름
   */
  readonly name: string;

  /**
   * 전사 결과를 분석하여 회의록 요약 생성
   * @param transcript - 전사 텍스트 (전체 또는 세그먼트 배열)
   * @param options - 분석 옵션
   */
  analyze(transcript: string, options?: LlmOptions): Promise<LlmAnalysisResult>;
}

