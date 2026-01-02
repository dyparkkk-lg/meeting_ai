import { Logger } from '@nestjs/common';
import { LlmProvider, LlmAnalysisResult, LlmOptions } from './llm.interface';

/**
 * Mock LLM Provider
 * 고정된 분석 결과를 반환하여 개발/테스트 용도로 사용
 */
export class MockLlmProvider implements LlmProvider {
  private readonly logger = new Logger(MockLlmProvider.name);
  readonly name = 'mock';

  async analyze(transcript: string, options?: LlmOptions): Promise<LlmAnalysisResult> {
    this.logger.log(`[Mock] Analyzing transcript (length: ${transcript.length})`);
    this.logger.debug(`[Mock] Options: ${JSON.stringify(options)}`);

    // 가상의 분석 결과
    const result: LlmAnalysisResult = {
      overallSummary: [
        '신규 프로젝트의 MVP 일정과 담당자 배정에 대해 논의함',
        '1월 말까지 MVP 완료를 목표로 설정',
        '백엔드(김철수), 프론트엔드(이영희) 담당자 배정 완료',
        '외부 API 연동 일정 미확정으로 인한 리스크 식별',
      ],
      decisions: [
        {
          decision: 'MVP 완료 일정을 1월 말로 확정',
          evidence: [
            {
              startMs: 15000,
              endMs: 30000,
              quote: '1월 말까지 MVP를 완료하는 것으로 결정했습니다.',
            },
          ],
        },
        {
          decision: '백엔드 개발은 김철수, 프론트엔드는 이영희가 담당',
          evidence: [
            {
              startMs: 30000,
              endMs: 45000,
              quote: '백엔드 개발은 김철수님이, 프론트엔드는 이영희님이 담당하시면 될 것 같습니다.',
            },
          ],
        },
        {
          decision: 'Docker 기반 테스트 환경 구축 진행',
          evidence: [
            {
              startMs: 105000,
              endMs: 120000,
              quote: 'Docker 기반으로 세팅 중입니다.',
            },
          ],
        },
      ],
      actionItems: [
        {
          task: 'API 문서화 완료',
          assigneeCandidate: null, // 전사에서 명확히 언급되지 않음
          dueDate: null, // 다음 주 금요일이지만 구체적 날짜 불명
          priority: 'P1',
          evidence: [
            {
              startMs: 45000,
              endMs: 60000,
              quote: 'API 문서화는 다음 주 금요일까지 완료해주세요.',
            },
          ],
        },
        {
          task: '외부 API 연동 일정 확인 및 공유',
          assigneeCandidate: 'Speaker 2',
          dueDate: null, // 내일이지만 구체적 날짜 불명
          priority: 'P1',
          evidence: [
            {
              startMs: 75000,
              endMs: 90000,
              quote: '그 부분은 제가 내일까지 확인해서 공유드리겠습니다.',
            },
          ],
        },
        {
          task: '테스트 환경 구축 완료',
          assigneeCandidate: 'Speaker 3',
          dueDate: null, // 이번 주 내
          priority: 'P2',
          evidence: [
            {
              startMs: 105000,
              endMs: 120000,
              quote: 'Docker 기반으로 세팅 중입니다. 이번 주 내로 완료될 예정입니다.',
            },
          ],
        },
      ],
      risks: [
        {
          description: '외부 API 연동 일정 미확정',
          severity: 'medium',
          evidence: [
            {
              startMs: 60000,
              endMs: 75000,
              quote: '외부 API 연동 일정이 확정되지 않았습니다.',
            },
          ],
        },
      ],
      openQuestions: [
        {
          question: '외부 API 연동 일정이 언제 확정되는지?',
          evidence: [
            {
              startMs: 60000,
              endMs: 75000,
              quote: '외부 API 연동 일정이 확정되지 않았습니다.',
            },
          ],
        },
      ],
    };

    return result;
  }
}

