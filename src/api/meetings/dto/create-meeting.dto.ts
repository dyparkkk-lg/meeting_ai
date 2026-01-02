import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class CreateMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ko', 'en', 'ja', 'zh'])
  languageHint?: string = 'ko';

  @IsOptional()
  @IsString()
  @IsIn(['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp4', 'audio/x-m4a'])
  contentType?: string = 'audio/webm';
}

export class CreateMeetingResponseDto {
  meetingId: string;
  uploadUrl: string;
  objectKey: string;
}

