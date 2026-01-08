document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取所有需要的 DOM 元素
    const latestResultContent = document.getElementById('latest-result-content');
    const predictionResultContent = document.getElementById('prediction-result-content');
    const historyRecordsContent = document.getElementById('history-records-content');
    const historySection = document.getElementById('history-records');
    const toggleHistoryBtn = document.getElementById('toggle-history-btn');
    const lotteryNav = document.getElementById('lottery-nav');

    // 2. 从 URL 获取彩票类型，并设置默认值
    const params = new URLSearchParams(window.location.search);
    const lotteryType = params.get('type') || 'HK';

    // 3. 更新导航栏高亮状态
    updateActiveNav(lotteryType, lotteryNav);

    // 4. 并行获取开奖数据和预测数据
    fetchData(lotteryType);

    // 5. 为切换按钮绑定事件
    if (toggleHistoryBtn) {
        toggleHistoryBtn.addEventListener('click', () => {
            const isHidden = historySection.classList.toggle('hidden');
            toggleHistoryBtn.textContent = isHidden ? '查看历史记录' : '收起历史记录';
        });
    }

    // 6. 注册 Service Worker 并在有更新时提示用户
    registerServiceWorker();

    /**
     * 注册 Service Worker 并处理更新逻辑
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(reg => {
                    console.log('SW registered!', reg);

                    // 如果检测到有新的 SW 正在等待激活
                    if (reg.waiting) {
                        showUpdatePrompt(reg.waiting);
                    }

                    // 监听新的 SW 安装过程
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdatePrompt(newWorker);
                            }
                        });
                    });
                });

                // 处理刷新逻辑
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return;
                    refreshing = true;
                    window.location.reload();
                });
            });
        }
    }

    /**
     * 显示更新提示框
     */
    function showUpdatePrompt(worker) {
        const prompt = document.createElement('div');
        prompt.className = 'update-prompt';
        prompt.innerHTML = `
            <div class="update-prompt-content">
                <span>发现新版本，是否立即更新？</span>
                <button id="update-confirm-btn">立即更新</button>
            </div>
        `;
        document.body.appendChild(prompt);

        document.getElementById('update-confirm-btn').addEventListener('click', () => {
            worker.postMessage('SKIP_WAITING');
            prompt.remove();
        });
    }

    /**
     * 主函数：并行获取所有数据并触发渲染
     */
    function fetchData(type) {
        // 显示加载状态
        latestResultContent.innerHTML = '<p class="loading-placeholder">正在加载最新开奖...</p>';
        predictionResultContent.innerHTML = '<p class="loading-placeholder">正在加载预测...</p>';
        historyRecordsContent.innerHTML = '<p class="loading-placeholder">正在加载历史记录...</p>';

        Promise.all([
            fetch(`/api/data?type=${type}`),
            fetch(`/api/predictions?type=${type}`)
        ]).then(async ([recordsRes, predictionRes]) => {
            // 开奖记录处理
            if (recordsRes.ok) {
                const records = await recordsRes.json();
                if (records.length > 0) {
                    renderLatestResult(records[0], latestResultContent);
                    renderHistoryRecords(records, historyRecordsContent);
                } else {
                    latestResultContent.innerHTML = '<p>暂无开奖记录。</p>';
                }
            }
            
            // 预测数据处理
            if (predictionRes.ok) {
                const prediction = await predictionRes.json();
                renderPrediction(prediction, predictionResultContent);
            } else {
                predictionResultContent.innerHTML = '<p>暂无可用预测，请通过机器人生成。</p>';
            }
        }).catch(err => {
            console.error('Fetch error:', err);
        });
    }

    /**
     * 渲染最新开奖结果
     */
    function renderLatestResult(record, container) {
        const numbers = record.openCode.split('+').map(s => s.trim());
        const mainNumbers = numbers[0].split(',');
        const specialNumber = numbers[1];

        const getWaveColor = (wave) => {
            if (!wave) return 'inherit';
            if (wave.includes('红')) return '#e74c3c';
            if (wave.includes('蓝')) return '#3498db';
            if (wave.includes('绿')) return '#2ecc71';
            return 'inherit';
        }

        container.innerHTML = `
            <div class="latest-info">
                <div class="info-item"><h3>期数</h3><p>${record.expect}</p></div>
                <div class="info-item"><h3>日期</h3><p>${record.openTime.split(' ')[0]}</p></div>
                <div class="info-item"><h3>生肖</h3><p>${record.zodiac || 'N/A'}</p></div>
                <div class="info-item"><h3>波色</h3><p style="color:${getWaveColor(record.wave)}">${record.wave || 'N/A'}</p></div>
            </div>
            <div class="open-codes">
                ${mainNumbers.map(num => `<div class="code-ball">${num}</div>`).join('')}
                <div style="font-size: 2rem; margin: 0 5px;">+</div>
                <div class="code-ball special-ball" style="background-color:${getWaveColor(record.wave)}">${specialNumber}</div>
            </div>
        `;
    }

    /**
     * 渲染预测结果
     */
    function renderPrediction(prediction, container) {
        container.innerHTML = `
            <div class="prediction-grid">
                <div class="prediction-item"><strong>推荐六肖:</strong> <span>${prediction.sixZodiacs.join(', ')}</span></div>
                <div class="prediction-item"><strong>主攻波色:</strong> <span style="font-weight:bold; color:${prediction.mainWave.includes('红')?'#e74c3c':prediction.mainWave.includes('蓝')?'#3498db':'#2ecc71'}">${prediction.mainWave}</span></div>
                <div class="prediction-item"><strong>防守波色:</strong> <span>${prediction.defenseWave}</span></div>
                <div class="prediction-item"><strong>推荐头数:</strong> <span>${prediction.twoHeads.join(', ')}</span></div>
                <div class="prediction-item"><strong>推荐尾数:</strong> <span>${prediction.fiveTails.join(', ')}</span></div>
                <div class="prediction-item full-width"><strong>精选18码:</strong> <div class="number-grid">${prediction.eighteenNumbers.map(n=>`<span>${n}</span>`).join('')}</div></div>
            </div>
        `;
    }

    /**
     * 渲染历史记录
     */
    function renderHistoryRecords(records, container) {
        container.innerHTML = `
            <div class="table-responsive">
                <table>
                    <thead><tr><th>期数</th><th>时间</th><th>号码</th><th>生肖</th><th>波色</th></tr></thead>
                    <tbody>
                        ${records.map(rec => `
                            <tr>
                                <td>${rec.expect}</td>
                                <td>${rec.openTime}</td>
                                <td>${rec.openCode}</td>
                                <td>${rec.zodiac || 'N/A'}</td>
                                <td style="color:${rec.wave && rec.wave.includes('红')?'#e74c3c':rec.wave && rec.wave.includes('蓝')?'#3498db':rec.wave && rec.wave.includes('绿')?'#2ecc71':'inherit'}">${rec.wave || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function updateActiveNav(type, navContainer) {
        const links = navContainer.querySelectorAll('a');
        links.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.type === type) {
                link.classList.add('active');
            }
        });
    }
});
