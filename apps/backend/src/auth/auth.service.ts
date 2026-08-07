import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { UserRole } from '@lms/types';
import { DatabaseService } from '../database/database.service';
import { LoginDto, RegisterDto } from './auth.dto';

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  password_hash: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  private signToken(profile: ProfileRow) {
    const secret = this.config.get<string>('JWT_SECRET') ?? 'dev-secret';
    const access_token = jwt.sign(
      {
        sub: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.full_name,
      },
      secret,
      { expiresIn: '7d' },
    );
    return {
      access_token,
      token_type: 'bearer',
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
      },
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.db.one(
      'select id from profiles where email = $1',
      [dto.email.toLowerCase()],
    );
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const profile = await this.db.one<ProfileRow>(
      `insert into profiles (email, full_name, phone, password_hash, role)
       values ($1, $2, $3, $4, 'borrower')
       returning id, email, full_name, role, password_hash`,
      [dto.email.toLowerCase(), dto.fullName, dto.phone ?? null, passwordHash],
    );
    if (!profile) throw new BadRequestException('Registration failed');
    return this.signToken(profile);
  }

  async login(dto: LoginDto) {
    const profile = await this.db.one<ProfileRow>(
      `select id, email, full_name, role, password_hash
       from profiles where email = $1`,
      [dto.email.toLowerCase()],
    );
    if (!profile?.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, profile.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.signToken(profile);
  }
}
