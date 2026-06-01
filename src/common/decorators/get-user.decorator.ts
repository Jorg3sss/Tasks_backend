import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extrae el payload del JWT del request.
 *  Uso: @GetUser() user  →  { sub: userId, correo }
 *       @GetUser('sub') id  →  userId string
 */
export const GetUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user    = request.user as Record<string, any>;
    return field ? user?.[field] : user;
  },
);
