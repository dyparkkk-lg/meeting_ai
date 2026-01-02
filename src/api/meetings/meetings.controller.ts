import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Response } from 'express';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto, CreateMeetingResponseDto } from './dto/create-meeting.dto';
import { UploadCompleteDto, UploadCompleteResponseDto } from './dto/upload-complete.dto';
import { UpdateActionItemsDto } from './dto/update-action-items.dto';
import { MeetingResponseDto, MeetingListResponseDto } from './dto/meeting-response.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /**
   * POST /api/meetings
   * 새 회의 생성 및 업로드 URL 발급
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createMeetingDto: CreateMeetingDto,
  ): Promise<CreateMeetingResponseDto> {
    return this.meetingsService.create(createMeetingDto);
  }

  /**
   * POST /api/meetings/:id/upload-complete
   * 업로드 완료 콜백 - TRANSCRIBE job enqueue 후 즉시 응답
   */
  @Post(':id/upload-complete')
  @HttpCode(HttpStatus.OK)
  async uploadComplete(
    @Param('id') id: string,
    @Body() uploadCompleteDto: UploadCompleteDto,
  ): Promise<UploadCompleteResponseDto> {
    return this.meetingsService.handleUploadComplete(id, uploadCompleteDto);
  }

  /**
   * GET /api/meetings
   * 회의 목록 조회 (페이징)
   */
  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<MeetingListResponseDto> {
    return this.meetingsService.findAll(page, limit);
  }

  /**
   * GET /api/meetings/:id
   * 회의 상세 조회 (상태, 전사, 요약, MD 콘텐츠 포함)
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MeetingResponseDto> {
    const meeting = await this.meetingsService.findOne(id);
    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${id} not found`);
    }
    return meeting;
  }

  /**
   * PUT /api/meetings/:id/action-items
   * 액션 아이템 수정 (assigneeCandidate, dueDate 등)
   */
  @Put(':id/action-items')
  @HttpCode(HttpStatus.OK)
  async updateActionItems(
    @Param('id') id: string,
    @Body() updateDto: UpdateActionItemsDto,
  ): Promise<{ message: string }> {
    await this.meetingsService.updateActionItems(id, updateDto);
    return { message: 'Action items updated successfully' };
  }

  /**
   * GET /api/meetings/:id/export.md
   * 마크다운 파일 다운로드
   */
  @Get(':id/export.md')
  async exportMarkdown(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { content, filename } = await this.meetingsService.exportMarkdown(id);
    
    // RFC 5987: UTF-8 인코딩된 파일명 지원
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="meeting.md"; filename*=UTF-8''${encodedFilename}`,
    );
    res.send(content);
  }
}

