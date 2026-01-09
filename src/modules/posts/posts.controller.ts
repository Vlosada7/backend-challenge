import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async createPost(@Body() body: CreatePostDto): Promise<PostResponseDto> {
    return this.postsService.create(body);
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
