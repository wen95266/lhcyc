
document.addEventListener('DOMContentLoaded', async () => {
    const app = document.getElementById('app');
    if (!app) {
        console.error('App container #app not found!');
        return;
    }

    // 从 URL 获取彩票类型, 例如 index.html?type=XINAO
    const params = new URLSearchParams(window.location.search);
    const lotteryType = params.get('type') || 'XINAO'; // 默认显示 XINAO

    // 更新页面标题
    document.title = `${lotteryType} - 开奖记录`;
    const titleElement = document.querySelector('h1');
    if(titleElement) {
        titleElement.textContent = `${lotteryType} 开奖记录`;
    }

    try {
        // 调用我们创建的后端 API
        const response = await fetch(`/api/data?type=${lotteryType}`);
        if (!response.ok) {
            throw new Error(`数据加载失败: ${response.statusText}`);
        }
        const records = await response.json();

        if (records.error) {
            throw new Error(records.error);
        }

        renderRecords(records);

    } catch (error) {
        app.innerHTML = `<p class="error">无法加载数据: ${error.message}</p><p class="error">请确保您已在 Cloudflare 控制台正确绑定了 D1 数据库，并稍后再试。</p>`;
        console.error(error);
    }
});

function renderRecords(records) {
    const app = document.getElementById('app');
    if (records.length === 0) {
        app.innerHTML = '<p>暂无开奖记录。请尝试通过 Telegram 机器人同步数据。</p>';
        return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>期数</th>
                <th>开奖时间</th>
                <th>开奖号码</th>
                <th>波色</th>
                <th>生肖</th>
            </tr>
        </thead>
        <tbody>
            ${records.map(record => `
                <tr>
                    <td>${record.expect}</td>
                    <td>${record.openTime}</td>
                    <td>${record.openCode}</td>
                    <td>${record.wave || 'N/A'}</td>
                    <td>${record.zodiac || 'N/A'}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    app.appendChild(table);
}
