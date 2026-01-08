export const onRequest = (context) => {
  // Attach D1 database instance to the request context
  context.env.DB = context.env.DB;

  // Attach environment variables to the request context
  context.env.LOTTERY_URLS = context.env.LOTTERY_URLS;
  context.env.TELEGRAM_BOT_TOKEN = context.env.TELEGRAM_BOT_TOKEN;
  context.env.TELEGRAM_ADMIN_ID = context.env.TELEGRAM_ADMIN_ID;

  return context.next();
};
