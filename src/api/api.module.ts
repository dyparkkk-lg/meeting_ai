import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  imports: [
    SharedModule,
    MeetingsModule,
  ],
})
export class ApiModule {}

