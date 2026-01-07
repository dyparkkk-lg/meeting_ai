import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { MeetingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { QueueService } from '../../shared/queue/queue.service';
import { ASR_PROVIDER, AsrProvider } from '../../providers/asr/asr.interface';
import { LLM_PROVIDER, LlmProvider } from '../../providers/llm/llm.interface';
import {
  MEETING_QUEUE,
  JobType,
  MeetingJobData,
} from '../../shared/queue/queue.constants';
import { MdRenderer } from './md-renderer';

@Processor(MEETING_QUEUE)
export class MeetingProcessor extends WorkerHost {
  private readonly logger = new Logger(MeetingProcessor.name);
  private readonly mdRenderer = new MdRenderer();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queueService: QueueService,
    @Inject(ASR_PROVIDER) private readonly asrProvider: AsrProvider,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {
    super();
  }

  async process(job: Job<MeetingJobData, unknown, JobType>): Promise<void> {
    const { meetingId } = job.data;
    const jobType = job.name as JobType;

    this.logger.log(`Processing ${jobType} job for meeting ${meetingId} (attempt ${job.attemptsMade + 1})`);

    try {
      switch (jobType) {
        case JobType.TRANSCRIBE:
          await this.processTranscribe(meetingId);
          break;
        case JobType.SUMMARIZE:
          await this.processSummarize(meetingId);
          break;
        case JobType.RENDER_MD:
          await this.processRenderMd(meetingId);
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
    } catch (error) {
      this.logger.error(`${jobType} failed for meeting ${meetingId}:`, error);
      
      // 마지막 시도에서 실패하면 FAILED 상태로 변경
      if (job.attemptsMade >= (job.opts.attempts || 5) - 1) {
        await this.markAsFailed(meetingId, error);
      }
      
      throw error; // BullMQ가 재시도하도록 에러를 다시 던짐
    }
  }

  /**
   * TRANSCRIBE 처리: ASR Provider 호출 → transcripts 저장 → SUMMARIZE enqueue
   */
  private async processTranscribe(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { transcript: true },
    });

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // 이미 처리됐으면 스킵 (idempotency)
    if (this.isStatusAtLeast(meeting.status, MeetingStatus.ASR_DONE)) {
      this.logger.warn(`Skipping TRANSCRIBE for ${meetingId}: already at ${meeting.status}`);
      // 다음 단계로 진행
      if (!this.isStatusAtLeast(meeting.status, MeetingStatus.SUMMARY_DONE)) {
        await this.queueService.enqueueSummarize(meetingId);
      }
      return;
    }

    // ASR 처리
    const audioUrl = await this.storage.generateDownloadUrl(meeting.audioObjectKey!);
    const mimeType = this.getMimeTypeFromObjectKey(meeting.audioObjectKey!);
    
    this.logger.log(`Audio MIME type: ${mimeType}`);
    
    const asrResult = await this.asrProvider.transcribe(audioUrl, {
      languageHint: meeting.languageHint || 'ko',
      enableSpeakerDiarization: true,
      mimeType,
    });

    // Transcript upsert (중복 실행 안전)
    await this.prisma.transcript.upsert({
      where: { meetingId },
      create: {
        meetingId,
        segments: asrResult.segments as unknown as Prisma.InputJsonValue,
      },
      update: {
        segments: asrResult.segments as unknown as Prisma.InputJsonValue,
      },
    });

    // 상태 업데이트
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.ASR_DONE },
    });

    this.logger.log(`TRANSCRIBE completed for meeting ${meetingId}`);

    // 다음 job enqueue
    await this.queueService.enqueueSummarize(meetingId);
  }

  /**
   * SUMMARIZE 처리: LLM Provider 호출 → summaries 저장 → RENDER_MD enqueue
   */
  private async processSummarize(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { transcript: true, summary: true },
    });

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // 이미 처리됐으면 스킵 (idempotency)
    if (this.isStatusAtLeast(meeting.status, MeetingStatus.SUMMARY_DONE)) {
      this.logger.warn(`Skipping SUMMARIZE for ${meetingId}: already at ${meeting.status}`);
      if (!this.isStatusAtLeast(meeting.status, MeetingStatus.MD_DONE)) {
        await this.queueService.enqueueRenderMd(meetingId);
      }
      return;
    }

    if (!meeting.transcript) {
      throw new Error(`Transcript not found for meeting ${meetingId}`);
    }

    // Transcript를 텍스트로 변환
    const segments = meeting.transcript.segments as Array<{
      startMs: number;
      endMs: number;
      text: string;
      speaker?: string;
    }>;
    const transcriptText = segments
      .map((s) => {
        const speaker = s.speaker ? `[${s.speaker}] ` : '';
        return `${speaker}${s.text}`;
      })
      .join('\n');

    // LLM 분석
    const llmResult = await this.llmProvider.analyze(transcriptText, {
      language: meeting.languageHint || 'ko',
      meetingTitle: meeting.title || undefined,
    });

    // Summary upsert (중복 실행 안전)
    await this.prisma.summary.upsert({
      where: { meetingId },
      create: {
        meetingId,
        result: llmResult as unknown as Prisma.InputJsonValue,
        promptVersion: 'v0.1',
        modelVersion: this.llmProvider.name,
      },
      update: {
        result: llmResult as unknown as Prisma.InputJsonValue,
        promptVersion: 'v0.1',
        modelVersion: this.llmProvider.name,
      },
    });

    // 상태 업데이트
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.SUMMARY_DONE },
    });

    this.logger.log(`SUMMARIZE completed for meeting ${meetingId}`);

    // 다음 job enqueue
    await this.queueService.enqueueRenderMd(meetingId);
  }

  /**
   * RENDER_MD 처리: 마크다운 생성 → exports 저장 → status READY
   */
  private async processRenderMd(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { transcript: true, summary: true, export: true },
    });

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // 이미 처리됐으면 스킵 (idempotency)
    if (this.isStatusAtLeast(meeting.status, MeetingStatus.READY)) {
      this.logger.warn(`Skipping RENDER_MD for ${meetingId}: already at ${meeting.status}`);
      return;
    }

    if (!meeting.transcript || !meeting.summary) {
      throw new Error(`Transcript or Summary not found for meeting ${meetingId}`);
    }

    const segments = meeting.transcript.segments as Array<{
      startMs: number;
      endMs: number;
      text: string;
      speaker?: string;
    }>;
    const summaryResult = meeting.summary.result as Record<string, unknown>;

    // 마크다운 생성
    const mdContent = this.mdRenderer.render({
      title: meeting.title,
      segments,
      summary: summaryResult,
    });

    // Export upsert (중복 실행 안전)
    await this.prisma.export.upsert({
      where: { meetingId },
      create: {
        meetingId,
        mdContent,
      },
      update: {
        mdContent,
      },
    });

    // 상태 업데이트: MD_DONE → READY
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.READY },
    });

    this.logger.log(`RENDER_MD completed for meeting ${meetingId}, status: READY`);
  }

  /**
   * 실패 처리
   */
  private async markAsFailed(meetingId: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: MeetingStatus.FAILED,
        errorMessage,
      },
    });

    this.logger.error(`Meeting ${meetingId} marked as FAILED: ${errorMessage}`);
  }

  /**
   * Object key에서 MIME type 추출
   */
  private getMimeTypeFromObjectKey(objectKey: string): string {
    const ext = objectKey.split('.').pop()?.toLowerCase() || '';
    
    const extToMime: Record<string, string> = {
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
      'ogg': 'audio/ogg',
      'oga': 'audio/ogg',
      'flac': 'audio/flac',
    };
    
    return extToMime[ext] || 'audio/webm';
  }

  /**
   * 상태 순서 비교
   */
  private isStatusAtLeast(current: MeetingStatus, target: MeetingStatus): boolean {
    const order: MeetingStatus[] = [
      MeetingStatus.CREATED,
      MeetingStatus.UPLOADED,
      MeetingStatus.ASR_DONE,
      MeetingStatus.SUMMARY_DONE,
      MeetingStatus.MD_DONE,
      MeetingStatus.READY,
      MeetingStatus.FAILED, // FAILED는 마지막에 (indexOf -1 방지)
    ];
    return order.indexOf(current) >= order.indexOf(target);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<MeetingJobData>) {
    this.logger.log(`Job ${job.name}:${job.data.meetingId} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<MeetingJobData>, error: Error) {
    this.logger.error(`Job ${job.name}:${job.data.meetingId} failed: ${error.message}`);
  }
}

