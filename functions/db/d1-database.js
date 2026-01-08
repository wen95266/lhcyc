
export class LotteryDB {
  constructor(db) {
    this.db = db;
  }

  async addRecord(lotteryType, record) {
    const { expect, openTime, openCode, wave, zodiac } = record;
    const stmt = this.db.prepare(
      'INSERT INTO lottery (lotteryType, expect, openTime, openCode, wave, zodiac) VALUES (?, ?, ?, ?, ?, ?)'
    );
    await stmt.bind(lotteryType, expect, openTime, openCode, wave, zodiac).run();
  }

  async getRecords(lotteryType) {
    const stmt = this.db.prepare(
      'SELECT * FROM lottery WHERE lotteryType = ? ORDER BY openTime DESC'
    );
    const { results } = await stmt.bind(lotteryType).all();
    return results;
  }

  async deleteRecord(recordId) {
    const stmt = this.db.prepare('DELETE FROM lottery WHERE id = ?');
    await stmt.bind(recordId).run();
  }
}
