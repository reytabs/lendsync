import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { SettingsController } from './settings.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, SettingsController],
  providers: [AdminService],
})
export class AdminModule {}
