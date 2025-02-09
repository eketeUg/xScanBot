import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { XbotModule } from './xbot/xbot.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [XbotModule, DatabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
