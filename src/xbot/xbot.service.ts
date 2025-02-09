import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { HttpService } from '@nestjs/axios';
import * as dotenv from 'dotenv';
import { followersMarkUp, menuMarkup, welcomeMessageMarkup } from './markups';
import { InjectModel } from '@nestjs/mongoose';
import { Account } from './schemas/account.schema';
import { Model } from 'mongoose';
dotenv.config();

const token = process.env.TELEGRAM_TOKEN;

@Injectable()
export class XbotService {
  private readonly xBot: TelegramBot;
  private logger = new Logger(XbotService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Account.name) private readonly AccountModel: Model<Account>,
  ) {
    this.xBot = new TelegramBot(token, { polling: true });
    this.xBot.on('message', this.handleRecievedMessages);
    this.xBot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.xBot.sendChatAction(msg.chat.id, 'typing');
      function extractPlatformAndUsername(text) {
        // Adjusted regex pattern to match the username with more characters and optional whitespace

        const regex = /@(\w+)/;

        const match = text.match(regex);

        if (match) {
          return {
            platform: `twitter`, // "twitter" or "tiktok"
            username: match[1], // The username after "@"
          };
        } else {
          return null; // Return null if no match is found
        }
      }

      const addMatch = extractPlatformAndUsername(msg.text.trim());

      if (msg.text.trim() === '/start') {
        const username: string = `${msg.from.username}`;
        const welcome = await welcomeMessageMarkup(username);
        const replyMarkup = {
          inline_keyboard: welcome.keyboard,
        };
        return await this.xBot.sendMessage(msg.chat.id, welcome.message, {
          reply_markup: replyMarkup,
        });
      } else if (addMatch) {
        if (addMatch.platform === 'twitter') {
          console.log(addMatch.username);
          //TODO: VERIFY USERNAME BEFORE SAVING
          const validAccount: any = await this.validateTwitterAccount(
            addMatch.username,
            msg.chat.id,
          );
          if (
            validAccount.username &&
            Number(validAccount.followersCount) > 0
          ) {
            if (Number(validAccount.followersCount) > 450000) {
              return await this.xBot.sendMessage(
                msg.chat.id,
                `Account @${validAccount.username} has ${validAccount.followersCount} and it is above the iteration threshold`,
              );
            } else if (
              validAccount.topFollowers &&
              validAccount.topFollowers.length > 0
            ) {
              await this.notifyTwitter(
                validAccount.username,
                validAccount.userId,
                msg.chat.id,
              );
              return;
            } else if (Number(validAccount.followersCount) >= 200) {
              await this.fetchTwitterPaginatedDataAbove200(
                validAccount.userId,
                msg.chat.id,
                validAccount.followersCount,
              );
              await this.notifyTwitter(
                validAccount.username,
                validAccount.userId,
                msg.chat.id,
              );
              return;
            }
            await this.fetchTwitterPaginatedData(
              validAccount.userId,
              msg.chat.id,
              validAccount.followersCount,
            );
            await this.notifyTwitter(
              validAccount.username,
              validAccount.userId,
              msg.chat.id,
            );
            return;
          }
          return;
        } else if (addMatch.platform === 'tiktok') {
          return;
        }
        return;
      } else if (msg.text.trim() === '/menu') {
        return await this.defaultMenu(msg.chat.id);
      }
    } catch (error) {
      console.log(error);
      return await this.xBot.sendMessage(
        msg.chat.id,
        'There was an error processing your message',
      );
    }
  };

  handleButtonCommands = async (
    query: TelegramBot.CallbackQuery,
  ): Promise<unknown> => {
    this.logger.debug(query);
    let command: string;

    // const username = `${query.from.username}`;
    const chatId = query.message.chat.id;

    // function to check if query.data is a json type
    function isJSON(str: string) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
    } else {
      command = query.data;
    }

    try {
      console.log(command);

      switch (command) {
        case '/menu':
          try {
            await this.xBot.sendChatAction(chatId, 'typing');
            return await this.defaultMenu(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/scanX':
          try {
            await this.xBot.sendChatAction(chatId, 'typing');
            return await this.twitterUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/close':
          await this.xBot.sendChatAction(query.message.chat.id, 'typing');
          return await this.xBot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        default:
          return await this.xBot.sendMessage(
            chatId,
            'There was an error processing your message',
          );
      }
    } catch (error) {
      console.log(error);
      return await this.xBot.sendMessage(
        chatId,
        'There was an error processing your message',
      );
    }
  };

  twitterUsernameInput = async (chatId: number) => {
    try {
      await this.xBot.sendMessage(chatId, '@username', {
        reply_markup: {
          force_reply: true,
        },
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  defaultMenu = async (chatId: number) => {
    try {
      const menu = await menuMarkup();
      const replyMarkup = {
        inline_keyboard: menu.keyboard,
      };
      return await this.xBot.sendMessage(chatId, menu.message, {
        reply_markup: replyMarkup,
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  validateTwitterAccount = async (username: string, chatId: number) => {
    await this.xBot.sendChatAction(chatId, 'typing');
    try {
      const userScanned = await this.AccountModel.findOne({
        username: username.toLowerCase(),
      });

      if (userScanned) {
        // const timeToScan =
        //   Number(userScanned.followersCount) >= 200
        //     ? Number(userScanned.followersCount) / 200
        //     : Number(userScanned.followersCount) / 70;

        await this.xBot.sendMessage(
          chatId,
          `SCanning Account <a href="https://x.com/${username}">@${username}</a>\n\n followers :${userScanned.followersCount}\nplease wait.........`,
        );
        return {
          username: userScanned.username,
          userId: userScanned.userId,
          followersCount: userScanned.followersCount,
          topFollowers: userScanned.topFollowers,
        };
      }
      // Fetch the valid Twitter account information
      const validAccount = await this.httpService.axiosRef.get(
        `https://twitter-api47.p.rapidapi.com/v2/user/by-username?username=${username}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      // If valid account data is returned
      if (validAccount.data.legacy.name) {
        // Prepare to save new account data
        // const saveTwitterUsername = new this.AccountModel({
        //   username: validAccount.data.legacy.screen_name,
        //   userId: validAccount.data.rest_id,
        //   followersCount: validAccount.data.legacy.followers_count,
        // });
        // // Use save method with error handling to prevent duplicates
        // await saveTwitterUsername.save();

        const saveTwitterUsername = await this.AccountModel.findOneAndUpdate(
          { userId: validAccount.data.rest_id }, // Find by userId
          {
            userId: validAccount.data.rest_id, // Ensure userId is always included
            username: validAccount.data.legacy.screen_name.toLowerCase(),
            followersCount: validAccount.data.legacy.followers_count,
          },
          { upsert: true, new: true }, // Create if not exists, return updated doc
        );

        // Only fetch paginated data if save is successful
        // await this.fetchTwitterPaginatedData(username);

        await this.xBot.sendMessage(
          chatId,
          `SCanning Account <a href="https://x.com/${username}">@${username}</a>\n\n followers :${saveTwitterUsername.followersCount}\nplease wait.........`,
        );
        return {
          username: saveTwitterUsername.username,
          userId: saveTwitterUsername.userId,
          followersCount: saveTwitterUsername.followersCount,
        };
      }
    } catch (error) {
      console.error('Error validating Twitter account:', error);
      return await this.xBot.sendMessage(
        chatId,
        `There was an error processing your action, please try again.`,
      );
    }
  };

  //   fetchTwitterPaginatedData = async (userId: string): Promise<void> => {
  //     try {
  //       // const params = cursor ? { cursor } : {};

  //       const response = await this.httpService.axiosRef.get(
  //         `https://twitter-api47.p.rapidapi.com/v2/user/followers-list?userId=${userId}&count=200`,
  //         {
  //           headers: {
  //             'Content-Type': 'application/json',
  //             'x-rapidapi-key': process.env.RAPID_API_KEY,
  //             'x-rapidapi-host': process.env.RAPID_HOST,
  //           },
  //         },
  //       );

  //       const { users } = response.data;
  //       const formattedUsers = users
  //         .filter((user) => Number(user.followers_count) >= 90000)
  //         .map((user) => ({
  //           followersCount: user.followers_count,
  //           username: user.screen_name,
  //         }));

  //       // Use findOneAndUpdate with error handling
  //       await this.AccountModel.updateOne(
  //         { userId: userId },
  //         {
  //           $push: {
  //             topFollowers: formattedUsers,
  //           },
  //         },
  //         { upsert: true },
  //       );

  //       console.log('Fetched items:', response.data);

  //       // if (users.length > 0 && next_cursor > 0) {
  //       //   // delay in milliseconds before fetching data

  //       //   await this.fetchTwitterPaginatedData(userId, next_cursor);
  //       // } else {
  //       //   console.log('No more items to fetch.');
  //       // }
  //     } catch (error) {
  //       console.error('Error fetching data:', error);
  //     }
  //   };

  //   fetchTwitterPaginatedData = async (userId: string): Promise<void> => {
  //     let nextCursor: string | null = null;
  //     const maxRequestsPerMinute = 60;
  //     const delayBetweenRequests = 1000; // 1 second per request
  //     let requestCount = 0;

  //     try {
  //       do {
  //         if (requestCount >= maxRequestsPerMinute) {
  //           console.log('Rate limit reached. Pausing for 60 seconds...');
  //           await new Promise((resolve) => setTimeout(resolve, 60000));
  //           requestCount = 0; // Reset request count
  //         }

  //         const response = await this.httpService.axiosRef.get(
  //           `https://twitter-api47.p.rapidapi.com/v2/user/followers-list`,
  //           {
  //             params: { userId, count: 200, cursor: nextCursor },
  //             headers: {
  //               'Content-Type': 'application/json',
  //               'x-rapidapi-key': process.env.RAPID_API_KEY,
  //               'x-rapidapi-host': process.env.RAPID_HOST,
  //             },
  //           },
  //         );

  //         const { users, next_cursor_str } = response.data;
  //         const formattedUsers = users
  //           .filter((user) => Number(user.followers_count) >= 90000)
  //           .map((user) => ({
  //             followersCount: user.followers_count,
  //             username: user.screen_name,
  //           }));

  //         await this.AccountModel.updateOne(
  //           { userId: userId },
  //           { $push: { topFollowers: { $each: formattedUsers } } },
  //           { upsert: true },
  //         );

  //         nextCursor = next_cursor_str !== '0' ? next_cursor_str : null;
  //         requestCount++;

  //         await new Promise((resolve) =>
  //           setTimeout(resolve, delayBetweenRequests),
  //         ); // Prevent exceeding rate limit
  //       } while (nextCursor);
  //     } catch (error: any) {
  //       if (error.response?.status === 429) {
  //         console.warn('Rate limited! Retrying in 60 seconds...');
  //         await new Promise((resolve) => setTimeout(resolve, 60000));
  //         await this.fetchTwitterPaginatedData(userId); // Retry after delay
  //       } else {
  //         console.error('Error fetching data:', error.message);
  //       }
  //     }
  //   };

  fetchTwitterPaginatedDataAbove200 = async (
    userId: string,
    chatId,
    followers_count,
  ): Promise<void> => {
    let nextCursor: string | null = null;
    const maxRequestsPerMinute = 60;
    const delayBetweenRequests = 1000; // 1 second per request
    let requestCount = 0;
    let scannedUser = 0;

    try {
      do {
        await this.xBot.sendChatAction(chatId, 'typing');
        if (requestCount >= maxRequestsPerMinute) {
          console.log('Rate limit reached. Pausing for 60 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          requestCount = 0; // Reset request count
        }

        const response = await this.httpService.axiosRef.get(
          `https://twitter-api47.p.rapidapi.com/v2/user/followers-list`,
          {
            params: { userId, count: 200, cursor: nextCursor },
            headers: {
              'Content-Type': 'application/json',
              'x-rapidapi-key': process.env.RAPID_API_KEY,
              'x-rapidapi-host': process.env.RAPID_HOST,
            },
          },
        );

        const { users, next_cursor_str } = response.data;

        const formattedUsers = users
          .filter((user) => Number(user.followers_count) >= 90000)
          .map((user) => ({
            followersCount: user.followers_count,
            username: user.screen_name,
          }));

        scannedUser += users.length;
        await this.AccountModel.updateOne(
          { userId: userId },
          {
            $addToSet: {
              topFollowers: { $each: formattedUsers }, // Prevents duplicates
            },
          },
          { upsert: true },
        );
        await this.xBot.sendMessage(
          chatId,
          `Scanned ${scannedUser} followers remaining ${Number(followers_count) - scannedUser}`,
        );

        nextCursor = next_cursor_str !== '0' ? next_cursor_str : null;
        requestCount++;

        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenRequests),
        ); // Prevent exceeding rate limit
      } while (nextCursor);
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn('Rate limited! Retrying in 60 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return this.fetchTwitterPaginatedDataAbove200(
          userId,
          chatId,
          followers_count,
        ); // Retry after delay
      } else {
        console.error('Error fetching data:', error.message);
      }
    }
  };

  fetchTwitterPaginatedData = async (
    userId: string,
    chatId,
    followers_count,
  ): Promise<void> => {
    let nextCursor: string | null = null;
    const maxRequestsPerMinute = 60;
    const delayBetweenRequests = 1000; // 1 second per request
    let requestCount = 0;
    let scannedUser = 0;

    try {
      console.log('hereeeeeee');
      do {
        await this.xBot.sendChatAction(chatId, 'typing');
        if (requestCount >= maxRequestsPerMinute) {
          console.log('Rate limit reached. Pausing for 60 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
          requestCount = 0; // Reset request count
        }

        const response = await this.httpService.axiosRef.get(
          `https://twitter-api47.p.rapidapi.com/v2/user/followers-list`,
          {
            params: { userId },
            headers: {
              'Content-Type': 'application/json',
              'x-rapidapi-key': process.env.RAPID_API_KEY,
              'x-rapidapi-host': process.env.RAPID_HOST,
            },
          },
        );

        const { users, next_cursor_str } = response.data;
        scannedUser += users.length;
        const formattedUsers = users
          .filter((user) => Number(user.followers_count) >= 90000)
          .map((user) => ({
            followersCount: user.followers_count,
            username: user.screen_name,
          }));

        await this.AccountModel.updateOne(
          { userId: userId },
          {
            $addToSet: {
              topFollowers: { $each: formattedUsers }, // Prevents duplicates
            },
          },
          { upsert: true },
        );

        await this.xBot.sendMessage(
          chatId,
          `Scanned ${scannedUser} followers remaining ${Number(followers_count) - scannedUser}`,
        );

        nextCursor = next_cursor_str !== '0' ? next_cursor_str : null;
        requestCount++;

        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenRequests),
        ); // Prevent exceeding rate limit
      } while (nextCursor);
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn('Rate limited! Retrying in 60 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return this.fetchTwitterPaginatedData(userId, chatId, followers_count); // Retry after delay
      } else {
        console.error('Error fetching data:', error.message);
      }
    }
  };

  notifyTwitter = async (username, userId, chatId) => {
    try {
      await this.xBot.sendChatAction(chatId, 'typing');
      const account = await this.AccountModel.findOne({ userId });
      if (account && account.topFollowers.length > 0) {
        const markUp = await followersMarkUp(account.topFollowers);
        const replyMarkup = {
          inline_keyboard: markUp.keyboard,
        };
        return await this.xBot.sendMessage(chatId, markUp.message, {
          reply_markup: replyMarkup,
          parse_mode: 'HTML',
        });
      }
      return await this.xBot.sendMessage(
        chatId,
        `<a href="https://x.com/${username}">@${username}</a> - has no user with 90k and above followers`,
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  // @Cron('*/30 * * * *')
  //   @Cron(`${process.env.CRON}`)
  //   async handleTwitterCron() {
  //     const jobRunning = await this.TwitterJobModel.find();
  //     if (jobRunning[0].isJobRunning) {
  //       // If a job is already running, exit early to prevent data pollution

  //       return;
  //     }

  //     // Set the flag to indicate the job is running
  //     await this.TwitterJobModel.updateOne(
  //       { _id: jobRunning[0]._id },
  //       { isJobRunning: true },
  //     );

  //     try {
  //       // Call your function to query new Twitter followers
  //       await this.queryNewTwitterFollowers();
  //     } catch (error) {
  //       // Handle any errors that may occur during execution
  //       console.error('Error in cron job:', error);
  //     } finally {
  //       // Reset the flag to indicate the job has completed
  //       await this.TwitterJobModel.updateOne(
  //         { _id: jobRunning[0]._id },
  //         { isJobRunning: false },
  //       );
  //     }
  //   }
}
