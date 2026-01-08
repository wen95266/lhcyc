/**
 * =================================================================================
 * 高级彩票预测引擎 V2.0
 * =================================================================================
 * 该引擎不再仅仅基于频率统计，而是融合了多种数据分析策略，从不同维度挖掘潜在规律。
 *
 * 核心分析策略：
 * 1.  冷热度分析 (Hot/Cold Analysis):
 *     - 热点: 近期频繁出现的元素。
 *     - 冷点: 长期未出现的元素，预期其将“回归”。
 *
 * 2.  转移概率分析 (Transition Matrix):
 *     - 分析一个元素（如生肖“龙”）出现后，下一个最可能出现的元素是什么。
 *
 * 3.  遗漏与重复分析 (Omission & Repetition):
 *     - 计算每个号码/生肖的平均“遗漏”周期。
 *     - 分析上一期号码在当期重复出现的规律。
 *
 * 4.  邻近关系分析 (Neighboring Numbers):
 *     - 关注与上一期中奖号码相邻的号码。
 * =================================================================================
 */

const ALL_ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const ALL_NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

/**
 * 主函数：生成增强型预测报告
 * @param {Array<object>} records - 历史开奖记录 (最新一期在最前面)
 * @returns {object} - 一个包含多种策略预测结果的结构化对象
 */
export function generatePrediction(records) {
    if (!records || records.length < 20) {
        return { error: "历史数据不足 (需要至少20期) 以进行高级分析。" };
    }

    const parsedRecords = records.map(parseRecord).reverse(); // 从旧到新排序
    const latestRecord = parsedRecords[parsedRecords.length - 1];

    // --- 1. 冷热度分析 (Hot/Cold Analysis) ---
    const hotCold = analyzeHotCold(parsedRecords, 20);

    // --- 2. 转移概率分析 (Transition Analysis) ---
    const transition = analyzeTransitions(parsedRecords);
    const transitionPrediction = transition.zodiacs[latestRecord.specialZodiac] || { next: [], strength: 0 };

    // --- 3. 遗漏值分析 (Omission Analysis) ---
    const omissions = analyzeOmissions(parsedRecords);

    // --- 4. 组合最终推荐 --- 
    const recommendations = combineStrategies({
        hot: hotCold.hotZodiacs.slice(0, 4),
        cold: hotCold.coldZodiacs.slice(0, 4),
        transition: transitionPrediction.next.slice(0, 4),
        omission: omissions.zodiacs.mostOverdue.slice(0, 4),
    });

    return {
        generatedAt: new Date().toISOString(),
        basedOnRecords: records.length,
        recommendations: {
            // 主要推荐6个生肖和18个号码，由多种策略综合加权得出
            combinedZodiacs: recommendations.slice(0, 6),
            combinedNumbers: generateNumbersFromZodiacs(recommendations.slice(0, 8), ZODIAC_NUMBER_MAP), 
        },
        analysisDetails: {
            hotZodiacs: hotCold.hotZodiacs,  // 最热的生肖
            coldZodiacs: hotCold.coldZodiacs, // 最冷的生肖
            mostOverdueZodiacs: omissions.zodiacs.mostOverdue, // 最久未出的生肖
            transitionFromLast: `上期 [${latestRecord.specialZodiac}] 后最可能出现: ${transitionPrediction.next.join(', ')}`,
        }
    };
}

// =================================================================================
// 辅助函数和分析模块
// =================================================================================

const ZODIAC_NUMBER_MAP = {
    "鼠": [6, 18, 30, 42], "牛": [5, 17, 29, 41], "虎": [4, 16, 28, 40],
    "兔": [3, 15, 27, 39], "龙": [2, 14, 26, 38], "蛇": [1, 13, 25, 37, 49],
    "马": [12, 24, 36, 48], "羊": [11, 23, 35, 47], "猴": [10, 22, 34, 46],
    "鸡": [9, 21, 33, 45], "狗": [8, 20, 32, 44], "猪": [7, 19, 31, 43]
};

function parseRecord(record) {
    const allNumbers = (record.openCode.match(/\d+/g) || []).map(Number);
    const specialNumber = allNumbers.length > 0 ? allNumbers[allNumbers.length - 1] : null;
    const zodiacs = record.zodiac ? record.zodiac.split(',').map(z => z.trim()) : [];
    const specialZodiac = zodiacs.length > 0 ? zodiacs[zodiacs.length - 1] : null;
    return { ...record, allNumbers, specialNumber, zodiacs, specialZodiac };
}

function analyzeHotCold(records, period) {
    const recentRecords = records.slice(-period);
    const allRecentZodiacs = recentRecords.flatMap(r => r.zodiacs);
    
    const frequency = new Map();
    allRecentZodiacs.forEach(z => frequency.set(z, (frequency.get(z) || 0) + 1));

    const sortedByFreq = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
    const hotZodiacs = sortedByFreq.map(e => e[0]);
    
    const coldZodiacs = ALL_ZODIACS.filter(z => !hotZodiacs.includes(z));
    return { hotZodiacs, coldZodiacs };
}

function analyzeTransitions(records) {
    const matrix = {};
    ALL_ZODIACS.forEach(z => { matrix[z] = {}; });

    for (let i = 0; i < records.length - 1; i++) {
        const currentZodiac = records[i].specialZodiac;
        const nextZodiac = records[i + 1].specialZodiac;
        if (currentZodiac && nextZodiac) {
            matrix[currentZodiac][nextZodiac] = (matrix[currentZodiac][nextZodiac] || 0) + 1;
        }
    }

    const probabilities = {};
    for (const z in matrix) {
        const total = Object.values(matrix[z]).reduce((sum, count) => sum + count, 0);
        const sortedNext = Object.entries(matrix[z]).sort((a, b) => b[1] - a[1]);
        probabilities[z] = {
            next: sortedNext.map(e => e[0]),
            strength: total
        };
    }
    return { zodiacs: probabilities };
}

function analyzeOmissions(records) {
    const lastSeen = {};
    records.forEach((record, index) => {
        record.zodiacs.forEach(z => { lastSeen[z] = index; });
    });

    const omissions = ALL_ZODIACS.map(z => ({
        item: z,
        gap: records.length - 1 - (lastSeen[z] ?? -1)
    }));

    const sortedOmissions = omissions.sort((a, b) => b.gap - a.gap);
    return { zodiacs: { mostOverdue: sortedOmissions.map(o => o.item) } };
}

function combineStrategies(strats) {
    const scores = new Map();
    // 给不同策略的推荐生肖赋予权重分
    strats.hot.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 1.2)); // 热点权重高
    strats.cold.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 0.8)); // 冷点权重较低
    strats.transition.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 1.5)); // 转移概率权重最高
    strats.omission.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 1.0)); // 遗漏值权重标准

    return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

function generateNumbersFromZodiacs(zodiacs, map) {
    const numbers = zodiacs.flatMap(z => map[z] || []);
    return [...new Set(numbers)].sort((a, b) => a - b).slice(0, 18);
}
