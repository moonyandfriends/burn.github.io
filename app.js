// Constants
const API_BASE_URL = 'https://stride-api.polkachu.com';
const RPC_URL = 'https://stride-rpc.polkachu.com';

const STRIDE_CHAIN_INFO = {
    chainId: 'stride-1',
    chainName: 'Stride',
    rpc: RPC_URL,
    rest: API_BASE_URL,
    bip44: { coinType: 118 },
    bech32Config: {
        bech32PrefixAccAddr: 'stride',
        bech32PrefixAccPub: 'stridepub',
        bech32PrefixValAddr: 'stridevaloper',
        bech32PrefixValPub: 'stridevaloperpub',
        bech32PrefixConsAddr: 'stridevalcons',
        bech32PrefixConsPub: 'stridevalconspub',
    },
    currencies: [{
        coinDenom: 'STRD',
        coinMinimalDenom: 'ustrd',
        coinDecimals: 6,
        coinGeckoId: 'stride',
    }],
    feeCurrencies: [{
        coinDenom: 'STRD',
        coinMinimalDenom: 'ustrd',
        coinDecimals: 6,
        coinGeckoId: 'stride',
        gasPriceStep: { low: 0.005, average: 0.01, high: 0.03 },
    }],
    stakeCurrency: {
        coinDenom: 'STRD',
        coinMinimalDenom: 'ustrd',
        coinDecimals: 6,
        coinGeckoId: 'stride',
    },
    features: ['ibc-transfer', 'ibc-go'],
};

// State
let walletState = {
    isConnected: false,
    address: null,
    walletType: null,
    signingClient: null,
};

let currentPage = 'burn-stats';
let currentAuction = null;
let auctions = [];

let burnData = {
    totalBurned: 0,
    avgBurn: 0,
    burnRate: 0,
    lastBurnDate: null,
    historicalBurns: [],
    isRealData: false
};

let chart;
let currentTimeframe = '7d';
let currentChartType = 'cumulative';

// Page Navigation
function switchPage(page) {
    currentPage = page;

    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.page-content').forEach(content => content.classList.remove('active'));

    if (page === 'auctions') {
        document.getElementById('auctionsTab').classList.add('active');
        document.getElementById('auctionsPage').classList.add('active');
        if (auctions.length === 0) {
            loadAuctions();
        }
    } else {
        document.getElementById('burnStatsTab').classList.add('active');
        document.getElementById('burnStatsPage').classList.add('active');
    }

    // Update URL hash
    window.location.hash = page;
}

