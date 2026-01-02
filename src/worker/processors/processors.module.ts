import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MEETING_QUEUE } from '../../shared/queue/queue.constants';
import { MeetingProcessor } from './meeting.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: MEETING_QUEUE,
    }),
  ],
  providers: [MeetingProcessor],
})
export class ProcessorsModule {}

