
import express from 'express';
import { createServer as createViteServer } from 'vite';
import YahooFinanceClass from 'yahoo-finance2';
const yahooFinance = new YahooFinanceClass();
import * as ss from 'simple-statistics';
import { calculateArithmeticDrift, calculateLedoitWolfCovariance, mleJumpDiffusion } from './src/utils/statistics';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Get Market Data
  app.get('/api/market-data', async (req, res) => {
    const ticker = req.query.ticker as string;
    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

    try {
      // 1. Fetch Historical Data (for Risk & Beta)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 5);

      const historical: any = await yahooFinance.historical(ticker, {
        period1: startDate.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1d' as const
      });

      if (!historical || historical.length < 252) {
        return res.status(404).json({ error: 'Insufficient historical data found' });
      }

      const logReturns: number[] = [];
      for (let i = 1; i < historical.length; i++) {
        const prev = historical[i - 1].adjClose || historical[i - 1].close;
        const curr = historical[i].adjClose || historical[i].close;
        if (prev && curr) logReturns.push(Math.log(curr / prev));
      }

      // 2. Calculate Volatility (Risk)
      const stdDailyReturn = ss.standardDeviation(logReturns);
      const sigma = stdDailyReturn * Math.sqrt(252);

      // 3. Jump Calibration using MLE (Constrained to Crashes)
      const { lambda, jumpMean, jumpVol } = mleJumpDiffusion(logReturns);

      // 4. Fetch Live Quote (For Analyst Targets & Beta)
      const quote: any = await yahooFinance.quote(ticker);

      let riskFree = 0.04;
      try {
        const irxQuote: any = await yahooFinance.quote('^IRX');
        if (irxQuote && irxQuote.regularMarketPrice) riskFree = irxQuote.regularMarketPrice / 100;
      } catch (e) { console.warn('Failed to fetch ^IRX'); }

      // NEW: Fetch Deep Summary Data for Target Price and Beta
      let targetPrice = null;
      let beta = 1.0;
      try {
        const summary = await yahooFinance.quoteSummary(ticker, {
          // Added defaultKeyStatistics for ETFs
          modules: ['financialData', 'summaryDetail', 'defaultKeyStatistics']
        });
        targetPrice = summary.financialData?.targetMeanPrice || null;
        beta = (summary.summaryDetail?.beta || summary.financialData?.beta || summary.defaultKeyStatistics?.beta3Year || 1.0) as number;
      } catch (e) {
        console.warn(`Failed to fetch deep summary for ${ticker}`);
      }

      // 5. HYBRID EXPECTED RETURN (μ) LOGIC
      let mu = 0;
      let returnMethod = "";

      const currentPrice = quote.regularMarketPrice;

      if (currentPrice && targetPrice && targetPrice > 0) {
        // Option A: Live Analyst 12-Month Target
        mu = (targetPrice - currentPrice) / currentPrice;
        returnMethod = "Analyst Target";
      } else {
        // Option B: Historical Drift Rollback
        const { mu: historicalMu } = calculateArithmeticDrift(logReturns);
        mu = historicalMu;
        returnMethod = `Trailing 5Yr Drift`;
      }

      res.json({
        ticker: ticker.toUpperCase(),
        mu,
        sigma,
        lambda,
        jumpMean,
        jumpVol,
        riskFree,
        returnMethod, // Useful for debugging
        dataPoints: logReturns.length,
        jumpsDetected: Math.round(lambda * (logReturns.length / 252))
      });

    } catch (error) {
      console.error('Error fetching market data:', error);
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });

  // API Route: Get Portfolio Data (Covariance Matrix)
  app.post('/api/portfolio-data', async (req, res) => {
    const { tickers } = req.body; // Expecting { tickers: string[] }

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Tickers array is required' });
    }

    try {
      // 1. Fetch Historical Data for all tickers + SPY
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 5); // 5 years of data

      const queryOptions = {
        period1: startDate.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1d' as const
      };

      const tickersWithSpy = [...tickers];
      if (!tickersWithSpy.includes('SPY')) {
        tickersWithSpy.push('SPY');
      }

      const historicalDataPromises = tickersWithSpy.map(async ticker => {
        try {
          const data = await yahooFinance.historical(ticker, queryOptions);
          return { ticker, data };
        } catch (e) {
          return { ticker, data: null };
        }
      });

      const results = await Promise.all(historicalDataPromises);

      // Filter out failed fetches
      const validResults = results.filter(item => item.data && item.data.length > 0);

      // We must have all requested tickers. SPY is also highly desired.
      const validTickers = validResults.map(r => r.ticker);
      const missingTickers = tickers.filter(t => !validTickers.includes(t));

      if (missingTickers.length > 0) {
        return res.status(400).json({ error: `Failed to fetch data for: ${missingTickers.join(', ')}` });
      }

      // 2. Align Data by Date
      const priceMap = new Map<string, { [ticker: string]: number }>();

      validResults.forEach(({ ticker, data }) => {
        data.forEach((day: any) => {
          const dateStr = day.date.toISOString().split('T')[0];
          const close = day.adjClose || day.close;
          if (close) {
            if (!priceMap.has(dateStr)) {
              priceMap.set(dateStr, {});
            }
            priceMap.get(dateStr)![ticker] = close;
          }
        });
      });

      // Filter dates where we have data for ALL valid tickers
      const sortedDates = Array.from(priceMap.keys()).sort();
      const alignedPrices: { [ticker: string]: number }[] = [];

      sortedDates.forEach(date => {
        const prices = priceMap.get(date)!;
        if (Object.keys(prices).length === validTickers.length) {
          alignedPrices.push(prices);
        }
      });

      if (alignedPrices.length < 252) {
        return res.status(400).json({ error: 'Insufficient overlapping historical data' });
      }

      // 3. Calculate Daily Log Returns
      const returnsMatrix: number[][] = tickers.map(() => []);
      const spyReturns: number[] = [];

      for (let i = 1; i < alignedPrices.length; i++) {
        const prev = alignedPrices[i - 1];
        const curr = alignedPrices[i];

        tickers.forEach((t, idx) => {
          const r = Math.log(curr[t] / prev[t]);
          returnsMatrix[idx].push(r);
        });

        if (validTickers.includes('SPY')) {
          spyReturns.push(Math.log(curr['SPY'] / prev['SPY']));
        }
      }

      // 4. Calculate Covariance Matrix using Ledoit-Wolf Shrinkage
      const covMatrix = calculateLedoitWolfCovariance(returnsMatrix);

      // 5. Calculate Beta to SPY and SPY Mu
      const assetBetas: number[] = [];
      let spyMu = 0.10; // Default fallback

      if (spyReturns.length > 0) {
        const { mu: calculatedSpyMu } = calculateArithmeticDrift(spyReturns);
        spyMu = calculatedSpyMu;

        const spyVar = ss.variance(spyReturns);

        tickers.forEach((t, idx) => {
          const assetRet = returnsMatrix[idx];
          const cov = ss.sampleCovariance(assetRet, spyReturns);
          const beta = cov / spyVar;
          assetBetas.push(beta);
        });
      } else {
        tickers.forEach(() => assetBetas.push(1.0)); // Fallback beta
      }

      res.json({
        tickers,
        covarianceMatrix: covMatrix,
        assetBetas,
        spyMu,
        dataPoints: returnsMatrix[0].length
      });

    } catch (error) {
      console.error('Error calculating portfolio data:', error);
      res.status(500).json({ error: 'Internal server error', details: String(error) });
    }
  });

  // API Route: Get Forward-Looking Jump Risk (Options Volatility Skew)
  app.get('/api/options-data', async (req, res) => {
    const ticker = req.query.ticker as string;
    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

    try {
      // 1. Get current price
      const quote: any = await yahooFinance.quote(ticker);
      const currentPrice = quote.regularMarketPrice;

      if (!currentPrice) {
        return res.status(404).json({ error: 'Could not fetch current price' });
      }

      // 2. Fetch options chain
      const optionsInfo = await yahooFinance.options(ticker);

      if (!optionsInfo || !optionsInfo.expirationDates || optionsInfo.expirationDates.length === 0) {
        return res.status(404).json({ error: 'No options data available for this ticker' });
      }

      // 3. Find target expiration date (~30-60 days out is ideal for skew)
      const now = new Date();
      let targetDate = optionsInfo.expirationDates[0]; // Default to closest

      for (const date of optionsInfo.expirationDates) {
        const daysToExpiry = (date.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (daysToExpiry >= 30) {
          targetDate = date;
          break; // First one that is at least 30 days out
        }
      }

      // 4. Fetch the specific chain for that date
      const chain = await yahooFinance.options(ticker, { date: targetDate });
      const calls = chain.options[0].calls;
      const puts = chain.options[0].puts;

      if (!calls.length || !puts.length) {
        return res.status(404).json({ error: 'Incomplete options chain' });
      }

      // 5. Find At-The-Money (ATM) Volatility
      // Closest call strike to current price
      let atmCall = calls[0];
      let minDiff = Math.abs(atmCall.strike - currentPrice);
      for (const call of calls) {
        const diff = Math.abs(call.strike - currentPrice);
        if (diff < minDiff) {
          minDiff = diff;
          atmCall = call;
        }
      }

      const atmVol = atmCall.impliedVolatility || 0;

      // 6. Find 10% Out-Of-The-Money (OTM) Put Volatility
      const targetPutStrike = currentPrice * 0.90; // 10% OTM
      let otmPut = puts[0];
      let minPutDiff = Math.abs(otmPut.strike - targetPutStrike);
      for (const put of puts) {
        const diff = Math.abs(put.strike - targetPutStrike);
        if (diff < minPutDiff) {
          minPutDiff = diff;
          otmPut = put;
        }
      }

      const otmVol = otmPut.impliedVolatility || 0;

      // 7. Derive Jump Parameters from actual market data

      // Sample OTM put strikes at 5% intervals from 5% to 30% OTM
      const otmLevels = [0.95, 0.90, 0.85, 0.80, 0.75, 0.70];
      const samples: { logMoneyness: number; weight: number }[] = [];

      for (const level of otmLevels) {
        const targetStrike = currentPrice * level;
        let bestPut = puts[0];
        let bestDiff = Math.abs(bestPut.strike - targetStrike);
        for (const p of puts) {
          const d = Math.abs(p.strike - targetStrike);
          if (d < bestDiff) {
            bestDiff = d;
            bestPut = p;
          }
        }
        const iv = bestPut.impliedVolatility || 0;
        const excessIV = Math.max(0, iv - atmVol);
        if (excessIV > 0) {
          samples.push({
            logMoneyness: Math.log(bestPut.strike / currentPrice),
            weight: excessIV
          });
        }
      }

      // λ (Jump Intensity): total implied crash demand = sum of excess IV across all sampled OTM puts
      const skew = otmVol - atmVol;
      let impliedLambda = 0;
      if (skew > 0) {
        impliedLambda = Math.min(5.0, skew * 10);
      }

      // μ_J (Jump Mean): IV-excess-weighted average log-moneyness across OTM put surface
      // High-vol stocks like TSLA with deep OTM IV concentration → deeper implied crash
      // Stable stocks like WM → shallow implied crash concentrated near ATM
      let impliedJumpMean = Math.log(otmPut.strike / currentPrice); // Fallback to 10% OTM
      if (samples.length >= 1) {
        const totalWeight = samples.reduce((s, x) => s + x.weight, 0);
        impliedJumpMean = samples.reduce((s, x) => s + x.weight * x.logMoneyness, 0) / totalWeight;
      }

      // σ_J (Jump Volatility): dispersion of the crash severity distribution
      // Wide spread of IV-weighted log-moneyness → uncertain crash extent
      let impliedJumpVol = 0.05; // Fallback
      if (samples.length >= 2) {
        const totalWeight = samples.reduce((s, x) => s + x.weight, 0);
        const weightedMean = samples.reduce((s, x) => s + x.weight * x.logMoneyness, 0) / totalWeight;
        const weightedVar = samples.reduce((s, x) => s + x.weight * Math.pow(x.logMoneyness - weightedMean, 2), 0) / totalWeight;
        impliedJumpVol = Math.min(1.0, Math.max(0.02, Math.sqrt(weightedVar)));
      }

      res.json({
        ticker: ticker.toUpperCase(),
        currentPrice,
        expirationDate: targetDate,
        atmStrike: atmCall.strike,
        atmVolatility: atmVol,
        otmPutStrike: otmPut.strike,
        otmPutVolatility: otmVol,
        volatilitySkew: skew,
        impliedLambda: parseFloat(impliedLambda.toFixed(4)),
        impliedJumpMean: parseFloat(impliedJumpMean.toFixed(4)),
        impliedJumpVol: parseFloat(impliedJumpVol.toFixed(4))
      });

    } catch (error) {
      console.error(`Error fetching options data for ${ticker}:`, error);
      res.status(500).json({ error: 'Failed to process options data' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
