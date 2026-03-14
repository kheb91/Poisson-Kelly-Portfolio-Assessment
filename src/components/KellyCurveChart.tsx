
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SimulationResult } from '../utils/poissonKelly';

interface KellyCurveChartProps {
  result: SimulationResult;
}

export default function KellyCurveChart({ result }: KellyCurveChartProps) {
  const { kellyCurve, optimalFraction } = result;

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4 h-96 flex flex-col">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Kelly Curve (Growth vs Leverage)</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kellyCurve} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis
              dataKey="leverage"
              type="number"
              domain={[0, 'dataMax']}
              tick={{ fill: '#666', fontSize: 12 }}
              tickFormatter={(val) => `${val.toFixed(1)}x`}
              axisLine={{ stroke: '#333' }}
              label={{ value: 'Leverage', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 12 }}
            />
            <YAxis
              domain={[-1.0, 'auto']}
              tick={{ fill: '#666', fontSize: 12 }}
              axisLine={{ stroke: '#333' }}
              tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
              label={{ value: 'Growth Rate', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
              itemStyle={{ color: '#888' }}
              labelStyle={{ color: '#666' }}
              formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Growth Rate']}
              labelFormatter={(label) => `Leverage: ${Number(label).toFixed(2)}x`}
            />
            <ReferenceLine x={optimalFraction} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Optimal f*', position: 'top', fill: '#10b981', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="growth"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
