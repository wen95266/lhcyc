/**
 * LotteryDB - 数据访问层 (Data Access Layer)
 * 
 * 职责：封装所有与 Cloudflare D1 数据库的底层交互。
 * 特点：
 * 1. 参数化查询，彻底杜绝 SQL 注入。
 * 2. INSERT OR IGNORE 实现幂等性同步。
 * 3. 完善的错误捕获与详细日志记录。
 */
export class LotteryDB {
    constructor(db) {
        if (!db) throw new Error("Database connection (D1) is missing.");
        this.db = db;
    }

    /**
     * 添加开奖记录 (同步用)
     */
    async addRecord(lotteryType, record) {
        const { expect, openTime, openCode, wave, zodiac } = record;
        const sql = 'INSERT OR IGNORE INTO lottery (lotteryType, expect, openTime, openCode, wave, zodiac) VALUES (?, ?, ?, ?, ?, ?)';
        try {
            return await this.db.prepare(sql).bind(lotteryType, expect, openTime, openCode, wave, zodiac).run();
        } catch (e) {
            console.error(`[DB Error] addRecord failed:`, e);
            throw e;
        }
    }

    /**
     * 获取开奖记录列表
     */
    async getRecords(lotteryType, limit = null) {
        let sql = 'SELECT * FROM lottery WHERE lotteryType = ? ORDER BY openTime DESC';
        const params = [lotteryType];

        if (typeof limit === 'number' && limit > 0) {
            sql += ' LIMIT ?';
            params.push(limit);
        }

        try {
            const { results } = await this.db.prepare(sql).bind(...params).all();
            return results || [];
        } catch (e) {
            console.error(`[DB Error] getRecords failed:`, e);
            throw e;
        }
    }

    /**
     * 删除单条记录
     */
    async deleteRecord(recordId) {
        try {
            return await this.db.prepare('DELETE FROM lottery WHERE id = ?').bind(Number(recordId)).run();
        } catch (e) {
            console.error(`[DB Error] deleteRecord failed:`, e);
            throw e;
        }
    }

    /**
     * 存储预测结果
     */
    async addPrediction(lotteryType, predictionData) {
        const sql = 'INSERT INTO predictions (lotteryType, predictionData) VALUES (?, ?)';
        try {
            // 存储前将对象序列化为 JSON 字符串
            return await this.db.prepare(sql).bind(lotteryType, JSON.stringify(predictionData)).run();
        } catch (e) {
            console.error(`[DB Error] addPrediction failed:`, e);
            throw e;
        }
    }

    /**
     * 获取最新的一条预测结果
     */
    async getLatestPrediction(lotteryType) {
        const sql = 'SELECT * FROM predictions WHERE lotteryType = ? ORDER BY createdAt DESC LIMIT 1';
        try {
            const result = await this.db.prepare(sql).bind(lotteryType).first();
            if (result && result.predictionData) {
                try {
                    result.predictionData = JSON.parse(result.predictionData);
                } catch (parseError) {
                    console.error("[DB Error] Failed to parse prediction JSON:", parseError);
                }
            }
            return result;
        } catch (e) {
            console.error(`[DB Error] getLatestPrediction failed:`, e);
            throw e;
        }
    }
}
