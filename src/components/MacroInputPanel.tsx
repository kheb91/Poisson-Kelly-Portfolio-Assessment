
import React, { useState, useEffect } from 'react';
import { MacroParams } from '../utils/macroEconomics';
import { Info, AlertTriangle } from 'lucide-react';

interface MacroInputPanelProps {
  params: MacroParams;
  onChange: (newParams: MacroParams) => void;
}

const NumberInput = ({
  label,
  value,
  onChange,
  step = "0.1",
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
        className="w-full bg-[#1A1A1A] border border-gray-700 rounded p-2 text-sm text-gray-200 focus:border-purple-500 focus:outline-none font-mono transition-colors"
      />
    </div>
  );
};

export default function MacroInputPanel({ params, onChange }: MacroInputPanelProps) {
  const updateParam = (name: keyof MacroParams, value: number | boolean) => {
    onChange({
      ...params,
      [name]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-purple-500 text-xs font-bold uppercase mb-3 border-b border-purple-500/20 pb-1">Macro Indicators</h3>
        <NumberInput
          label="CPI (Inflation %)"
          value={params.cpi}
          onChange={(v) => updateParam('cpi', v)}
          tooltip="Consumer Price Index (Year-over-Year). High inflation increases volatility."
        />
        <NumberInput
          label="Fed Funds Rate (%)"
          value={params.fedFundsRate}
          onChange={(v) => updateParam('fedFundsRate', v)}
          tooltip="Federal Reserve Interest Rate. Directly impacts the risk-free rate."
        />
        <NumberInput
          label="GDP Growth (%)"
          value={params.gdpGrowth}
          onChange={(v) => updateParam('gdpGrowth', v)}
          tooltip="Gross Domestic Product Growth Rate. Correlates with expected returns."
        />
        <NumberInput
          label="Unemployment Rate (%)"
          value={params.unemployment}
          onChange={(v) => updateParam('unemployment', v)}
          tooltip="Unemployment Rate. High unemployment signals recession risk (higher jump intensity)."
        />

        <div className="mt-8 pt-6 border-t border-purple-900/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-red-500 uppercase flex items-center gap-1.5">
                <AlertTriangle size={14} /> Market Stress Test
              </span>
              <span className="text-[10px] text-gray-500 mt-1 max-w-[200px] leading-tight flex-wrap">
                Simulates panic conditions where diversification fails and all cross-asset correlations spike above 0.85
              </span>
            </div>

            <button
              onClick={() => updateParam('isStressTest', !params.isStressTest)}
              className={`relative inline-flex h-5 w-10 mt-1 items-center rounded-full transition-colors focus:outline-none ${params.isStressTest ? 'bg-red-500' : 'bg-gray-700'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${params.isStressTest ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
