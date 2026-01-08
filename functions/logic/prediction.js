/**
 * 彩票预测逻辑模块
 * 
 * 本模块基于历史数据进行统计分析，生成下一期的预测建议。
 * 预测内容包括：生肖、数字、波色、头数和尾数。
 */

// 定义所有生肖和波色
const ALL_ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const ALL_WAVES = ['红波', '蓝波', '绿波'];

/**
 * 主函数：根据历史记录生成预测
 * @param {Array<object>} records - 历史开奖记录数组
 * @returns {object} 包含各项预测结果的对象
 */
export function generatePrediction(records) {
    if (!records || records.length === 0) {
        return createEmptyPrediction();
    }

    // 1. 从所有记录中提取数字、生肖和波色
    const allNumbers = [];
    const allZodiacs = [];
    const allWaves = [];

    records.forEach(record => {
        // 提取所有开奖号码（包括主码和特码）
        if (record.openCode) {
            const numbers = record.openCode.match(/\d+/g) || [];
            allNumbers.push(...numbers.map(n => parseInt(n, 10)));
        }
        // 提取生肖（可能是多个）
        if (record.zodiac) {
            allZodiacs.push(...record.zodiac.split(',').map(z => z.trim()));
        }
        // 提取波色
        if (record.wave) {
            allWaves.push(record.wave);
        }
    });

    // 2. 执行各项分析
    const zodiacPrediction = predictItems(allZodiacs, 6, ALL_ZODIACS);
    const numberPrediction = predictItems(allNumbers, 18);
    const wavePrediction = predictItems(allWaves, 2, ALL_WAVES);
    const headPrediction = predictHeadTails(allNumbers, 'head', 2);
    const tailPrediction = predictHeadTails(allNumbers, 'tail', 5);

    // 3. 组装并返回结果
    return {
        sixZodiacs: zodiacPrediction,       // 六肖
        eighteenNumbers: numberPrediction.sort((a,b) => a-b), // 18码 (排序)
        mainWave: wavePrediction[0] || 'N/A', // 主攻波色
        defenseWave: wavePrediction[1] || 'N/A',// 防守波色
        twoHeads: headPrediction,           // 两个头数
        fiveTails: tailPrediction,            // 五个尾数
    };
}

/**
 * 辅助函数：创建一个空的预测对象
 */
function createEmptyPrediction() {
    return {
        sixZodiacs: [],
        eighteenNumbers: [],
        mainWave: 'N/A',
        defenseWave: 'N/A',
        twoHeads: [],
        fiveTails: [],
        error: '数据不足，无法生成预测'
    };
}

/**
 * 通用频率分析函数
 * @param {Array<string|number>} items - 要分析的项的数组 (例如: ['猴', '鸡', '猴'])
 * @param {number} count - 需要返回的项的数量
 * @param {Array<string>} [allItems=null] - (可选) 所有可能的项，用于补全未出现的项
 * @returns {Array<string|number>} 按频率降序排列的前N个项
 */
function predictItems(items, count, allItems = null) {
    if (items.length === 0) return [];
    
    const frequency = new Map();
    
    // 如果提供了所有可能项，则初始化频率为0
    if(allItems) {
        allItems.forEach(item => frequency.set(item, 0));
    }

    // 统计频率
    items.forEach(item => {
        frequency.set(item, (frequency.get(item) || 0) + 1);
    });

    // 排序并返回前N个
    return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(entry => entry[0]);
}

/**
 * 头数/尾数频率分析函数
 * @param {Array<number>} numbers - 要分析的数字数组
 * @param {'head'|'tail'} type - 分析类型 ('head' 或 'tail')
 * @param {number} count - 需要返回的数量
 * @returns {Array<number>} 按频率降序排列的前N个头数/尾数
 */
function predictHeadTails(numbers, type, count) {
    if (numbers.length === 0) return [];

    const derivedNumbers = numbers.map(n => {
        if (type === 'head') {
            return Math.floor(n / 10); // 获取头数 (十位)
        } else { // tail
            return n % 10; // 获取尾数 (个位)
        }
    });

    const frequency = new Map();
    for (let i = 0; i < 10; i++) frequency.set(i, 0); // 初始化0-9的频率

    derivedNumbers.forEach(n => {
        frequency.set(n, (frequency.get(n) || 0) + 1);
    });

    return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(entry => entry[0]);
}
