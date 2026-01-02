import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { ProcessorsModule } from './processors/processors.module';

@Module({
  imports: [
    SharedModule,
    ProcessorsModule,
  ],
})
export class WorkerModule {}

