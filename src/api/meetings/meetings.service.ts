import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MeetingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { QueueService } from '../../shared/queue/queue.service';
import { CreateMeetingDto, CreateMeetingResponseDto } from './dto/create-meeting.dto';
import { UploadCompleteDto, UploadCompleteResponseDto } from './dto/upload-complete.dto';
import { UpdateActionItemsDto } from './dto/update-action-items.dto';
import {
  MeetingResponseDto,
  MeetingListResponseDto,
  TranscriptSegment,
  SummaryResult,
} from './dto/meeting-response.dto';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * 새 회의 생성 및 업로드 URL 발급
   */
  async create(dto: CreateMeetingDto): Promise<CreateMeetingResponseDto> {
    // 1. Meeting 생성
    const meeting = await this.prisma.meeting.create({
      data: {
        title: dto.title,
        languageHint: dto.languageHint || 'ko',
        status: MeetingStatus.CREATED,
      },
    });

    // 2. Presigned URL 발급
    const { uploadUrl, objectKey } = await this.storage.generateUploadUrl(
      meeting.id,
      dto.contentType || 'audio/webm',
    );

    // 3. objectKey 저장
    await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: { audioObjectKey: objectKey },
    });

    this.logger.log(`Meeting created: ${meeting.id}, objectKey: ${objectKey}`);

    return {
      meetingId: meeting.id,
      uploadUrl,
      objectKey,
    };
  }

  /**
   * 업로드 완료 처리 - TRANSCRIBE job enqueue 후 즉시 응답 (v0.1 비동기)
   */
  async handleUploadComplete(
    meetingId: string,
    dto: UploadCompleteDto,
  ): Promise<UploadCompleteResponseDto> {
    // 1. Meeting 조회 및 검증
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // objectKey 검증
    if (meeting.audioObjectKey !== dto.objectKey) {
      throw new BadRequestException('Object key mismatch');
    }

    // 상태 검증 (CREATED만 허용)
    if (meeting.status !== MeetingStatus.CREATED) {
      throw new BadRequestException(
        `Meeting is not in CREATED status (current: ${meeting.status})`,
      );
    }

    // 2. 상태 변경: CREATED → UPLOADED
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.UPLOADED },
    });

    // 3. TRANSCRIBE job enqueue
    await this.queueService.enqueueTranscribe(meetingId);

    this.logger.log(`Upload complete, TRANSCRIBE job enqueued: ${meetingId}`);

    // 4. 즉시 응답 (동기 처리 금지)
    return {
      meetingId,
      status: MeetingStatus.UPLOADED,
      message: 'Upload complete. Processing started.',
    };
  }

  /**
   * 회의 목록 조회 (페이징)
   */
  async findAll(page: number, limit: number): Promise<MeetingListResponseDto> {
    const skip = (page - 1) * limit;

    const [meetings, total] = await Promise.all([
      this.prisma.meeting.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.meeting.count(),
    ]);

    return {
      meetings,
      total,
      page,
      limit,
    };
  }

  /**
   * 회의 상세 조회
   */
  async findOne(meetingId: string): Promise<MeetingResponseDto | null> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcript: true,
        summary: true,
        export: true,
      },
    });

    if (!meeting) {
      return null;
    }

    const response: MeetingResponseDto = {
      id: meeting.id,
      title: meeting.title,
      status: meeting.status,
      languageHint: meeting.languageHint,
      errorMessage: meeting.errorMessage,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
    };

    // ASR_DONE 이상: transcript 포함
    // FAILED 상태는 별도 처리 (진행 중 상태만 순서 비교)
    const statusOrder: MeetingStatus[] = [
      MeetingStatus.CREATED,
      MeetingStatus.UPLOADED,
      MeetingStatus.ASR_DONE,
      MeetingStatus.SUMMARY_DONE,
      MeetingStatus.MD_DONE,
      MeetingStatus.READY,
      MeetingStatus.FAILED, // FAILED는 마지막에 추가 (indexOf -1 방지)
    ];
    const currentIndex = statusOrder.indexOf(meeting.status);
    const asrDoneIndex = statusOrder.indexOf(MeetingStatus.ASR_DONE);
    const summaryDoneIndex = statusOrder.indexOf(MeetingStatus.SUMMARY_DONE);
    const mdDoneIndex = statusOrder.indexOf(MeetingStatus.MD_DONE);

    if (currentIndex >= asrDoneIndex && meeting.transcript) {
      response.transcript = {
        segments: meeting.transcript.segments as unknown as TranscriptSegment[],
      };
    }

    // SUMMARY_DONE 이상: summary 포함
    if (currentIndex >= summaryDoneIndex && meeting.summary) {
      response.summary = meeting.summary.result as unknown as SummaryResult;
    }

    // MD_DONE/READY: mdContent 포함
    if (currentIndex >= mdDoneIndex && meeting.export) {
      response.mdContent = meeting.export.mdContent;
    }

    return response;
  }

  /**
   * 액션 아이템 수정
   */
  async updateActionItems(
    meetingId: string,
    dto: UpdateActionItemsDto,
  ): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { summary: true },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    if (!meeting.summary) {
      throw new BadRequestException('Summary not found for this meeting');
    }

    // 기존 result에서 actionItems만 교체
    const currentResult = meeting.summary.result as Record<string, unknown>;
    const updatedResult = {
      ...currentResult,
      actionItems: dto.actionItems,
    };

    await this.prisma.summary.update({
      where: { meetingId },
      data: { result: updatedResult as unknown as Prisma.InputJsonValue },
    });

    this.logger.log(`Action items updated for meeting: ${meetingId}`);
  }

  /**
   * 마크다운 내보내기
   */
  async exportMarkdown(meetingId: string): Promise<{ content: string; filename: string }> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { export: true },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    if (!meeting.export || !meeting.export.mdContent) {
      throw new BadRequestException('Export not ready for this meeting');
    }

    const filename = this.generateFilename(meeting.title, meeting.createdAt);

    return {
      content: meeting.export.mdContent,
      filename,
    };
  }

  /**
   * 파일명 생성
   */
  private generateFilename(title: string | null, createdAt: Date): string {
    const date = createdAt.toISOString().split('T')[0];
    const safeName = (title || '회의록')
      .replace(/[^a-zA-Z0-9가-힣]/g, '_')
      .substring(0, 50);
    return `${date}_${safeName}.md`;
  }
}