// Wallet functions
function toggleWalletDropdown() {
    if (walletState.isConnected) {
        disconnect();
    } else {
        const dropdown = document.getElementById('walletDropdown');
        dropdown.classList.toggle('active');
    }
}

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('walletDropdown');
    if (!dropdown.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

async function connectKeplr() {
    try {
        if (!window.keplr) {
            alert('Please install Keplr wallet extension');
            return;
        }

        await window.keplr.experimentalSuggestChain(STRIDE_CHAIN_INFO);
        await window.keplr.enable(STRIDE_CHAIN_INFO.chainId);

        const offlineSigner = window.getOfflineSigner(STRIDE_CHAIN_INFO.chainId);
        const accounts = await offlineSigner.getAccounts();

        if (window.cosmjsStargate) {
            const { SigningStargateClient } = window.cosmjsStargate;
            const client = await SigningStargateClient.connectWithSigner(RPC_URL, offlineSigner);

            walletState = {
                isConnected: true,
                address: accounts[0].address,
                walletType: 'keplr',
                signingClient: client,
            };
        } else {
            walletState = {
                isConnected: true,
                address: accounts[0].address,
                walletType: 'keplr',
                signingClient: null,
            };
        }

        updateWalletUI();
        document.getElementById('walletDropdown').classList.remove('active');

        // Reload auction page if viewing it
        if (currentPage === 'auctions') {
            loadAuctions();
        }
    } catch (error) {
        console.error('Failed to connect Keplr:', error);
        alert('Failed to connect Keplr wallet');
    }
}

async function connectLeap() {
    try {
        if (!window.leap) {
            alert('Please install Leap wallet extension');
            return;
        }

        await window.leap.experimentalSuggestChain(STRIDE_CHAIN_INFO);
        await window.leap.enable(STRIDE_CHAIN_INFO.chainId);

        const offlineSigner = window.leap.getOfflineSigner(STRIDE_CHAIN_INFO.chainId);
        const accounts = await offlineSigner.getAccounts();

        if (window.cosmjsStargate) {
            const { SigningStargateClient } = window.cosmjsStargate;
            const client = await SigningStargateClient.connectWithSigner(RPC_URL, offlineSigner);

            walletState = {
                isConnected: true,
                address: accounts[0].address,
                walletType: 'leap',
                signingClient: client,
            };
        } else {
            walletState = {
                isConnected: true,
                address: accounts[0].address,
                walletType: 'leap',
                signingClient: null,
            };
        }

        updateWalletUI();
        document.getElementById('walletDropdown').classList.remove('active');

        // Reload auction page if viewing it
        if (currentPage === 'auctions') {
            loadAuctions();
        }
    } catch (error) {
        console.error('Failed to connect Leap:', error);
        alert('Failed to connect Leap wallet');
    }
}

function disconnect() {
    walletState = {
        isConnected: false,
        address: null,
        walletType: null,
        signingClient: null,
    };
    updateWalletUI();

    // Reload auction page if viewing it
    if (currentPage === 'auctions') {
        loadAuctions();
    }
}

function updateWalletUI() {
    const button = document.getElementById('walletButton');

    if (walletState.isConnected) {
        const shortAddress = `${walletState.address.slice(0, 10)}...${walletState.address.slice(-8)}`;
        button.innerHTML = `
            <div class="wallet-connected">
                <span class="wallet-address">${shortAddress}</span>
            </div>
        `;
        button.onclick = disconnect;
    } else {
        button.textContent = 'Connect Wallet';
        button.onclick = toggleWalletDropdown;
    }

    // Save to localStorage
    if (walletState.isConnected) {
        localStorage.setItem('walletState', JSON.stringify({
            isConnected: walletState.isConnected,
            address: walletState.address,
            walletType: walletState.walletType,
        }));
    } else {
        localStorage.removeItem('walletState');
    }
}

// Burn Stats Functions
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

async function loadCSV() {
    try {
        showLoading();

        const response = await fetch('https://storage.googleapis.com/stride-public-data/burn_data/strd_burn.csv');
        if (!response.ok) throw new Error('Failed to fetch data from server');

        const text = await response.text();
        const lines = text.trim().split('\n');
        const burns = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 2) continue;

            const timestamp = new Date(parts[0]);
            const totalBurnedMicroSTRD = parseInt(parts[1]);

            if (isNaN(timestamp.getTime()) || isNaN(totalBurnedMicroSTRD)) continue;

            // Convert microSTRD to STRD
            const totalBurnedSTRD = totalBurnedMicroSTRD / 1000000;

            // Calculate daily increase
            const previousTotal = burns.length > 0 ? burns[burns.length - 1].totalAfter : 0;
            const dailyIncrease = totalBurnedSTRD - previousTotal;

            burns.push({
                timestamp: timestamp,
                totalAfter: totalBurnedSTRD,
                amount: Math.max(0, dailyIncrease),
                totalMicroSTRD: totalBurnedMicroSTRD
            });
        }

        if (burns.length > 0) {
            burnData.historicalBurns = burns;
            burnData.totalBurned = burns[burns.length - 1].totalAfter;
            burnData.lastBurnDate = burns[burns.length - 1].timestamp;

            const nonZeroBurns = burns.filter(burn => burn.amount > 0);
            burnData.avgBurn = nonZeroBurns.length > 0
                ? nonZeroBurns.reduce((sum, burn) => sum + burn.amount, 0) / nonZeroBurns.length
                : 0;

            const last7BurnsWithData = burns.slice(-7).filter(burn => burn.amount > 0);
            burnData.burnRate = last7BurnsWithData.length > 0
                ? last7BurnsWithData.reduce((sum, burn) => sum + burn.amount, 0) / 7
                : 0;

            burnData.isRealData = true;
            console.log('Loaded', burns.length, 'burn records from Google Cloud Storage');
        } else {
            console.error('No valid burn data found');
            burnData.historicalBurns = [];
            burnData.totalBurned = 0;
            burnData.avgBurn = 0;
            burnData.burnRate = 0;
            burnData.lastBurnDate = null;
            burnData.isRealData = false;
        }
    } catch (error) {
        console.error('Failed to load CSV:', error);
        burnData.historicalBurns = [];
        burnData.totalBurned = 0;
        burnData.avgBurn = 0;
        burnData.burnRate = 0;
        burnData.lastBurnDate = null;
        burnData.isRealData = false;
    } finally {
        hideLoading();
    }
}

