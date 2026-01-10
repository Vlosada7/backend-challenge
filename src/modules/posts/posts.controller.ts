import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { XUserIdGuard } from '../../shared/auth/x-user-id.guard';
import { UserId } from '../../shared/auth/user-id.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(XUserIdGuard)
  async createPost(
    @Body() body: CreatePostDto,
    @UserId() userId: string,
  ): Promise<PostResponseDto> {
    return this.postsService.create(body, userId);
  }

  @Get()
  async getAllPosts(): Promise<PostResponseDto[]> {
    return this.postsService.getAll();
  }

  @Get(':id')
  async getPostById(@Param('id') id: string): Promise<PostResponseDto> {
    return this.postsService.findById(id);
  }
}
