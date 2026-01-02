import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly presignedUrlExpiresIn: number;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>('s3.endpoint')!;
    this.bucket = this.configService.get<string>('s3.bucket')!;
    this.presignedUrlExpiresIn = this.configService.get<number>('s3.presignedUrlExpiresIn')!;

    // S3 클라이언트 설정 (로컬 실행 시 localhost:9000 직접 사용)
    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>('s3.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('s3.accessKey')!,
        secretAccessKey: this.configService.get<string>('s3.secretKey')!,
      },
      forcePathStyle: true, // MinIO 호환
    });

    this.logger.log(`Storage initialized - Endpoint: ${this.endpoint}`);
  }

  /**
   * 업로드용 Presigned URL 생성
   */
  async generateUploadUrl(meetingId: string, contentType: string = 'audio/webm'): Promise<PresignedUploadResult> {
    // 객체 키 생성: meetings/{meetingId}/{uuid}.{ext}
    const extension = this.getExtensionFromContentType(contentType);
    const objectKey = `meetings/${meetingId}/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.presignedUrlExpiresIn,
    });

    this.logger.debug(`Generated upload URL for meeting ${meetingId}: ${objectKey}`);

    return {
      uploadUrl,
      objectKey,
    };
  }

  /**
   * 다운로드용 Presigned URL 생성
   */
  async generateDownloadUrl(objectKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: this.presignedUrlExpiresIn,
    });
  }

  /**
   * 오브젝트 존재 여부 확인
   */
  async objectExists(objectKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 오브젝트 메타데이터 조회
   */
  async getObjectMetadata(objectKey: string): Promise<{ contentType?: string; contentLength?: number } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      const response = await this.s3Client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Content-Type에서 확장자 추출
   */
  private getExtensionFromContentType(contentType: string): string {
    const mapping: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/m4a': 'm4a',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
    };
    return mapping[contentType] || 'audio';
  }
}
