import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async getProfile(id: string) {
    const data = await this.db.one('select * from profiles where id = $1', [id]);
    if (!data) {
      return {
        id,
        email: '',
        full_name: 'Unknown',
        role: 'borrower',
        kyc_status: 'unverified',
      };
    }
    const { password_hash: _, ...rest } = data as Record<string, unknown>;
    return rest;
  }

  async updateProfile(
    id: string,
    dto: { fullName?: string; phone?: string; occupation?: string },
  ) {
    const data = await this.db.one(
      `update profiles set
         full_name = coalesce($2, full_name),
         phone = coalesce($3, phone),
         occupation = coalesce($4, occupation),
         updated_at = now()
       where id = $1
       returning *`,
      [id, dto.fullName ?? null, dto.phone ?? null, dto.occupation ?? null],
    );
    if (!data) throw new NotFoundException('Profile not found');
    const { password_hash: _, ...rest } = data as Record<string, unknown>;
    return rest;
  }

  async listBorrowers() {
    return this.db.many(
      `select id, email, full_name, phone, role, occupation, credit_score, kyc_status, created_at, updated_at
       from profiles where role = 'borrower' order by full_name`,
    );
  }
}
