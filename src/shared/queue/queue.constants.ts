/**
 * Queue 관련 상수
 */

// 큐 이름
export const MEETING_QUEUE = 'meeting-pipeline';

// Job 타입
export enum JobType {
  TRANSCRIBE = 'TRANSCRIBE',
  SUMMARIZE = 'SUMMARIZE',
  RENDER_MD = 'RENDER_MD',
}

// Job 데이터 인터페이스
export interface MeetingJobData {
  meetingId: string;
  attempt?: number;
}

// Job ID 생성 (idempotency용)
// BullMQ는 jobId에 ':' 문자를 허용하지 않음
export function createJobId(jobType: JobType, meetingId: string): string {
  return `${jobType}_${meetingId}`;
}

// BullMQ 기본 옵션
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1초부터 시작
  },
  removeOnComplete: {
    count: 100, // 최근 100개만 유지
    age: 24 * 3600, // 24시간
  },
  removeOnFail: {
    count: 500, // 실패한 job은 더 많이 유지
    age: 7 * 24 * 3600, // 7일
  },
};

