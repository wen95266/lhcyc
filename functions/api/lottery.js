
import { LotteryDB } from '../db/d1-database';
import { generatePrediction } from '../logic/prediction';

export async function onRequest(context) {
  const { env, params } = context;
  const lotteryType = params.type;
  const db = new LotteryDB(env.DB);
  const records = await db.getRecords(lotteryType);
  const prediction = generatePrediction(records);

  return new Response(JSON.stringify(prediction), {
    headers: { 'Content-Type': 'application/json' },
  });
}
