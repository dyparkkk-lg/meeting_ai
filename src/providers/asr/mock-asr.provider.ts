import { Logger } from '@nestjs/common';
import { AsrProvider, AsrResult, AsrOptions, TranscriptSegment } from './asr.interface';

/**
 * Mock ASR Provider
 * 고정된 전사 결과를 반환하여 개발/테스트 용도로 사용
 */
export class MockAsrProvider implements AsrProvider {
  private readonly logger = new Logger(MockAsrProvider.name);
  readonly name = 'mock';

  async transcribe(audioUrl: string, options?: AsrOptions): Promise<AsrResult> {
    this.logger.log(`[Mock] Transcribing audio: ${audioUrl}`);
    this.logger.debug(`[Mock] Options: ${JSON.stringify(options)}`);

    // 가상의 회의 전사 결과
    const segments: TranscriptSegment[] = [
      {
        startMs: 0,
        endMs: 5000,
        text: '안녕하세요, 오늘 회의를 시작하겠습니다.',
        speaker: 'Speaker 1',
      },
      {
        startMs: 5000,
        endMs: 15000,
        text: '네, 오늘 논의할 내용은 신규 프로젝트 일정과 담당자 배정입니다.',
        speaker: 'Speaker 2',
      },
      {
        startMs: 15000,
        endMs: 30000,
        text: '먼저 일정에 대해 말씀드리면, 1월 말까지 MVP를 완료하는 것으로 결정했습니다.',
        speaker: 'Speaker 1',
      },
      {
        startMs: 30000,
        endMs: 45000,
        text: '백엔드 개발은 김철수님이, 프론트엔드는 이영희님이 담당하시면 될 것 같습니다.',
        speaker: 'Speaker 2',
      },
      {
        startMs: 45000,
        endMs: 60000,
        text: '좋습니다. 그리고 API 문서화는 다음 주 금요일까지 완료해주세요.',
        speaker: 'Speaker 1',
      },
      {
        startMs: 60000,
        endMs: 75000,
        text: '한 가지 우려사항이 있는데, 외부 API 연동 일정이 확정되지 않았습니다.',
        speaker: 'Speaker 3',
      },
      {
        startMs: 75000,
        endMs: 90000,
        text: '그 부분은 제가 내일까지 확인해서 공유드리겠습니다.',
        speaker: 'Speaker 2',
      },
      {
        startMs: 90000,
        endMs: 105000,
        text: '테스트 환경 구축은 어떻게 진행되고 있나요?',
        speaker: 'Speaker 1',
      },
      {
        startMs: 105000,
        endMs: 120000,
        text: 'Docker 기반으로 세팅 중입니다. 이번 주 내로 완료될 예정입니다.',
        speaker: 'Speaker 3',
      },
      {
        startMs: 120000,
        endMs: 135000,
        text: '네, 알겠습니다. 그럼 오늘 회의는 여기서 마무리하겠습니다. 수고하셨습니다.',
        speaker: 'Speaker 1',
      },
    ];

    return {
      segments,
      language: options?.languageHint || 'ko',
      durationMs: 135000,
    };
  }
}

