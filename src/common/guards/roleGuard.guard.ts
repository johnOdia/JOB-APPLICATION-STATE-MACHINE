import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly allowedRoles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { role, newStatus } = request.body;

    if (!role) {
      throw new ForbiddenException('No role provided in request body');
    }

    if (
      !['ADMIN', 'COMPANY'].includes(role) &&
      ['INTERVIEWING', 'CONTRACTED'].includes(newStatus)
    ) {
      throw new ForbiddenException(
        `Role "${role}" not allowed to access this resource`,
      );
    }

    return true;
  }
}
