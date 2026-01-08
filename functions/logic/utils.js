import { LOTTERY_CONFIG } from './constants.js';

/**
 * 根据特码数字推导出生肖
 * @param {number} number - 特码数字
 * @returns {string | null} 对应的生肖名称，如果找不到则返回 null
 */
export function getZodiac(number) {
    for (const zodiac in LOTTERY_CONFIG.ZODIAC_MAP) {
        if (LOTTERY_CONFIG.ZODIAC_MAP[zodiac].includes(number)) {
            return zodiac;
        }
    }
    return null; // 如果数字超出范围
}

/**
 * 根据特码数字推导出波色
 * @param {number} number - 特码数字
 * @returns {string | null} 对应的中文波色名称（例如 '红波'），如果找不到则返回 null
 */
export function getWave(number) {
    for (const color in LOTTERY_CONFIG.COLORS) {
        if (LOTTERY_CONFIG.COLORS[color].includes(number)) {
            return LOTTERY_CONFIG.WAVE_MAP[color];
        }
    }
    return null; // 如果数字超出范围
}

/**
 * 从开奖号码字符串中提取特码（最后一个数字）
 * @param {string} openCode - 例如 "06,18,30,42,05,17+02"
 * @returns {number | null} 特码数字，如果格式不正确则返回 null
 */
export function getSpecialNumber(openCode) {
    if (typeof openCode !== 'string') return null;
    
    const parts = openCode.split('+');
    if (parts.length < 2) return null;
    
    const specialNumberStr = parts[1].trim();
    const specialNumber = parseInt(specialNumberStr, 10);

    return isNaN(specialNumber) ? null : specialNumber;
}
