/**
 * ASR (Automatic Speech Recognition) Provider 인터페이스
 * 음성 → 텍스트 변환
 */

export const ASR_PROVIDER = 'ASR_PROVIDER';

/**
 * 전사 세그먼트
 */
export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string | null;
}

/**
 * ASR 요청 옵션
 */
export interface AsrOptions {
  languageHint?: string;
  enableSpeakerDiarization?: boolean;
  mimeType?: string;  // 오디오 파일 MIME type (예: 'audio/mp4', 'audio/webm')
}

/**
 * ASR 결과
 */
export interface AsrResult {
  segments: TranscriptSegment[];
  language?: string;
  durationMs?: number;
}

/**
 * ASR Provider 인터페이스
 */
export interface AsrProvider {
  /**
   * Provider 이름
   */
  readonly name: string;

  /**
   * 오디오 파일을 전사
   * @param audioUrl - 오디오 파일 URL (presigned URL 또는 직접 URL)
   * @param options - 전사 옵션
   */
  transcribe(audioUrl: string, options?: AsrOptions): Promise<AsrResult>;
}

