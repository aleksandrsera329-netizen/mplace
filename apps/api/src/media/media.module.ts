import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';

/** StorageModule is @Global — StorageService injects without import */
@Module({
  controllers: [MediaController],
})
export class MediaModule {}
