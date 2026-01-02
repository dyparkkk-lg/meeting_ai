import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  MEETING_QUEUE,
  JobType,
  MeetingJobData,
  createJobId,
  DEFAULT_JOB_OPTIONS,
} from './queue.constants';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(MEETING_QUEUE) private readonly meetingQueue: Queue,
  ) {}

  /**
   * TRANSCRIBE job 추가
   */
  async enqueueTranscribe(meetingId: string): Promise<void> {
    const jobId = createJobId(JobType.TRANSCRIBE, meetingId);
    const data: MeetingJobData = { meetingId };

    await this.meetingQueue.add(JobType.TRANSCRIBE, data, {
      ...DEFAULT_JOB_OPTIONS,
      jobId,
    });

    this.logger.log(`Enqueued ${JobType.TRANSCRIBE} job for meeting ${meetingId}`);
  }

  /**
   * SUMMARIZE job 추가
   */
  async enqueueSummarize(meetingId: string): Promise<void> {
    const jobId = createJobId(JobType.SUMMARIZE, meetingId);
    const data: MeetingJobData = { meetingId };

    await this.meetingQueue.add(JobType.SUMMARIZE, data, {
      ...DEFAULT_JOB_OPTIONS,
      jobId,
    });

    this.logger.log(`Enqueued ${JobType.SUMMARIZE} job for meeting ${meetingId}`);
  }

  /**
   * RENDER_MD job 추가
   */
  async enqueueRenderMd(meetingId: string): Promise<void> {
    const jobId = createJobId(JobType.RENDER_MD, meetingId);
    const data: MeetingJobData = { meetingId };

    await this.meetingQueue.add(JobType.RENDER_MD, data, {
      ...DEFAULT_JOB_OPTIONS,
      jobId,
    });

    this.logger.log(`Enqueued ${JobType.RENDER_MD} job for meeting ${meetingId}`);
  }

  /**
   * 큐 상태 조회
   */
  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.meetingQueue.getWaitingCount(),
      this.meetingQueue.getActiveCount(),
      this.meetingQueue.getCompletedCount(),
      this.meetingQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}

