
const lotteryTypeSelect = document.getElementById('lottery-type');
const predictBtn = document.getElementById('predict-btn');
const predictionResultDiv = document.getElementById('prediction-result');

predictBtn.addEventListener('click', async () => {
  const lotteryType = lotteryTypeSelect.value;
  const response = await fetch(`/api/lottery?type=${lotteryType}`);
  const prediction = await response.json();

  if (prediction) {
    predictionResultDiv.innerHTML = `
      <p>期号: ${prediction.expect}</p>
      <p>开奖时间: ${prediction.openTime}</p>
      <p>开奖号码: ${prediction.openCode}</p>
    `;
  } else {
    predictionResultDiv.innerHTML = '<p>暂无预测结果</p>';
  }
});

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
