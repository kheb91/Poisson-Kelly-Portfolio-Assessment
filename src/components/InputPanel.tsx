
import React, { useState, useEffect } from 'react';
import { ModelParams } from '../utils/poissonKelly';
import { Info, Download, Loader2 } from 'lucide-react';

interface InputPanelProps {
  params: ModelParams;
  onChange: (newParams: ModelParams) => void;
}

const NumberInput = ({ 
  label, 
  value, 
  onChange, 
  step = "0.01", 
  tooltip 
}: { 
  label: string, 
  value: number, 
  onChange: (val: number) => void, 
  step?: string, 
  tooltip?: string 
}) => {
  const [localValue, setLocalValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value.toString());
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        {tooltip && (
          <div className="group relative cursor-help">
            <Info size={12} className="text-gray-500" />
            <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-gray-800 text-xs text-gray-300 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        step={step}
        className="w-full bg-[#1A1A1A] border border-gray-700 rounded p-2 text-sm text-gray-200 focus:border-emerald-500 focus:outline-none font-mono transition-colors"
      />
    </div>
  );
};

export default function InputPanel({ params, onChange }: InputPanelProps) {
  const [ticker, setTicker] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateParam = (name: keyof ModelParams, value: number) => {
    onChange({
      ...params,
      [name]: value,
    });
  };

  const fetchMarketData = async () => {
    if (!ticker) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/market-data?ticker=${ticker}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      
      onChange({
        ...params,
        mu: data.mu,
        sigma: data.sigma,
        lambda: data.lambda,
        jumpMean: data.jumpMean,
        jumpVol: data.jumpVol,
        riskFree: data.riskFree
      });
    } catch (err) {
      setError('Failed to load market data. Please check the ticker.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#111] border-r border-gray-800 p-6 h-full overflow-y-auto w-80 flex-shrink-0">
      <h2 className="text-lg font-semibold text-white mb-6 font-sans">Model Inputs</h2>
      
      {/* Live Data Fetcher */}
      <div className="mb-6 p-4 bg-[#1A1A1A] border border-gray-700 rounded-lg">
        <label className="text-xs font-medium text-emerald-500 uppercase tracking-wider mb-2 block">Load Live Data</label>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="TICKER (e.g. SPY)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="flex-1 bg-[#0A0A0A] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono uppercase"
          />
          <button
            onClick={fetchMarketData}
            disabled={isLoading || !ticker}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white p-2 rounded transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-emerald-500 text-xs font-bold uppercase mb-3 border-b border-emerald-500/20 pb-1">Market Parameters</h3>
          <NumberInput 
            label="Exp. Annual Return (μ)" 
            value={params.mu}
            onChange={(v) => updateParam('mu', v)}
            tooltip="Total expected annual return including jumps."
          />
          <NumberInput 
            label="Annual Volatility (σ)" 
            value={params.sigma}
            onChange={(v) => updateParam('sigma', v)}
            tooltip="Standard deviation of the diffusion component."
          />
          <NumberInput 
            label="Risk-Free Rate (r)" 
            value={params.riskFree}
            onChange={(v) => updateParam('riskFree', v)}
            tooltip="Annual risk-free interest rate."
          />
        </div>

        <div>
          <h3 className="text-orange-500 text-xs font-bold uppercase mb-3 border-b border-orange-500/20 pb-1">Jump Parameters</h3>
          <NumberInput 
            label="Jump Intensity (λ)" 
            value={params.lambda}
            onChange={(v) => updateParam('lambda', v)}
            step="0.1"
            tooltip="Average number of jump events per year."
          />
          <NumberInput 
            label="Jump Mean (μ_J)" 
            value={params.jumpMean}
            onChange={(v) => updateParam('jumpMean', v)}
            tooltip="Mean of the log-jump size. e.g. -0.1 is approx -10%."
          />
          <NumberInput 
            label="Jump Volatility (σ_J)" 
            value={params.jumpVol}
            onChange={(v) => updateParam('jumpVol', v)}
            tooltip="Standard deviation of the jump size."
          />
        </div>

        <div>
          <h3 className="text-blue-500 text-xs font-bold uppercase mb-3 border-b border-blue-500/20 pb-1">Portfolio Settings</h3>
          <NumberInput 
            label="Initial Wealth" 
            value={params.initialWealth}
            onChange={(v) => updateParam('initialWealth', v)}
            step="1000"
          />
          <NumberInput 
            label="Horizon (Years)" 
            value={params.horizon}
            onChange={(v) => updateParam('horizon', v)}
            step="0.5"
          />
          <NumberInput 
            label="Simulations" 
            value={params.simulations}
            onChange={(v) => updateParam('simulations', v)}
            step="10"
          />
          <NumberInput 
            label="Max Leverage (Cap)" 
            value={params.maxLeverage}
            onChange={(v) => updateParam('maxLeverage', v)}
            step="0.1"
            tooltip="Maximum allowed leverage. Set to 1.0 for cash-only (no margin)."
          />
          {/* NEW SLIDER: CONCENTRATION LIMIT */}
          <NumberInput 
            label="Max Position Size (Cap)" 
            value={params.maxAssetWeight * 100}
            onChange={(v) => updateParam('maxAssetWeight', v / 100)}
            step="5"
            tooltip="Max % of the equity portfolio a single stock can occupy (e.g., 30 for 30%). Prevents overconcentration."
          />
        </div>

        <div>
          <h3 className="text-red-500 text-xs font-bold uppercase mb-3 border-b border-red-500/20 pb-1">Risk Management</h3>
          
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">Kelly Fraction</label>
            <select
              value={params.kellyFraction}
              onChange={(e) => updateParam('kellyFraction', parseFloat(e.target.value))}
              className="w-full bg-[#1A1A1A] border border-gray-700 rounded p-2 text-sm text-gray-200 focus:border-red-500 focus:outline-none font-mono transition-colors"
            >
              <option value={1.0}>Full Kelly (1.0x)</option>
              <option value={0.5}>Half Kelly (0.5x)</option>
              <option value={0.25}>Quarter Kelly (0.25x)</option>
              <option value={0.75}>Three-Quarter Kelly (0.75x)</option>
            </select>
          </div>

          <NumberInput 
            label="Friction Cost (Annual %)" 
            value={params.frictionCost * 100}
            onChange={(v) => updateParam('frictionCost', v / 100)}
            step="0.01"
            tooltip="Estimated annual drag from spreads and fees."
          />
          
          <NumberInput 
            label="Max Drawdown Limit (%)" 
            value={params.maxDrawdown * 100}
            onChange={(v) => updateParam('maxDrawdown', v / 100)}
            step="1"
            tooltip="Maximum acceptable drawdown (CVaR 95%). Model will reduce leverage if breached."
          />
        </div>
      </div>
    </div>
  );
}