function updateStats() {
    document.getElementById('totalBurned').textContent = Math.round(burnData.totalBurned).toLocaleString('en-US');
    document.getElementById('avgBurn').textContent = Math.round(burnData.avgBurn).toLocaleString('en-US');
    document.getElementById('burnRate').textContent = Math.round(burnData.burnRate).toLocaleString('en-US');
}

function createChart() {
    const ctx = document.getElementById('burnChart').getContext('2d');

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Total STRD Burned',
                data: [],
                borderColor: '#e50571',
                backgroundColor: 'rgba(229, 5, 113, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#e50571',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            return `${context.dataset.label}: ${value.toLocaleString('en-US', {
                                minimumFractionDigits: 6,
                                maximumFractionDigits: 6
                            })} STRD`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' STRD';
                        },
                        color: '#ffffff',
                        font: {
                            family: 'Inter',
                            weight: 600
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            family: 'Inter',
                            weight: 600
                        },
                        maxTicksLimit: 10,
                        autoSkip: true
                    }
                }
            }
        }
    });

    updateChart();
}

function updateChart() {
    const now = new Date();
    let filtered = [];

    switch(currentTimeframe) {
        case '7d':
            filtered = burnData.historicalBurns.filter(burn =>
                now - burn.timestamp < 7 * 24 * 60 * 60 * 1000
            );
            break;
        case '30d':
            filtered = burnData.historicalBurns.filter(burn =>
                now - burn.timestamp < 30 * 24 * 60 * 60 * 1000
            );
            break;
        case 'all':
            filtered = burnData.historicalBurns;
            break;
    }

    chart.data.labels = filtered.map(burn => {
        return burn.timestamp.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: currentTimeframe === 'all' ? '2-digit' : undefined
        });
    });

    if (currentChartType === 'cumulative') {
        chart.data.datasets[0].data = filtered.map(burn => burn.totalAfter);
        chart.data.datasets[0].label = 'Total STRD Burned';
        chart.data.datasets[0].fill = true;
        chart.options.scales.y.beginAtZero = false;
    } else {
        chart.data.datasets[0].data = filtered.map(burn => burn.amount);
        chart.data.datasets[0].label = 'Daily Burns';
        chart.data.datasets[0].fill = false;
        chart.options.scales.y.beginAtZero = true;
    }

    chart.update('none');
}

function changeChartType(type) {
    currentChartType = type;

    document.getElementById('cumulativeBtn').classList.remove('active');
    document.getElementById('individualBtn').classList.remove('active');

    if (type === 'cumulative') {
        document.getElementById('cumulativeBtn').classList.add('active');
    } else {
        document.getElementById('individualBtn').classList.add('active');
    }

    updateChart();
}

function changeTimeframe(timeframe) {
    currentTimeframe = timeframe;

    document.getElementById('timeframe7d').classList.remove('active');
    document.getElementById('timeframe30d').classList.remove('active');
    document.getElementById('timeframeall').classList.remove('active');
    document.getElementById('timeframe' + timeframe).classList.add('active');

    updateChart();
}

