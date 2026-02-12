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
    wallet: null,
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

        const key = await window.keplr.getKey(STRIDE_CHAIN_INFO.chainId);

        walletState = {
            isConnected: true,
            address: key.bech32Address,
            walletType: 'keplr',
            wallet: window.keplr,
        };

        console.log('Keplr connected successfully', {
            address: walletState.address,
            hasWallet: !!walletState.wallet
        });

        updateWalletUI();
        document.getElementById('walletDropdown').classList.remove('active');

        // Reload auction page if viewing it
        if (currentPage === 'auctions') {
            loadAuctions();
        }
    } catch (error) {
        console.error('Failed to connect Keplr:', error);
        alert('Failed to connect Keplr wallet: ' + error.message);
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

        const key = await window.leap.getKey(STRIDE_CHAIN_INFO.chainId);

        walletState = {
            isConnected: true,
            address: key.bech32Address,
            walletType: 'leap',
            wallet: window.leap,
        };

        console.log('Leap connected successfully', {
            address: walletState.address,
            hasWallet: !!walletState.wallet
        });

        updateWalletUI();
        document.getElementById('walletDropdown').classList.remove('active');

        // Reload auction page if viewing it
        if (currentPage === 'auctions') {
            loadAuctions();
        }
    } catch (error) {
        console.error('Failed to connect Leap:', error);
        alert('Failed to connect Leap wallet: ' + error.message);
    }
}

function disconnect() {
    walletState = {
        isConnected: false,
        address: null,
        walletType: null,
        wallet: null,
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
    // Check if it's an IBC denom
    if (denom.startsWith('ibc/')) {
        return IBC_DENOM_MAP[denom] || denom.substring(4, 8) + '...';
    }

    // Handle standard denoms
    const denomMap = {
        'ustrd': 'STRD',
        'uatom': 'ATOM',
        'uosmo': 'OSMO',
        'utia': 'TIA',
    };
    return denomMap[denom] || denom.replace('u', '').toUpperCase();
}

function formatAmount(amount, decimals = 6) {
    // Handle very large numbers and strings
    let value;
    if (typeof amount === 'string' && amount.length > 15) {
        // For very large numbers, use BigInt
        try {
            const bigAmount = BigInt(amount);
            const divisor = BigInt(Math.pow(10, decimals));
            value = Number(bigAmount / divisor);
        } catch (e) {
            value = parseFloat(amount) / Math.pow(10, decimals);
        }
    } else {
        value = parseFloat(amount) / Math.pow(10, decimals);
    }

    // For very large numbers, use abbreviated format
    if (value >= 1e9) {
        return (value / 1e9).toFixed(2) + 'B';
    } else if (value >= 1e6) {
        return (value / 1e6).toFixed(2) + 'M';
    } else if (value >= 1e3) {
        return (value / 1e3).toFixed(2) + 'K';
    }

    return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
}

// IBC denom to readable name mapping
const IBC_DENOM_MAP = {
    'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2': 'ATOM',
    'ibc/AC11D57A5FBC0DF322615027DB86FAA602283F1801ED71FDDAA26117C41256D7': 'BAND',
    'ibc/EB66980014602E6BD50A1CB9FFB8FA694DC3EC10A48D2C1C649D732954F88D4A': 'CMDX',
    'ibc/561C70B20188A047BFDE6F9946BDDC5D8AC172B9BE04FF868DFABF819E5A9CCE': 'DYDX',
    'ibc/E1C22332C083574F3418481359733BA8887D171E76C80AD9237422AEABB66018': 'DYM',
    'ibc/4B322204B4F59D770680FE4D7A565DDC3F37BFF035474B717476C66A4F83DD72': 'EVMOS',
    'ibc/A7454562FF29FE068F42F9DE4805ABEF54F599D1720B345D6518D9B5C64EA6D2': 'INJ',
    'ibc/255BEB856BFBC1B75A3C349CF769E9FADEB595804F4FC688A72D651576B9180E': 'ISLM',
    'ibc/DA356E369C3E5CF6A9F1DCD99CE8ED55FBD595E676A5CF033CE784C060492D5A': 'JUNO',
    'ibc/E61BCB1126F42A2ED73B4CEA2221C9635BC2102F0417543C38071779F991942E': 'LUNA',
    'ibc/D24B4564BCD51D3D02D9987D92571EAC5915676A9BD6D9B0C1D0254CB8A5EA34': 'OSMO',
    'ibc/520D9C4509027DE66C737A1D6A6021915A3071E30DBA8F758B46532B060D7AA5': 'SAGA',
    'ibc/B86EFF6D227E3E33D7E3B5E65D0C1BB5BD79CCB56D35A9D824F0DD5D52CA43BA': 'SOMM',
    'ibc/7EAE5BEF3A26B64AFBD89828AFDDB1DC7024A0276D22745201632C40E6E634D0': 'STARS',
    'ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801': 'TIA',
    'ibc/1A2271226209D309902AFF4F21BD21237CB514DD24EA2EE0423BF74C6135D8B8': 'UMEE',
};

// Token to CoinGecko ID mapping
const COINGECKO_ID_MAP = {
    'ATOM': 'cosmos',
    'OSMO': 'osmosis',
    'TIA': 'celestia',
    'STRD': 'stride',
    'JUNO': 'juno-network',
    'INJ': 'injective-protocol',
    'DYDX': 'dydx-chain',
    'EVMOS': 'evmos',
    'STARS': 'stargaze',
    'LUNA': 'terra-luna-2',
    'BAND': 'band-protocol',
    'SAGA': 'saga-2',
    'CMDX': 'comdex',
    'DYM': 'dymension',
    'SOMM': 'sommelier',
    'UMEE': 'umee',
    'ISLM': 'islamic-coin',
};

let oraclePrices = {};
let auctionBalances = {};
const AUCTION_MODULE_ADDRESS = 'stride1j4yzhgjm00ch3h0p9kel7g8sp6g045qfcgk6ex';

async function fetchOraclePrices() {
    // Check cache first (5 minute expiry)
    const cached = localStorage.getItem('oraclePrices');
    const cacheTime = localStorage.getItem('oraclePricesTime');

    if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < 5 * 60 * 1000) { // 5 minutes
            console.log('Using cached oracle prices');
            return JSON.parse(cached);
        }
    }

    try {
        // Get all unique CoinGecko IDs from active tokens
        const ids = Object.values(COINGECKO_ID_MAP).join(',');
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('CoinGecko rate limit hit, using cached prices if available');
                if (cached) {
                    return JSON.parse(cached);
                }
                throw new Error('Rate limit exceeded and no cached prices available');
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Convert to our token name format
        const prices = {};
        for (const [token, geckoId] of Object.entries(COINGECKO_ID_MAP)) {
            if (data[geckoId] && data[geckoId].usd) {
                prices[token] = data[geckoId].usd;
            }
        }

        // Cache the prices
        localStorage.setItem('oraclePrices', JSON.stringify(prices));
        localStorage.setItem('oraclePricesTime', Date.now().toString());
        console.log('Fetched and cached new oracle prices');

        return prices;
    } catch (error) {
        console.error('Failed to fetch oracle prices:', error);

        // Return cached prices if available, even if expired
        if (cached) {
            console.log('Using stale cached prices due to error');
            return JSON.parse(cached);
        }

        return {};
    }
}

