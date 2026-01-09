import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithUser } from './request-with-user';

@Injectable()
export class XUserIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const headerValue = request.header('x-user-id');

    if (!headerValue || headerValue.trim().length === 0) {
      throw new UnauthorizedException('x-user.id header is required');
    }

    request.userId = headerValue.trim();
    return true;
  }
}
