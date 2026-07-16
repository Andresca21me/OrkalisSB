import { SetMetadata } from '@nestjs/common';

/** Marca de endpoint público: excluye del JwtAuthGuard global (FASE-05). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
