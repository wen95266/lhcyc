document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const predictionResultDiv = document.getElementById('prediction-result');

    // Function to fetch and display lottery data
    async function fetchLotteryData(lotteryType) {
        // Update active link
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.lotteryType === lotteryType);
        });

        // Fetch data from the API
        try {
            predictionResultDiv.innerHTML = '<p>正在加载数据...</p>';
            const response = await fetch(`/api/lottery?type=${lotteryType}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Display the data in a table
            displayDataAsTable(data);

        } catch (error) {
            console.error('Fetch error:', error);
            predictionResultDiv.innerHTML = `<p>加载数据失败: ${error.message}</p>`;
        }
    }

    // Function to display data in a table format
    function displayDataAsTable(data) {
        if (!data || data.length === 0) {
            predictionResultDiv.innerHTML = '<p>暂无预测数据。</p>';
            return;
        }

        const table = document.createElement('table');
        const thead = table.createTHead();
        const tbody = table.createTBody();
        
        // Create table headers from the keys of the first object
        const headers = Object.keys(data[0]);
        const headerRow = thead.insertRow();
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });

        // Create table rows
        data.forEach(item => {
            const row = tbody.insertRow();
            headers.forEach(header => {
                const cell = row.insertCell();
                cell.textContent = item[header] !== null ? item[header] : ''; // Handle null values
            });
        });

        predictionResultDiv.innerHTML = ''; // Clear previous content
        predictionResultDiv.appendChild(table);
    }

    // Event listener for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const lotteryType = e.target.dataset.lotteryType;
            fetchLotteryData(lotteryType);
        });
    });

    // Initial load: Fetch data for the default active tab
    const initialLotteryType = document.querySelector('.nav-link.active').dataset.lotteryType;
    fetchLotteryData(initialLotteryType);
});