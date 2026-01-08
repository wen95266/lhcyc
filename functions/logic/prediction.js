/**
 * =================================================================================
 * 高级彩票预测引擎 V2.1 (Refactored & Patched)
 * =================================================================================
 * 变更日志:
 * - V2.1: 移除了所有本地常量定义，改为从 `utils.js` 导入，确保数据源统一。
 * - V2.1: 修复了 Cloudflare Pages 构建失败的问题，将 `??` 运算符替换为兼容性更好的三元表达式。
 * =================================================================================
 */

import {
    ALL_ZODIACS,
    ZODIAC_NUMBER_MAP,
    getZodiac
} from './utils.js';

/**
 * 主函数：生成增强型预测报告
 * @param {Array<object>} records - 历史开奖记录 (最新一期在最前面)
 * @returns {object} - 一个包含多种策略预测结果的结构化对象
 */
export function generatePrediction(records) {
    if (!records || records.length < 20) {
        return { error: "历史数据不足 (需要至少20期) 以进行高级分析。" };
    }

    const parsedRecords = records.map(parseRecord).filter(r => r.specialZodiac).reverse(); // 从旧到新排序，并过滤掉无效记录
    if (parsedRecords.length < 20) {
        return { error: "有效历史数据不足 (需要至少20期含生肖的记录)。" };
    }
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
            combinedZodiacs: recommendations.slice(0, 6),
            combinedNumbers: generateNumbersFromZodiacs(recommendations.slice(0, 8), ZODIAC_NUMBER_MAP), 
        },
        analysisDetails: {
            hotZodiacs: hotCold.hotZodiacs.slice(0, 6),  // 最热的生肖
            coldZodiacs: hotCold.coldZodiacs.slice(0, 6), // 最冷的生肖
            mostOverdueZodiacs: omissions.zodiacs.mostOverdue.slice(0, 6), // 最久未出的生肖
            transitionFromLast: `上期 [${latestRecord.specialZodiac}] 后最可能出现: ${transitionPrediction.next.slice(0, 3).join(', ')}`,
        }
    };
}

// =================================================================================
// 辅助函数和分析模块
// =================================================================================

function parseRecord(record) {
    const allNumbers = (record.openCode.match(/\d+/g) || []).map(Number);
    const specialNumber = allNumbers.length > 0 ? allNumbers[allNumbers.length - 1] : null;
    
    // 从包含多个生肖的字符串中，永远只取最后一个作为特码生肖
    const zodiacs = record.zodiac ? record.zodiac.split(',').map(z => z.trim()) : [];
    const specialZodiac = zodiacs.length > 0 ? zodiacs[zodiacs.length - 1] : (specialNumber ? getZodiac(specialNumber) : null);
    
    return { ...record, allNumbers, specialNumber, zodiacs, specialZodiac };
}

function analyzeHotCold(records, period) {
    const recentRecords = records.slice(-period);
    const allRecentZodiacs = recentRecords.flatMap(r => r.zodiacs.filter(z => ALL_ZODIACS.includes(z))); // 确保只统计有效生肖
    
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
    // 我们只关心特码生肖的遗漏
    records.forEach((record, index) => {
        if (record.specialZodiac) {
            lastSeen[record.specialZodiac] = index;
        }
    });

    const omissions = ALL_ZODIACS.map(z => ({
        item: z,
        // 修复：使用三元运算符替换 `??` 以确保兼容性
        gap: records.length - 1 - (typeof lastSeen[z] !== 'undefined' ? lastSeen[z] : -1)
    }));

    const sortedOmissions = omissions.sort((a, b) => b.gap - a.gap);
    return { zodiacs: { mostOverdue: sortedOmissions.map(o => o.item) } };
}

function combineStrategies(strats) {
    const scores = new Map();
    strats.hot.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 1.2));
    strats.cold.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 0.8));
    strats.transition.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 1.5));
    strats.omission.forEach((z, i) => scores.set(z, (scores.get(z) || 0) + (4 - i) * 1.0));

    return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

function generateNumbersFromZodiacs(zodiacs, map) {
    const numbers = zodiacs.flatMap(z => map[z] || []);
    return [...new Set(numbers)].sort((a, b) => a - b).slice(0, 18);
}
