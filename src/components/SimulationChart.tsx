
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SimulationResult } from '../utils/poissonKelly';

interface SimulationChartProps {
  result: SimulationResult;
}

export default function SimulationChart({ result }: SimulationChartProps) {
  const { paths } = result;

  const chartData = useMemo(() => {
    if (!paths || paths.length === 0) return [];

    const timeSteps = paths[0].length;

    const data = [];
    for (let i = 0; i < timeSteps; i++) {
      const point: any = { time: paths[0][i].time };

      // Extract out all wealths at exactly this timestep
      const valuesAtTime = paths.map(p => p[i].value).sort((a, b) => a - b);

      const p5 = valuesAtTime[Math.floor(valuesAtTime.length * 0.05)];
      const median = valuesAtTime[Math.floor(valuesAtTime.length * 0.50)];
      const p95 = valuesAtTime[Math.floor(valuesAtTime.length * 0.95)];

      // Force a tiny lower bound to prevent Log Scale from exploding on 0
      point.p5 = Math.max(1, p5);
      point.median = Math.max(1, median);
      point.p95 = Math.max(1, p95);

      // Recharts Area can take an array [bottom, top] to organically shade the area between curves!
      point.confidenceInterval = [point.p5, point.p95];

      data.push(point);
    }
    return data;
  }, [paths]);

  return (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4 h-96 flex flex-col">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Monte Carlo Wealth Propagation (90% CI)</h3>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: '#666', fontSize: 12 }}
              tickFormatter={(val) => `${val.toFixed(1)}y`}
              axisLine={{ stroke: '#333' }}
            />
            <YAxis
              scale="log"
              domain={['auto', 'auto']}
              tick={{ fill: '#666', fontSize: 12 }}
              axisLine={{ stroke: '#333' }}
              tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
              itemStyle={{ color: '#888' }}
              labelStyle={{ color: '#666' }}
              formatter={(value: any, name: string) => {
                if (Array.isArray(value)) return [`$${value[0].toFixed(0)} - $${value[1].toFixed(0)}`, '90% Variance'];
                return [`$${Number(value).toFixed(0)}`, 'Median (Base)'];
              }}
              labelFormatter={(label) => `Time: ${Number(label).toFixed(2)}y`}
            />

            <Line
              type="monotone"
              name="95th Bull Case"
              dataKey="p95"
              stroke="#10b981"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              name="5th Bear Case"
              dataKey="p5"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              name="Median Path"
              dataKey="median"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
