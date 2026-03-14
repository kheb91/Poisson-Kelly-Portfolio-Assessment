
import React from 'react';
import { SimulationResult } from '../utils/poissonKelly';
import { Asset } from '../utils/portfolioOptimizer';
import { TrendingUp, Clock, AlertTriangle, Percent, Combine } from 'lucide-react';

interface SummaryMetricsProps {
  result: SimulationResult;
  initialWealth: number;
  covarianceMatrix?: number[][] | null;
  assets?: Asset[];
}

export default function SummaryMetrics({ result, initialWealth, covarianceMatrix, assets }: SummaryMetricsProps) {
  const { optimalFraction, maxGrowthRate, finalWealths } = result;

  // Calculate doubling time: ln(2) / g
  const doublingTime = maxGrowthRate > 0 ? Math.log(2) / maxGrowthRate : Infinity;

  // Calculate ruin probability (wealth < 20% of initial, i.e., 80% drawdown)
  const ruinThreshold = initialWealth * 0.20;
  const ruinCount = finalWealths.filter(w => w < ruinThreshold).length;
  const ruinProb = (ruinCount / finalWealths.length) * 100;

  const MetricCard = ({ label, value, subtext, icon: Icon, color }: any) => (
    <div className="bg-[#1A1A1A] border border-gray-800 p-4 rounded-lg flex items-start space-x-4">
      <div className={`p-2 rounded-md bg-opacity-10 ${color.bg} ${color.text}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-2xl font-mono text-white mt-1">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{subtext}</p>
      </div>
    </div>
  );

  // Calculate true Correlation derived from Covariances for the Heatmap visualization
  const getCorrelationColor = (val: number) => {
    if (val >= 0.8) return 'bg-red-500/80 text-white'; // High stress/panic
    if (val >= 0.5) return 'bg-orange-500/60 text-white'; // Moderate correlation
    if (val >= 0.2) return 'bg-yellow-500/40 text-gray-200'; // Low correlation
    if (val > -0.2) return 'bg-gray-800 text-gray-400'; // Neutral (uncorrelated)
    return 'bg-emerald-500/60 text-white'; // Negative underlying correlation! (Holy Grail)
  };

  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Optimal Leverage (f*)"
          value={`${(optimalFraction * 100).toFixed(2)}%`}
          subtext="Kelly Criterion"
          icon={Percent}
          color={{ bg: 'bg-emerald-500', text: 'text-emerald-500' }}
        />
        <MetricCard
          label="Exp. Growth Rate (g*)"
          value={`${(maxGrowthRate * 100).toFixed(2)}%`}
          subtext="Continuous Compounding"
          icon={TrendingUp}
          color={{ bg: 'bg-blue-500', text: 'text-blue-500' }}
        />
        <MetricCard
          label="Doubling Time"
          value={doublingTime === Infinity ? "Never" : `${doublingTime.toFixed(1)} Yrs`}
          subtext="Expected Time to 2x"
          icon={Clock}
          color={{ bg: 'bg-purple-500', text: 'text-purple-500' }}
        />
        <MetricCard
          label="Drawdown Risk"
          value={`${ruinProb.toFixed(1)}%`}
          subtext="Prob. of Ruin (>80% Loss)"
          icon={AlertTriangle}
          color={{ bg: 'bg-red-500', text: 'text-red-500' }}
        />
      </div>

      {/* Dynamic Correlation Heatmap Panel */}
      {covarianceMatrix && assets && assets.length > 1 && (
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Combine size={18} className="text-gray-400" />
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Historical Correlation Matrix (Trailing 5Yr)</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] uppercase tracking-wider font-mono">
              <thead>
                <tr>
                  <th className="p-2 text-left text-gray-500">Asset</th>
                  {assets.map((a) => (
                    <th key={a.id} className="p-2 text-center text-gray-300 w-16">{a.ticker}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((rowAsset, i) => (
                  <tr key={rowAsset.id} className="border-t border-gray-800/50">
                    <td className="p-2 font-bold text-gray-300">{rowAsset.ticker}</td>
                    {assets.map((colAsset, j) => {
                      // Extract Corelation: Cor(x,y) = Cov(x,y) / (Std(x) * Std(y))
                      const cov = covarianceMatrix[i][j];
                      const stdI = Math.sqrt(covarianceMatrix[i][i]);
                      const stdJ = Math.sqrt(covarianceMatrix[j][j]);
                      const correlation = cov / (stdI * stdJ);

                      return (
                        <td key={`${rowAsset.id}-${colAsset.id}`} className="p-1">
                          <div className={`w-full py-1.5 rounded flex items-center justify-center font-bold ${getCorrelationColor(correlation)}`}>
                            {correlation.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
