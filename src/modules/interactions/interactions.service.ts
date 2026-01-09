import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LikePostResponseDto } from './dto/like-post-response.dto';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async likePost(postId: string, userId: string): Promise<LikePostResponseDto> {
    const postExists = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!postExists) {
      throw new NotFoundException('Post not found');
    }

    try {
      const result = await this.prisma.$transaction([
        this.prisma.postLike.create({
          data: { postId, userId },
          select: { id: true },
        }),
        this.prisma.post.update({
          where: { id: postId },
          data: { likesCount: { increment: 1 } },
          select: { likesCount: true },
        }),
      ] as const);

      const updatedPost = result[1];

      return {
        postId,
        userId,
        duplicated: false,
        likesCount: updatedPost.likesCount,
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
