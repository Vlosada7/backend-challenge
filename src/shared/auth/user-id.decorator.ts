import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './request-with-user';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.userId;
  },
);
