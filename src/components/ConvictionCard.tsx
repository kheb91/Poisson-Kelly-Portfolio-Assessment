import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, ShieldCheck } from 'lucide-react';

interface ConvictionCardProps {
  decision: 'STRONG GO' | 'SCALED GO' | 'NO-GO' | null;
  reason: string;
  portfolioGrowth: number;
  spyGrowth: number | null;
  riskFree: number;
  alpha: number | null;
  beta: number | null;
}

const ConvictionCard: React.FC<ConvictionCardProps> = ({ decision, reason, portfolioGrowth, spyGrowth, riskFree, alpha, beta }) => {
  if (!decision) return null;

  const getStyle = () => {
    switch (decision) {
      case 'STRONG GO':
        return {
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          text: 'text-emerald-400',
          icon: <CheckCircle className="w-8 h-8 text-emerald-500" />
        };
      case 'SCALED GO':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
          icon: <ShieldCheck className="w-8 h-8 text-yellow-500" />
        };
      case 'NO-GO':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: <XCircle className="w-8 h-8 text-red-500" />
        };
    }
  };

  const style = getStyle();

  return (
    <div className={`mt-6 p-6 rounded-xl border ${style.border} ${style.bg} backdrop-blur-sm`}>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 mt-1">
          {style.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xl font-bold tracking-tight ${style.text}`}>
              VERDICT: {decision}
            </h3>
            <div className="flex items-center space-x-4 text-xs font-mono text-gray-400">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>PORTFOLIO: {(portfolioGrowth * 100).toFixed(2)}%</span>
              </div>
              {spyGrowth !== null && (
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>SPY: {(spyGrowth * 100).toFixed(2)}%</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                <span>CASH: {(riskFree * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
          
          <p className="text-gray-300 leading-relaxed mb-4">
            {reason}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="text-gray-500 mb-1 uppercase tracking-wider font-semibold">Alpha (α)</div>
              <div className={`font-mono ${alpha !== null && alpha > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {alpha !== null ? `${(alpha * 100).toFixed(2)}%` : 'N/A'}
              </div>
            </div>
            <div className="bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="text-gray-500 mb-1 uppercase tracking-wider font-semibold">Beta (β)</div>
              <div className="text-gray-200 font-mono">
                {beta !== null ? beta.toFixed(2) : 'N/A'}
              </div>
            </div>
            <div className="bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="text-gray-500 mb-1 uppercase tracking-wider font-semibold">Excess Return</div>
              <div className={`font-mono ${portfolioGrowth > (spyGrowth || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                {spyGrowth ? `${((portfolioGrowth - spyGrowth) * 100).toFixed(2)}% vs SPY` : 'N/A'}
              </div>
            </div>
            <div className="bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="text-gray-500 mb-1 uppercase tracking-wider font-semibold">Risk-Adj. Status</div>
              <div className="text-gray-200 font-mono">
                {decision === 'STRONG GO' ? 'Optimal Edge' : decision === 'SCALED GO' ? 'Leveraged Beta' : 'Inefficient'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConvictionCard;