async function fetchAuctionBalances() {
    try {
        const response = await fetch(`${API_BASE_URL}/cosmos/bank/v1beta1/balances/${AUCTION_MODULE_ADDRESS}?pagination.limit=100`);
        const data = await response.json();

        const balances = {};
        if (data.balances) {
            data.balances.forEach(balance => {
                const amount = balance.amount;
                // Only include non-zero balances
                if (amount && parseInt(amount) > 0) {
                    balances[balance.denom] = amount;
                }
            });
        }

        return balances;
    } catch (error) {
        console.error('Failed to fetch auction balances:', error);
        return {};
    }
}

async function fetchAuctions() {
    try {
        const response = await fetch(`${API_BASE_URL}/stride/auction/auctions`);
        const data = await response.json();

        if (data.auctions && data.auctions.length > 0) {
            // Transform the API response to match our expected format
            return data.auctions.map(auction => ({
                type: auction.type === 'AUCTION_TYPE_FCFS' ? 'FCFS' : auction.type,
                name: auction.name,
                sellingDenom: auction.selling_denom,
                paymentDenom: auction.payment_denom,
                enabled: auction.enabled,
                minPriceMultiplier: auction.min_price_multiplier,
                minBidAmount: auction.min_bid_amount,
                beneficiary: auction.beneficiary,
                totalPaymentTokenReceived: auction.total_payment_token_received,
                totalSellingTokenSold: auction.total_selling_token_sold,
            }));
        }
    } catch (error) {
        console.error('Failed to fetch auctions from API:', error);
    }

    return [];
}

