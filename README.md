<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Poisson-Kelly Portfolio Architect

A sophisticated multi-asset jump diffusion model tool designed to optimize portfolio allocation and growth using the Kelly Criterion.

## ✨ Features

- **Kelly Criterion Growth Optimization**: Determines the optimal leverage and asset allocation fractions to maximize geometric growth.
- **Multi-Asset Portfolio Builder & Optimization**: Calculates the optimal portfolio composition by factoring in Expected Return (Mu), Volatility (Sigma), covariance, and beta.
- **Live Market Data**: Integrates with the `yahoo-finance2` API for live fetching of historical prices, target prices, analyst estimates, and SPY correlations.
- **Jump Risk Assessment**: Calibrates for market crashes (lambda, jump mean, jump volatility) and evaluates tail risk.
- **Macro-Economic Toggles**: Dynamic adjustments for inflation and Federal Funds Rates, instantly updating the underlying model assumptions.
- **Risk Mitigation**: Includes Conditional Value at Risk (CVaR) limits and precise fraction-scaling down for portfolio safety.

## 🛠 Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide React
- **Backend**: Express, `simple-statistics`, `yahoo-finance2`

## 🚀 Run Locally

**Prerequisites:**  Node.js

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Set Environment Variables**:
   Update the `.env.local` file to include your API keys if required.
3. **Run the app**:
   ```bash
   npm run dev
   ```
   The backend server will start on port `3000` alongside Vite. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.
