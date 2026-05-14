import React from 'react';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarData[];
  title: string;
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
}

/**
 * Lightweight CSS-based bar chart — no external chart library needed.
 */
export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ 
  data, title, height = 200, valuePrefix = '', valueSuffix = '' 
}) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{title}</h4>
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((item, i) => {
          const pct = (item.value / maxValue) * 100;
          const color = item.color || ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'][i % 6];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="text-xs font-black text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                {valuePrefix}{item.value.toLocaleString()}{valueSuffix}
              </div>
              <div className="w-full rounded-t-xl transition-all duration-500 group-hover:opacity-80" 
                style={{ height: `${pct}%`, backgroundColor: color, minHeight: 4 }} />
              <div className="text-[10px] font-bold text-slate-400 text-center truncate w-full">{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DonutData {
  label: string;
  value: number;
  color: string;
}

interface SimpleDonutChartProps {
  data: DonutData[];
  title: string;
  size?: number;
}

/**
 * Lightweight CSS-based donut chart using conic-gradient.
 */
export const SimpleDonutChart: React.FC<SimpleDonutChartProps> = ({ data, title, size = 160 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let accumulated = 0;
  const gradientStops: string[] = [];

  data.forEach(d => {
    const start = (accumulated / total) * 360;
    accumulated += d.value;
    const end = (accumulated / total) * 360;
    gradientStops.push(`${d.color} ${start}deg ${end}deg`);
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{title}</h4>
      <div className="flex items-center gap-6">
        <div 
          className="rounded-full flex-shrink-0"
          style={{
            width: size,
            height: size,
            background: `conic-gradient(${gradientStops.join(', ')})`,
            mask: `radial-gradient(circle at center, transparent ${size * 0.35}px, black ${size * 0.35}px)`,
            WebkitMask: `radial-gradient(circle at center, transparent ${size * 0.35}px, black ${size * 0.35}px)`,
          }}
        />
        <div className="space-y-2 flex-1">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-xs font-bold text-slate-600 flex-1">{d.label}</span>
              <span className="text-xs font-black text-slate-800">{d.value.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface TrendData {
  label: string;
  value: number;
}

interface SimpleLineChartProps {
  data: TrendData[];
  title: string;
  height?: number;
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

/**
 * Lightweight CSS-based line/area chart using SVG polyline.
 */
export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ 
  data, title, height = 150, color = '#6366f1', valuePrefix = '', valueSuffix = '' 
}) => {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const w = 400;
  const h = height;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (w - 2 * padding);
    const y = h - padding - (d.value / maxValue) * (h - 2 * padding);
    return `${x},${y}`;
  });

  const areaPoints = [...points, `${w - padding},${h - padding}`, `${padding},${h - padding}`].join(' ');

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">{title}</h4>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(pct => (
          <line key={pct} x1={padding} y1={h - padding - pct * (h - 2 * padding)} 
            x2={w - padding} y2={h - padding - pct * (h - 2 * padding)}
            stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
        ))}
        {/* Area */}
        <polygon points={areaPoints} fill={color} fillOpacity="0.1" />
        {/* Line */}
        <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * (w - 2 * padding);
          const y = h - padding - (d.value / maxValue) * (h - 2 * padding);
          return (
            <g key={i}>
              <title>{`${d.label}: ${valuePrefix}${d.value.toLocaleString()}${valueSuffix}`}</title>
              <circle cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2" />
              <text x={x} y={h - 4} textAnchor="middle" className="text-[8px] fill-slate-400 font-bold">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
