const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const { handleMessage } = require('./handlers');
const logger = require('./logger');
const fs = require('fs');

// Load configuration
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

// Initialize bot with your bot token, bot is used to talk to the Telegram API via Telegraf
const bot = new Telegraf(CONFIG.token);

/**
 * Handles incoming text messages
 * If the message violates rules, put the user in timeout and delete the message
 * Then notify the user about the timeout
 * @param {Telegraf.Context} ctx - The Telegraf context object
 */
bot.on(message('text'), async (ctx) => {
  try {
    // If the user has immunity, skip processing
    if (CONFIG.immunity.includes(ctx.update.message.from.username)) {
      return;
    }

    // Check message against rules
    const returnedArray = await handleMessage(ctx.update.message.text);
    if (returnedArray[0] === 'YES') {
      ctx.deleteMessage();

      // Set the permissions for the timeout
      const permissions = await getTimeoutPermissions();

      // Unix timestamp for the timeout in minute
      const timeoutMinutes = 15;
      const until_date = Math.floor(Date.now() / 1000) + timeoutMinutes * 60;

      await ctx.telegram.restrictChatMember(ctx.update.message.chat.id, ctx.update.message.from.id, {
        permissions: permissions,
        until_date: until_date
      });

      ctx.reply(
        `@${ctx.update.message.from.username} Sorry your post was removed, please see the chat rules. You are in a ${timeoutMinutes} minute timeout. Reason: ${returnedArray[1]}`
      );
      logger.info(`>>> User @${ctx.update.message.from.username} placed in timeout.`);
      logger.info(`>>> Message: ${ctx.update.message.text}`);
      logger.info(`>>> Reason: ${returnedArray[1]}`);
    }
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    logger.error(error.stack);
  }
});

async function getTimeoutPermissions() {
  return {
    can_send_messages: false,
    can_send_audios: false,
    can_send_documents: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false
  };
}

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
