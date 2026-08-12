import { Global, Module } from '@nestjs/common';
import { FileSecurityService } from './file-security.service';
import { VirusScanService } from './virus-scan.service';

@Global()
@Module({
  providers: [VirusScanService, FileSecurityService],
  exports: [VirusScanService, FileSecurityService],
})
export class UploadModule {}
