
import React, { useState, useEffect } from 'react';
import { ModelParams, SimulationResult, runSimulation, calculateGrowthRate } from './utils/poissonKelly';
import { MacroParams, DEFAULT_MACRO, adjustParamsWithMacro } from './utils/macroEconomics';
import { Asset, optimizePortfolio } from './utils/portfolioOptimizer';
import InputPanel from './components/InputPanel';
import MacroInputPanel from './components/MacroInputPanel';
import AssetInputPanel from './components/AssetInputPanel';
import SummaryMetrics from './components/SummaryMetrics';
import SimulationChart from './components/SimulationChart';
import KellyCurveChart from './components/KellyCurveChart';
import ConvictionCard from './components/ConvictionCard';
import { Play, RotateCcw, Activity, Settings2, Globe, Briefcase, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const DEFAULT_PARAMS: ModelParams = {
  mu: 0.10,          // 10% expected return
  sigma: 0.20,       // 20% volatility
  riskFree: 0.04,    // 4% risk-free rate
  lambda: 0.5,       // 0.5 jumps per year (1 every 2 years)
  jumpMean: -0.20,   // -20% average jump size
  jumpVol: 0.10,     // 10% volatility in jump size
  horizon: 3,        // 3 years
  initialWealth: 67000,
  simulations: 9990,  // 9990 simulations
  maxLeverage: 1.0,  // Default to no leverage (cash only)
  maxAssetWeight: 0.30, // Default to a 30% max position size cap to force diversification
  kellyFraction: 0.5, // Default to Half-Kelly for Estimation Risk mitigation
  frictionCost: 0.001, // 0.1% friction
  maxDrawdown: 0.25  // 25% max drawdown
};

const DEFAULT_ASSETS: Asset[] = [
  // Benchmarks
  { id: '1', ticker: 'SPY', mu: 0.14, sigma: 0.16, lambda: 0.5, jumpMean: -0.20, jumpVol: 0.10 },
  { id: '2', ticker: 'QQQ', mu: 0.15, sigma: 0.22, lambda: 0.5, jumpMean: -0.25, jumpVol: 0.15 },
  { id: '3', ticker: 'TLT', mu: 0.04, sigma: 0.12, lambda: 0.1, jumpMean: -0.05, jumpVol: 0.05 },

  // Mega-Cap Tech
  { id: 't1', ticker: 'GOOGL', mu: 0.20, sigma: 0.28, lambda: 1.0, jumpMean: -0.10, jumpVol: 0.10 },
  { id: 't2', ticker: 'META', mu: 0.28, sigma: 0.35, lambda: 1.2, jumpMean: -0.12, jumpVol: 0.12 },
  { id: 't3', ticker: 'AMZN', mu: 0.18, sigma: 0.30, lambda: 1.0, jumpMean: -0.10, jumpVol: 0.10 },
  { id: 't4', ticker: 'MSFT', mu: 0.15, sigma: 0.25, lambda: 0.8, jumpMean: -0.08, jumpVol: 0.09 },
  { id: 't40', ticker: 'AAPL', mu: 0.12, sigma: 0.24, lambda: 0.8, jumpMean: -0.08, jumpVol: 0.08 },
  { id: 't18', ticker: 'NFLX', mu: 0.22, sigma: 0.38, lambda: 1.5, jumpMean: -0.12, jumpVol: 0.14 },

  // Semiconductors
  { id: 't10', ticker: 'NVDA', mu: 0.35, sigma: 0.50, lambda: 2.0, jumpMean: -0.15, jumpVol: 0.18 },
  { id: 't9', ticker: 'AMD', mu: 0.25, sigma: 0.50, lambda: 1.8, jumpMean: -0.14, jumpVol: 0.16 },
  { id: 't5', ticker: 'ASML', mu: 0.18, sigma: 0.38, lambda: 1.2, jumpMean: -0.12, jumpVol: 0.13 },
  { id: 't6', ticker: 'AMAT', mu: 0.20, sigma: 0.40, lambda: 1.5, jumpMean: -0.13, jumpVol: 0.14 },
  { id: 't8', ticker: 'TSM', mu: 0.20, sigma: 0.35, lambda: 1.2, jumpMean: -0.12, jumpVol: 0.12 },
  { id: 't7', ticker: 'INTC', mu: 0.05, sigma: 0.38, lambda: 1.5, jumpMean: -0.14, jumpVol: 0.15 },
  { id: 't11', ticker: 'AVGO', mu: 0.22, sigma: 0.38, lambda: 1.2, jumpMean: -0.12, jumpVol: 0.13 },
  { id: 't12', ticker: 'ARM', mu: 0.30, sigma: 0.55, lambda: 2.0, jumpMean: -0.15, jumpVol: 0.18 },
  { id: 't14', ticker: 'NXPI', mu: 0.15, sigma: 0.35, lambda: 1.2, jumpMean: -0.11, jumpVol: 0.12 },
  { id: 't32', ticker: 'MPWR', mu: 0.20, sigma: 0.40, lambda: 1.5, jumpMean: -0.13, jumpVol: 0.14 },

  // Speculative / High-Vol
  { id: 't13', ticker: 'TSLA', mu: 0.25, sigma: 0.60, lambda: 2.5, jumpMean: -0.18, jumpVol: 0.20 },
  { id: 't34', ticker: 'IONQ', mu: 0.30, sigma: 0.90, lambda: 3.5, jumpMean: -0.20, jumpVol: 0.25 },
  { id: 't37', ticker: 'JOBY', mu: 0.15, sigma: 0.80, lambda: 3.0, jumpMean: -0.20, jumpVol: 0.25 },
  { id: 't15', ticker: 'POET', mu: 0.20, sigma: 0.85, lambda: 3.5, jumpMean: -0.22, jumpVol: 0.28 },
  { id: 't19', ticker: 'NBIS', mu: 0.25, sigma: 0.70, lambda: 3.0, jumpMean: -0.18, jumpVol: 0.22 },
  { id: 't16', ticker: 'KWEB', mu: 0.15, sigma: 0.45, lambda: 2.0, jumpMean: -0.15, jumpVol: 0.18 },

  // Healthcare & Biotech
  { id: 't23', ticker: 'UNH', mu: 0.12, sigma: 0.28, lambda: 1.0, jumpMean: -0.10, jumpVol: 0.10 },
  { id: 't24', ticker: 'NVO', mu: 0.18, sigma: 0.35, lambda: 1.5, jumpMean: -0.12, jumpVol: 0.14 },
  { id: 't25', ticker: 'QURE', mu: 0.15, sigma: 0.90, lambda: 4.0, jumpMean: -0.25, jumpVol: 0.30 },
  { id: 't26', ticker: 'SRPT', mu: 0.12, sigma: 0.75, lambda: 3.5, jumpMean: -0.22, jumpVol: 0.28 },
  { id: 't27', ticker: 'DXCM', mu: 0.15, sigma: 0.45, lambda: 2.0, jumpMean: -0.15, jumpVol: 0.16 },

  // Enterprise Tech & Fintech
  { id: 't20', ticker: 'ADBE', mu: 0.15, sigma: 0.38, lambda: 1.5, jumpMean: -0.13, jumpVol: 0.14 },
  { id: 't21', ticker: 'CRM', mu: 0.18, sigma: 0.35, lambda: 1.2, jumpMean: -0.12, jumpVol: 0.13 },
  { id: 't41', ticker: 'PANW', mu: 0.22, sigma: 0.38, lambda: 1.5, jumpMean: -0.12, jumpVol: 0.14 },
  { id: 't17', ticker: 'UBER', mu: 0.20, sigma: 0.40, lambda: 1.5, jumpMean: -0.13, jumpVol: 0.14 },
  { id: 't36', ticker: 'PYPL', mu: 0.12, sigma: 0.40, lambda: 1.5, jumpMean: -0.14, jumpVol: 0.15 },

  // Industrials, Energy & Consumer
  { id: 't29', ticker: 'GEV', mu: 0.25, sigma: 0.50, lambda: 2.0, jumpMean: -0.14, jumpVol: 0.16 },
  { id: 't31', ticker: 'ETN', mu: 0.15, sigma: 0.30, lambda: 1.0, jumpMean: -0.10, jumpVol: 0.11 },
  { id: 't33', ticker: 'VST', mu: 0.22, sigma: 0.45, lambda: 2.0, jumpMean: -0.14, jumpVol: 0.16 },
  { id: 't30', ticker: 'ALB', mu: 0.10, sigma: 0.50, lambda: 2.0, jumpMean: -0.16, jumpVol: 0.18 },
  { id: 't35', ticker: 'UPS', mu: 0.08, sigma: 0.30, lambda: 1.0, jumpMean: -0.10, jumpVol: 0.10 },
  { id: 't38', ticker: 'WM', mu: 0.10, sigma: 0.22, lambda: 0.8, jumpMean: -0.08, jumpVol: 0.09 },
  { id: 't28', ticker: 'LULU', mu: 0.15, sigma: 0.38, lambda: 1.5, jumpMean: -0.12, jumpVol: 0.14 },
  { id: 't39', ticker: 'CMG', mu: 0.15, sigma: 0.35, lambda: 1.2, jumpMean: -0.11, jumpVol: 0.12 },
];

export default function App() {
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);
  const [macroParams, setMacroParams] = useState<MacroParams>(DEFAULT_MACRO);
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [correlation, setCorrelation] = useState(0.5);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'macro' | 'portfolio'>('model');
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [portfolioWeights, setPortfolioWeights] = useState<Asset[]>([]);
  const [benchmarkGrowth, setBenchmarkGrowth] = useState<number | null>(null);
  const [decision, setDecision] = useState<'STRONG GO' | 'SCALED GO' | 'NO-GO' | null>(null);
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [alpha, setAlpha] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null);
  const [finalLambda, setFinalLambda] = useState<number | null>(null);
  const [covarianceMatrix, setCovarianceMatrix] = useState<number[][] | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    setAdjustments([]);
    setBenchmarkGrowth(null);
    setDecision(null);
    setDecisionReason('');
    setAlpha(null);
    setBeta(null);
    setFinalLambda(null);

    // Fetch SPY Benchmark Data
    let spyGrowthRate = 0;
    try {
      const res = await fetch('/api/market-data?ticker=SPY');
      const data = await res.json();

      if (data.mu && data.sigma) {
        const spyParams: ModelParams = {
          ...params,
          mu: data.mu,
          sigma: data.sigma,
          lambda: data.lambda || params.lambda,
          jumpMean: data.jumpMean || params.jumpMean,
          jumpVol: data.jumpVol || params.jumpVol,
          frictionCost: 0
        };
        spyGrowthRate = calculateGrowthRate(1.0, spyParams);
        setBenchmarkGrowth(spyGrowthRate);
      }
    } catch (e) {
      console.error("Failed to fetch SPY benchmark", e);
      const fallbackSpyParams: ModelParams = { ...params, mu: 0.10, sigma: 0.15, frictionCost: 0 };
      spyGrowthRate = calculateGrowthRate(1.0, fallbackSpyParams);
      setBenchmarkGrowth(spyGrowthRate);
    }

    // Fetch Portfolio Covariance
    let covMatrix: number[][] | undefined = undefined;
    let assetBetas: number[] = [];
    let spyMu = 0.10;

    if (assets.length > 1) {
      try {
        const tickers = assets.map(a => a.ticker);
        const res = await fetch('/api/portfolio-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers })
        });
        const data = await res.json();
        if (data.covarianceMatrix) {
          covMatrix = data.covarianceMatrix;
          assetBetas = data.assetBetas || [];
          spyMu = data.spyMu || 0.10;
        }
      } catch (e) {
        console.error("Failed to fetch covariance matrix", e);
      }
    }

    // Save to state for the UI Heatmap
    setCovarianceMatrix(covMatrix || null);

    setTimeout(() => {
      let finalParams = { ...params };
      let currentExplanations: string[] = [];

      // 1. Portfolio Optimization
      let optimalWeights: number[] = [];
      let baseMu = params.mu;
      let baseSigma = params.sigma;

      // FIX: Check if we have assets to optimize, regardless of which tab is active
      const isMultiAsset = assets.length > 0;

      if (isMultiAsset) {
        // Apply Friction Cost
        const assetsWithFriction = assets.map(a => ({
          ...a,
          mu: Math.max(params.riskFree, a.mu - params.frictionCost)
        }));

        const { weights, portMu, portSigma } = optimizePortfolio(
          assetsWithFriction,
          correlation,
          covMatrix,
          params.maxAssetWeight,
          macroParams.isStressTest
        );

        optimalWeights = weights;
        baseMu = portMu;
        baseSigma = portSigma;

        finalParams.mu = portMu;
        finalParams.sigma = portSigma;

        // Calculate Weighted Average Jump Parameters
        let weightedLambda = 0;
        let weightedJumpMean = 0;
        let weightedJumpVol = 0;
        let totalStockWeight = 0;

        weights.forEach((w, i) => {
          if (w > 0.001) {
            const asset = assets[i];
            const aLambda = asset.lambda !== undefined ? asset.lambda : params.lambda;
            const aJumpMean = asset.jumpMean !== undefined ? asset.jumpMean : params.jumpMean;
            const aJumpVol = asset.jumpVol !== undefined ? asset.jumpVol : params.jumpVol;

            weightedLambda += w * aLambda;
            weightedJumpMean += w * aJumpMean;
            weightedJumpVol += w * aJumpVol;
            totalStockWeight += w;
          }
        });

        if (totalStockWeight > 0.001) {
          finalParams.lambda = weightedLambda / totalStockWeight;
          finalParams.jumpMean = weightedJumpMean / totalStockWeight;
          finalParams.jumpVol = weightedJumpVol / totalStockWeight;
          currentExplanations.push(`Jump parameters aggregated from optimal portfolio weights.`);
        }

        currentExplanations.push(`Portfolio optimized (Max Growth). Friction: ${(params.frictionCost * 100).toFixed(2)}%.`);
      } else {
        setPortfolioWeights([]);
      }

      // 2. Apply Macro Adjustments
      const { adjusted, explanations } = adjustParamsWithMacro(finalParams, macroParams);

      // 3. Find True Optimal Leverage (Jump-Adjusted)
      const tempParams = { ...adjusted, maxLeverage: 10.0 };
      const initialRes = runSimulation(tempParams);
      const trueOptimalF = initialRes.optimalFraction;

      // 4. Apply Kelly Fraction
      let targetF = Math.min(trueOptimalF * params.kellyFraction, params.maxLeverage);

      // 5. Precision Binary Search for CVaR Limiting
      let safetyExplanations: string[] = [];

      let low = 0.0;
      let high = targetF;
      let mid = targetF;
      let res = initialRes;
      let finalCvar95 = 0;

      adjusted.maxLeverage = targetF;
      res = runSimulation(adjusted);
      let drawdowns = [...res.maxDrawdowns].sort((a, b) => a - b);
      let cvarIndex = Math.floor(drawdowns.length * 0.95);
      finalCvar95 = drawdowns[cvarIndex];

      if (finalCvar95 > params.maxDrawdown) {
        safetyExplanations.push(`Initial CVaR Breach (${(finalCvar95 * 100).toFixed(1)}% > ${(params.maxDrawdown * 100).toFixed(0)}%). Initiating precision risk control...`);

        while ((high - low) > 0.001) {
          mid = (low + high) / 2;
          adjusted.maxLeverage = mid;
          res = runSimulation(adjusted);

          drawdowns = [...res.maxDrawdowns].sort((a, b) => a - b);
          cvarIndex = Math.floor(drawdowns.length * 0.95);
          finalCvar95 = drawdowns[cvarIndex];

          if (finalCvar95 > params.maxDrawdown) {
            high = mid;
          } else {
            low = mid;
          }
        }

        adjusted.maxLeverage = low;
        res = runSimulation(adjusted);
        safetyExplanations.push(`Risk Control: Leverage precisely capped at ${(low * 100).toFixed(1)}% to satisfy Max Drawdown limit.`);
      }

      // 6. Update Portfolio Weights Display
      // We keep the optimalWeights exactly as they are (summing to 1.0 for the equity slice)
      const effectiveCashWeight = Math.max(0, 1 - res.optimalFraction);

      if (optimalWeights.length > 0) {
        const weightedAssets = assets.map((a, i) => ({
          ...a,
          weight: optimalWeights[i] // Raw equity weight (e.g., 30% NVDA)
        }));

        // Only show assets that actually received an allocation (> 0.1%)
        const filteredAssets = weightedAssets.filter(a => (a.weight || 0) > 0.001);

        setPortfolioWeights(filteredAssets);
      } else {
        setPortfolioWeights([]);
      }

      // 7. Calculate Alpha and Beta
      let finalBeta: number | null = null;
      let finalAlpha: number | null = null;

      if (isMultiAsset && assetBetas.length === optimalWeights.length) {
        const baseBeta = optimalWeights.reduce((sum, w, i) => sum + w * assetBetas[i], 0);
        finalBeta = res.optimalFraction * baseBeta;

        // Arithmetic expected return of leveraged portfolio
        const finalMu = params.riskFree + res.optimalFraction * (baseMu - params.riskFree);

        // Alpha = E[Rp] - (Rf + Beta * (E[Rm] - Rf))
        finalAlpha = (finalMu - params.riskFree) - finalBeta * (spyMu - params.riskFree);
      }

      // 8. Decision Engine
      const portfolioGrowth = res.maxGrowthRate;
      const hurdleRate = spyGrowthRate + params.frictionCost;

      let d: 'STRONG GO' | 'SCALED GO' | 'NO-GO' = 'NO-GO';
      let reason = '';

      if (effectiveCashWeight > 0.80 || portfolioGrowth < params.riskFree || (finalAlpha !== null && finalAlpha < -0.01)) {
        d = 'NO-GO';
        reason = 'Mathematical confirmation to abandon trade. Either Cash > 80%, Growth < Risk-Free, or deeply negative Alpha.';
      } else if (portfolioGrowth > hurdleRate && finalAlpha !== null && finalAlpha > 0.02 && effectiveCashWeight < 0.50) {
        d = 'STRONG GO';
        reason = `Proof of efficient diversification and edge. Growth > SPY + Friction, Alpha > 2.0%, Cash < 50%.`;
      } else if (portfolioGrowth > hurdleRate && finalAlpha !== null && finalAlpha > 0.02 && effectiveCashWeight >= 0.50) {
        d = 'SCALED GO';
        reason = `Strong edge (Alpha > 2.0%), but high Tail Risk constrains capital deployment (Cash ≥ 50%). Scale with caution.`;
      } else if (portfolioGrowth > params.riskFree) {
        d = 'SCALED GO';
        reason = `Profitable, but heavily reliant on broad market performance rather than distinct mathematical edge.`;
      } else {
        d = 'NO-GO';
        reason = `Projected growth is inferior to Risk-Free Rate. Abandon trade.`;
      }

      if (macroParams.isStressTest) {
        reason += ` ALLOCATION SOLVED UNDER 'CRASH STRESS TEST' ASSUMPTIONS (Correlations > 0.85).`;
      }

      setDecision(d);
      setDecisionReason(reason);
      setAlpha(finalAlpha);
      setBeta(finalBeta);
      setFinalLambda(finalParams.lambda);

      setAdjustments([...currentExplanations, ...explanations, ...safetyExplanations]);
      setResult(res);
      setIsRunning(false);
    }, 10);
  };

  // Run initial simulation on mount
  useEffect(() => {
    handleRun();
  }, []);

  return (
    <div className="flex h-screen bg-[#050505] text-gray-200 overflow-hidden font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <div className="bg-[#111] border-r border-gray-800 h-full w-80 flex-shrink-0 flex flex-col">
        {/* Sidebar Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('model')}
            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors ${activeTab === 'model' ? 'text-emerald-500 bg-[#1A1A1A] border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Settings2 size={14} />
            <span className="sr-only">Model</span>
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors ${activeTab === 'portfolio' ? 'text-blue-500 bg-[#1A1A1A] border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Briefcase size={14} />
            <span className="sr-only">Assets</span>
          </button>
          <button
            onClick={() => setActiveTab('macro')}
            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors ${activeTab === 'macro' ? 'text-purple-500 bg-[#1A1A1A] border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Globe size={14} />
            <span className="sr-only">Macro</span>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'model' ? (
            <InputPanel params={params} onChange={setParams} />
          ) : activeTab === 'portfolio' ? (
            <AssetInputPanel
              assets={assets}
              correlation={correlation}
              onAssetsChange={setAssets}
              onCorrelationChange={setCorrelation}
            />
          ) : (
            <div className="p-6">
              <MacroInputPanel params={macroParams} onChange={setMacroParams} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#0A0A0A]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">Poisson-Kelly Portfolio Architect</h1>
              <p className="text-xs text-gray-500 font-mono">MULTI-ASSET JUMP DIFFUSION MODEL • v2.0.0</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setParams(DEFAULT_PARAMS);
                setMacroParams(DEFAULT_MACRO);
                setAssets(DEFAULT_ASSETS);
              }}
              className="flex items-center space-x-2 px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              <RotateCcw size={14} />
              <span>RESET DEFAULTS</span>
            </button>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className={`
                flex items-center space-x-2 px-6 py-2 rounded-md font-medium text-sm transition-all
                ${isRunning
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40'
                }
              `}
            >
              {isRunning ? (
                <span className="animate-pulse">CALCULATING...</span>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>RUN ANALYSIS</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {result ? (
            <div className="max-w-7xl mx-auto space-y-6">
              <SummaryMetrics
                result={result}
                initialWealth={params.initialWealth}
                covarianceMatrix={covarianceMatrix}
                assets={assets}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SimulationChart result={result} />
                <KellyCurveChart result={result} />
              </div>

              {/* Portfolio Breakdown */}
              {(portfolioWeights.length > 0 || result.optimalFraction < 1) && (
                <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Optimal Portfolio Composition</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Render Stock Allocations */}
                    {portfolioWeights.map((asset) => {
                      // Total Allocation = Equity Weight * Optimal Leverage Fraction
                      const totalAllocation = (asset.weight || 0) * result.optimalFraction;
                      return (
                        <div key={asset.id} className="bg-[#111] p-4 rounded border border-gray-800 flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold text-white block">{asset.ticker}</span>
                            <span className="text-xs text-blue-400 font-medium">Equity Pie: {((asset.weight || 0) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-mono text-emerald-400 block">{(totalAllocation * 100).toFixed(1)}%</span>
                            <span className="text-[10px] text-gray-500 uppercase">Account Total</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Render Cash Allocation */}
                    {result.optimalFraction < 1.0 && (
                      <div className="bg-gray-900/50 p-4 rounded border border-gray-700 flex items-center justify-between">
                        <div>
                          <span className="text-lg font-bold text-gray-300 block">CASH</span>
                          <span className="text-xs text-gray-500 font-medium">Yield: {(params.riskFree * 100).toFixed(2)}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-mono text-gray-300 block">{((1 - result.optimalFraction) * 100).toFixed(1)}%</span>
                          <span className="text-[10px] text-gray-500 uppercase">Account Total</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detailed Analysis / Recommendation */}
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Investment Recommendation</h3>
                <div className="prose prose-invert prose-sm max-w-none text-gray-300 font-mono">
                  <p>
                    Based on the Multi-Asset Poisson-Kelly model, the optimal total leverage fraction is <strong className="text-emerald-400">{(result.optimalFraction * 100).toFixed(2)}%</strong> of the optimized portfolio.
                  </p>

                  <p className="text-xs text-gray-400 mt-1 mb-3">
                    Includes {params.kellyFraction}x Kelly scaling.
                    {result.optimalFraction < (result.unconstrainedFraction * params.kellyFraction) && (
                      <span> Further reduced by constraints (Max Leverage or CVaR Limit).</span>
                    )}
                  </p>

                  <p>
                    The <strong>Constrained Solver</strong> first determined the optimal asset mix (including Cash) to maximize geometric growth. The <strong>Sizing Model</strong> then adjusted the total exposure to account for Jump Risk (λ={finalLambda !== null ? finalLambda.toFixed(2) : params.lambda}) and Tail Risk (CVaR).
                  </p>

                  <p className="mt-2">
                    This allocation maximizes the expected geometric growth rate to <strong className="text-blue-400">{(result.maxGrowthRate * 100).toFixed(2)}%</strong> per annum.
                  </p>

                  {/* Macro Impact Section */}
                  {adjustments.length > 0 && (
                    <div className="mt-4 p-4 bg-purple-900/10 border border-purple-900/30 rounded text-purple-200/80 text-xs">
                      <strong className="block mb-2 text-purple-400 uppercase tracking-wider">Model Adjustments:</strong>
                      <ul className="list-disc pl-4 space-y-1">
                        {adjustments.map((adj, i) => (
                          <li key={i}>{adj}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-yellow-900/10 border border-yellow-900/30 rounded text-yellow-200/80 text-xs">
                    <strong>ESTIMATION RISK WARNING:</strong> The output above assumes your inputs are accurate.
                    {params.kellyFraction >= 1.0 ?
                      ` You are running Full-Kelly (1.0x). Given the current macro volatility, scaling down to a "Half-Kelly" is strongly recommended to algorithmically protect against estimation errors.` :
                      ` You are appropriately commanding a computationally constrained ${params.kellyFraction}x Kelly fraction, heavily mitigating variance drain and estimation risk.`}
                  </div>
                </div>
              </div>

              {/* Conviction Output */}
              <ConvictionCard
                decision={decision}
                reason={decisionReason}
                portfolioGrowth={result.maxGrowthRate}
                spyGrowth={benchmarkGrowth}
                riskFree={params.riskFree}
                alpha={alpha}
                beta={beta}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Click "RUN ANALYSIS" to generate model outputs.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
