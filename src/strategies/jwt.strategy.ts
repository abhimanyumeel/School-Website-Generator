import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    entityType: string;
    entityId: string;
    iat: number;
    exp: number;
  }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    try {
      // Verify if user still exists in database
      const user = await this.authService.findById(payload.sub);
      
      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      // Return payload for JWT token
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        entityType: payload.entityType,
        entityId: payload.entityId,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
} 