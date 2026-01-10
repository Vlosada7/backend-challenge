import { Injectable, NotFoundException } from '@nestjs/common';
import {
  OutboxEventType,
  Prisma,
  Prisma as PrismaNamespace,
} from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LikePostResponseDto } from './dto/like-post-response.dto';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async likePost(postId: string, userId: string): Promise<LikePostResponseDto> {
    try {
      const likesCount = await this.prisma.$transaction(
        async (tx: PrismaNamespace.TransactionClient) => {
          const post = await tx.post.findUnique({
            where: { id: postId },
            select: { id: true, authorId: true },
          });

          if (!post) {
            throw new NotFoundException('Post not found');
          }

          await tx.postLike.create({
            data: { postId, userId },
            select: { id: true },
          });

          const updatedPost = await tx.post.update({
            where: { id: postId },
            data: { likesCount: { increment: 1 } },
            select: { likesCount: true },
          });

          if (post.authorId !== userId) {
            await tx.notificationOutbox.create({
              data: {
                type: OutboxEventType.POST_LIKED,
                payload: {
                  postId,
                  actorUserId: userId,
                  recipientUserId: post.authorId,
                } satisfies Prisma.JsonObject,
              },
              select: { id: true },
            });
          }

          return updatedPost.likesCount;
        },
      );

      return {
        postId,
        userId,
        duplicated: false,
        likesCount,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const post = await this.prisma.post.findUnique({
          where: { id: postId },
          select: { likesCount: true },
        });

        if (!post) {
          throw new NotFoundException('Post not found');
        }

        return {
          postId,
          userId,
          duplicated: true,
          likesCount: post.likesCount,
        };
      }

      throw error;
    }
  }
}
