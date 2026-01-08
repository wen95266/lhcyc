import { LotteryDB } from '../db/d1-database.js';

export const onRequestGet = async ({ request, env }) => {
  const db = new LotteryDB(env.DB);
  const url = new URL(request.url);
  const lotteryType = url.searchParams.get('type');

  if (!lotteryType) {
    return new Response(JSON.stringify({ error: 'Lottery type must be provided via ?type=TYPE' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 修正：调用数据库中已存在的 getRecords 方法
    const records = await db.getRecords(lotteryType);
    return new Response(JSON.stringify(records), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};