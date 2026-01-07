import { Logger } from '@nestjs/common';
import { AsrProvider, AsrResult, AsrOptions, TranscriptSegment } from './asr.interface';

/**
 * OpenAI Whisper ASR Provider
 * OpenAI의 Whisper API를 사용하여 음성을 텍스트로 변환
 */
export class OpenAiAsrProvider implements AsrProvider {
  private readonly logger = new Logger(OpenAiAsrProvider.name);
  readonly name = 'openai-whisper';

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.logger.log('OpenAI Whisper ASR Provider initialized');
  }

  async transcribe(audioUrl: string, options?: AsrOptions): Promise<AsrResult> {
    this.logger.log(`Transcribing audio from URL: ${audioUrl.substring(0, 50)}...`);
    this.logger.debug(`Options: ${JSON.stringify(options)}`);

    try {
      // 1. 오디오 파일 다운로드
      const audioBuffer = await this.downloadAudio(audioUrl);
      this.logger.log(`Downloaded audio: ${audioBuffer.byteLength} bytes`);

      // 2. OpenAI Whisper API 호출
      const result = await this.callWhisperApi(audioBuffer, options);

      this.logger.log(`Transcription completed: ${result.segments.length} segments, language: ${result.language}`);
      return result;
    } catch (error) {
      // 상세 에러 로깅
      if (error instanceof Error) {
        this.logger.error(`Transcription failed: ${error.message}`);
        if ('cause' in error && error.cause) {
          this.logger.error(`Cause: ${JSON.stringify(error.cause, null, 2)}`);
        }
        if (error.stack) {
          this.logger.debug(`Stack: ${error.stack}`);
        }
      } else {
        this.logger.error(`Transcription failed: ${error}`);
      }
      throw error;
    }
  }

  /**
   * URL에서 오디오 파일 다운로드
   */
  private async downloadAudio(audioUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  /**
   * OpenAI Whisper API 호출
   */
  private async callWhisperApi(audioBuffer: ArrayBuffer, options?: AsrOptions): Promise<AsrResult> {
    // FormData 생성
    const formData = new FormData();

    // MIME type과 파일 확장자 결정
    const mimeType = options?.mimeType || 'audio/webm';
    const extension = this.getExtensionFromMimeType(mimeType);
    const filename = `audio.${extension}`;

    this.logger.debug(`Audio format: ${mimeType} -> ${filename}`);

    // 오디오 파일을 Blob으로 변환하여 추가
    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    // 언어 힌트가 있으면 추가
    if (options?.languageHint) {
      formData.append('language', options.languageHint);
    }

    this.logger.debug('Calling OpenAI Whisper API...');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as WhisperResponse;
    return this.convertToAsrResult(data);
  }

  /**
   * MIME type에서 파일 확장자 추출
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/m4a': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac',
    };

    return mimeToExt[mimeType.toLowerCase()] || 'webm';
  }

  /**
   * OpenAI 응답을 AsrResult 형식으로 변환
   */
  private convertToAsrResult(response: WhisperResponse): AsrResult {
    const segments: TranscriptSegment[] = (response.segments || []).map((seg) => ({
      startMs: Math.round(seg.start * 1000),
      endMs: Math.round(seg.end * 1000),
      text: seg.text.trim(),
      speaker: null, // Whisper API는 화자 분리 미지원
    }));

    // segments가 비어있으면 전체 텍스트를 하나의 segment로
    if (segments.length === 0 && response.text) {
      segments.push({
        startMs: 0,
        endMs: Math.round((response.duration || 0) * 1000),
        text: response.text.trim(),
        speaker: null,
      });
    }

    return {
      segments,
      language: response.language,
      durationMs: response.duration ? Math.round(response.duration * 1000) : undefined,
    };
  }
}

/**
 * OpenAI Whisper API 응답 타입
 */
interface WhisperResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments?: WhisperSegment[];
}

interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}
