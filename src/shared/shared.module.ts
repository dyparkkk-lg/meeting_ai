import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ProvidersModule } from '../providers/providers.module';
import { QueueModule } from './queue/queue.module';
import { QueueService } from './queue/queue.service';
import configuration from '../config/configuration';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    StorageModule,
    ProvidersModule,
    QueueModule,
  ],
  providers: [QueueService],
  exports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
    ProvidersModule,
    QueueModule,
    QueueService,
  ],
})
export class SharedModule {}

