import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../auth/auth.guards';

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  async list(user: AuthUser) {
    if (user.role === 'borrower') {
      return this.db.many(
        `select * from borrower_documents
         where borrower_id = $1 order by created_at desc`,
        [user.id],
      );
    }
    return this.db.many(
      `select * from borrower_documents order by created_at desc`,
    );
  }

  async create(
    user: AuthUser,
    dto: { docType: string; storagePath: string; applicationId?: string },
  ) {
    const data = await this.db.one(
      `insert into borrower_documents (
         borrower_id, doc_type, storage_path, application_id
       ) values ($1, $2::public.document_type, $3, $4)
       returning *`,
      [user.id, dto.docType, dto.storagePath, dto.applicationId ?? null],
    );
    if (!data) throw new BadRequestException('Failed to create document');
    return data;
  }
}
