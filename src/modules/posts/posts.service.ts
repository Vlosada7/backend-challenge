import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePostDto, authorId: string): Promise<PostResponseDto> {
    const post = await this.prisma.post.create({
      data: {
        content: dto.content,
        authorId,
      },
    });

    return {
      id: post.id,
      content: post.content,
      authorId: post.authorId,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      viewsCount: post.viewsCount,
      sharesCount: post.sharesCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  async getAll(): Promise<PostResponseDto[]> {
    const posts = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return posts.map((post) => ({
      id: post.id,
      content: post.content,
      authorId: post.authorId,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      viewsCount: post.viewsCount,
      sharesCount: post.sharesCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));
  }

  async findById(id: string): Promise<PostResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return {
      id: post.id,
      content: post.content,
      authorId: post.authorId,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      viewsCount: post.viewsCount,
      sharesCount: post.sharesCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
