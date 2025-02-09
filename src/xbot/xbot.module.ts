import { Module } from '@nestjs/common';
import { XbotService } from './xbot.service';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from './schemas/account.schema';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([{ name: Account.name, schema: AccountSchema }]),
  ],
  providers: [XbotService],
})
export class XbotModule {}
