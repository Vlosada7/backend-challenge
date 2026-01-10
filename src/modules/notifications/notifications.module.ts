import { Module } from '@nestjs/common';
import { OutboxProcessorService } from './outbox-processor.service';

@Module({
  providers: [OutboxProcessorService],
})
export class NotificationsModule {}
