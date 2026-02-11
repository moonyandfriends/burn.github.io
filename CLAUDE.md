# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static website dashboard for monitoring STRD (Stride) token burns on the Stride blockchain. This is a GitHub Pages site hosted at burn.atomhe.art with no build process or dependencies.

## Development Commands

Since this is a static site with no build tools, run it locally using any HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Then navigate to http://localhost:8000
```

No build, test, or lint commands - this is pure HTML/CSS/JavaScript.

## Architecture

### Files Structure
- **index.html** - Burn stats dashboard with Chart.js visualizations and statistics
- **auctions.html** - Protocol-Owned Liquidity auction bidding interface
- **userburns.html** - Transaction listing page querying Stride RPC directly
- **static/strdburn.ico** - Favicon
- **CNAME** - Custom domain configuration for GitHub Pages

### Navigation
Both pages share a consistent header with:
- Navigation tabs: "Auctions" and "Burn Stats"
- Wallet connect button (top-right) supporting Keplr and Leap wallets
- Responsive design maintaining state across page navigation via localStorage

### Data Flow

**Main Dashboard (index.html)**:
1. Fetches CSV from `https://storage.googleapis.com/stride-public-data/burn_data/strd_burn.csv`
2. CSV contains: timestamp and total burned (in microSTRD)
3. Converts microSTRD to STRD (1 STRD = 1,000,000 microSTRD)
4. Calculates daily burn amounts by diffing cumulative totals
5. Displays via Chart.js with three timeframes (7d, 30d, all time) and two chart types (cumulative, individual)

**Auctions Page (auctions.html)**:
1. Fetches auctions from `https://stride-api.polkachu.com/stride/auction/v1/auctions`
2. Falls back to sample data if API unavailable
3. Displays auction cards with: status, discount percentage, selling/payment tokens, min bid, total sold
4. Wallet integration using CosmJS from CDN (@cosmjs/stargate, @cosmjs/proto-signing)
5. Bid submission creates `MsgPlaceBid` transaction with typeUrl `/stride.auction.MsgPlaceBid`
6. Modal-based bidding interface with real-time token estimate calculations

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
