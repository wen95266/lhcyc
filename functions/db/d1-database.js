/**
 * LotteryDB - 数据访问层 (Data Access Layer)
 * 
 * 这个类封装了所有与 Cloudflare D1 数据库的交互逻辑，为上层应用提供了一套清晰、
 * 安全且健壮的数据操作接口。它负责处理所有 SQL 查询，并内置了详细的错误处理机制。
 */
export class LotteryDB {
    /**
     * @param {D1Database} db D1 数据库实例，由 Cloudflare Worker 环境提供。
     */
    constructor(db) {
        if (!db) {
            throw new Error("Database connection (D1) is required.");
        }
        this.db = db;
    }

    /**
     * 添加一条开奖记录。使用 INSERT OR IGNORE 避免重复插入，实现幂等性。
     * @param {string} lotteryType 彩票类型 (e.g., 'HK')。
     * @param {object} record 开奖记录对象。
     * @returns {Promise<D1Result>} D1 操作结果。
     */
    async addRecord(lotteryType, record) {
        const { expect, openTime, openCode, wave, zodiac } = record;
        const sql = 'INSERT OR IGNORE INTO lottery (lotteryType, expect, openTime, openCode, wave, zodiac) VALUES (?, ?, ?, ?, ?, ?)';
        try {
            const stmt = this.db.prepare(sql);
            return await stmt.bind(lotteryType, expect, openTime, openCode, wave, zodiac).run();
        } catch (e) {
            console.error(`DB Error: Failed to execute addRecord with SQL: ${sql}`, e);
            throw new Error(`Database operation failed: ${e.message}`);
        }
    }

    /**
     * 获取指定类型的开奖记录列表，按时间倒序排列。
     * @param {string} lotteryType 彩票类型。
     * @param {number|null} limit 限制返回的记录数量。
     * @returns {Promise<Array<object>>} 开奖记录数组。
     */
    async getRecords(lotteryType, limit = null) {
        let sql = 'SELECT * FROM lottery WHERE lotteryType = ? ORDER BY openTime DESC';
        const params = [lotteryType];

        if (typeof limit === 'number' && limit > 0) {
            sql += ' LIMIT ?';
            params.push(limit);
        }

        try {
            const stmt = this.db.prepare(sql);
            const { results } = await stmt.bind(...params).all();
            return results || [];
        } catch (e) {
            console.error(`DB Error: Failed to execute getRecords with SQL: ${sql}`, e);
            throw new Error(`Database operation failed: ${e.message}`);
        }
    }

    /**
     * 根据 ID 删除一条开奖记录。
     * @param {number|string} recordId 要删除的记录 ID。
     * @returns {Promise<D1Result>} D1 操作结果。
     */
    async deleteRecord(recordId) {
        const sql = 'DELETE FROM lottery WHERE id = ?';
        try {
            const stmt = this.db.prepare(sql);
            // 确保传入的是数字类型
            return await stmt.bind(Number(recordId)).run();
        } catch (e) {
            console.error(`DB Error: Failed to execute deleteRecord with SQL: ${sql}`, e);
            throw new Error(`Database operation failed: ${e.message}`);
        }
    }

    /**
     * 添加一条新的预测记录。
     * @param {string} lotteryType 彩票类型。
     * @param {object} predictionData 预测数据对象。
     * @returns {Promise<D1Result>} D1 操作结果。
     */
    async addPrediction(lotteryType, predictionData) {
        const sql = 'INSERT INTO predictions (lotteryType, predictionData) VALUES (?, ?)';
        try {
            const stmt = this.db.prepare(sql);
            // 将预测对象转换为 JSON 字符串进行存储
            return await stmt.bind(lotteryType, JSON.stringify(predictionData)).run();
        } catch (e) {
            console.error(`DB Error: Failed to execute addPrediction with SQL: ${sql}`, e);
            throw new Error(`Database operation failed: ${e.message}`);
        }
    }

    /**
     * 获取指定类型的最新一条预测记录。
     * @param {string} lotteryType 彩票类型。
     * @returns {Promise<object|null>} 最新的预测记录，如果找不到则返回 null。
     */
    async getLatestPrediction(lotteryType) {
        const sql = 'SELECT * FROM predictions WHERE lotteryType = ? ORDER BY createdAt DESC LIMIT 1';
        try {
            const stmt = this.db.prepare(sql);
            const result = await stmt.bind(lotteryType).first();

            // 如果找到了记录，并且 predictionData 是一个 JSON 字符串，就安全地解析它
            if (result && typeof result.predictionData === 'string') {
                try {
                    result.predictionData = JSON.parse(result.predictionData);
                } catch (parseError) {
                    console.error(`DB Parse Error: Failed to parse predictionData JSON for record ID ${result.id}:`, parseError);
                    // 返回记录，但 predictionData 可能是无效的
                    result.predictionData = { error: "Invalid JSON format in database" }; 
                }
            }
            return result;
        } catch (e) {
            console.error(`DB Error: Failed to execute getLatestPrediction with SQL: ${sql}`, e);
            throw new Error(`Database operation failed: ${e.message}`);
        }
    }
}
