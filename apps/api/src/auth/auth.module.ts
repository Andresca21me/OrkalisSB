import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PagosModule } from '../pagos/pagos.module';

/**
 * Módulo de autenticación (FASE-05, ADR-003). Los secretos/TTL se pasan por
 * llamada (ver AuthService); JwtModule se registra sin secreto global.
 * Importa PagosModule para el control de acceso por suscripción (FASE-04).
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), PagosModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
