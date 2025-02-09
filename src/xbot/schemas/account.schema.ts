import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type AccountDocument = mongoose.HydratedDocument<Account>;

@Schema()
export class Account {
  @Prop({ unique: true })
  username: string;

  @Prop()
  followersCount: string;

  @Prop()
  userId: string;

  @Prop({ required: false })
  topFollowers: string[];
}

export const AccountSchema = SchemaFactory.createForClass(Account);
