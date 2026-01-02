import { IsNotEmpty, IsString } from 'class-validator';

export class UploadCompleteDto {
  @IsNotEmpty()
  @IsString()
  objectKey: string;
}

export class UploadCompleteResponseDto {
  meetingId: string;
  status: string;
  message: string;
}

