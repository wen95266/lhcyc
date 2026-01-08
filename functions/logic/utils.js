/**
 * 核心工具函数库 (Unified Constants & Utilities)
 *
 * 这个模块是整个应用中所有核心静态数据和纯工具函数的唯一来源。
 * 它包含了彩票相关的常量定义、预计算的映射表以及高效的数据转换和查找函数。
 */

// =================================================================================
// 1. 静态常量定义
// =================================================================================

export const ALL_ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
export const ALL_NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

export const ZODIAC_NUMBER_MAP = {
    "鼠": [6, 18, 30, 42], "牛": [5, 17, 29, 41], "虎": [4, 16, 28, 40],
    "兔": [3, 15, 27, 39], "龙": [2, 14, 26, 38], "蛇": [1, 13, 25, 37, 49],
    "马": [12, 24, 36, 48], "羊": [11, 23, 35, 47], "猴": [10, 22, 34, 46],
    "鸡": [9, 21, 33, 45], "狗": [8, 20, 32, 44], "猪": [7, 19, 31, 43]
};

export const COLOR_NUMBER_MAP = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

export const WAVE_TRANSLATION_MAP = { 
    red: '红波', blue: '蓝波', green: '绿波',
    '红': '红波', '蓝': '蓝波', '绿': '绿波' // 兼容中文输入
};
export const ALL_WAVES = Object.values(WAVE_TRANSLATION_MAP).filter((value, index, self) => self.indexOf(value) === index);

// =================================================================================
// 2. 预计算的反向映射表 (提高查找效率)
// =================================================================================

export const NUMBER_TO_ZODIAC_MAP = new Map();
for (const zodiac in ZODIAC_NUMBER_MAP) {
    for (const num of ZODIAC_NUMBER_MAP[zodiac]) {
        NUMBER_TO_ZODIAC_MAP.set(num, zodiac);
    }
}

export const NUMBER_TO_COLOR_MAP = new Map();
for (const color in COLOR_NUMBER_MAP) {
    for (const num of COLOR_NUMBER_MAP[color]) {
        NUMBER_TO_COLOR_MAP.set(num, WAVE_TRANSLATION_MAP[color]); // 直接映射到中文波色
    }
}

// =================================================================================
// 3. 导出的工具函数
// =================================================================================

/**
 * 根据数字获取其对应的生肖。
 * @param {number} num - 需要查询的数字 (1-49)。
 * @returns {string | null} 对应的生肖名称，如果数字无效则返回 null。
 */
export function getZodiac(num) {
    if (typeof num !== 'number' || num < 1 || num > 49) return null;
    return NUMBER_TO_ZODIAC_MAP.get(num) || null;
}

/**
 * 根据数字获取其对应的波色。
 * @param {number} num - 需要查询的数字 (1-49)。
 * @returns {string | null} 对应的中文波色名称 (e.g., '红波')，如果数字无效则返回 null。
 */
export function getWave(num) {
    if (typeof num !== 'number' || num < 1 || num > 49) return null;
    return NUMBER_TO_COLOR_MAP.get(num) || null;
}

/**
 * 从开奖号码字符串中安全地提取特码（最后一个数字）。
 * @param {string} openCode - 开奖号码字符串 (e.g., "06,18,30,42,05,17+02")。
 * @returns {number | null} 提取出的特码数字，如果格式不正确或无效则返回 null。
 */
export function getSpecialNumber(openCode) {
    if (typeof openCode !== 'string') return null;
    
    const parts = openCode.split('+');
    if (parts.length < 2) return null;
    
    const specialNumberStr = parts[1].trim();
    const specialNumber = parseInt(specialNumberStr, 10);

    return isNaN(specialNumber) ? null : specialNumber;
}
