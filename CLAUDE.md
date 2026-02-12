# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static website dashboard for monitoring STRD (Stride) token burns on the Stride blockchain. This is a GitHub Pages site hosted at burn.atomhe.art. The site is static HTML/CSS/JavaScript with a pre-built CosmJS bundle.

## Development Commands

Run locally using any HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Then navigate to http://localhost:8000
```

## Building CosmJS Bundle (Only needed if updating CosmJS)

The `cosmjs-bundle.js` file is pre-built and committed to the repo. Only rebuild if you need to update CosmJS:

```bash
# From parent directory (burn-site/)
npm install
node build-cosmjs.js

# This generates burn.github.io/cosmjs-bundle.js (3.0MB minified)
```

The bundle includes @cosmjs/stargate with browser polyfills (crypto-browserify, stream-browserify, events) to work in Keplr's secure environment.

## Architecture

### Files Structure
- **index.html** - Single-page application (SPA) containing both Auctions and Burn Stats
- **app.js** - All JavaScript functionality for both pages and wallet integration
- **cosmjs-bundle.js** - Pre-built CosmJS bundle (3.0MB) with browser polyfills
- **userburns.html** - Transaction listing page querying Stride RPC directly
- **static/strdburn.ico** - Favicon
- **CNAME** - Custom domain configuration for GitHub Pages

**Build files (in parent directory, not deployed):**
- **build-cosmjs.js** - esbuild script to generate cosmjs-bundle.js
- **package.json** - Dependencies for building the CosmJS bundle
- **node-globals.js** - Browser polyfills for Node.js globals

### Single-Page Application
The site uses a SPA architecture where:
- Header and navigation tabs remain static
- Content sections switch dynamically without page reload
- URL hash routing (`#auctions`, `#burn-stats`) maintains navigation state
- Wallet connection persists across content switches
- Initial page load shows Burn Stats by default

### Data Flow

**Main Dashboard (index.html)**:
1. Fetches CSV from `https://storage.googleapis.com/stride-public-data/burn_data/strd_burn.csv`
2. CSV contains: timestamp and total burned (in microSTRD)
3. Converts microSTRD to STRD (1 STRD = 1,000,000 microSTRD)
4. Calculates daily burn amounts by diffing cumulative totals
5. Displays via Chart.js with three timeframes (7d, 30d, all time) and two chart types (cumulative, individual)

**Auctions Section**:
1. Fetches live auction data from `https://stride-api.polkachu.com/stride/auction/auctions`
2. Displays 16 active auctions: ATOM, OSMO, TIA, JUNO, INJ, DYDX, EVMOS, LUNA, STARS, SAGA, BAND, CMDX, DYM, ISLM, SOMM, UMEE
3. IBC denom mapping converts on-chain denoms to readable token names
4. Handles large numbers (18+ decimals) using BigInt, displays with K/M/B abbreviations
5. All auctions offer 3% discount (min_price_multiplier: 0.97)
6. Min bid is 1 micro-STRD (0.000001 STRD) for all auctions
7. Wallet integration using pre-built CosmJS bundle (SigningStargateClient)
8. Bid submission creates `MsgPlaceBid` transaction with typeUrl `/stride.auction.MsgPlaceBid`
9. Modal-based bidding interface with real-time token estimate calculations
10. Bundle works within Keplr's SES (Secure EcmaScript) environment with proper polyfills

**User Burns Page (userburns.html)**:
- Queries Stride RPC at `https://stride-rpc.polkachu.com` using JSON-RPC
- Searches for transactions with `message.action='/stride.strdburner.MsgBurn'`

### Wallet Integration
- Supports Keplr and Leap browser extension wallets
- Uses Stride chain config (chainId: 'stride-1', RPC: polkachu.com)
- Stores connection state in localStorage for persistence across pages
- Creates SigningStargateClient for transaction signing on auction page
- Gas fees: 5000 ustrd amount, 200000 gas limit for bid transactions

### Key Technical Details
- Chart.js (v3.9.1) loaded from CDN for visualizations
- CSS custom properties for theming (--primary: #e50571, etc.)
- Responsive design with mobile breakpoints at 768px
- All styles embedded in HTML (no separate CSS files)
- All JavaScript embedded in HTML (no separate JS files)

### Statistics Calculations
- **Total Burned**: Last cumulative value from CSV
- **Avg Daily Burn (All Time)**: Average of all non-zero daily burn amounts
- **Avg Daily Burn (7D)**: Average of last 7 days of actual burn data

## Deployment

This is a GitHub Pages site. Changes pushed to the main branch are automatically deployed to burn.atomhe.art.
