import { Logger } from '@nestjs/common';
import { LlmProvider, LlmAnalysisResult, LlmOptions } from './llm.interface';

/**
 * Ollama LLM Provider
 * OpenAI 호환 API를 사용하여 내부 Ollama 서버와 통신
 */
export class OllamaLlmProvider implements LlmProvider {
  private readonly logger = new Logger(OllamaLlmProvider.name);
  readonly name = 'ollama';

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly apiKey?: string,
  ) {
    this.logger.log(`Ollama LLM Provider initialized - URL: ${baseUrl}, Model: ${model}`);
  }

  async analyze(transcript: string, options?: LlmOptions): Promise<LlmAnalysisResult> {
    this.logger.log(`Analyzing transcript (length: ${transcript.length})`);
    this.logger.debug(`Options: ${JSON.stringify(options)}`);

    const systemPrompt = this.buildSystemPrompt(options?.language || 'ko');
    const userPrompt = this.buildUserPrompt(transcript, options);

    try {
      const response = await this.callOllamaApi(systemPrompt, userPrompt);
      const result = this.parseResponse(response);
      
      this.logger.log(`Analysis completed - summaries: ${result.overallSummary.length}, actions: ${result.actionItems.length}`);
      return result;
    } catch (error) {
      this.logger.error(`Ollama API call failed: ${error}`);
      throw error;
    }
  }

  /**
   * Ollama API 호출 (OpenAI 호환 엔드포인트 사용)
   */
  private async callOllamaApi(systemPrompt: string, userPrompt: string): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    };

    this.logger.debug(`Calling Ollama API: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 시스템 프롬프트 생성
   */
  private buildSystemPrompt(language: string): string {
    return `당신은 회의록 분석 전문가입니다. 주어진 회의 전사 내용을 분석하여 구조화된 JSON 형식으로 결과를 반환하세요.

## 분석 요구사항
1. **전체 요약 (overallSummary)**: 회의의 핵심 내용을 3-5개의 문장으로 요약
2. **결정사항 (decisions)**: 회의에서 결정된 사항들 (근거 포함)
3. **액션 아이템 (actionItems)**: 수행해야 할 작업들 (담당자, 기한, 우선순위 포함)
4. **리스크 (risks)**: 식별된 위험요소나 우려사항
5. **미결 질문 (openQuestions)**: 아직 해결되지 않은 질문들

## 출력 형식 (반드시 JSON)
\`\`\`json
{
  "overallSummary": ["요약1", "요약2", "요약3"],
  "decisions": [
    {
      "decision": "결정 내용",
      "evidence": [{"startMs": 0, "endMs": 5000, "quote": "관련 발언 인용"}]
    }
  ],
  "actionItems": [
    {
      "task": "수행할 작업",
      "assigneeCandidate": "담당자 이름 또는 null",
      "dueDate": "YYYY-MM-DD 또는 null",
      "priority": "P0|P1|P2|P3",
      "evidence": [{"startMs": 0, "endMs": 5000, "quote": "관련 발언"}]
    }
  ],
  "risks": [
    {
      "description": "리스크 설명",
      "severity": "high|medium|low",
      "evidence": [{"startMs": 0, "endMs": 5000, "quote": "관련 발언"}]
    }
  ],
  "openQuestions": [
    {
      "question": "미결 질문",
      "evidence": [{"startMs": 0, "endMs": 5000, "quote": "관련 발언"}]
    }
  ]
}
\`\`\`

## 규칙
- 반드시 유효한 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.
- 언어: ${language === 'ko' ? '한국어' : language}로 작성
- evidence의 startMs, endMs는 전사 텍스트에 타임스탬프가 있으면 활용하고, 없으면 0으로 설정
- priority는 P0(긴급), P1(높음), P2(보통), P3(낮음)
- 확실하지 않은 정보는 null로 표시`;
  }

  /**
   * 사용자 프롬프트 생성
   */
  private buildUserPrompt(transcript: string, options?: LlmOptions): string {
    const title = options?.meetingTitle || '회의';
    return `## 회의 제목: ${title}

## 전사 내용:
${transcript}

위 회의 내용을 분석하여 JSON 형식으로 결과를 반환해주세요.`;
  }

  /**
   * LLM 응답 파싱
   */
  private parseResponse(response: string): LlmAnalysisResult {
    // JSON 블록 추출 시도
    let jsonStr = response;
    
    // ```json ... ``` 형식 처리
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    // { } 블록만 추출
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return this.validateAndNormalize(parsed);
    } catch (parseError) {
      this.logger.error(`Failed to parse LLM response: ${parseError}`);
      this.logger.debug(`Raw response: ${response}`);
      
      // 파싱 실패 시 기본 결과 반환
      return this.getDefaultResult();
    }
  }

  /**
   * 결과 검증 및 정규화
   */
  private validateAndNormalize(parsed: Record<string, unknown>): LlmAnalysisResult {
    return {
      overallSummary: Array.isArray(parsed.overallSummary) 
        ? parsed.overallSummary.map(String) 
        : [],
      decisions: Array.isArray(parsed.decisions) 
        ? parsed.decisions.map(this.normalizeDecision) 
        : [],
      actionItems: Array.isArray(parsed.actionItems) 
        ? parsed.actionItems.map(this.normalizeActionItem) 
        : [],
      risks: Array.isArray(parsed.risks) 
        ? parsed.risks.map(this.normalizeRisk) 
        : [],
      openQuestions: Array.isArray(parsed.openQuestions) 
        ? parsed.openQuestions.map(this.normalizeOpenQuestion) 
        : [],
    };
  }

  private normalizeDecision = (d: Record<string, unknown>) => ({
    decision: String(d.decision || ''),
    evidence: this.normalizeEvidence(d.evidence),
  });

  private normalizeActionItem = (a: Record<string, unknown>) => ({
    task: String(a.task || ''),
    assigneeCandidate: a.assigneeCandidate ? String(a.assigneeCandidate) : null,
    dueDate: a.dueDate ? String(a.dueDate) : null,
    priority: this.normalizePriority(a.priority),
    evidence: this.normalizeEvidence(a.evidence),
  });

  private normalizeRisk = (r: Record<string, unknown>) => ({
    description: String(r.description || ''),
    severity: this.normalizeSeverity(r.severity),
    evidence: this.normalizeEvidence(r.evidence),
  });

  private normalizeOpenQuestion = (q: Record<string, unknown>) => ({
    question: String(q.question || ''),
    evidence: this.normalizeEvidence(q.evidence),
  });

  private normalizeEvidence(evidence: unknown): Array<{ startMs: number; endMs: number; quote: string }> {
    if (!Array.isArray(evidence)) return [];
    return evidence.map((e: Record<string, unknown>) => ({
      startMs: Number(e.startMs) || 0,
      endMs: Number(e.endMs) || 0,
      quote: String(e.quote || ''),
    }));
  }

  private normalizePriority(priority: unknown): 'P0' | 'P1' | 'P2' | 'P3' {
    const p = String(priority).toUpperCase();
    if (['P0', 'P1', 'P2', 'P3'].includes(p)) {
      return p as 'P0' | 'P1' | 'P2' | 'P3';
    }
    return 'P2';
  }

  private normalizeSeverity(severity: unknown): 'high' | 'medium' | 'low' {
    const s = String(severity).toLowerCase();
    if (['high', 'medium', 'low'].includes(s)) {
      return s as 'high' | 'medium' | 'low';
    }
    return 'medium';
  }

  /**
   * 기본 결과 (파싱 실패 시)
   */
  private getDefaultResult(): LlmAnalysisResult {
    return {
      overallSummary: ['회의 내용 분석 중 오류가 발생했습니다.'],
      decisions: [],
      actionItems: [],
      risks: [],
      openQuestions: [],
    };
  }
}



