import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxEventType, OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

type PostLikedOutboxPayload = {
  postId: string;
  actorUserId: string;
  recipientUserId: string;
};

function isPostLikedOutboxPayload(
  payload: unknown,
): payload is PostLikedOutboxPayload {
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Record<string, unknown>;
  return (
    typeof p.postId === 'string' &&
    typeof p.actorUserId === 'string' &&
    typeof p.recipientUserId === 'string'
  );
}

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  private isRunning = false;

  private readonly batchSize = 10;
  private readonly maxAttempts = 3;

  constructor(private readonly prisma: PrismaService) {}

  @Interval(2000)
  async processPendingEvents(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.drainOnce();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Outbox poll failed: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async drainOnce(): Promise<void> {
    const pending = await this.prisma.notificationOutbox.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    });

    if (pending.length === 0) return;

    const ids = pending.map((e) => e.id);

    await this.prisma.notificationOutbox.updateMany({
      where: {
        id: { in: ids },
        status: OutboxStatus.PENDING,
      },
      data: { status: OutboxStatus.PROCESSING },
    });

    const claimed = await this.prisma.notificationOutbox.findMany({
      where: {
        id: { in: ids },
        status: OutboxStatus.PROCESSING,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const event of claimed) {
      try {
        this.handleEvent(event.type, event.payload);

        await this.prisma.notificationOutbox.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.PROCESSED,
            processedAt: new Date(),
            lastError: null,
          },
        });

        this.logger.log(`Processed outbox event ${event.id} (${event.type})`);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';

        const attempts = event.attempts + 1;
        const shouldRetry = attempts < this.maxAttempts;

        await this.prisma.notificationOutbox.update({
          where: { id: event.id },
          data: {
            attempts,
            lastError: message,
            status: shouldRetry ? OutboxStatus.PENDING : OutboxStatus.FAILED,
          },
        });

        this.logger.warn(
          `Failed outbox event ${event.id} (${event.type}) - attempt ${attempts}/${this.maxAttempts}: ${message}`,
        );
      }
    }
  }

  private handleEvent(type: OutboxEventType, payload: Prisma.JsonValue): void {
    switch (type) {
      case OutboxEventType.POST_LIKED: {
        if (!isPostLikedOutboxPayload(payload)) {
          throw new Error('Invalid POST_LIKED payload');
        }

        this.logger.log(
          `Notify recipient=${payload.recipientUserId} actor=${payload.actorUserId} post=${payload.postId}`,
        );
        return;
      }

      default: {
        throw new Error(`Unsupported outbox event type: ${String(type)}`);
      }
    }
  }
}
