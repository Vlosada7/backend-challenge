import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { XUserIdGuard } from '../../shared/auth/x-user-id.guard';
import { UserId } from '../../shared/auth/user-id.decorator';
import { LikePostResponseDto } from './dto/like-post-response.dto';
import { InteractionsService } from './interactions.service';

@Controller('posts')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post(':id/like')
  @UseGuards(XUserIdGuard)
  async likePost(
    @Param('id') postId: string,
    @UserId() userId: string,
  ): Promise<LikePostResponseDto> {
    return this.interactionsService.likePost(postId, userId);
  }
}
