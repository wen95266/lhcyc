/**
 * 彩票预测核心逻辑模块
 * 
 * 本模块基于历史开奖数据的频率分析，生成下一期的预测建议。它遵循关注点分离原则，
 * 将数据解析、频率计算和预测生成分离开来，以提高代码的可读性、可维护性和健壮性。
 */

// =================================================================================
// 1. 辅助与工具函数
// =================================================================================

/**
 * 通用频率计数器。
 * 接受一个项目数组，返回一个包含每个项目出现频率的 Map。
 * @param {Array<T>} items - 要进行频率统计的数组 (T 可以是 string, number 等)。
 * @returns {Map<T, number>} 一个包含 { item => frequency } 的 Map。
 * @template T
 */
const getFrequencyMap = (items) => {
    const frequency = new Map();
    for (const item of items) {
        frequency.set(item, (frequency.get(item) || 0) + 1);
    }
    return frequency;
};

/**
 * 数据预处理器。
 * 从原始数据库记录中提取、清洗并组织数据，为后续的预测分析做准备。
 * @param {Array<object>} records - 原始开奖记录数组。
 * @returns {{allNumbers: Array<number>, allZodiacs: Array<string>, allWaves: Array<string>}} - 包含所有数字、生肖和波色的对象。
 */
const parseRecords = (records) => {
    const allNumbers = [];
    const allZodiacs = [];
    const allWaves = [];

    for (const record of records) {
        if (record.openCode) {
            const numbers = record.openCode.match(/\d+/g) || [];
            allNumbers.push(...numbers.map(n => parseInt(n, 10)));
        }
        if (record.zodiac) {
            allZodiacs.push(...record.zodiac.split(',').map(z => z.trim()));
        }
        if (record.wave) {
            allWaves.push(record.wave);
        }
    }
    return { allNumbers, allZodiacs, allWaves };
};

/**
 * 创建一个空的预测结果对象，用于数据不足时返回。
 */
const createEmptyPrediction = () => ({
    sixZodiacs: [],
    eighteenNumbers: [],
    mainWave: 'N/A',
    defenseWave: 'N/A',
    twoHeads: [],
    fiveTails: [],
    error: '数据不足，无法生成预测'
});

// =================================================================================
// 2. 核心分析函数
// =================================================================================

/**
 * 预测出现频率最高的项目 (通用)。
 * @param {Array<string|number>} items - 要分析的数据数组。
 * @param {number} count - 需要返回的项的数量。
 * @param {Array<string>} [universe=null] - (可选) 所有可能的项的集合，用于确保即使某项未出现，也参与排序。
 * @returns {Array<string|number>} 按频率降序排列的前 N 个项。
 */
function predictTopItems(items, count, universe = null) {
    if (!items || items.length === 0) return [];
    
    const frequency = getFrequencyMap(items);

    // 如果提供了“universe”，确保所有可能的项都存在于频率图中，即使频率为0
    if (universe) {
        for (const item of universe) {
            if (!frequency.has(item)) {
                frequency.set(item, 0);
            }
        }
    }

    return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1]) // 按频率降序排序
        .slice(0, count)
        .map(entry => entry[0]);
}

/**
 * 预测头数或尾数。
 * @param {Array<number>} numbers - 要分析的数字数组。
 * @param {'head'|'tail'} type - 分析类型: 'head' (十位数) 或 'tail' (个位数)。
 * @param {number} count - 需要返回的数量。
 * @returns {Array<number>} 按频率降序排列的前 N 个头数或尾数。
 */
function predictHeadTails(numbers, type, count) {
    if (!numbers || numbers.length === 0) return [];

    const derived = numbers.map(n => (type === 'head' ? Math.floor(n / 10) : n % 10));
    
    // 数字 0-9 构成“universe”
    const universe = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    return predictTopItems(derived, count, universe);
}

// =================================================================================
// 3. 主预测函数 (导出)
// =================================================================================

/**
 * 根据历史记录生成完整的预测报告。
 * @param {Array<object>} records - 历史开奖记录数组。
 * @returns {object} 包含所有预测结果的综合对象。
 */
export function generatePrediction(records) {
    if (!records || records.length === 0) {
        return createEmptyPrediction();
    }

    // 1. 数据准备
    const { allNumbers, allZodiacs, allWaves } = parseRecords(records);

    // 2. 定义常量 (所有可能的取值范围)
    const ALL_ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    const ALL_WAVES = ['红波', '蓝波', '绿波'];

    // 3. 执行各项分析
    const zodiacPrediction = predictTopItems(allZodiacs, 6, ALL_ZODIACS);
    const numberPrediction = predictTopItems(allNumbers, 18);
    const wavePrediction = predictTopItems(allWaves, 2, ALL_WAVES);
    const headPrediction = predictHeadTails(allNumbers, 'head', 2);
    const tailPrediction = predictHeadTails(allNumbers, 'tail', 5);

    // 4. 组装并返回最终结果
    return {
        sixZodiacs: zodiacPrediction,
        eighteenNumbers: numberPrediction.sort((a, b) => a - b), // 数值排序
        mainWave: wavePrediction[0] || 'N/A',
        defenseWave: wavePrediction[1] || 'N/A',
        twoHeads: headPrediction.sort((a, b) => a - b),
        fiveTails: tailPrediction.sort((a, b) => a - b),
    };
}