// Auction Functions
function formatDenom(denom) {
    const denomMap = {
        'ustrd': 'STRD',
        'uatom': 'ATOM',
        'uosmo': 'OSMO',
        'utia': 'TIA',
    };
    return denomMap[denom] || denom.replace('u', '').toUpperCase();
}

function formatAmount(amount, decimals = 6) {
    const value = parseInt(amount) / Math.pow(10, decimals);
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
}

async function fetchAuctions() {
    try {
        const response = await fetch(`${API_BASE_URL}/stride/auction/v1/auctions`);
        const data = await response.json();

        if (data.auctions && data.auctions.length > 0) {
            return data.auctions;
        }
    } catch (error) {
        console.error('Failed to fetch auctions from API (Note: API endpoint may not be implemented yet):', error);
    }

    // Sample auctions - the API endpoint is not implemented yet
    return [
        {
            type: 'FCFS',
            name: 'atom-auction',
            sellingDenom: 'uatom',
            paymentDenom: 'ustrd',
            enabled: true,
            minPriceMultiplier: '0.95',
            minBidAmount: '1000000',
            beneficiary: 'stride1example...',
            totalPaymentTokenReceived: '500000000',
            totalSellingTokenSold: '100000000',
        },
        {
            type: 'FCFS',
            name: 'osmo-auction',
            sellingDenom: 'uosmo',
            paymentDenom: 'ustrd',
            enabled: true,
            minPriceMultiplier: '0.90',
            minBidAmount: '2000000',
            beneficiary: 'stride1example...',
            totalPaymentTokenReceived: '300000000',
            totalSellingTokenSold: '75000000',
        }
    ];
}

