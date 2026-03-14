
import React, { useState } from 'react';
import { Asset } from '../utils/portfolioOptimizer';
import { Plus, Trash2, Info, Download, Loader2, Zap } from 'lucide-react';

interface AssetInputPanelProps {
  assets: Asset[];
  correlation: number;
  onAssetsChange: (assets: Asset[]) => void;
  onCorrelationChange: (corr: number) => void;
}

export default function AssetInputPanel({ assets, correlation, onAssetsChange, onCorrelationChange }: AssetInputPanelProps) {
  const [newTicker, setNewTicker] = useState('');
  const [newMu, setNewMu] = useState(0.10);
  const [newSigma, setNewSigma] = useState(0.20);
  const [newLambda, setNewLambda] = useState(0.5);
  const [newJumpMean, setNewJumpMean] = useState(-0.1);
  const [newJumpVol, setNewJumpVol] = useState(0.1);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAssetData = async () => {
    if (!newTicker) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/market-data?ticker=${newTicker}`);
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setNewMu(parseFloat(data.mu.toFixed(4)));
      setNewSigma(parseFloat(data.sigma.toFixed(4)));
      if (data.lambda) setNewLambda(parseFloat(data.lambda.toFixed(4)));
      if (data.jumpMean) setNewJumpMean(parseFloat(data.jumpMean.toFixed(4)));
      if (data.jumpVol) setNewJumpVol(parseFloat(data.jumpVol.toFixed(4)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const syncAllAssets = async () => {
    setIsLoading(true);
    try {
      const updatedAssetsP = assets.map(async (a) => {
        try {
          const response = await fetch(`/api/market-data?ticker=${a.ticker}`);
          if (!response.ok) return a;
          const data = await response.json();
          return {
            ...a,
            mu: parseFloat(data.mu.toFixed(4)),
            sigma: parseFloat(data.sigma.toFixed(4)),
            lambda: data.lambda ? parseFloat(data.lambda.toFixed(4)) : a.lambda,
            jumpMean: data.jumpMean ? parseFloat(data.jumpMean.toFixed(4)) : a.jumpMean,
            jumpVol: data.jumpVol ? parseFloat(data.jumpVol.toFixed(4)) : a.jumpVol
          };
        } catch (e) {
          return a;
        }
      });
      const updatedAssets = await Promise.all(updatedAssetsP);
      onAssetsChange(updatedAssets);
    } catch (e) {
      console.error("Batch sync failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const syncAllOptionsData = async () => {
    setIsLoading(true);
    try {
      const updatedAssetsP = assets.map(async (a) => {
        try {
          const response = await fetch(`/api/options-data?ticker=${a.ticker}`);
          if (!response.ok) return a;
          const data = await response.json();
          if (data.impliedLambda !== undefined) {
            return {
              ...a,
              lambda: data.impliedLambda,
              jumpMean: data.impliedJumpMean ?? a.jumpMean,
              jumpVol: data.impliedJumpVol ?? a.jumpVol
            };
          }
          return a;
        } catch (e) {
          return a;
        }
      });
      const updatedAssets = await Promise.all(updatedAssetsP);
      onAssetsChange(updatedAssets);
    } catch (e) {
      console.error("Batch options sync failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const syncAssetOptionsData = async (asset: Asset) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/options-data?ticker=${asset.ticker}`);
      if (!response.ok) throw new Error('Failed to fetch options data');
      const data = await response.json();

      if (data.impliedLambda !== undefined) {
        const updatedAssets = assets.map(a =>
          a.id === asset.id
            ? {
              ...a,
              lambda: data.impliedLambda,
              jumpMean: data.impliedJumpMean ?? a.jumpMean,
              jumpVol: data.impliedJumpVol ?? a.jumpVol
            }
            : a
        );
        onAssetsChange(updatedAssets);
      }
    } catch (e) {
      console.error(e);
      alert(`Could not extract valid Options Volatility Skew for ${asset.ticker}. It may not have an active derivatives market.`);
    } finally {
      setIsLoading(false);
    }
  };

  const addAsset = () => {
    if (!newTicker) return;
    const newAsset: Asset = {
      id: Math.random().toString(36).substr(2, 9),
      ticker: newTicker.toUpperCase(),
      mu: newMu,
      sigma: newSigma,
      lambda: newLambda,
      jumpMean: newJumpMean,
      jumpVol: newJumpVol
    };
    onAssetsChange([...assets, newAsset]);
    setNewTicker('');
    setNewMu(0.10);
    setNewSigma(0.20);
    setNewLambda(0.5);
    setNewJumpMean(-0.1);
    setNewJumpVol(0.1);
  };

  const removeAsset = (id: string) => {
    onAssetsChange(assets.filter(a => a.id !== id));
  };

  const updateAsset = (id: string, field: keyof Asset, value: any) => {
    onAssetsChange(assets.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  return (
    <div className="bg-[#111] border-r border-gray-800 p-6 h-full overflow-y-auto w-80 flex-shrink-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white font-sans">Portfolio Assets</h2>
        <div className="flex flex-col space-y-2">
          <button
            onClick={syncAllAssets}
            disabled={isLoading || assets.length === 0}
            className="bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 px-2 py-1 flex items-center justify-center space-x-1 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
            title="Refresh historical returns and volatility"
          >
            {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
            <span>SYNC TBL</span>
          </button>
          <button
            onClick={syncAllOptionsData}
            disabled={isLoading || assets.length === 0}
            className="bg-orange-600/20 text-orange-500 hover:bg-orange-600/30 px-2 py-1 flex items-center justify-center space-x-1 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
            title="Batch Extract Forward-Looking Crash Probabilities (λ)"
          >
            {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
            <span>SYNC JUMPS</span>
          </button>
        </div>
      </div>

      <div className="mb-4 p-3 bg-blue-900/10 border border-blue-900/30 rounded text-xs text-blue-200/80">
        <p className="mb-2"><strong>How this works:</strong></p>
        <p>1. Define individual assets (Return/Vol/Jumps) to optimize the <em>relative</em> portfolio weights.</p>
        <p>2. The model aggregates these parameters to determine the total optimal allocation size.</p>
      </div>

      {/* Asset List */}
      <div className="space-y-4 mb-6">
        {assets.map((asset) => (
          <div key={asset.id} className="bg-[#1A1A1A] border border-gray-800 rounded p-3 relative group">
            <button
              onClick={() => removeAsset(asset.id)}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={asset.ticker}
                onChange={(e) => updateAsset(asset.id, 'ticker', e.target.value.toUpperCase())}
                className="bg-transparent text-sm font-bold text-white w-20 focus:outline-none border-b border-transparent focus:border-gray-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Return (μ)</label>
                <input
                  type="number"
                  value={asset.mu}
                  onChange={(e) => updateAsset(asset.id, 'mu', parseFloat(e.target.value))}
                  step="0.01"
                  className="w-full bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase block mb-1">Vol (σ)</label>
                <input
                  type="number"
                  value={asset.sigma}
                  onChange={(e) => updateAsset(asset.id, 'sigma', parseFloat(e.target.value))}
                  step="0.01"
                  className="w-full bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:border-red-500 focus:outline-none font-mono"
                />
              </div>
            </div>
            {/* Jump Params Row */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800/50">
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">λ</label>
                <input
                  type="number"
                  value={asset.lambda || 0.5}
                  onChange={(e) => updateAsset(asset.id, 'lambda', parseFloat(e.target.value))}
                  step="0.1"
                  className="w-full bg-[#111] border border-gray-800 rounded px-1 py-1 text-[10px] text-gray-400 focus:border-orange-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">μ_J</label>
                <input
                  type="number"
                  value={asset.jumpMean || -0.1}
                  onChange={(e) => updateAsset(asset.id, 'jumpMean', parseFloat(e.target.value))}
                  step="0.01"
                  className="w-full bg-[#111] border border-gray-800 rounded px-1 py-1 text-[10px] text-gray-400 focus:border-orange-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">σ_J</label>
                <input
                  type="number"
                  value={asset.jumpVol || 0.1}
                  onChange={(e) => updateAsset(asset.id, 'jumpVol', parseFloat(e.target.value))}
                  step="0.01"
                  className="w-full bg-[#111] border border-gray-800 rounded px-1 py-1 text-[10px] text-gray-400 focus:border-orange-500 focus:outline-none font-mono"
                />
              </div>
            </div>
            {/* Options Skew Sync Row */}
            <div className="mt-2 pt-2 border-t border-gray-800/50 flex justify-end">
              <button
                onClick={() => syncAssetOptionsData(asset)}
                disabled={isLoading}
                className="bg-orange-600/20 text-orange-500 hover:bg-orange-600/30 px-2 py-1 flex items-center space-x-1 rounded text-[9px] font-bold transition-colors disabled:opacity-50"
                title="Extract Forward-Looking Crash Probability (λ) from Live Options Volatility Skew"
              >
                {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                <span>RIP OPTIONS SKEW</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Asset Form */}
      <div className="bg-[#1A1A1A] border border-dashed border-gray-700 rounded p-3">
        <div className="flex items-center space-x-2 mb-2">
          <input
            type="text"
            placeholder="TICKER"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            className="flex-1 bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none font-mono uppercase placeholder-gray-600"
          />
          <button
            onClick={fetchAssetData}
            disabled={isLoading || !newTicker}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white p-1.5 rounded transition-colors"
            title="Fetch Data"
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            placeholder="μ (0.10)"
            value={newMu}
            onChange={(e) => setNewMu(parseFloat(e.target.value))}
            step="0.01"
            className="bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none font-mono placeholder-gray-600"
          />
          <input
            type="number"
            placeholder="σ (0.20)"
            value={newSigma}
            onChange={(e) => setNewSigma(parseFloat(e.target.value))}
            step="0.01"
            className="bg-[#111] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none font-mono placeholder-gray-600"
          />
        </div>
        <button
          onClick={addAsset}
          disabled={!newTicker}
          className="w-full flex items-center justify-center space-x-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={12} />
          <span>ADD ASSET</span>
        </button>
      </div>
    </div>
  );
}
