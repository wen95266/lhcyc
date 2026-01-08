
export class LotteryDB {
  constructor(db) {
    this.db = db;
  }

  // --- 开奖记录相关 ---

  async addRecord(lotteryType, record) {
    const { expect, openTime, openCode, wave, zodiac } = record;
    const stmt = this.db.prepare(
      'INSERT INTO lottery (lotteryType, expect, openTime, openCode, wave, zodiac) VALUES (?, ?, ?, ?, ?, ?)'
    );
    await stmt.bind(lotteryType, expect, openTime, openCode, wave, zodiac).run();
  }

  async getRecords(lotteryType, limit = null) {
    let query = 'SELECT * FROM lottery WHERE lotteryType = ? ORDER BY openTime DESC';
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    const stmt = this.db.prepare(query);
    const { results } = await stmt.bind(lotteryType).all();
    return results;
  }

  async deleteRecord(recordId) {
    const stmt = this.db.prepare('DELETE FROM lottery WHERE id = ?');
    await stmt.bind(recordId).run();
  }

  // --- 预测记录相关 ---

  async addPrediction(lotteryType, predictionData) {
    const stmt = this.db.prepare(
      'INSERT INTO predictions (lotteryType, predictionData) VALUES (?, ?)'
    );
    // 将预测对象转换为 JSON 字符串进行存储
    await stmt.bind(lotteryType, JSON.stringify(predictionData)).run();
  }

  async getLatestPrediction(lotteryType) {
    const stmt = this.db.prepare(
      'SELECT * FROM predictions WHERE lotteryType = ? ORDER BY createdAt DESC LIMIT 1'
    );
    const result = await stmt.bind(lotteryType).first();
    
    // 如果找到了记录，并且 predictionData 是一个字符串，就解析它
    if (result && typeof result.predictionData === 'string') {
      try {
        result.predictionData = JSON.parse(result.predictionData);
      } catch (e) {
        console.error("Failed to parse predictionData JSON:", e);
        return null; // or handle the error imóvel
      }
    }
    return result;
  }
}