async function loadAuctions() {
    const container = document.getElementById('auctionsContainer');
    container.innerHTML = '<div class="loading">Loading auctions...</div>';

    auctions = await fetchAuctions();

    if (auctions.length === 0) {
        container.innerHTML = '<div class="error-message">No auctions available at this time</div>';
        return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'auction-grid';

    for (const auction of auctions) {
        const card = createAuctionCard(auction);
        grid.appendChild(card);
    }

    container.appendChild(grid);
}

function createAuctionCard(auction) {
    const discount = ((1 - parseFloat(auction.minPriceMultiplier)) * 100).toFixed(1);

    const card = document.createElement('div');
    card.className = 'auction-card';

    card.innerHTML = `
        <div class="auction-header">
            <div class="auction-title">${auction.name}</div>
            <div class="auction-status">
                <span class="status-badge ${auction.enabled ? 'status-active' : 'status-inactive'}">
                    ${auction.enabled ? 'Active' : 'Inactive'}
                </span>
                ${discount > 0 ? `<span class="discount-badge">${discount}% OFF</span>` : ''}
            </div>
        </div>
        <div class="auction-details">
            <div class="detail-row">
                <span class="detail-label">Selling</span>
                <span class="detail-value">${formatDenom(auction.sellingDenom)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Payment</span>
                <span class="detail-value">${formatDenom(auction.paymentDenom)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Min Bid</span>
                <span class="detail-value">${formatAmount(auction.minBidAmount)} STRD</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Total Sold</span>
                <span class="detail-value">${formatAmount(auction.totalSellingTokenSold)} ${formatDenom(auction.sellingDenom)}</span>
            </div>
        </div>
        <button class="bid-button" onclick="openBidModal('${auction.name}')" ${!auction.enabled || !walletState.isConnected ? 'disabled' : ''}>
            ${!walletState.isConnected ? 'Connect Wallet to Bid' : (auction.enabled ? 'Place Bid' : 'Auction Inactive')}
        </button>
    `;

    return card;
}

function openBidModal(auctionName) {
    currentAuction = auctions.find(a => a.name === auctionName);
    if (!currentAuction) return;

    document.getElementById('modalTitle').textContent = `Bid on ${currentAuction.name}`;
    document.getElementById('minBidHint').textContent = `Minimum bid: ${formatAmount(currentAuction.minBidAmount)} STRD`;
    document.getElementById('bidAmount').value = '';
    document.getElementById('estimatedReceive').textContent = '0 ' + formatDenom(currentAuction.sellingDenom);
    document.getElementById('bidError').innerHTML = '';

    document.getElementById('bidModal').classList.add('active');
}

function closeBidModal() {
    document.getElementById('bidModal').classList.remove('active');
    currentAuction = null;
}

document.addEventListener('DOMContentLoaded', function() {
    const bidAmountInput = document.getElementById('bidAmount');
    if (bidAmountInput) {
        bidAmountInput.addEventListener('input', function(e) {
            if (!currentAuction) return;

            const amount = parseFloat(e.target.value) || 0;
            const multiplier = parseFloat(currentAuction.minPriceMultiplier);

            // Simplified calculation - actual would depend on oracle prices
            const estimated = amount * multiplier;
            document.getElementById('estimatedReceive').textContent =
                estimated.toFixed(6) + ' ' + formatDenom(currentAuction.sellingDenom);
        });
    }
});

async function submitBid() {
    if (!walletState.isConnected || !walletState.signingClient) {
        alert('Please connect your wallet first');
        return;
    }

    const bidAmountSTRD = parseFloat(document.getElementById('bidAmount').value);
    if (!bidAmountSTRD || bidAmountSTRD <= 0) {
        showBidError('Please enter a valid bid amount');
        return;
    }

    const minBidSTRD = parseInt(currentAuction.minBidAmount) / 1000000;
    if (bidAmountSTRD < minBidSTRD) {
        showBidError(`Bid must be at least ${minBidSTRD} STRD`);
        return;
    }

    const bidAmountMicro = Math.floor(bidAmountSTRD * 1000000).toString();

    try {
        document.getElementById('submitBidButton').disabled = true;
        document.getElementById('submitBidButton').textContent = 'Submitting...';

        const msg = {
            typeUrl: '/stride.auction.MsgPlaceBid',
            value: {
                auctionName: currentAuction.name,
                bidder: walletState.address,
                paymentTokenAmount: bidAmountMicro,
            },
        };

        const fee = {
            amount: [{ denom: 'ustrd', amount: '5000' }],
            gas: '200000',
        };

        const result = await walletState.signingClient.signAndBroadcast(
            walletState.address,
            [msg],
            fee,
            'Bid placed via STRD Dashboard'
        );

        if (result.code === 0) {
            alert('Bid placed successfully! Transaction hash: ' + result.transactionHash);
            closeBidModal();
            loadAuctions();
        } else {
            showBidError('Transaction failed: ' + result.rawLog);
        }
    } catch (error) {
        console.error('Failed to submit bid:', error);
        showBidError('Failed to submit bid: ' + error.message);
    } finally {
        document.getElementById('submitBidButton').disabled = false;
        document.getElementById('submitBidButton').textContent = 'Confirm Bid';
    }
}

function showBidError(message) {
    document.getElementById('bidError').innerHTML = `
        <div class="error-message" style="margin-top: 16px">${message}</div>
    `;
}

// Initialize
async function init() {
    await loadCSV();
    updateStats();
    createChart();

    // Restore wallet state
    const savedState = localStorage.getItem('walletState');
    if (savedState) {
        try {
            const saved = JSON.parse(savedState);
            walletState.isConnected = saved.isConnected;
            walletState.address = saved.address;
            walletState.walletType = saved.walletType;
            updateWalletUI();
        } catch (e) {
            console.error('Failed to restore wallet state:', e);
        }
    }

    // Handle URL hash for navigation
    const hash = window.location.hash.slice(1);
    if (hash === 'auctions') {
        switchPage('auctions');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

// Handle hash changes
window.addEventListener('hashchange', function() {
    const hash = window.location.hash.slice(1);
    if (hash === 'auctions' || hash === 'burn-stats') {
        switchPage(hash);
    }
});