async function loadAuctions() {
    const container = document.getElementById('auctionsContainer');
    container.innerHTML = '<div class="loading">Loading auctions, prices, and availability...</div>';

    // Fetch auctions, oracle prices, and balances in parallel
    const [auctionData, prices, balances] = await Promise.all([
        fetchAuctions(),
        fetchOraclePrices(),
        fetchAuctionBalances()
    ]);

    auctions = auctionData;
    oraclePrices = prices;
    auctionBalances = balances;

    if (auctions.length === 0) {
        container.innerHTML = '<div class="error-message">No auctions available at this time</div>';
        return;
    }

    // Sort auctions: available first, sold out last
    const sortedAuctions = [...auctions].sort((a, b) => {
        const aBalance = parseInt(auctionBalances[a.sellingDenom] || '0');
        const bBalance = parseInt(auctionBalances[b.sellingDenom] || '0');

        // If both have balance or both don't, sort alphabetically by name
        if ((aBalance > 0 && bBalance > 0) || (aBalance === 0 && bBalance === 0)) {
            return a.name.localeCompare(b.name);
        }

        // Otherwise, available (with balance) comes first
        return bBalance - aBalance;
    });

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'auction-grid';

    for (const auction of sortedAuctions) {
        const card = createAuctionCard(auction);
        grid.appendChild(card);
    }

    container.appendChild(grid);
}

function createAuctionCard(auction) {
    const discount = ((1 - parseFloat(auction.minPriceMultiplier)) * 100).toFixed(1);
    const tokenName = formatDenom(auction.sellingDenom);

    // Check available balance
    const availableBalance = auctionBalances[auction.sellingDenom] || '0';
    const hasBalance = parseInt(availableBalance) > 0;
    const availableAmount = formatAmount(availableBalance);

    // Format min bid - if it's 1, it means 1 micro-STRD (0.000001 STRD)
    const minBidValue = parseFloat(auction.minBidAmount);
    const minBidDisplay = minBidValue <= 1 ? '0.000001' : formatAmount(auction.minBidAmount);

    // Calculate STRD cost per token
    let priceDisplay = '';
    if (oraclePrices[tokenName] && oraclePrices['STRD']) {
        const tokenOraclePrice = oraclePrices[tokenName];
        const auctionPrice = tokenOraclePrice * parseFloat(auction.minPriceMultiplier);
        const strdPrice = oraclePrices['STRD'];
        const strdPerToken = auctionPrice / strdPrice;

        priceDisplay = `
            <div class="detail-row">
                <span class="detail-label">Oracle Price</span>
                <span class="detail-value">$${tokenOraclePrice.toFixed(4)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Cost per ${tokenName}</span>
                <span class="detail-value" style="color: #90EE90; font-weight: 700;">${strdPerToken.toFixed(2)} STRD</span>
            </div>
        `;
    }

    const card = document.createElement('div');
    card.className = 'auction-card';
    if (!hasBalance) {
        card.style.opacity = '0.6';
    }

    card.innerHTML = `
        <div class="auction-header">
            <div class="auction-title">${auction.name}</div>
            <div class="auction-status">
                <span class="status-badge ${hasBalance ? 'status-active' : 'status-inactive'}">
                    ${hasBalance ? 'Available' : 'Sold Out'}
                </span>
                ${discount > 0 && hasBalance ? `<span class="discount-badge">${discount}% OFF</span>` : ''}
            </div>
        </div>
        <div class="auction-details">
            <div class="detail-row">
                <span class="detail-label">Available</span>
                <span class="detail-value" style="color: ${hasBalance ? '#90EE90' : '#FFB6C1'}; font-weight: 700;">
                    ${availableAmount} ${tokenName}
                </span>
            </div>
            ${priceDisplay}
            <div class="detail-row">
                <span class="detail-label">Total Sold</span>
                <span class="detail-value">${formatAmount(auction.totalSellingTokenSold)} ${tokenName}</span>
            </div>
        </div>
        <button class="bid-button" onclick="openBidModal('${auction.name}')" ${!hasBalance || !walletState.isConnected ? 'disabled' : ''}>
            ${!walletState.isConnected ? 'Connect Wallet to Bid' : (hasBalance ? 'Place Bid' : 'Sold Out')}
        </button>
    `;

    return card;
}

function openBidModal(auctionName) {
    currentAuction = auctions.find(a => a.name === auctionName);
    if (!currentAuction) return;

    const tokenName = formatDenom(currentAuction.sellingDenom);
    const availableBalance = auctionBalances[currentAuction.sellingDenom] || '0';
    const availableTokens = parseFloat(availableBalance) / 1000000; // Convert from micro to normal units

    // Calculate STRD needed for full amount
    let strdNeeded = 0;
    if (oraclePrices[tokenName] && oraclePrices['STRD']) {
        const tokenOraclePrice = oraclePrices[tokenName];
        const auctionPrice = tokenOraclePrice * parseFloat(currentAuction.minPriceMultiplier);
        const strdPrice = oraclePrices['STRD'];
        const strdPerToken = auctionPrice / strdPrice;
        strdNeeded = availableTokens * strdPerToken;
    }

    document.getElementById('modalTitle').textContent = `Bid on ${currentAuction.name}`;
    document.getElementById('bidAmount').value = strdNeeded.toFixed(2);
    document.getElementById('bidAmount').disabled = true;
    document.getElementById('minBidHint').textContent = `Bidding for full available amount`;
    document.getElementById('estimatedReceive').textContent = availableTokens.toFixed(6) + ' ' + tokenName;
    document.getElementById('bidError').innerHTML = '';

    document.getElementById('bidModal').classList.add('active');
}

function closeBidModal() {
    document.getElementById('bidModal').classList.remove('active');
    currentAuction = null;
}

// Bid amount input is now disabled, no need for event listener

async function submitBid() {
    console.log('Submit bid called. Wallet state:', {
        isConnected: walletState.isConnected,
        hasWallet: !!walletState.wallet,
        address: walletState.address,
        walletType: walletState.walletType
    });

    if (!walletState.isConnected || !walletState.wallet) {
        alert('Please connect your wallet first');
        return;
    }

    const tokenName = formatDenom(currentAuction.sellingDenom);
    const availableBalance = auctionBalances[currentAuction.sellingDenom] || '0';

    if (parseInt(availableBalance) === 0) {
        showBidError('No tokens available for this auction');
        return;
    }

    // Calculate STRD needed for full available amount
    const availableTokens = parseFloat(availableBalance) / 1000000;
    let strdNeeded = 0;

    if (oraclePrices[tokenName] && oraclePrices['STRD']) {
        const tokenOraclePrice = oraclePrices[tokenName];
        const auctionPrice = tokenOraclePrice * parseFloat(currentAuction.minPriceMultiplier);
        const strdPrice = oraclePrices['STRD'];
        const strdPerToken = auctionPrice / strdPrice;
        strdNeeded = availableTokens * strdPerToken;
    } else {
        showBidError('Unable to calculate bid amount - price data unavailable');
        return;
    }

    const bidAmountMicro = Math.floor(strdNeeded * 1000000).toString();

    try {
        document.getElementById('submitBidButton').disabled = true;
        document.getElementById('submitBidButton').textContent = 'Submitting...';

        console.log('Starting bid submission...');

        // Get account info
        const accountResponse = await fetch(`${API_BASE_URL}/cosmos/auth/v1beta1/accounts/${walletState.address}`);
        const accountData = await accountResponse.json();

        // Wait for CosmJS bundle to load
        let attempts = 0;
        while (!window.CosmosClient || !window.CosmosClient.SigningStargateClient) {
            if (attempts++ > 50) {
                showBidError('CosmJS library not loaded. Please refresh the page.');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('CosmJS bundle loaded, creating client...');

        // Get offline signer
        const offlineSigner = window.keplr.getOfflineSigner(STRIDE_CHAIN_INFO.chainId);

        // Create signing client
        const client = await window.CosmosClient.SigningStargateClient.connectWithSigner(
            RPC_URL,
            offlineSigner
        );

        console.log('Client created, preparing message...');

        // Create the protobuf message
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

        console.log('Signing and broadcasting...');

        // This will trigger the wallet popup again and handle everything properly
        const result = await client.signAndBroadcast(
            walletState.address,
            [msg],
            fee,
            'Bid placed via STRD Dashboard'
        );

        console.log('Result:', result);

        if (result.code === 0) {
            alert(`Bid placed successfully!\n\nYou bid ${strdNeeded.toFixed(2)} STRD for ${availableTokens.toFixed(6)} ${tokenName}\n\nTransaction hash: ${result.transactionHash}`);
            closeBidModal();
            loadAuctions();
        } else {
            showBidError('Transaction failed: ' + (result.rawLog || 'Unknown error'));
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

    // Don't restore wallet state - require fresh connection each time
    // This ensures signingClient is properly initialized
    localStorage.removeItem('walletState');

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
