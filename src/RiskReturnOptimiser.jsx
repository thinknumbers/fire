// Deployment trigger: v1.249 - 2026-01-19
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, PieChart, Pie, Cell, AreaChart, Area, ReferenceLine,
  BarChart, Bar, ComposedChart
} from 'recharts';
import { runResampledOptimization, projectConstraints } from './utils/MichaudOptimizer';
import { 
  Settings, User, Activity, PieChart as PieIcon, TrendingUp, 
  ChevronRight, Save, Calculator, ArrowRight, DollarSign, Plus, Trash2, Calendar,
  AlertCircle, FileText, CheckSquare, Square, Clock, Percent, Loader, Cpu, Cloud,
  FolderOpen, ChevronDown, X, Upload, Type
} from 'lucide-react';
import { supabase } from './supabase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'svg2pdf.js';
import fireLogo from '../FIRE_Logo_White.webp';
import { APP_TITLE, ABN, AFSL } from './constants';

// --- Constants & Defaults ---
const NumberInput = ({ value, onChange, className, placeholder, prefix = "$" }) => {
  const format = (val) => {
      if (val === '' || val === undefined || val === null) return '';
      return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleChange = (e) => {
      const rawValue = e.target.value.replace(/[^0-9.-]/g, '');
      if (rawValue === '' || rawValue === '-') {
          onChange(0); 
          return;
      }
      const numericValue = parseFloat(rawValue);
      if (!isNaN(numericValue)) {
          onChange(numericValue);
      }
  };

  return (
      <div className="relative w-full">
          {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">{prefix}</span>}
          <input 
              type="text" 
              value={format(value)}
              onChange={handleChange}
              className={`${className} ${prefix ? 'pl-7' : ''}`}
              placeholder={placeholder}
          />
      </div>
  );
};

// Sample Allocation Targets (from User provided image)
// Used to guide the "Portfolio Constraint Matrix" to preventing outliers.
const SAMPLE_TARGETS = {
  1:  { aus_eq: 0.5, us_large: 0.2, us_small: 0.1, dev_world: 0.1, em_eq: 0.2, reits: 0.6, hedge: 2.8, comm: 0.9, aus_bond: 4.3, gl_bond: 7.8, hy_bond: 1.4, em_bond: 0.5, cash: 80.5 },
  2:  { aus_eq: 2.5, us_large: 1.4, us_small: 0.8, dev_world: 0.7, em_eq: 1.3, reits: 1.1, hedge: 5.4, comm: 1.3, aus_bond: 10.3, gl_bond: 12.7, hy_bond: 3.2, em_bond: 1.9, cash: 57.3 },
  3:  { aus_eq: 5.3, us_large: 2.9, us_small: 1.6, dev_world: 1.6, em_eq: 2.6, reits: 1.3, hedge: 7.4, comm: 1.8, aus_bond: 15.9, gl_bond: 17.4, hy_bond: 5.3, em_bond: 4.2, cash: 32.7 },
  4:  { aus_eq: 8.6, us_large: 4.7, us_small: 2.7, dev_world: 2.5, em_eq: 4.2, reits: 1.6, hedge: 8.6, comm: 2.3, aus_bond: 18.1, gl_bond: 18.1, hy_bond: 6.2, em_bond: 6.7, cash: 15.5 },
  5:  { aus_eq: 12.4, us_large: 7.3, us_small: 4.2, dev_world: 3.6, em_eq: 6.1, reits: 2.1, hedge: 8.4, comm: 2.9, aus_bond: 16.3, gl_bond: 15.2, hy_bond: 5.4, em_bond: 8.5, cash: 7.9 },
  6:  { aus_eq: 16.0, us_large: 10.1, us_small: 5.8, dev_world: 5.0, em_eq: 8.4, reits: 2.3, hedge: 8.0, comm: 3.2, aus_bond: 12.8, gl_bond: 11.7, hy_bond: 4.2, em_bond: 8.3, cash: 4.3 },
  7:  { aus_eq: 19.2, us_large: 13.1, us_small: 7.5, dev_world: 6.3, em_eq: 10.8, reits: 2.6, hedge: 7.8, comm: 3.5, aus_bond: 9.3, gl_bond: 8.0, hy_bond: 3.1, em_bond: 6.7, cash: 2.2 },
  8:  { aus_eq: 22.2, us_large: 15.9, us_small: 9.7, dev_world: 7.5, em_eq: 13.1, reits: 3.1, hedge: 6.8, comm: 3.5, aus_bond: 5.7, gl_bond: 4.9, hy_bond: 1.9, em_bond: 4.5, cash: 1.2 },
  9:  { aus_eq: 23.8, us_large: 18.0, us_small: 12.7, dev_world: 8.6, em_eq: 15.5, reits: 3.5, hedge: 4.8, comm: 3.1, aus_bond: 3.1, gl_bond: 2.7, hy_bond: 1.1, em_bond: 2.6, cash: 0.6 },
  10: { aus_eq: 20.3, us_large: 18.5, us_small: 20.0, dev_world: 10.6, em_eq: 18.6, reits: 4.0, hedge: 2.6, comm: 2.1, aus_bond: 0.8, gl_bond: 0.6, hy_bond: 0.3, em_bond: 1.0, cash: 0.6 },
};

const DEFAULT_ASSETS = [
  { id: 'aus_eq', name: 'Australian Equities', return: 0.087000, stdev: 0.174200, incomeRatio: 0.67, minWeight: 0.1, maxWeight: 24, color: '#AEC6CF', active: true, isDefault: true },
  { id: 'us_large', name: 'US Large Cap Equities', return: 0.084000, stdev: 0.171100, incomeRatio: 0.35, minWeight: 0.1, maxWeight: 19, color: '#FFB347', active: true, isDefault: true },
  { id: 'us_small', name: 'US Small Cap Equities', return: 0.077000, stdev: 0.208100, incomeRatio: 0.40, minWeight: 0.1, maxWeight: 20, color: '#FF6961', active: true, isDefault: true },
  { id: 'dev_world', name: 'Developed World Equities', return: 0.070000, stdev: 0.167300, incomeRatio: 0.49, minWeight: 0.1, maxWeight: 11, color: '#CB99C9', active: true, isDefault: true },
  { id: 'em_eq', name: 'Emerging Markets Equities', return: 0.083000, stdev: 0.200000, incomeRatio: 0.44, minWeight: 0.1, maxWeight: 19, color: '#779ECB', active: true, isDefault: true },
  { id: 'reits', name: 'Global REITs', return: 0.060000, stdev: 0.151877, incomeRatio: 0.63, minWeight: 0.1, maxWeight: 5, color: '#FDFD96', active: true, isDefault: true }, // SD: 15.18769% -> 0.151877
  { id: 'hedge', name: 'Hedge Fund', return: 0.052000, stdev: 0.117100, incomeRatio: 0.99, minWeight: 0.1, maxWeight: 9, color: '#B39EB5', active: true, isDefault: true },
  { id: 'comm', name: 'Commodities', return: 0.042000, stdev: 0.208375, incomeRatio: 0.99, minWeight: 0.1, maxWeight: 4, color: '#C23B22', active: true, isDefault: true }, // SD: 20.83749% -> 0.208375
  { id: 'aus_bond', name: 'Australian Bonds', return: 0.038000, stdev: 0.039376, incomeRatio: 0.99, minWeight: 0.1, maxWeight: 19, color: '#77DD77', active: true, isDefault: true }, // SD: 3.93760% -> 0.039376
  { id: 'gl_bond', name: 'Global Bonds', return: 0.036000, stdev: 0.035757, incomeRatio: 1.0, minWeight: 0.1, maxWeight: 19, color: '#836953', active: true, isDefault: true }, // SD: 3.57570% -> 0.035757
  { id: 'hy_bond', name: 'High Yield Bonds', return: 0.054000, stdev: 0.111227, incomeRatio: 0.99, minWeight: 0.1, maxWeight: 7, color: '#FFD1DC', active: true, isDefault: true }, // SD: 11.12267% -> 0.111227
  { id: 'em_bond', name: 'Emerging Markets Bonds', return: 0.067000, stdev: 0.126213, incomeRatio: 0.99, minWeight: 0.1, maxWeight: 9, color: '#826d85', active: true, isDefault: true }, // SD: 12.62131% -> 0.126213
  { id: 'cash', name: 'Cash', return: 0.029000, stdev: 0.006139, incomeRatio: 1.0, minWeight: 0.1, maxWeight: 82, color: '#CFCFC4', active: true, isDefault: true }, // SD: 0.61391% -> 0.006139
];

const INITIAL_CORRELATIONS_DATA = {
  // Symmetric Data (Upper Triangle + Diagonals)
  // Format: "ROW_ID": { "COL_ID": value, ... }
  "aus_eq": { "us_large": 0.462689, "us_small": 0.528396, "dev_world": 0.582217, "em_eq": 0.598446, "reits": 0.560008, "hedge": 0.50, "comm": 0.123853, "aus_bond": 0.005883, "gl_bond": 0.139196, "hy_bond": 0.672802, "em_bond": 0.40, "cash": -0.03929 },
  "us_large": { "us_small": 0.791495, "dev_world": 0.770658, "em_eq": 0.507356, "reits": 0.604173, "hedge": 0.467206, "comm": 0.100355, "aus_bond": 0.1073, "gl_bond": -0.00051, "hy_bond": 0.286807, "em_bond": 0.48789, "cash": -0.06655 },
  "us_small": { "dev_world": 0.664269, "em_eq": 0.525133, "reits": 0.606552, "hedge": 0.34373, "comm": 0.164277, "aus_bond": 0.047697, "gl_bond": -0.05806, "hy_bond": 0.375976, "em_bond": 0.349538, "cash": -0.03607 },
  "dev_world": { "em_eq": 0.61929, "reits": 0.627213, "hedge": 0.299626, "comm": 0.139579, "aus_bond": 0.068988, "gl_bond": 0.001715, "hy_bond": 0.42957, "em_bond": 0.364849, "cash": -0.05919 },
  "em_eq": { "reits": 0.485376, "hedge": 0.079337, "comm": 0.082088, "aus_bond": -0.02811, "gl_bond": -0.01552, "hy_bond": 0.59832, "em_bond": 0.324641, "cash": -0.02681 },
  "reits": { "hedge": 0.205612, "comm": 0.065917, "aus_bond": 0.230711, "gl_bond": 0.236395, "hy_bond": 0.470036, "em_bond": 0.412268, "cash": 0.002356 },
  "hedge": { "comm": 0.188014, "aus_bond": 0.152706, "gl_bond": 0.10, "hy_bond": 0.40, "em_bond": 0.64591, "cash": 0.050603 },
  "comm": { "aus_bond": -0.12671, "gl_bond": -0.19519, "hy_bond": 0.087571, "em_bond": 0.038482, "cash": 0.011105 },
  "aus_bond": { "gl_bond": 0.706525, "hy_bond": 0.079467, "em_bond": 0.446238, "cash": 0.230288 },
  "gl_bond": { "hy_bond": 0.282245, "em_bond": 0.244124, "cash": 0.22785 },
  "hy_bond": { "em_bond": 0.177213, "cash": 0.02484 },
  "em_bond": { "cash": 0.115046 }
};

const generateFullCorrelationMatrix = (assets) => {
  const map = {};
  // Initialize empty
  assets.forEach(a => {
    map[a.id] = {};
    assets.forEach(b => {
      map[a.id][b.id] = (a.id === b.id) ? 1.0 : 0.0;
    });
  });

  // Fill from Data
  Object.keys(INITIAL_CORRELATIONS_DATA).forEach(rowId => {
    const row = INITIAL_CORRELATIONS_DATA[rowId];
    Object.keys(row).forEach(colId => {
      const val = row[colId];
      if (map[rowId] && map[rowId][colId] !== undefined) map[rowId][colId] = val;
      if (map[colId] && map[colId][rowId] !== undefined) map[colId][rowId] = val;
    });
  });

  return map;
};

const DEFAULT_ENTITY_TYPES = {
  PERSONAL: { label: 'Personal Name', incomeTax: 0.47, ltCgt: 0.235, stCgt: 0.47 },
  COMPANY: { label: 'Company', incomeTax: 0.30, ltCgt: 0.30, stCgt: 0.30 },
  TRUST: { label: 'Family Trust', incomeTax: 0.30, ltCgt: 0.235, stCgt: 0.30 }, // Avg dist rate
  SUPER_ACCUM: { label: 'Superannuation (Accumulation Phase)', incomeTax: 0.15, ltCgt: 0.10, stCgt: 0.15 },
  PENSION: { label: 'Superannuation (Pension Phase)', incomeTax: 0.00, ltCgt: 0.00, stCgt: 0.00 },
};

const MODEL_NAMES = {
  1: "Defensive",
  2: "Conservative",
  3: "Moderate Conservative",
  4: "Moderate",
  5: "Balanced",
  6: "Balanced Growth",
  7: "Growth",
  8: "High Growth",
  9: "Aggressive",
  10: "High Aggressive"
};

const DEFAULT_STRUCTURES = [
  { id: 1, type: 'PERSONAL', name: 'Personal Name', value: 980000 },
  { id: 2, type: 'TRUST', name: 'Family Trust', value: 5000000 },
  { id: 3, type: 'SUPER_ACCUM', name: 'Super Fund (Accum)', value: 4000000 },
];

const DEFAULT_INCOME_STREAMS = [
  { id: 1, name: 'Husband Salary', amount: 350000, startYear: 1, endYear: 5, isOneOff: false, year: 1 },
  { id: 2, name: 'Wife Salary', amount: 150000, startYear: 1, endYear: 5, isOneOff: false, year: 1 },
  { id: 3, name: 'Downsize Home', amount: 2000000, startYear: 1, endYear: 1, isOneOff: true, year: 15 },
];

const DEFAULT_EXPENSE_STREAMS = [
  { id: 1, name: 'Living Expenses', amount: 200000, startYear: 1, endYear: 30, isOneOff: false, year: 1 },
  { id: 2, name: 'Gift to Children', amount: 1500000, startYear: 1, endYear: 1, isOneOff: true, year: 5 },
];

// --- Math Functions ---

const calculatePercentile = (arr, p) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const calculateClientTaxAdjustedReturns = (assets, structures, entityTypes) => {
  const totalValue = structures.reduce((sum, s) => sum + s.value, 0);
  if (totalValue === 0) return assets.map(a => a.return);
  
  return assets.map(asset => {
    let weightedReturn = 0;

    structures.forEach(struct => {
      let accumValue = 0;
      let pensionValue = 0;

      // Check if it's a Super Accumulation fund with a Pension Split
      if (struct.type === 'SUPER_ACCUM') {
         const pensionPct = struct.pensionPercentage || 0;
         pensionValue = struct.value * (pensionPct / 100);
         accumValue = struct.value - pensionValue;
      } else {
         // Default treatment
         accumValue = struct.value;
      }

      // 1. Process Accumulation Portion (or standard entity)
      if (accumValue > 0) {
          const entityProp = accumValue / totalValue;
          let rates = entityTypes[struct.type] || entityTypes.PERSONAL || { incomeTax: 0.47, ltCgt: 0.235 };
          
          if (struct.useCustomTax && struct.customTax) {
             rates = struct.customTax;
          }

          const incomeComponent = asset.return * asset.incomeRatio;
          const capitalComponent = asset.return * (1 - asset.incomeRatio);
          const afterTaxIncome = incomeComponent * (1 - rates.incomeTax);
          const afterTaxCapital = capitalComponent * (1 - rates.ltCgt);
          
          weightedReturn += entityProp * (afterTaxIncome + afterTaxCapital);
      }

      // 2. Process Pension Portion (if any)
      if (pensionValue > 0) {
          const entityProp = pensionValue / totalValue;
          // Look up PENSION type rates, fallback to 0 if missing
          const rates = entityTypes.PENSION || { incomeTax: 0.0, ltCgt: 0.0 };
          
          const incomeComponent = asset.return * asset.incomeRatio;
          const capitalComponent = asset.return * (1 - asset.incomeRatio);
          const afterTaxIncome = incomeComponent * (1 - rates.incomeTax);
          const afterTaxCapital = capitalComponent * (1 - rates.ltCgt);
          
          weightedReturn += entityProp * (afterTaxIncome + afterTaxCapital);
      }
    });

    return weightedReturn;
  });
};

// Calculate after-tax returns for a SPECIFIC entity type (for entity-specific optimization)
const calculateEntityAfterTaxReturns = (assets, entityType, entityTypes, customTax = null) => {
  // Get tax rates for this entity type
  let rates = entityTypes[entityType] || entityTypes.PERSONAL || { incomeTax: 0.47, ltCgt: 0.235 };
  
  // Allow custom tax override
  if (customTax) {
    rates = customTax;
  }
  
  return assets.map(asset => {
    const incomeComponent = asset.return * (asset.incomeRatio || 0);
    const capitalComponent = asset.return * (1 - (asset.incomeRatio || 0));
    const afterTaxIncome = incomeComponent * (1 - rates.incomeTax);
    const afterTaxCapital = capitalComponent * (1 - rates.ltCgt);
    return afterTaxIncome + afterTaxCapital;
  });
};

const calculatePortfolioStats = (weights, afterTaxReturns, assets, correlations) => {
  let expectedReturn = 0;
  for (let i = 0; i < weights.length; i++) {
    expectedReturn += weights[i] * afterTaxReturns[i];
  }

  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      const cov = correlations[i][j] * (assets[i].stdev || 0) * (assets[j].stdev || 0);
      variance += weights[i] * weights[j] * cov;
    }
  }

  return {
    return: expectedReturn,
    risk: Math.sqrt(variance),
    weights: weights
  };
};

const randn_bm = (rng = Math.random) => {
  let u = 0, v = 0;
  while(u === 0) u = rng(); 
  while(v === 0) v = rng();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
};

// Simple Seeded RNG (Mulberry32)
const createSeededRandom = (seed) => {
    return () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// Batch Runner logic handled inside handler to access closure state properly

// --- Main Application ---

const OutcomeCandlestick = (props) => {
  const { x, y, width, height, payload, index } = props;
  const { p02, p50, p84 } = payload;
  
  // Recharts Bar passed us the box for the range (p02 to p84).
  // y is the top (p84), height is the distance to bottom (p02).
  // We can draw the box and the specific lines within it.
  
  // Using blue color palette
  const color84 = "#93C5FD"; // Blue 300 (Top/Upside)
  const color50 = "#3B82F6"; // Blue 500 (Median)
  const color02 = "#1D4ED8"; // Blue 700 (Bottom/Downside)
  const boxFill = "#DBEAFE"; // Blue 100

  // Calculate pixel position for median
  // We need the scale. Recharts passes xAxis and yAxis in the props if we look for them,
  // but for CustomShape in Bar, it might be easier to rely on the fact that
  // the Bar 'dataKey={[p16, p95]}' already sets the box from p16 to p95.
  // BUT: The 'median' (p50) position isn't passed as a pixel value automatically.
  // We need to calculate its relative position within the bar.
  
  // Ratio of median within range: (p50 - p16) / (p95 - p16)
  // Recharts Y-axis goes UP, but SVG coord Y goes DOWN.
  // Top of bar (y) corresponds to max value (p95).
  // Bottom of bar (y + height) corresponds to min value (p16).
  
  const range = p84 - p02;
  if(range === 0) return null;
  
  const medianRatio = (p84 - p50) / range; // Distance from top
  const medianY = y + (height * medianRatio);

  return (
    <g>
      {/* Box */}
      <rect x={x} y={y} width={width} height={height} fill={boxFill} stroke="none" />
      
      {/* 84.1st Line (Top) */}
      <line x1={x} y1={y} x2={x+width} y2={y} stroke={color84} strokeWidth={3} />
      
      {/* Median Line */}
      <line x1={x} y1={medianY} x2={x+width} y2={medianY} stroke={color50} strokeWidth={3} />
      
      {/* 2.3rd Line (Bottom) */}
      <line x1={x} y1={y+height} x2={x+width} y2={y+height} stroke={color02} strokeWidth={3} />
    </g>
  );
};

// Custom Label for One-Off Events (Callout Box)
const CustomEventLabel = (props) => {
  const { viewBox, value, type, index, amount } = props;
  const xPos = props.x !== undefined ? props.x : (viewBox ? viewBox.x : 0);
  const chartY = viewBox ? viewBox.y : 0;
  const chartHeight = viewBox ? viewBox.height : 0;
  
  // Format amount in millions
  const formatAmount = (val) => {
    if (!val || val === 0) return '';
    const millions = val / 1000000;
    return `$${millions.toFixed(1)}m`;
  };
  
  const boxY = chartY + 10 + ((index || 0) % 3) * 40; // Increased stagger for taller boxes

  const boxHeight = 36; // Increased height (was 24)
  // Calculate width based on larger font size (approx 8px per char)
  const textWidth = value.length * 8 + 20; 
  const amountWidth = 60; 
  const boxWidth = Math.max(textWidth, amountWidth, 70);
  const boxX = xPos - boxWidth / 2;
  
  const color = type === 'income' ? '#15803d' : '#b91c1c';
  const bgColor = type === 'income' ? '#dcfce7' : '#fee2e2';
  const borderColor = type === 'income' ? '#86efac' : '#fca5a5';

  return (
    <g>
      {/* Line connecting box to the reference line */}
      <line x1={xPos} y1={boxY + boxHeight} x2={xPos} y2={chartY + chartHeight} stroke={color} strokeWidth={1} strokeDasharray="2 2" />
      
      {/* Callout Box */}
      <rect 
        x={boxX} 
        y={boxY} 
        width={boxWidth} 
        height={boxHeight} 
        rx={4} 
        fill={bgColor} 
        stroke={borderColor} 
        strokeWidth={1} 
      />
      
      {/* Event Name - Full text, no truncation */}
      <text 
        x={xPos} 
        y={boxY + 14} 
        textAnchor="middle" 
        fill={color} 
        fontSize={11} // Increased from 8
        fontWeight="bold"
      >
        {value}
      </text>
      
      {/* Amount */}
      <text 
        x={xPos} 
        y={boxY + 28} 
        textAnchor="middle" 
        fill={color} 
        fontSize={12} // Increased from 9
        fontWeight="bold"
      >
        {formatAmount(amount)}
      </text>
    </g>
  );
};

export default function RiskReturnOptimiser() {
  const [activeTab, setActiveTab] = useState('client');
  
  // Data State
  const [clientName, setClientName] = useState('');
  const [clientDate, setClientDate] = useState(new Date().toISOString().split('T')[0]);
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [structures, setStructures] = useState(
    DEFAULT_STRUCTURES.map(s => ({
      ...s,
      useAssetAllocation: false,
      useCustomTax: false,
      customTax: { incomeTax: 0.47, ltCgt: 0.235, stCgt: 0.47 },
      assetAllocation: DEFAULT_ASSETS.map(a => ({ id: a.id, weight: 0, min: 0, max: 100 }))
    }))
  );
  const [entityTypes, setEntityTypes] = useState(DEFAULT_ENTITY_TYPES);
  const [correlations, setCorrelations] = useState(() => generateFullCorrelationMatrix(DEFAULT_ASSETS));

  // FORCE RESET STATE for v1.207 Constraints
  useEffect(() => {
    const RESET_KEY = 'fire_wealth_v1.207_constraints_reset_v3';
    if (!localStorage.getItem(RESET_KEY)) {
      console.log('Forcing Asset Reset for new Constraints');
      setAssets(DEFAULT_ASSETS);
      localStorage.setItem(RESET_KEY, 'true');
    }
  }, []);
  
  // Cashflow Inputs
  const [incomeStreams, setIncomeStreams] = useState(DEFAULT_INCOME_STREAMS);
  const [expenseStreams, setExpenseStreams] = useState(DEFAULT_EXPENSE_STREAMS);
  const [projectionYears, setProjectionYears] = useState(30);
  const [inflationRate, setInflationRate] = useState(0.025);
  const [adviceFee, setAdviceFee] = useState(0.011); // 1.1% Default incl GST maybe? Let's say 1.1% or just 0.0. User implies they want to add it. Let's default 0.0 to be safe or 0.01. Let's do 0.8% + GST = ~0.88%. Let's default to 0.0 for now so it doesn't surprise, or 0.01. Let's stick to 0.008 (0.8%).
  
  // Simulation State
  const [simulations, setSimulations] = useState([]);
  const [efficientFrontier, setEfficientFrontier] = useState([]);
  const [entityFrontiers, setEntityFrontiers] = useState({}); // Per-entity-type frontiers: { PERSONAL: [...], TRUST: [...], etc }
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [simulationCount, setSimulationCount] = useState(5); // Default number of simulations


  const [selectedPortfolioId, setSelectedPortfolioId] = useState(5);
  const [forecastConfidenceLevel, setForecastConfidenceLevel] = useState(3); // 1=Low, 2=Med, 3=High
  const [showPreTaxFrontier, setShowPreTaxFrontier] = useState(false); // Toggle for optimization chart
  
  // Debug State
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugModal, setShowDebugModal] = useState(false);

  // --- Settings State ---
  const DEFAULT_APP_SETTINGS = {
     title: "Fireball Risk Optimiser",
     logo: fireLogo,
     colors: {
         accent: '#004876',
         heading: '#f7a800',
         text: '#333333',
         bgLight: '#F2F2F2'
     }
  };

  const [appSettings, setAppSettings] = useState(() => {
      const saved = localStorage.getItem('fireball_settings');
      return saved ? JSON.parse(saved) : DEFAULT_APP_SETTINGS;
  });

  // Persist Settings & Apply Styles
  useEffect(() => {
     localStorage.setItem('fireball_settings', JSON.stringify(appSettings));
     
     // Update CSS Variables
     const root = document.documentElement;
     root.style.setProperty('--color-fire-accent', appSettings.colors.accent);
     root.style.setProperty('--color-fire-heading', appSettings.colors.heading);
     root.style.setProperty('--color-fire-text', appSettings.colors.text);
     root.style.setProperty('--color-fire-text', appSettings.colors.text);
     root.style.setProperty('--color-fire-bg-light', appSettings.colors.bgLight);
     root.style.setProperty('--font-main', AVAILABLE_FONTS.find(f => f.id === appSettings.font)?.family || 'Calibri, sans-serif');
  }, [appSettings]);
  const [optimizationAssets, setOptimizationAssets] = useState([]);
  const [scenarioName, setScenarioName] = useState('My Scenario');
  
  // Privacy: Local Device ID for filtering scenarios
  const [localUserId] = useState(() => {
    let uid = localStorage.getItem('fire_wealth_device_id');
    if (!uid) {
        // Simple random ID if crypto.randomUUID not available (older browsers)
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            uid = crypto.randomUUID();
        } else {
            uid = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }
        localStorage.setItem('fire_wealth_device_id', uid);
    }
    return uid;
  });
  
  // Cashflow Result State
  const [cfSimulationResults, setCfSimulationResults] = useState([]);
  
  // Projections Tab State
  const [selectedCashflowEntity, setSelectedCashflowEntity] = useState('all'); // 'all' or entity id
  const [showBeforeTax, setShowBeforeTax] = useState(false); // false = after tax, true = before tax
  const [showNominal, setShowNominal] = useState(true); // true = nominal, false = real (inflation-adjusted)
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const [savedScenarios, setSavedScenarios] = useState([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastDeleted, setLastDeleted] = useState(null); // For Undo
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const AVAILABLE_FONTS = [
      { id: 'Calibri', label: 'Calibri (Default)', family: 'Calibri, sans-serif' },
      { id: 'Inter', label: 'Inter', family: "'Inter', sans-serif" },
      { id: 'Roboto', label: 'Roboto', family: "'Roboto', sans-serif" },
      { id: 'Lato', label: 'Lato', family: "'Lato', sans-serif" },
      { id: 'Open Sans', label: 'Open Sans', family: "'Open Sans', sans-serif" },
  ];

  useEffect(() => {
    fetchScenarios();
  }, []);

  // Inject Fonts
  useEffect(() => {
      if (!appSettings.font || appSettings.font === 'Calibri') return;
      
      const fontName = appSettings.font;
      const linkId = 'dynamic-font-link';
      let link = document.getElementById(linkId);
      
      if (!link) {
          link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
      }
      
      link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(' ', '+')}:wght@400;500;700&display=swap`;
  }, [appSettings.font]);

  const fetchScenarios = async () => {
    // Privacy: Only fetch scenarios owned by this device/local_user
    const { data, error } = await supabase
      .from('scenarios')
      .select('id, name, created_at')
      // .eq('owner_id', localUserId) // Reverted privacy constraint per user request
      .order('created_at', { ascending: false });
    
    if (data) setSavedScenarios(data);
  };

  // --- Helpers ---
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;

  // Calculate constrained weights for a specific entity based on its asset allocation settings
  // Priority: 1) Allocate minimums first, 2) Distribute remaining budget within max constraints
  // If entity has no allocation, use the global optimal weights unchanged
  const getEntityConstrainedWeights = useCallback((entity, globalWeights, assetList) => {
    if (!entity || !globalWeights || !assetList || globalWeights.length === 0) {
      return globalWeights || [];
    }

    // If entity doesn't use asset allocation, return global weights unchanged
    if (!entity.useAssetAllocation || !entity.assetAllocation) {
      return globalWeights;
    }

    const n = assetList.length;
    
    // Get min/max constraints for each asset (convert from 0-100 to 0-1)
    const mins = assetList.map(asset => {
      const alloc = entity.assetAllocation.find(a => a.id === asset.id);
      return alloc ? (alloc.min || 0) / 100 : 0;
    });
    
    const maxs = assetList.map(asset => {
      const alloc = entity.assetAllocation.find(a => a.id === asset.id);
      return alloc ? (alloc.max !== undefined ? alloc.max : 100) / 100 : 1;
    });

    // Step 1: Start with minimums
    let weights = [...mins];
    let minSum = mins.reduce((a, b) => a + b, 0);

    // If minimums exceed 100%, normalize them to fit
    if (minSum > 1.0) {
      weights = mins.map(m => m / minSum);
      return weights; // All budget consumed by minimums
    }

    // Step 2: Calculate remaining budget after minimums
    let remainingBudget = 1.0 - minSum;

    // Step 3: Distribute remaining budget based on global weights, respecting max constraints
    // Calculate how much each asset "wants" beyond its minimum, based on global weight proportions
    const globalTotal = globalWeights.reduce((a, b) => a + b, 0);
    
    if (remainingBudget > 0.0001 && globalTotal > 0) {
      // Calculate room for each asset (max - min) and desired allocation from global weights
      const rooms = maxs.map((max, i) => Math.max(0, max - mins[i]));
      
      // Distribute remaining budget proportionally to global weights, capped by room
      let iterations = 0;
      while (remainingBudget > 0.0001 && iterations < 20) {
        // Calculate proportional shares based on global weights for assets with room
        const eligibleIndices = [];
        let eligibleGlobalSum = 0;
        
        for (let i = 0; i < n; i++) {
          const currentRoom = maxs[i] - weights[i];
          if (currentRoom > 0.0001) {
            eligibleIndices.push(i);
            eligibleGlobalSum += globalWeights[i];
          }
        }
        
        if (eligibleIndices.length === 0) break;
        
        let distributed = 0;
        for (const i of eligibleIndices) {
          // If global weights are all zero for eligible assets, distribute equally
          const share = eligibleGlobalSum > 0 
            ? (globalWeights[i] / eligibleGlobalSum) * remainingBudget
            : remainingBudget / eligibleIndices.length;
          const currentRoom = maxs[i] - weights[i];
          const actualAdd = Math.min(share, currentRoom);
          weights[i] += actualAdd;
          distributed += actualAdd;
        }
        
        remainingBudget -= distributed;
        iterations++;
      }
    }

    // Final normalization - if we didn't use all budget, proportionally scale up
    // but respect max constraints
    const total = weights.reduce((a, b) => a + b, 0);
    if (total > 0 && total < 0.9999) {
      // Need to scale up - but respect max constraints
      const scaleFactor = 1.0 / total;
      weights = weights.map((w, i) => Math.min(w * scaleFactor, maxs[i]));
      
      // Re-normalize if we hit any max constraints during scaling
      const newTotal = weights.reduce((a, b) => a + b, 0);
      if (newTotal < 0.9999) {
        // Still under 100%, scale proportionally for assets not at max
        const deficit = 1.0 - newTotal;
        const assetsWithRoom = weights.map((w, i) => maxs[i] - w > 0.0001 ? i : -1).filter(i => i >= 0);
        if (assetsWithRoom.length > 0) {
          const addEach = deficit / assetsWithRoom.length;
          assetsWithRoom.forEach(i => {
            weights[i] = Math.min(weights[i] + addEach, maxs[i]);
          });
        }
      }
    }

    return weights;
  }, []);

  // Derived Values
  const totalWealth = useMemo(() => structures.reduce((sum, s) => sum + s.value, 0), [structures]);
  
  const selectedPortfolio = useMemo(() => {
    return efficientFrontier.find(p => p.id === selectedPortfolioId) || efficientFrontier[0];
  }, [efficientFrontier, selectedPortfolioId]);

  // --- Handlers ---

  const handleSaveScenario = async (saveAsNew = false) => {
    if (!scenarioName.trim()) {
      alert('Please enter a scenario name');
      return;
    }
    setIsSaving(true);
    try {
      // Check if scenario exists
      const { data: existingData, error: fetchError } = await supabase
        .from('scenarios')
        .select('id')
        .eq('name', scenarioName)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching scenario:', fetchError);
        // We don't throw yet, as we might be inserting a new one
      }

      let shouldSave = true;
      let isUpdate = false;

      if (existingData) {
        console.log('Existing scenario found:', existingData);
        if (saveAsNew) {
             if (!window.confirm(`Scenario "${scenarioName}" already exists. Do you want to overwrite it?`)) {
                 setIsSaving(false);
                 return;
             }
             isUpdate = true; // Proceed as update since user confirmed overwrite
        } else {
             shouldSave = window.confirm(`Scenario "${scenarioName}" already exists. Do you want to overwrite it?`);
             isUpdate = true;
        }
      } else {
        console.log('No existing scenario found with name:', scenarioName);
      }

      if (!shouldSave) {
        setIsSaving(false);
        return;
      }

      const payload = {
        name: scenarioName,
        client_name: clientName,
        client_date: clientDate,
        correlations,
        selected_portfolio_id: selectedPortfolioId,
        simulation_count: simulationCount,
        assets,
        structures,
        income_streams: incomeStreams,
        expense_streams: expenseStreams,
        projection_years: projectionYears,
        inflation_rate: inflationRate,
        advice_fee: adviceFee,
        created_at: new Date().toISOString(),
        owner_id: localUserId // Privacy Link
      };

      console.log('Attempting save with payload:', payload);

      let error;
      if (isUpdate && !saveAsNew) {
        // Update existing
        const { error: updateError } = await supabase
          .from('scenarios')
          .update(payload)
          .eq('id', existingData.id);
        error = updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('scenarios')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      console.log('Save successful!');
      setLastSaved(new Date());
      fetchScenarios();
      alert('Scenario saved successfully!');
    } catch (error) {
      console.error('CRITICAL: Error saving scenario:', error);
      alert(`Failed to save scenario: ${error.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setIsSaving(true);
    setIsExporting(true);
    const originalTab = activeTab;
    
    // Helper to convert hex to rgb array for jsPDF
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    };

    const accentRgb = hexToRgb(appSettings.colors.accent);
    const headingRgb = hexToRgb(appSettings.colors.heading);
    const textRgb = hexToRgb(appSettings.colors.text);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;

      // --- Helper Functions ---
      const addText = (text, size = 10, style = 'normal', color = [0, 0, 0], align = 'left') => {
        pdf.setFontSize(size);
        pdf.setFont('helvetica', style);
        pdf.setTextColor(...color);
        if (align === 'center') {
          pdf.text(text, pageWidth / 2, y, { align: 'center' });
        } else if (align === 'right') {
          pdf.text(text, pageWidth - margin, y, { align: 'right' });
        } else {
          pdf.text(text, margin, y);
        }
      };

      const addLine = () => {
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;
      };

      const addPageBorder = () => {
         pdf.setDrawColor(...accentRgb); 
         pdf.setLineWidth(0.5);
         pdf.rect(3, 3, pageWidth - 6, pageHeight - 6, 'S');
      };

      const captureChart = async (elementId) => {
        const el = document.getElementById(elementId);
        if (!el) return null;
        const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff' });
        return canvas.toDataURL('image/png');
      };

      // ==================== PAGE 1: EXECUTIVE SUMMARY ====================
      
      // Header
      const headerEl = document.getElementById('app-header');
      let headerHeightPdf = 0;
      if (headerEl) {
        const headerCanvas = await html2canvas(headerEl, { scale: 2, backgroundColor: appSettings.colors.accent });
        const headerImg = headerCanvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(headerImg);
        headerHeightPdf = (imgProps.height * pageWidth) / imgProps.width;
        pdf.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerHeightPdf);
      }

      y = headerHeightPdf + 10;
      addPageBorder();
      
      // Title Block
      addText("Wealth Strategy Report", 22, 'bold', accentRgb, 'center'); y += 10;
      addText(scenarioName, 14, 'normal', textRgb, 'center'); y += 7;
      const modelName = MODEL_NAMES[selectedPortfolio.id] || "";
      addText(`Selected Portfolio: Portfolio ${selectedPortfolio.id}${modelName ? ' - ' + modelName : ''}`, 12, 'bold', accentRgb, 'center'); y += 7;
      addText(`Generated: ${new Date().toLocaleDateString()}`, 9, 'italic', [112, 112, 112], 'center'); y += 10;

      // Key Assumptions (2 columns)
      addText("Key Assumptions", 12, 'bold', headingRgb); y += 6;
      const col1X = margin;
      const col2X = pageWidth / 2 + 5;
      const startY = y;

      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text("Financial Parameters", col1X, y); y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Projection Period: ${projectionYears} Years`, col1X, y); y += 4;
      pdf.text(`Inflation Rate: ${(inflationRate * 100).toFixed(1)}%`, col1X, y); y += 4;
      pdf.text(`Advice Fee: ${(adviceFee * 100).toFixed(2)}%`, col1X, y); y += 4;
      pdf.text(`Total Investable: ${formatCurrency(totalWealth)}`, col1X, y); y += 4;

      y = startY;
      pdf.setFont('helvetica', 'bold');
      pdf.text("Entity Structure", col2X, y); y += 5;
      pdf.setFont('helvetica', 'normal');
      structures.forEach(s => {
        const entityLabel = DEFAULT_ENTITY_TYPES[s.type] ? DEFAULT_ENTITY_TYPES[s.type].label : s.type;
        pdf.text(`${entityLabel}: ${formatCurrency(s.value)}`, col2X, y);
        y += 4;
      });

      y = Math.max(y, startY + 25) + 5;
      addLine();

      // Portfolio Analysis Boxes
      addText("Portfolio Analysis", 12, 'bold', headingRgb); y += 8;
      const boxWidth = 50;
      const boxHeight = 22;
      const contentWidth = (boxWidth * 2) + 10; // 10mm gap
      const startX = (pageWidth - contentWidth) / 2;
      const pdfWidth = pageWidth - (margin * 2);
      
      const drawBox = (bx, title, value, color) => {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(bx, y, boxWidth, boxHeight, 'F');
        pdf.setFontSize(9); pdf.setTextColor(100, 100, 100); pdf.setFont('helvetica', 'normal');
        pdf.text(title, bx + boxWidth/2, y + 7, { align: 'center' });
        pdf.setFontSize(13); pdf.setTextColor(...color); pdf.setFont('helvetica', 'bold');
        pdf.text(value, bx + boxWidth/2, y + 16, { align: 'center' });
      };

      drawBox(startX, "Expected Return", formatPercent(selectedPortfolio.return), [22, 163, 74]);
      drawBox(startX + boxWidth + 10, "Risk (StdDev)", formatPercent(selectedPortfolio.risk), [220, 38, 38]);
      
      y += boxHeight + 8;

      // ==================== PAGE 1: PIE CHARTS ====================
      // Overall Pie Chart
      addText("Target Asset Allocation", 12, 'bold', headingRgb); y += 5;
      setActiveTab('output');
      await new Promise(r => setTimeout(r, 1500));

      const pieSize = 70; // Increased size to match entity charts (70mm)
      const pieX = (pageWidth - pieSize) / 2;
      
      // Add Title for the Total Pie
      addText("Total Portfolio", 9, 'bold', [80, 80, 80], 'center');
      y += 2;

      const pieContainer = document.getElementById('pie-chart-section');
      if (pieContainer) {
        const svg = pieContainer.querySelector('svg');
        if (svg) {
          const clone = svg.cloneNode(true);
          if (!clone.getAttribute('viewBox')) {
            const w = parseInt(clone.getAttribute('width')) || 300;
            const h = parseInt(clone.getAttribute('height')) || 300;
            clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
          }
          clone.setAttribute('width', pieSize);
          clone.setAttribute('height', pieSize);
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.appendChild(clone);
          document.body.appendChild(tempDiv);
          try {
            await pdf.svg(clone, { x: pieX, y: y - 5, width: pieSize, height: pieSize });
          } catch (err) { console.error("SVG Pie Error", err); }
          finally { document.body.removeChild(tempDiv); }
        }
      }
      y += pieSize - 12; // Aggressively reduced gap (Net -17mm spacing shift)

      // Entity Pie Charts - capture from UI
      addText("Allocation by Entity", 12, 'bold', headingRgb); y += 4; // Reduced gap
      
      // Capture entity pie charts section from the Output tab
      const entityPiesSection = document.getElementById('entity-pies-section');
      if (entityPiesSection) {
        // Temporarily force single row for PDF capture
        const originalStyle = entityPiesSection.style.cssText;
        entityPiesSection.style.flexWrap = 'nowrap';
        entityPiesSection.style.overflowX = 'visible';
        await new Promise(r => setTimeout(r, 100)); // Let layout update
        
        const entityCanvas = await html2canvas(entityPiesSection, { scale: 2, backgroundColor: '#ffffff' });
        const entityImg = entityCanvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(entityImg);
        const maxWidth = pdfWidth;
        const maxHeight = 60; // Increased height for 4-5 entity charts
        let entityWidth = maxWidth;
        let entityHeight = (imgProps.height * entityWidth) / imgProps.width;
        if (entityHeight > maxHeight) {
          entityHeight = maxHeight;
          entityWidth = (imgProps.width * entityHeight) / imgProps.height;
        }
        const entityX = (pageWidth - entityWidth) / 2;
        pdf.addImage(entityImg, 'PNG', entityX, y, entityWidth, entityHeight, undefined, 'FAST');
        y += entityHeight + 10;
        
        // Restore original style
        entityPiesSection.style.cssText = originalStyle;
      } else {
        // Fallback: draw placeholder circles with full labels
        const entityPieSize = 30;
        const entityGap = 10;
        const entityCount = structures.length;
        const totalEntityWidth = entityCount * entityPieSize + (entityCount - 1) * entityGap;
        let entityStartX = (pageWidth - totalEntityWidth) / 2;
        
        structures.forEach((struct, idx) => {
          const ex = entityStartX + idx * (entityPieSize + entityGap);
          pdf.setDrawColor(200, 200, 200);
          pdf.circle(ex + entityPieSize/2, y + entityPieSize/2, entityPieSize/2 - 2, 'S');
          pdf.setFontSize(6);
          pdf.setTextColor(50, 50, 50);
          const typeLabel = DEFAULT_ENTITY_TYPES[struct.type] ? DEFAULT_ENTITY_TYPES[struct.type].label : struct.type;
          // Wrap long labels
          const maxLabelWidth = entityPieSize + entityGap;
          pdf.text(typeLabel, ex + entityPieSize/2, y + entityPieSize + 3, { align: 'center', maxWidth: maxLabelWidth });
        });
        y += entityPieSize + 15;
      }

      // Legend - Moved to underneath Allocation by Entity
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      const activeOnly = assets.filter(a => a.active);
      const legendCols = 4;
      const legendItemWidth = 48;
      let lx = (pageWidth - (legendCols * legendItemWidth)) / 2;
      activeOnly.forEach((asset, i) => {
        const weight = selectedPortfolio.weights[activeOnly.findIndex(a => a.id === asset.id)] || 0;
        if (weight > 0.005) {
          const col = i % legendCols;
          const row = Math.floor(i / legendCols);
          const itemX = lx + (col * legendItemWidth);
          const itemY = y + (row * 5);
          pdf.setFillColor(asset.color);
          pdf.rect(itemX, itemY - 2, 2, 2, 'F');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${asset.name}: ${formatPercent(weight)}`, itemX + 3, itemY);
        }
      });
      y += Math.ceil(activeOnly.filter(a => (selectedPortfolio.weights[activeOnly.findIndex(x => x.id === a.id)] || 0) > 0.005).length / legendCols) * 5 + 8;

      // ==================== PAGE 2: TABLES ====================
      pdf.addPage();
      addPageBorder();
      y = margin;

      // Calculate spacing: 3 sections need to be evenly distributed over ~250mm (280 - 2*margin)
      const sectionGap = 15; // Gap between sections

      // 1. Detailed Asset Allocation Table
      addText("Detailed Asset Allocation", 12, 'bold', headingRgb); y += 8;
      
      // Table Header
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pdfWidth, 7, 'F');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 72, 118);
      pdf.text("Asset Class", margin + 2, y + 5);
      pdf.text("Weight", margin + pdfWidth * 0.6, y + 5);
      pdf.text("Value", margin + pdfWidth * 0.8, y + 5);
      y += 7;

      // Table Rows
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
      let totalValue = 0;
      activeOnly.forEach((asset, idx) => {
        const weight = selectedPortfolio.weights[activeOnly.findIndex(a => a.id === asset.id)] || 0;
        const value = weight * totalWealth;
        totalValue += value;
        
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, y, pdfWidth, 6, 'F');
        }
        
        pdf.setFillColor(asset.color);
        pdf.rect(margin + 2, y + 1.5, 3, 3, 'F');
        pdf.setTextColor(0, 72, 118);
        pdf.text(asset.name, margin + 7, y + 4);
        pdf.text(formatPercent(weight), margin + pdfWidth * 0.6, y + 4);
        pdf.text(formatCurrency(value), margin + pdfWidth * 0.8, y + 4);
        y += 6;
      });
      
      // Total Row
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y, pdfWidth, 7, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.text("Total", margin + 7, y + 5);
      pdf.text("100.0%", margin + pdfWidth * 0.6, y + 5);
      pdf.text(formatCurrency(totalWealth), margin + pdfWidth * 0.8, y + 5);
      y += sectionGap;

      // 2. Model Portfolios Summary
      addText("Model Portfolios Summary", 12, 'bold', headingRgb); y += 8;
      
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pdfWidth, 7, 'F');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 72, 118);
      pdf.text("Model", margin + 2, y + 5);
      pdf.text("Name", margin + 25, y + 5);
      pdf.text("Return", margin + pdfWidth * 0.65, y + 5);
      pdf.text("Risk", margin + pdfWidth * 0.85, y + 5);
      y += 7;

      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
      efficientFrontier.forEach((port, idx) => {
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, y, pdfWidth, 6, 'F');
        }
        
        const isSelected = port.id === selectedPortfolio.id;
        if (isSelected) {
          pdf.setFillColor(255, 240, 220);
          pdf.rect(margin, y, pdfWidth, 6, 'F');
        }
        
        pdf.setTextColor(0, 72, 118);
        pdf.text(String(port.id || idx + 1), margin + 2, y + 4);
        pdf.text(MODEL_NAMES[port.id] || 'Custom', margin + 25, y + 4);
        pdf.text(formatPercent(port.return), margin + pdfWidth * 0.65, y + 4);
        pdf.text(formatPercent(port.risk), margin + pdfWidth * 0.85, y + 4);
        y += 6;
      });
      y += sectionGap;

      // 3. Estimated Outcomes Table
      addText("Estimated Outcomes", 12, 'bold', headingRgb); y += 8;
      
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pdfWidth, 7, 'F');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 72, 118);
      pdf.text("Year", margin + 2, y + 5);
      pdf.text("Upside", margin + pdfWidth * 0.3, y + 5);
      pdf.text("Median", margin + pdfWidth * 0.55, y + 5);
      pdf.text("Downside", margin + pdfWidth * 0.8, y + 5);
      y += 7;

      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
      const outcomeYears = [1, 3, 5, 10, 20];
      outcomeYears.forEach((yr, idx) => {
        const res = cfSimulationResults[yr];
        if (!res) return;
        
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, y, pdfWidth, 6, 'F');
        }
        
        pdf.setTextColor(0, 72, 118);
        pdf.text(`${yr} Year`, margin + 2, y + 4);
        pdf.text(formatCurrency(res.p84), margin + pdfWidth * 0.3, y + 4);
        pdf.setFont('helvetica', 'bold');
        pdf.text(formatCurrency(res.p50), margin + pdfWidth * 0.55, y + 4);
        pdf.setFont('helvetica', 'normal');
        pdf.text(formatCurrency(res.p02), margin + pdfWidth * 0.8, y + 4);
        y += 6;
      });
      y += 10;


      // ==================== PAGE 3: ASSET ALLOCATION BY ENTITY ====================
      pdf.addPage();
      addPageBorder();
      y = margin;
      
      addText("Asset Allocation by Entity", 12, 'bold', headingRgb); y += 8;
      
      // Render 2 entity boxes per row - reduced gap for wider boxes
      const entityBoxWidth = (pdfWidth - 4) / 2; // 2 boxes per row with 4mm gap
      const rowHeight = 7; // Row height for each asset
      const headerHeight = 8;
      const boxPadding = 2;
      
      structures.forEach((struct, sIdx) => {
        // Determine position: left (even) or right (odd) in the row
        const isLeft = sIdx % 2 === 0;
        const boxX = isLeft ? margin : margin + entityBoxWidth + 4;
        
        // Start new row if this is a left box (and not the first)
        if (isLeft && sIdx > 0) {
          y += 10; // Gap between rows
        }
        
        // Check if we need a new page
        const estimatedBoxHeight = headerHeight + (activeOnly.length * rowHeight) + 15;
        if (y + estimatedBoxHeight > 280) {
          pdf.addPage();
          addPageBorder();
          y = margin;
          addText("Asset Allocation by Entity (continued)", 12, 'bold', headingRgb); y += 8;
        }
        
        const boxStartY = y;
        
        // Entity Header - use same heading color as other pages
        pdf.setFillColor(headingRgb[0], headingRgb[1], headingRgb[2]);
        pdf.rect(boxX, boxStartY, entityBoxWidth, headerHeight, 'F');
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255);
        pdf.text(struct.name, boxX + boxPadding, boxStartY + 5.5);
        
        let rowY = boxStartY + headerHeight;
        
        // Column Headers - adjusted positions for better alignment
        pdf.setFillColor(250, 250, 250);
        pdf.rect(boxX, rowY, entityBoxWidth, 5, 'F');
        pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 72, 118);
        pdf.text("Asset", boxX + boxPadding, rowY + 3.5);
        pdf.text("Current", boxX + entityBoxWidth * 0.45, rowY + 3.5, { align: 'center' });
        pdf.text("%", boxX + entityBoxWidth * 0.58, rowY + 3.5, { align: 'center' });
        pdf.text("Recommend", boxX + entityBoxWidth * 0.74, rowY + 3.5, { align: 'center' });
        pdf.text("%", boxX + entityBoxWidth * 0.92, rowY + 3.5, { align: 'center' });
        rowY += 5;
        
        // Asset Rows
        pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0, 72, 118);
        
        const globalWeights = selectedPortfolio?.weights || [];
        
        // v1.242 FIX: Use actual optimized entity weights if available
        let entityWeights;
        if (entityFrontiers && entityFrontiers[struct.type]) {
             const entPort = entityFrontiers[struct.type].find(p => p.id === selectedPortfolio.id);
             if (entPort) {
                 entityWeights = entPort.weights;
             }
        }
        
        if (!entityWeights) {
             entityWeights = getEntityConstrainedWeights(struct, globalWeights, activeOnly);
        }
        
        activeOnly.forEach((asset, aIdx) => {
          // Recommended
          const recWeight = entityWeights[aIdx] || 0;
          const recVal = recWeight * struct.value;
          const recPct = recWeight * 100;
          
          // Current
          let currWeight = 0;
          if (struct.useAssetAllocation && struct.assetAllocation) {
            const alloc = struct.assetAllocation.find(a => a.id === asset.id);
            currWeight = alloc ? alloc.weight / 100 : 0;
          } else if (asset.id === 'cash') {
            currWeight = 1.0;
          }
          const currVal = currWeight * struct.value;
          const currPct = currWeight * 100;
          
          // Alternate row background
          if (aIdx % 2 === 1) {
            pdf.setFillColor(252, 252, 252);
            pdf.rect(boxX, rowY, entityBoxWidth, 4, 'F');
          }
          
          // Asset names - allow full names
          const maxNameLen = 24;
          const displayName = asset.name.length > maxNameLen ? asset.name.substring(0, maxNameLen - 2) + '..' : asset.name;
          
          pdf.setTextColor(0, 72, 118);
          pdf.text(displayName, boxX + boxPadding, rowY + 3);
          // Center all values
          pdf.text(formatCurrency(currVal), boxX + entityBoxWidth * 0.45, rowY + 3, { align: 'center' });
          pdf.text(currPct.toFixed(1) + '%', boxX + entityBoxWidth * 0.58, rowY + 3, { align: 'center' });
          pdf.text(formatCurrency(recVal), boxX + entityBoxWidth * 0.74, rowY + 3, { align: 'center' });
          pdf.text(recPct.toFixed(1) + '%', boxX + entityBoxWidth * 0.92, rowY + 3, { align: 'center' });
          rowY += 4;
        });
        
        // Total Row
        pdf.setFillColor(240, 240, 240);
        pdf.rect(boxX, rowY, entityBoxWidth, 5, 'F');
        pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 72, 118);
        pdf.text("Total", boxX + boxPadding, rowY + 3.5);
        pdf.text(formatCurrency(struct.value), boxX + entityBoxWidth * 0.45, rowY + 3.5, { align: 'center' });
        pdf.text("100%", boxX + entityBoxWidth * 0.58, rowY + 3.5, { align: 'center' });
        pdf.text(formatCurrency(struct.value), boxX + entityBoxWidth * 0.74, rowY + 3.5, { align: 'center' });
        pdf.text("100%", boxX + entityBoxWidth * 0.92, rowY + 3.5, { align: 'center' });
        rowY += 5;
        
        // Box border
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(boxX, boxStartY, entityBoxWidth, rowY - boxStartY, 'S');
        
        // Update y position if this was a right box
        if (!isLeft) {
          y = Math.max(y, rowY);
        } else if (sIdx === structures.length - 1) {
          // Last entity and it's on the left
          y = rowY;
        }
      });
      
      y += 10;

      // ==================== PAGE 3: CHARTS ====================
      pdf.addPage();
      addPageBorder();
      y = margin;

      const chartH = 75;
      const displayMargin = 5; // Reduced margin for wider charts
      const displayWidth = pageWidth - (displayMargin * 2);

      // 1. Efficient Frontier
      addText("Efficient Frontier Analysis", 12, 'bold', headingRgb); y += 8;
      setActiveTab('optimization');
      await new Promise(r => setTimeout(r, 1000));
      const frontierEl = document.getElementById('optimization-tab-content')?.querySelector('.h-\\[500px\\]');
      if (frontierEl) {
         const originalId = frontierEl.id;
         frontierEl.id = 'temp-frontier-chart';
         const img = await captureChart('temp-frontier-chart');
         frontierEl.id = originalId;
         if (img) {
            pdf.addImage(img, 'PNG', displayMargin, y, displayWidth, chartH, undefined, 'FAST');
            y += chartH + 10;
         }
      } else {
         y += chartH + 10;
      }

      // 2. Monte Carlo Wealth Projection
      setActiveTab('cashflow');
      await new Promise(r => setTimeout(r, 1500));
      addText("Wealth Projection", 12, 'bold', headingRgb); y += 8;
      const wealthImg = await captureChart('wealth-projection-chart');
      if (wealthImg) {
          pdf.addImage(wealthImg, 'PNG', displayMargin, y, displayWidth, chartH, undefined, 'FAST');
          y += chartH + 10;
      }
      
      // 3. Estimating Outcomes Chart
      addText("Estimated Outcomes", 12, 'bold', headingRgb); y += 8;
      const outcomesImg = await captureChart('estimating-outcomes-chart');
      if (outcomesImg) {
          pdf.addImage(outcomesImg, 'PNG', displayMargin, y, displayWidth, chartH, undefined, 'FAST');
      }

      // Footer on each page
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        pdf.text(`Generated by ${appSettings.title || 'FIREBALL'}`, pageWidth / 2, pageHeight - 4, { align: 'center' });
      }

      pdf.save(`${scenarioName.replace(/\s+/g, '_')}_Report.pdf`);

    } catch (e) {
      console.error("PDF Generation Error", e);
      alert("Failed to generate PDF");
    } finally {
      setActiveTab(originalTab);
      setIsSaving(false);
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
      const activeAssets = assets.filter(a => a.active);
      try {
        // Fallback or Alert if no portfolio
        // If efficientFrontier is empty, we might not have a "selectedPortfolio" with stats. 
        // We can still export current inputs.
        
        let activePort = selectedPortfolio;
        if (!activePort || !activePort.weights) {
             // Try to find by ID
             if (efficientFrontier.length > 0) {
                 activePort = efficientFrontier.find(p => p.id === selectedPortfolioId) || efficientFrontier[0];
             }
        }
        
        // Create CSV Content
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // 1. Scenario Info
        csvContent += `Scenario Name,${scenarioName}\n`;
        csvContent += `Client Name,${clientName}\n`;
        csvContent += `Date,${new Date().toLocaleDateString()}\n`;
        csvContent += `Inflation Rate,${(inflationRate * 100).toFixed(2)}%\n`;
        csvContent += `Advice Fee,${(adviceFee * 100).toFixed(2)}%\n\n`;

        // 2. Asset Allocation
        if (activePort && activePort.weights) {
            const portName = activePort.label || `Portfolio ${activePort.id}`;
            csvContent += `Selected Portfolio,${portName}\n`;
            csvContent += `Expected Return (Net),${(activePort.return * 100).toFixed(2)}%\n`;
            csvContent += `Expected Risk,${(activePort.risk * 100).toFixed(2)}%\n`;
        } else {
            csvContent += `Selected Portfolio,Current/Manual Inputs\n`;
        }
        
        csvContent += `\nAsset Allocation\n`;
        csvContent += `Asset Class,Weight (%),Value ($),Return (%),Risk (%)\n`;
        activeAssets.forEach(asset => {
             // Find weight
             let weight = 0;
             if (activePort && activePort.weights && optimizationAssets.length > 0) {
                 const optIdx = optimizationAssets.findIndex(oa => oa.id === asset.id);
                 if (optIdx >= 0) weight = activePort.weights[optIdx];
             }
             
             // Fallback
             if (!weight && weight !== 0) {
                 // Check activeAssets current state?
                 if (asset.weight) weight = asset.weight / 100; // asset.weight is usually 0-100 in state
             }

             csvContent += `${asset.name},${(weight * 100).toFixed(2)}%,${(weight * totalWealth).toFixed(0)},${(asset.return * 100).toFixed(2)}%,${(asset.stdev * 100).toFixed(2)}%\n`;
        });

        // 3. Projections
        if (cfSimulationResults.length > 0) {
            csvContent += `\nWealth Projections\n`;
            csvContent += `Year,Downside (2nd),Median (50th),Upside (84th)\n`;
            cfSimulationResults.forEach(res => {
                 csvContent += `${res.year},${res.p02.toFixed(0)},${res.p50.toFixed(0)},${res.p84.toFixed(0)}\n`;
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${scenarioName.replace(/\s+/g, '_')}_data.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } catch (e) {
          console.error("Export Excel Error:", e);
          alert("Failed to export Excel: " + e.message);
      }
  };


  const handleNewScenario = () => {
    if (window.confirm('Are you sure you want to create a new scenario? All unsaved changes will be lost.')) {
      setScenarioName('My Scenario');
      setClientName('');
      setClientDate(new Date().toISOString().split('T')[0]);
      setAssets(DEFAULT_ASSETS);
      setStructures(DEFAULT_STRUCTURES.map(s => ({
        ...s,
        useAssetAllocation: false,
        useCustomTax: false,
        customTax: { incomeTax: 0.47, ltCgt: 0.235, stCgt: 0.47 },
        assetAllocation: DEFAULT_ASSETS.map(a => ({ id: a.id, weight: 0, min: 0, max: 100 }))
      })));
      setIncomeStreams(DEFAULT_INCOME_STREAMS);
      setExpenseStreams(DEFAULT_EXPENSE_STREAMS);
      setProjectionYears(30);
      setInflationRate(0.025);
      setAdviceFee(0.008);
      setCorrelations(generateFullCorrelationMatrix(DEFAULT_ASSETS));
      setSelectedPortfolioId(5);
      setSimulationCount(5);
      
      // Reset simulation state
      setSimulations([]);
      setEfficientFrontier([]);
      setCfSimulationResults([]);
      setActiveTab('client');
      setShowLoadMenu(false);
    }
  };

  const handleLoadScenario = async (id) => {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading scenario:', error);
      alert('Failed to load scenario');
      return;
    }

    if (data) {
      console.log('Loaded scenario data:', data);
      if (data.advice_fee !== undefined) setAdviceFee(data.advice_fee);
      
      // Restore client details
      setClientName(data.client_name || '');
      setClientDate(data.client_date || new Date().toISOString().split('T')[0]);

      // Restore other data
      setScenarioName(data.name || 'Untitled');
      if (data.assets) setAssets(data.assets);
      if (data.structures) setStructures(data.structures);
      if (data.income_streams) setIncomeStreams(data.income_streams);
      if (data.expense_streams) setExpenseStreams(data.expense_streams);
      if (data.projection_years) setProjectionYears(data.projection_years);
      if (data.inflation_rate) setInflationRate(data.inflation_rate);
      
      // Restore new persistence fields
      if (data.correlations) setCorrelations(data.correlations);
      if (data.selected_portfolio_id !== undefined) setSelectedPortfolioId(data.selected_portfolio_id);
      if (data.simulation_count) setSimulationCount(data.simulation_count);
      
      // Reset simulation state
      setSimulations([]);
      setEfficientFrontier([]);
      setCfSimulationResults([]);
      setActiveTab('data');
      setShowLoadMenu(false);
    }
  };

  const handleDeleteScenario = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this scenario?')) {
      const { error } = await supabase
        .from('scenarios')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting scenario:', error);
        alert('Failed to delete scenario');
      } else {
        fetchScenarios();
      }
    }
  };

  const handleCorrelationChange = (id1, id2, value) => {
    let val = parseFloat(value);
    if (isNaN(val)) val = 0;
    if (val > 1) val = 1;
    if (val < -1) val = -1;
    
    setCorrelations(prev => ({
      ...prev,
      [id1]: { ...prev[id1], [id2]: val },
      [id2]: { ...prev[id2], [id1]: val }
    }));
  };

  const handleAssetToggle = (id) => {
    setAssets(assets.map(a => a.id === id ? { ...a, active: !a.active } : a));
    setEfficientFrontier([]);
    setSimulations([]);
  };

  const handleAddAsset = () => {
    const newId = `custom_${Date.now()}`;
    const newAsset = {
      id: newId,
      name: 'New Asset Class',
      return: 0.05,
      stdev: 0.10,
      incomeRatio: 0.5,
      minWeight: 0,
      maxWeight: 100,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      active: true,
      isDefault: false
    };
    
    // Update correlations
    setCorrelations(prev => {
        const next = { ...prev };
        next[newId] = { [newId]: 1.0 };
        assets.forEach(a => {
             // Default 0.3 for new vs existing
             next[newId][a.id] = 0.3;
             if (next[a.id]) {
                 next[a.id] = { ...next[a.id], [newId]: 0.3 };
             }
        });
        return next;
    });

    setAssets([...assets, newAsset]);
  };

  const handleDeleteAsset = (id) => {
    setAssets(assets.filter(a => a.id !== id));
    // Optional: cleanup correlations to save memory, though not strictly required
    setCorrelations(prev => {
        const next = { ...prev };
        delete next[id];
        // Remove from others
        Object.keys(next).forEach(k => {
            if (next[k][id] !== undefined) {
                const row = { ...next[k] };
                delete row[id];
                next[k] = row;
            }
        });
        return next;
    });
  };

  // Re-defined batch simulation here to be used in handler
  const runSingleBatchSimulation = (activeAssets, afterTaxReturns, activeCorrelations, batchSize) => {
    const results = [];
    const n = activeAssets.length;
    // Pre-calculate bounds
    const mins = activeAssets.map(a => (a.minWeight || 0) / 100);
    const maxs = activeAssets.map(a => (a.maxWeight || 100) / 100);

    const minSum = mins.reduce((a, b) => a + b, 0);
    
    // Safety check: if minimums exceed 100%, we strictly normalize min weights to fit 100%
    if (minSum > 1.0) {
        // Just return one portfolio: the normalized mins
        const weights = mins.map(w => w / minSum);
        const stats = calculatePortfolioStats(weights, afterTaxReturns, activeAssets, activeCorrelations);
        results.push(stats);
        return results;
    }

    for (let k = 0; k < batchSize; k++) {
      // 1. Start with Minimums
      let weights = [...mins];
      let remainingBudget = 1.0 - minSum;

      // 2. Distribute remaining budget randomly respecting Max constraints
      // Strategy: Randomly assign portions of remaining budget to eligible assets
      // until budget is exhausted or all maxed out.
      
      // Create a random order to fill assets
      const indices = Array.from({length: n}, (_, i) => i);
      // Shuffle indices (Fisher-Yates)
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // First pass: try to fill randomly
      // Generate random stick breaks for better distribution
      let randomShares = indices.map(() => Math.random());
      const shareSum = randomShares.reduce((a,b)=>a+b, 0);
      randomShares = randomShares.map(s => s / shareSum); // Sum to 1

      // Tentatively add budget based on random shares
      for(let i=0; i<n; i++) {
         const idx = i; // simple index
         const add = randomShares[i] * remainingBudget;
         weights[i] += add;
      }

      // 3. Correction Loop for Max Constraints
      // If any weight exceeds max, trim it and redistribute excess to others that have room
      let violations = true;
      let iter = 0;
      while(violations && iter < 20) {
         violations = false;
         let excess = 0;
         
         // Trim to Max
         for(let i=0; i<n; i++) {
            if (weights[i] > maxs[i]) {
                excess += weights[i] - maxs[i];
                weights[i] = maxs[i];
                violations = true;
            }
         }

         if (excess > 0.000001) {
             // Redistribute excess to those below max
             // Count how many have room
             const availableIndices = weights.map((w, i) => (w < maxs[i] - 0.000001) ? i : -1).filter(i => i !== -1);
             
             if (availableIndices.length === 0) {
                 // No room left, we are stuck (constraints likely impossible to sum to 1)
                 // Just break and accept (will normalize later)
                 break; 
             }
             
             // Distribute proportionally or equally? Equally is safer for convergence
             const chunk = excess / availableIndices.length;
             availableIndices.forEach(idx => {
                 weights[idx] += chunk;
                 if (weights[idx] > maxs[idx]) violations = true; // Flag to check again
             });
         }
         iter++;
      }

      // Final normalization to ensure exact sum 1.0 (float errors)
      const total = weights.reduce((a, b) => a + b, 0);
      if (total > 0) weights = weights.map(w => w / total);

      const stats = calculatePortfolioStats(weights, afterTaxReturns, activeAssets, activeCorrelations);
      results.push(stats);
    }
    return results;
  };

  // Calculate effective global constraints by aggregating per-entity allocations
  // Entities without useAssetAllocation enabled use default constraints (0-100%) - optimizer allocates freely
  const calculateEffectiveConstraints = (assetList, structuresList) => {
    const totalValue = structuresList.reduce((sum, s) => sum + (s.value || 0), 0);
    if (totalValue === 0) return assetList;

    // Process ALL entities: those with custom allocation use their constraints, 
    // those without use default (0-100% for all assets)
    return assetList.map(asset => {
      let weightedMin = 0;
      let weightedMax = 0;

      structuresList.forEach(entity => {
        if (!entity.value) return;
        const entityProportion = entity.value / totalValue;

        if (entity.useAssetAllocation && entity.assetAllocation) {
          // Use custom allocation constraints from entity
          const alloc = entity.assetAllocation.find(a => a.id === asset.id);
          if (alloc) {
            weightedMin += (alloc.min || 0) * entityProportion;
            weightedMax += (alloc.max !== undefined ? alloc.max : 100) * entityProportion;
          } else {
            // Asset not in entity's allocation list - use defaults (0-100)
            weightedMax += 100 * entityProportion;
          }
        } else {
          // Entity without allocation enabled: use Asset's default bounds (scaled by entity proportion)
          weightedMin += (asset.minWeight !== undefined ? asset.minWeight : 0) * entityProportion;
          weightedMax += (asset.maxWeight !== undefined ? asset.maxWeight : 100) * entityProportion;
        }
      });

      return {
        ...asset,
        // Restore Math.max(0) to enforce STRICT non-negative constraints per user request
        minWeight: Math.max(0, weightedMin),
        maxWeight: Math.max(0, weightedMax) 
      };
    });
  };

  // Helper: Round to 6 decimal places (for precision consistency)
  const round6 = (num) => Math.round(num * 1000000) / 1000000;

  const handleRunOptimization = () => {
    const logs = [];
    logs.push({ step: 'Start', details: 'Optimization Initiated (v1.243)', timestamp: Date.now() });

    // Helper to clamp negative weights and renormalize 
    const ensureNonNegative = (weights) => {
        let clamped = weights.map(w => Math.max(0, w));
        const sum = clamped.reduce((a, b) => a + b, 0);
        if (sum === 0) return clamped; 
        return clamped.map(w => w / sum);
    };

    // Use global asset settings directly for constraints, ensuring defaults (0.1%) apply to all
    // Bypassing calculateEffectiveConstraints to strict enforcement of Settings
    const activeAssets = assets.filter(a => a.active);
    if (activeAssets.length < 2) {
      alert("Please select at least 2 active assets to optimize.");
      return;
    }

    setIsSimulating(true);
    setProgress(0);
    setSimulations([]);
    setEfficientFrontier([]); // Clear stale results immediately

    // Prepare Data
    
    // Dynamic Correlation Matrix Construction
    const activeIndices = assets.map((a, i) => a.active ? i : -1).filter(i => i !== -1);
    const activeCorrelations = activeIndices.map(rowIdx => 
      activeIndices.map(colIdx => {
         const idA = assets[rowIdx].id;
         const idB = assets[colIdx].id;
         if (idA === idB) return 1.0;
         return correlations[idA] && correlations[idA][idB] !== undefined ? correlations[idA][idB] : 0.3;
      })
    );

    // Group Constraints (Step 4: 15% Cap on Alternatives)
    const altAssets = ['reits', 'hedge', 'comm'];
    const altIndices = [];
    activeAssets.forEach((a, idx) => {
        if (altAssets.includes(a.id)) altIndices.push(idx);
    });
    
    const groupConstraints = [];
    if (altIndices.length > 0) {
        groupConstraints.push({
            message: "Alternatives Cap (15%)",
            indices: altIndices,
            max: 0.15
        });
        logs.push({ step: 'Constraint', details: `Applied 15% Cap to indices: ${altIndices.join(', ')}` });
    }

    // Prepare Assets for Optimization (Pre-Tax Risk, but we need After-Tax Return)
    // We will calculate After-tax returns per entity.
    
    // Collect Constraints
    // Collect Constraints
    // Constraints are now built per-entity inside the loop to support conditional strict mode (v1.229)
    
     // Forecast Confidence (T)
    const T_MAP = { 1: 15, 2: 50, 3: 200 }; 
    const confidenceT = T_MAP[forecastConfidenceLevel] || 50;
    const numSimulations = Math.max(10, Math.min(simulationCount, 500));

    setTimeout(() => {
        try {
            // =====================================================
            // ENTITY-SPECIFIC OPTIMIZATION
            // Run separate optimization for each unique entity type
            // =====================================================
            const uniqueEntityTypes = [...new Set(structures.map(s => s.type))];
            const perEntityFrontiers = {};
            // Also keep track of a "Global Fallback" in case Total Wealth is 0 or singular
            let globalFallbackFrontier = []; 
            const cloud = []; 
            
            
            uniqueEntityTypes.forEach(entityType => {
                try {
                    // Manual inline calculation to capture debug details
                    // Step 1: Tax Adjust (Strict 4 decimals)
                    const entRates = entityTypes[entityType] || { incomeTax: 0, ltCgt: 0 };
                    const detailLogs = [];

                    const entityOptAssets = activeAssets.map((asset, i) => {
                        const preTaxReturn = asset.return; 
                        const incomeRatio = asset.incomeRatio !== undefined ? asset.incomeRatio : 1.0; 
                        const incomeTax = entRates.incomeTax;
                        const capGainTax = entRates.ltCgt; 

                        // Formula: Ret * [ (Income% * (1-IncTax)) + (Growth% * (1-CGT)) ]
                        // Round intermediates to 6 decimal places
                        const incomeComponent = round6(incomeRatio * (1 - incomeTax));
                        const growthComponent = round6((1 - incomeRatio) * (1 - capGainTax));
                        const afterTaxReturn = round6(preTaxReturn * (incomeComponent + growthComponent));

                        // Post-Tax Risk Adjustment
                        // UPDATE (v1.233): User feedback confirms SD should NOT be tax-adjusted. 
                        // Risk remains Pre-Tax. Only Return is Tax-Adjusted.
                        const riskInput = asset.stdev || 0;

                        detailLogs.push({
                            name: asset.name,
                            preTax: preTaxReturn,
                            incomeRatio: incomeRatio,
                            incTaxRate: incomeTax,
                            cgtRate: capGainTax,
                            postTax: afterTaxReturn,
                            riskUsed: riskInput
                        });

                        return {
                            ...asset,
                            return: afterTaxReturn,
                            stdev: riskInput
                        };
                    });
                    
                    logs.push({ step: `Entity Opt: ${entityType}`, details: detailLogs });

                    // BUILD CONSTRAINTS (v1.230 Logic)
                    // behavior: 
                    // 1. If "Current Asset Allocation" is CHECKED -> Use the explicit inputs from that entity.
                    // 2. If UNCHECKED -> Use "System Defaults" (Strict 9% Cap), ie. "Treatment to Date".
                    
                    const structWithAlloc = structures.find(s => s.type === entityType && s.useAssetAllocation);
                    const useCustom = !!structWithAlloc;

                    const constraints = {
                        minWeights: [],
                        maxWeights: []
                    };

                    if (useCustom && structWithAlloc.assetAllocation) {
                         // CASE A: Checked (Custom Inputs)
                         // We trust the user's manual inputs for this entity
                         constraints.minWeights = activeAssets.map(a => {
                             const row = structWithAlloc.assetAllocation.find(r => r.id === a.id);
                             return (row && row.min !== undefined) ? row.min / 100 : 0;
                         });
                         constraints.maxWeights = activeAssets.map(a => {
                             const row = structWithAlloc.assetAllocation.find(r => r.id === a.id);
                             // If user left max blank/undefined, default to 100? Or System Default?
                             // User said "uses whatever has been input". We assume explicit max.
                             return (row && row.max !== undefined) ? row.max / 100 : 1.0; 
                         });
                    } else {
                         // CASE B: Unchecked (System Defaults / "Treatment to Date")
                         // We must enforce the Strict Caps (e.g. 9% EM Bond)
                         constraints.minWeights = activeAssets.map(a => (a.minWeight || 0)/100);
                         constraints.maxWeights = activeAssets.map(a => {
                             let stateMax = (a.maxWeight !== undefined ? a.maxWeight : 100) / 100;
                             
                             // Enforce System Default (Anti-Stale / Strict Logic)
                             const def = DEFAULT_ASSETS.find(d => d.id === a.id);
                             if (def) {
                                 const sysMax = (def.maxWeight !== undefined ? def.maxWeight : 100) / 100;
                                 if (sysMax < stateMax) stateMax = sysMax;
                             }
                             return stateMax;
                         });
                    }
                    
                    // Parse Group Constraints from UI Inputs (v1.244)
                    // Format: "GroupName:Limit" (e.g., "Defensive:30" => Max 30% for all assets marked "Defensive")
                    const groupConstraints = [];
                    const groupMap = {}; // { "Name": { max: 1.0, indices: [] } }
                    
                    if (useCustom && structWithAlloc.assetAllocation) {
                        activeAssets.forEach((asset, idx) => {
                             const row = structWithAlloc.assetAllocation.find(r => r.id === asset.id);
                             if (row && row.groupLimit) {
                                  // Parse "Name:Limit" or just "Name" (if Limit defined elsewhere? No, explicit here)
                                  // We take the strictest limit found for the group name.
                                  const parts = row.groupLimit.split(':');
                                  const gName = parts[0].trim();
                                  let gLimit = 1.0;
                                  
                                  if (parts.length > 1) {
                                      const val = parseFloat(parts[1]);
                                      if (!isNaN(val)) gLimit = val / 100;
                                  }
                                  
                                  if (gName) {
                                      if (!groupMap[gName]) groupMap[gName] = { max: 1.0, indices: [] };
                                      groupMap[gName].indices.push(idx);
                                      // Take minimum valid limit seen for this group
                                      if (gLimit < groupMap[gName].max) groupMap[gName].max = gLimit;
                                  }
                             }
                        });
                        Object.values(groupMap).forEach(g => groupConstraints.push(g));
                    }

                    // Step 2: Optimize (Maximize Return for fixed Risk)
                    // runResampledOptimization approximates the Efficient Frontier
                    const entityResult = runResampledOptimization(
                        entityOptAssets, 
                        activeCorrelations, 
                        constraints, 
                        confidenceT, 
                        Math.max(10, Math.floor(numSimulations / 2)),
                        groupConstraints // Pass Parsed Groups
                    );
                    
                    // Map to 10 buckets (Risk-based distribution)
                    const entityFrontier = entityResult.frontier.map(p => ({
                        ...p,
                        return: p.return,
                        risk: p.risk,
                        weights: ensureNonNegative(p.weights)
                    }));
                    
                    // Normalize to 10 Named Profiles
                    if (entityFrontier.length > 0) {
                        const BUCKET_LABELS = [
                            "Defensive", "Conservative", "Moderate Conservative", "Moderate", "Balanced",
                            "Balanced Growth", "Growth", "High Growth", "Aggressive", "High Aggressive"
                        ];
                        
                        const minRisk = entityFrontier[0].risk;
                        const maxRisk = entityFrontier[entityFrontier.length - 1].risk;
                        
                        // Glide Path Rule: Profile 1 = Min Variance (0th index), Profile 10 = Max Return (last index)
                        // Verify sorting? Michaud frontiers are sorted by Return usually. But Min Var should be first.
                        // We will sort by Risk just in case.
                        entityFrontier.sort((a,b) => a.risk - b.risk);

                        const mappedEntityFrontier = [];
                        
                        // Interpolate indices 0 to 9
                        BUCKET_LABELS.forEach((label, idx) => {
                            // Logic: map idx 0..9 to Frontier indices 0..Length-1
                            // To align closely with "Fixed Risk Level" request, we distribute equidistant by Risk.
                            const step = (maxRisk - minRisk) / (BUCKET_LABELS.length - 1 || 1);
                            const targetRisk = minRisk + (idx * step);
                            
                            let closest = entityFrontier[0];
                            let minDiff = Math.abs(entityFrontier[0].risk - targetRisk);
                            
                            for (let p of entityFrontier) {
                                const diff = Math.abs(p.risk - targetRisk);
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    closest = p;
                                }
                            }
                            
                            mappedEntityFrontier.push({
                                ...closest,
                                id: idx + 1,
                                label: `Portfolio ${idx + 1} - ${label}`
                            });
                        });
                        
                        const finalEntityFrontier = mappedEntityFrontier.map((p, idx) => ({
                            ...p,
                            id: idx + 1,
                            label: `Portfolio ${idx + 1} - ${p.label.split(' - ')[1]}`
                        }));

                        perEntityFrontiers[entityType] = finalEntityFrontier;
                        
                        // Accumulate simulation cloud data for visualization
                        if (entityResult.simulations) {
                             entityResult.simulations.forEach(simFrontier => {
                                simFrontier.forEach(p => {
                                    cloud.push({
                                        return: p.return, 
                                        risk: p.risk
                                    });
                                });
                            });
                        }

                        // Store Personal or first available as fallback
                        if (entityType === 'PERSONAL' || !globalFallbackFrontier.length) {
                             globalFallbackFrontier = finalEntityFrontier;
                        }

                        // Log the resulting Allocations for verification (v1.238)
                        // Capture matrix of all 10 portfolios
                        logs.push({
                            step: `Entity Allocations: ${entityType}`,
                            details: {
                                assets: activeAssets.map(a => a.name),
                                portfolios: finalEntityFrontier.map(p => ({
                                    id: p.id,
                                    label: p.label,
                                    weights: p.weights
                                }))
                            }
                        });
                    }
                } catch (entityErr) {
                    console.warn(`Entity optimization for ${entityType} failed:`, entityErr);
                }
            });

            // Store entity-specific frontiers
            // Store entity-specific frontiers
            setEntityFrontiers(perEntityFrontiers);

            // =====================================================
            // 5. AGGREGATE PROFILES (Weighted Blend)
            // =====================================================
            
            const weightedFrontier = [];
            
            // Calculate Weighted Average per Profile (Rank 1 to 10)
            // Calculate Weighted Average per Profile (Rank 1 to 10)
            const numProfiles = perEntityFrontiers[Object.keys(perEntityFrontiers)[0]]?.length || 9;
            
            for(let p=0; p<numProfiles; p++) {
                let blendedWeights = new Array(activeAssets.length).fill(0);
                let totalWeight = 0;
                
                Object.keys(perEntityFrontiers).forEach(type => {
                   const entityFrontier = perEntityFrontiers[type];
                   if (!entityFrontier || !entityFrontier[p]) return;
                   
                   // Weight of this entity in total portfolio
                   const totalVal = structures.reduce((sum,s)=>sum+s.value,0) || 1;
                   const typeVal = structures.filter(s => s.type === type).reduce((sum,s)=>sum+s.value,0);
                   const weight = typeVal / totalVal;
                   
                   if (weight > 0) {
                       const entityW = entityFrontier[p].weights;
                       for(let i=0; i<blendedWeights.length; i++) {
                           blendedWeights[i] += entityW[i] * weight;
                       }
                       totalWeight += weight;
                   }
                });
                
                if (totalWeight === 0) {
                    // Fallback if something went wrong: Equal weight (shouldn't happen if structures exist)
                    // Or default to globalFallback if available
                    if (globalFallbackFrontier[p]) {
                         blendedWeights = globalFallbackFrontier[p].weights;
                    } else {
                         blendedWeights.fill(1/activeAssets.length);
                    }
                } else {
                     // Normalize (precision safety)
                     const sumW = blendedWeights.reduce((a,b)=>a+b,0);
                     if (sumW > 0) blendedWeights = blendedWeights.map(w => w/sumW);
                }
                
                weightedFrontier.push({
                    id: p+1,
                    label: `Profile ${p+1}`,
                    weights: blendedWeights,
                    return: 0, // Recalculated below
                    risk: 0    // Recalculated below
                });
            }

            // =====================================================
            // 6. APPLY PORTFOLIO CONSTRAINT MATRIX (Sanity Check)
            // =====================================================
            // Force the blended profiles to stay within "River" of Sample Targets
            
            // Force the blended profiles to stay within "River" of Sample Targets
            
            // v1.244: Simplified Sanitize Weights
            // The previous logic enforced "River" constraints and System Defaults which conflicted with User Inputs.
            // We now rely on the Optimizer to handle constraints correctly.
            // This function just cleans up floating point noise (0..1 clamp).
            
            const sanitizeWeights = (profiles, assets) => {
                return profiles.map(profile => {
                    let weights = [...profile.weights];
                    
                    // Simple Clamp 0..1
                    const clean = weights.map(w => {
                        let val = w;
                        if (val < 0) val = 0;
                        if (val > 1) val = 1;
                        return val;
                    });
                    
                    // Normalize Sum to 1
                    const sum = clean.reduce((a,b) => a+b, 0);
                    const final = sum > 0 ? clean.map(w => w/sum) : clean;
                    
                    return { ...profile, weights: final };
                });
            };



            const constrainedFrontier = sanitizeWeights(weightedFrontier, activeAssets);

            // =====================================================
            // 7. FINALIZE STATS & STATE
            // =====================================================

            const BUCKET_LABELS = [
                "Defensive", "Conservative", "Moderate Conservative", "Moderate", "Balanced",
                "Balanced Growth", "Growth", "High Growth", "Aggressive", "High Aggressive"
            ];
            
            // v1.244 Change: User requested removal of Portfolio 1.
            // We generate 10 steps as before to maintain the risk curve, but discard the first (Defensive/Cash-heavy).
            // We also remove the descriptive text labels.
            
            const rawProfiles = constrainedFrontier.map((p, pIdx) => {
                 // 1. Calculate Weighted Average Return (After-Tax)
                 const netAssetReturns = calculateClientTaxAdjustedReturns(activeAssets, structures, entityTypes); 
                 const portReturn = p.weights.reduce((sum, w, i) => sum + (w * netAssetReturns[i]), 0);
                 
                 // 2. Calculate Risk (Standard Deviation)
                 let variance = 0;
                 for(let i=0; i<p.weights.length; i++) {
                     for(let j=0; j<p.weights.length; j++) {
                         variance += p.weights[i] * p.weights[j] * activeCorrelations[i][j] * activeAssets[i].stdev * activeAssets[j].stdev;
                     }
                 }
                 
                 return {
                     ...p,
                     label: `Portfolio ${p.id}`, // Placeholder
                     return: portReturn,
                     risk: Math.sqrt(variance)
                 };
            });
            
            // Re-instating 10 portfolios (v1.249 Fix)
            const finalProfiles = rawProfiles.map((p, idx) => ({
                ...p,
                id: idx + 1,
                label: `Portfolio ${idx + 1}`
            }));

            setDebugLogs(logs);
            
            setOptimizationAssets(activeAssets);
            setSimulations(cloud); 
            setEfficientFrontier(finalProfiles);
            setSelectedPortfolioId(5); // Default to middle (was 5, now maybe 4 or 5 in new scale)
            setIsSimulating(false);
            setProgress(100);
            setActiveTab('optimization');
            
            // Trigger cashflow simulation
            setTimeout(() => { }, 200);
            
        } catch (err) {
            console.error("Optimization Failed", err);
            alert("Optimization failed: " + err.message);
            setIsSimulating(false);
        }
    }, 100);
  };

  const finishOptimization = (sims, frontier, activeAssets) => {
    // 4. Map Efficient Frontier to 10 Named Buckets (User Requested)
    // Labels: Defensive, Conservative, Moderate Conservative, Moderate, Balanced,
    // Balanced Growth, Growth, High Growth, Aggressive, High Aggressive
    
    const BUCKET_LABELS = [
        "Defensive",
        "Conservative", 
        "Moderate Conservative",
        "Moderate",
        "Balanced",
        "Balanced Growth",
        "Growth",
        "High Growth",
        "Aggressive",
        "High Aggressive"
    ];

    // Find Global Min/Max Risk from the full frontier
    if (frontier.length === 0) { setIsSimulating(false); return; }
    
    const minRisk = frontier[0].risk;
    const maxRisk = frontier[frontier.length - 1].risk;
    
    // We want 10 points distributed by Risk
    // v1.244: Generate 10 buckets, then slice off the first one.
    // We want 10 points distributed by Risk
    const rawMapped = [];
    const step = (maxRisk - minRisk) / (BUCKET_LABELS.length - 1 || 1);

    BUCKET_LABELS.forEach((label, idx) => {
        const targetRisk = minRisk + (idx * step);
        // Find portfolio in frontier with closest risk
        let closest = frontier[0];
        let minDiff = Math.abs(frontier[0].risk - targetRisk);
        
        for (let p of frontier) {
            const diff = Math.abs(p.risk - targetRisk);
            if (diff < minDiff) {
                minDiff = diff;
                closest = p;
            }
        }
        
        rawMapped.push({
            ...closest,
            id: idx + 1,
            label: `Portfolio ${idx + 1}` // Placeholder name
        });
    });
    
    // Re-instating 10 portfolios
    const mappedFrontier = rawMapped.map((p, idx) => ({
        ...p,
        id: idx + 1,
        label: `Portfolio ${idx + 1}`
    }));

    setOptimizationAssets(activeAssets);
    setSimulations(sims); // The Cloud
    setEfficientFrontier(mappedFrontier);
    
    // Default to middle (Portfolio 5)
    setSelectedPortfolioId(5);
    
    // Default to "Balanced" (Index 4 => ID 5)
    setSelectedPortfolioId(5);

    setIsSimulating(false);
    setProgress(100); // Show 100% only after all processing is complete
    setActiveTab('optimization');
    
    // Trigger cashflow simulation immediately so Estimating Outcomes has data
    setTimeout(() => {
      // The simulation will run via useEffect when tab changes, but also trigger here
      // to ensure data is ready before user navigates
    }, 200);
  };

  const runCashflowMonteCarlo = useCallback(() => {
    if (!selectedPortfolio) return;

    const numRuns = 1000;
    const years = projectionYears;
    
    // 1. Calculate Pre-Tax Portfolio Return/Risk if needed
    // We already have 'selectedPortfolio' which is implicitly After-Tax (calculated in optimization)
    // To get Pre-Tax, we need to calculate it from the selected weights and raw asset returns involved.
    
    let simReturn = selectedPortfolio.return;
    let simRisk = selectedPortfolio.risk;

    if (showBeforeTax) {
         // Calculate Pre-Tax Stats roughly based on weighted average of raw asset returns
         // Re-use calculation logic but with raw returns
         const weights = selectedPortfolio.weights || [];
         if (weights.length === optimizationAssets.length) {
             let expectedReturn = 0;
             let variance = 0;
             
             // Calculate Return
             for (let i = 0; i < weights.length; i++) {
                 expectedReturn += weights[i] * optimizationAssets[i].return;
             }

             // Calculate Risk (variance) - using same correlations
             // Note: Correlations are same pre/post tax generally for this model level
             for (let i = 0; i < weights.length; i++) {
                 for (let j = 0; j < weights.length; j++) {
                     const activeIndices = assets.map((a, idx) => a.active ? idx : -1).filter(idx => idx !== -1);
                     // Need to map optimizationAssets index back to global assets index to get correlation
                     // optimizationAssets is subset of assets. Assuming order is preserved from activeAssets check.
                     // The 'optimizationAssets' state might need to be robust. 
                     // Let's use the 'activeAssets' derived inside handleRunOptimization if possible, 
                     // but here we rely on 'optimizationAssets' state saved after optimization.
                     
                     // Helper: find asset ID to look up correlation
                     const idA = optimizationAssets[i].id;
                     const idB = optimizationAssets[j].id;
                     
                     // activeCorrelations logic is complex to reconstruct here without the matrix.
                     // However, 'selectedPortfolio.risk' is after-tax risk. 
                     // Pre-tax risk should generally be higher or similar. 
                     // Approximation: Scale risk by ratio of Returns? No, that's not accurate.
                     // Better approach: Since we don't have the full covariance matrix handy easily without 
                     // re-deriving 'activeCorrelations' (which is local in handleRunOptimization),
                     // and 'correlations' state is global...
                     
                     const val = (idA === idB) ? 1.0 : (correlations[idA] && correlations[idA][idB] !== undefined ? correlations[idA][idB] : 0.3);
                     const cov = val * (optimizationAssets[i].stdev || 0) * (optimizationAssets[j].stdev || 0);
                     variance += weights[i] * weights[j] * cov;
                 }
             }
             
             simReturn = expectedReturn;
             simRisk = Math.sqrt(variance);
         }
    }

    const annualNetFlows = new Array(years + 1).fill(0);
    
    // Calculate Weighted Average Tax Rate for Fee Deduction Tax Shield
    let wTaxRate = 0; 
    if (structures.length > 0) {
       const totalVal = structures.reduce((s, st) => s + st.value, 0);
       if (totalVal > 0) {
           wTaxRate = structures.reduce((s, st) => {
               const entityDef = entityTypes[st.type] || entityTypes.COMPANY; 
               let rate = entityDef ? entityDef.incomeTax : 0.30;
               
               if (st.type === 'SUPER_ACCUM') {
                   // Split logic for tax rate
                   const pensionPct = st.pensionPercentage || 0;
                   const pensionVal = st.value * (pensionPct / 100);
                   const accumVal = st.value - pensionVal;
                   
                   const pensRate = entityTypes.PENSION ? entityTypes.PENSION.incomeTax : 0.0;
                   const accumRate = rate; // 15% usually
                   
                   // Weighted rate for this structure relative to its own value
                   // (accumVal * accumRate + pensionVal * pensRate) / st.value
                   if (st.value > 0) {
                       rate = ((accumVal * accumRate) + (pensionVal * pensRate)) / st.value;
                   } else {
                       rate = 0;
                   }
               }

               return s + (rate * (st.value / totalVal));
           }, 0);
       }
    }

    // Helper to get tax rate for a stream
    const getTaxRateForEntity = (entityId) => {
        if (!entityId || entityId === 'all') {
            // Default to Personal Rate if not specified
            return entityTypes.PERSONAL ? entityTypes.PERSONAL.incomeTax : 0.47;
        }
        const struct = structures.find(s => s.id == entityId); // loose equality in case of string/int mismatch
        if (!struct) return 0.47; // Default fallback

        if (struct.useCustomTax && struct.customTax) {
             return struct.customTax.incomeTax || 0;
        }
        const typeDef = entityTypes[struct.type];
        return typeDef ? typeDef.incomeTax : 0.47;
    };

    for (let y = 1; y <= years; y++) {
      let flow = 0;
      const inflationFactor = Math.pow(1 + inflationRate, y);
      
      incomeStreams.forEach(s => {  
        const amount = parseFloat(s.amount) || 0;
        const taxRate = getTaxRateForEntity(s.entityId);

        if (s.isOneOff) {
            // Ensure strict type comparison or loose if year can be string.
            // s.year is usually number from input. y is number.
            if (parseInt(s.year) === y) {
                 const netIncome = showBeforeTax ? amount : amount * (1 - taxRate);
                 flow += netIncome * inflationFactor; 
            }
        } else {
            if(y >= s.startYear && y <= s.endYear) {
              const netIncome = showBeforeTax ? amount : amount * (1 - taxRate);
              flow += netIncome * inflationFactor; 
            }
        }
      });
      
      expenseStreams.forEach(s => { 
        const amount = parseFloat(s.amount) || 0;
        // Expenses are usually post-tax spending. 
        // If showing Before Tax, we subtract Gross Amount needed to pay that expense? 
        // Or just the expense amount? Convention: Expense reduces wealth directly.
        // Usually expenses are stated in "money out of pocket". 
        // If Before Tax view, do we gross up expenses? 
        // No, typically Before Tax view shows Gross Income growth. Expenses are just expenses.
        // However, standard logic: Net Flow = Income - Expense. 
        // If Income is Gross, Flow is Gross Income - Expense. This mimics "Pre-Tax Cashflow".
        const val = amount * inflationFactor;

        if (s.isOneOff) {
            if (parseInt(s.year) === y) {
                flow -= val; 
            }
        } else {
            if(y >= s.startYear && y <= s.endYear) {
              flow -= val; 
            }
        }
      });
      
      annualNetFlows[y] = flow;
    }

    const results = [];

    for (let y = 0; y <= years; y++) {
      results.push({ year: y, p05: 0, p50: 0, p95: 0, paths: [] });
    }

    const seed = 12345; // Fixed seed for deterministic results
    const rng = createSeededRandom(seed);

    for (let r = 0; r < numRuns; r++) {
      let balance = totalWealth;
      results[0].paths.push(balance);

      for (let y = 1; y <= years; y++) {
        const rnd = randn_bm(rng); 
        const annualReturn = simReturn + (rnd * simRisk);
        
        balance = balance * (1 + annualReturn);
        
        // Fee Deduction with Tax Shield
        if (adviceFee > 0) {
            const grossFee = balance * adviceFee;
            // If Before Tax, do we apply tax shield?
            // Before Tax usually ignores tax effects. So Fee is just Fee.
            // After Tax: Net Fee = Fee * (1 - TaxRate) (deductible)
            
            const effectiveFee = showBeforeTax ? grossFee : (grossFee - (grossFee * wTaxRate));
            balance -= effectiveFee;
        }

        balance += annualNetFlows[y];
        
        if (balance < 0) balance = 0;

        // v1.244: Handle Nominal vs Real (Inflation Adjustment)
        // If showNominal is FALSE, we want REAL values (Deflated).
        const reportBalance = showNominal ? balance : (balance / Math.pow(1 + inflationRate, y));
        
        results[y].paths.push(reportBalance);
      }
    }

    const finalData = results.map(r => ({
      year: r.year,
      p02: calculatePercentile(r.paths, 2.3),
      p50: calculatePercentile(r.paths, 50),
      p84: calculatePercentile(r.paths, 84.1)
    }));

    setCfSimulationResults(finalData);
  }, [selectedPortfolio, totalWealth, incomeStreams, expenseStreams, projectionYears, inflationRate, adviceFee, structures, entityTypes, showBeforeTax, showNominal, optimizationAssets, assets, correlations]);

  useEffect(() => {
    // Run simulation immediately when portfolio is selected (after optimization or tab change)
    if (selectedPortfolio && efficientFrontier.length > 0) {
      runCashflowMonteCarlo();
    }
  }, [selectedPortfolio, efficientFrontier, runCashflowMonteCarlo]);


  // --- Sub-Components ---

  const Navigation = () => (
    <div className="flex flex-col md:flex-row gap-2 mb-6 border-b border-gray-200 pb-4 overflow-x-auto">
      {[
        { id: 'client', label: 'Client Details', icon: User },
        { id: 'optimization', label: 'Optimisation', icon: Calculator },
        { id: 'output', label: 'Output', icon: PieIcon },
        { id: 'cashflow', label: 'Projections', icon: FileText },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === tab.id 
              ? 'bg-fire-accent text-white shadow-sm' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <tab.icon className="w-4 h-4 mr-2" />
          {tab.label}
        </button>
      ))}
    </div>
  );

  const handleLogoUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `logo-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
              .from('assets') // Ensure this bucket exists or use 'public' if configured
              .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
              .from('assets')
              .getPublicUrl(filePath);

          setSettingsDraft(prev => ({ ...prev, logo: data.publicUrl }));
      } catch (error) {
          console.error('Error uploading logo:', error);
          alert('Failed to upload logo: ' + error.message);
      } finally {
          setIsUploading(false);
      }
  };

  const SettingsModal = () => {
      if (!isSettingsOpen) return null;
      // Initialize draft on open
      if (!settingsDraft) return null;

      return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <Settings className="w-6 h-6 mr-2 text-fire-accent" />
                        Application Settings
                    </h3>
                    <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 space-y-8">
                    {/* Identity Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Identity
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Application Title</label>
                                <input 
                                    type="text" 
                                    defaultValue={settingsDraft.title}
                                    onBlur={(e) => setSettingsDraft(prev => ({ ...prev, title: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-fire-accent/50 outline-none transition-all"
                                />
                            </div>
                            <div>
                               <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                               <div className="flex gap-3 items-start">
                                   <div className="w-16 h-16 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-2 shrink-0">
                                       <img src={settingsDraft.logo || fireLogo} alt="Preview" className="max-w-full max-h-full object-contain" />
                                   </div>
                                   <div className="flex-1">
                                       <label className="flex items-center justify-center w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                                            <Upload className="w-4 h-4 mr-2" />
                                            {isUploading ? 'Uploading...' : 'Upload New Logo'}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploading} />
                                       </label>
                                       <p className="text-xs text-gray-500 mt-2">Recommended: PNG or SVG with transparent background.</p>
                                   </div>
                               </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100"></div>

                    {/* Appearance Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                             <Type className="w-4 h-4" /> Appearance
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                                <select 
                                    value={settingsDraft.font || 'Calibri'}
                                    onChange={(e) => setSettingsDraft(prev => ({ ...prev, font: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-fire-accent/50 outline-none"
                                >
                                    {AVAILABLE_FONTS.map(font => (
                                        <option key={font.id} value={font.id}>{font.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <input 
                                                type="color" 
                                                value={settingsDraft.colors.accent}
                                                onChange={(e) => setSettingsDraft(prev => ({ ...prev, colors: { ...prev.colors, accent: e.target.value } }))}
                                                className="w-10 h-10 rounded cursor-pointer border-0 p-0 overflow-hidden shadow-sm"
                                            />
                                        </div>
                                        <input 
                                            type="text"
                                            key={`accent-${settingsDraft.colors.accent}`}
                                            defaultValue={settingsDraft.colors.accent}
                                            onBlur={(e) => {
                                                let val = e.target.value.trim();
                                                if (!val.startsWith('#')) val = '#' + val;
                                                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                                    setSettingsDraft(prev => ({ ...prev, colors: { ...prev.colors, accent: val } }));
                                                }
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                            className="text-xs font-mono text-gray-700 border border-gray-300 rounded px-2 py-1 w-20"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Heading Color</label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <input 
                                                type="color" 
                                                value={settingsDraft.colors.heading}
                                                onChange={(e) => setSettingsDraft(prev => ({ ...prev, colors: { ...prev.colors, heading: e.target.value } }))}
                                                className="w-10 h-10 rounded cursor-pointer border-0 p-0 overflow-hidden shadow-sm"
                                            />
                                        </div>
                                        <input 
                                            type="text"
                                            key={`heading-${settingsDraft.colors.heading}`}
                                            defaultValue={settingsDraft.colors.heading}
                                            onBlur={(e) => {
                                                let val = e.target.value.trim();
                                                if (!val.startsWith('#')) val = '#' + val;
                                                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                                    setSettingsDraft(prev => ({ ...prev, colors: { ...prev.colors, heading: val } }));
                                                }
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                            className="text-xs font-mono text-gray-700 border border-gray-300 rounded px-2 py-1 w-20"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-xl">
                    <button 
                      onClick={() => {
                          if(window.confirm('Reset all settings to default?')) {
                              setAppSettings(DEFAULT_APP_SETTINGS);
                              setSettingsDraft(DEFAULT_APP_SETTINGS);
                              setIsSettingsOpen(false);
                          }
                      }}
                      className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        Reset to Defaults
                    </button>
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setIsSettingsOpen(false)}
                            className="px-5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                setAppSettings(settingsDraft);
                                setIsSettingsOpen(false);
                            }}
                            className="px-5 py-2 text-sm font-medium bg-fire-accent text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity flex items-center"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
  };
   

  const DataTab = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-fire-accent" />
          Capital Market Estimates
        </h3>
        {/* Defensive check */}
        {!assets ? <div>Loading assets...</div> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs"> {/* Reduced font size to text-xs */}
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-500">Asset Class</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 w-20">
                  <div>Expected Return</div>
                  <div className="text-[10px]">(%)</div>
                </th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 w-20">
                  <div>Expected SD</div>
                  <div className="text-[10px]">(%)</div>
                </th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 w-20">Proportion of return – gains (%)</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 w-20">Proportion of return – income (%)</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map((asset) => (
                <tr key={asset.id} className={!asset.active ? 'opacity-50 bg-gray-50' : ''}>
                  <td className="px-4 py-3 font-medium text-black">
                    <div className="flex items-center">
                      {asset.isDefault ? (
                        asset.name
                      ) : (
                        <input 
                          type="text" 
                          defaultValue={asset.name}
                          onBlur={(e) => {
                            if (e.target.value !== asset.name) {
                              setAssets(assets.map(a => a.id === asset.id ? {...a, name: e.target.value} : a));
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          className="border border-gray-300 rounded px-2 py-1 w-full text-xs text-black"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center">
                      <input 
                        type="text" 
                        className="w-20 border rounded px-2 py-1 text-xs text-center text-black"
                        disabled={!asset.active}
                        key={`return-${asset.id}-${asset.return}`}
                        defaultValue={(asset.return * 100).toFixed(6)}
                        onBlur={(e) => {
                           const val = parseFloat(e.target.value);
                           if (!isNaN(val) && val/100 !== asset.return) {
                             setAssets(assets.map(a => a.id === asset.id ? {...a, return: val/100} : a));
                           }
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="text" 
                      className="w-20 border rounded px-2 py-1 text-xs text-center text-black"
                      disabled={!asset.active}
                      key={`stdev-${asset.id}-${asset.stdev}`}
                      defaultValue={(asset.stdev * 100).toFixed(6)}
                      onBlur={(e) => {
                           const val = parseFloat(e.target.value);
                           if (!isNaN(val) && val/100 !== asset.stdev) {
                             setAssets(assets.map(a => a.id === asset.id ? {...a, stdev: val/100} : a));
                           }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="text" 
                      key={`gains-${asset.id}-${asset.incomeRatio}`}
                      defaultValue={Math.round((1 - asset.incomeRatio) * 100).toString()}
                      onBlur={(e) => {
                         let val = parseFloat(e.target.value);
                         if (isNaN(val)) val = 0;
                         if (val > 100) val = 100;
                         if (val < 0) val = 0;
                         const newIncomeRatio = 1 - (val / 100);
                         if (newIncomeRatio !== asset.incomeRatio) {
                           setAssets(assets.map(a => a.id === asset.id ? { ...a, incomeRatio: newIncomeRatio } : a));
                         }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      className="w-16 border border-gray-300 rounded px-1 py-1 text-xs text-center text-black"
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="text" 
                      key={`income-${asset.id}-${asset.incomeRatio}`}
                      defaultValue={Math.round(asset.incomeRatio * 100).toString()}
                      onBlur={(e) => {
                         let val = parseFloat(e.target.value);
                         if (isNaN(val)) val = 0;
                         if (val > 100) val = 100;
                         if (val < 0) val = 0;
                         if (val / 100 !== asset.incomeRatio) {
                           setAssets(assets.map(a => a.id === asset.id ? { ...a, incomeRatio: val / 100 } : a));
                         }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      className="w-16 border border-gray-300 rounded px-1 py-1 text-xs text-center text-black"
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button 
                      onClick={() => handleDeleteAsset(asset.id)} 
                      className="text-red-400 hover:text-red-600"
                      title="Remove asset class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-gray-200">
            <button 
              onClick={handleAddAsset}
              className="flex items-center text-sm font-medium text-fire-accent hover:text-blue-800"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Asset Class
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Correlation Matrix Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-fire-accent" />
          Correlation
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs table-fixed">
            <thead>
              <tr>
                <th className="px-2 py-2 bg-gray-50 w-24 sticky left-0 z-20 border-r border-gray-200"></th>
                {assets.map(a => (
                  <th key={a.id} className="px-1 py-2 bg-gray-50 font-medium text-gray-500 text-center w-20 whitespace-nowrap overflow-hidden text-ellipsis" title={a.name}>
                    {a.name}
                  </th>
                ))}
                <th className="px-2 py-2 bg-gray-50 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map(rowAsset => (
                <tr key={rowAsset.id} className={!rowAsset.active ? 'opacity-50' : ''}>
                  <td className="px-2 py-2 font-medium text-black bg-gray-50 whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 w-24 overflow-hidden text-ellipsis" title={rowAsset.name}>
                    {rowAsset.name}
                  </td>
                  {assets.map(colAsset => {
                     const isDiag = rowAsset.id === colAsset.id;
                     const val = correlations[rowAsset.id] && correlations[rowAsset.id][colAsset.id] !== undefined ? correlations[rowAsset.id][colAsset.id] : 0;
                     
                     return (
                       <td key={colAsset.id} className="px-1 py-1 text-center h-10 w-20">
                          {isDiag ? (
                            <div className="text-gray-300 text-center">-</div>
                          ) : (
                            <input 
                              type="text"
                              className="w-16 border border-gray-200 rounded px-1 py-1 text-center text-xs text-black focus:ring-1 focus:ring-fire-accent focus:border-fire-accent"
                              key={`corr-${rowAsset.id}-${colAsset.id}-${val}`}
                              defaultValue={val.toFixed(6)}
                              disabled={!rowAsset.active || !colAsset.active} 
                              onBlur={(e) => {
                                  const newVal = parseFloat(e.target.value);
                                  if (!isNaN(newVal) && newVal !== val) {
                                    handleCorrelationChange(rowAsset.id, colAsset.id, newVal);
                                  }
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            />
                          )}
                       </td>
                     );
                  })}
                  <td className="px-2 py-1 text-center">
                    <button 
                      onClick={() => handleDeleteAsset(rowAsset.id)} 
                      className="text-red-400 hover:text-red-600"
                      title="Remove asset class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handleAddAsset}
            className="flex items-center text-sm font-medium text-fire-accent hover:text-blue-800"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Asset Class
          </button>
        </div>
      </div>

      {/* Tax Rates Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-fire-accent" />
          Tax Rates
        </h3>
        <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-200 text-xs">
             <thead>
               <tr className="bg-gray-50">
                 <th className="px-4 py-3 text-left font-medium text-gray-500">Entity</th>
                 <th className="px-4 py-3 text-left font-medium text-gray-500">Income</th>
                 <th className="px-4 py-3 text-left font-medium text-gray-500">Long Term Capital Gains</th>
                 <th className="px-4 py-3 text-left font-medium text-gray-500">Short Term Capital Gains</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
               {Object.entries(entityTypes).map(([key, data]) => (
                 <tr key={key}>
                   <td className="px-4 py-2 font-medium text-gray-900">{data.label}</td>
                   <td className="px-4 py-2">
                     <div className="relative w-32">
                       <input 
                         type="number" step="0.5" 
                         value={(data.incomeTax * 100).toFixed(2)}
                         onChange={(e) => {
                            const val = parseFloat(e.target.value)/100 || 0;
                            setEntityTypes(prev => ({
                                ...prev,
                                [key]: { ...prev[key], incomeTax: val }
                            }));
                         }}
                         className="w-full border border-gray-300 rounded px-2 py-1 pr-6"
                       />
                       <span className="absolute right-2 top-1 text-gray-400">%</span>
                     </div>
                   </td>
                   <td className="px-4 py-2">
                     <div className="relative w-32">
                       <input 
                         type="number" step="0.5" 
                         value={(data.ltCgt * 100).toFixed(2)}
                         onChange={(e) => {
                            const val = parseFloat(e.target.value)/100 || 0;
                            setEntityTypes(prev => ({
                                ...prev,
                                [key]: { ...prev[key], ltCgt: val }
                            }));
                         }}
                         className="w-full border border-gray-300 rounded px-2 py-1 pr-6"
                       />
                       <span className="absolute right-2 top-1 text-gray-400">%</span>
                     </div>
                   </td>
                   <td className="px-4 py-2">
                     <div className="relative w-32">
                       <input 
                         type="number" step="0.5" 
                         value={data.stCgt !== undefined ? (data.stCgt * 100).toFixed(2) : '0.00'}
                         onChange={(e) => {
                            const val = parseFloat(e.target.value)/100 || 0;
                            setEntityTypes(prev => ({
                                ...prev,
                                [key]: { ...prev[key], stCgt: val }
                            }));
                         }}
                         className="w-full border border-gray-300 rounded px-2 py-1 pr-6"
                       />
                       <span className="absolute right-2 top-1 text-gray-400">%</span>
                     </div>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );

  const ClientTab = () => (
    <div className="space-y-6 animate-in fade-in">
      {/* Client Details Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-fire-accent" />
          Client Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                <input 
                    type="text" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-fire-accent/50 outline-none"
                    placeholder="Enter client name"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input 
                    type="date" 
                    value={clientDate}
                    onChange={(e) => setClientDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-fire-accent/50 outline-none"
                />
            </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-fire-accent" />
          Client details
        </h3>
        
        <div className="space-y-4">
          {structures.map(struct => (
            <div key={struct.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              {/* Entity Header Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-3">
                     <label className="block text-xs font-bold text-gray-500 mb-1">Entity Name</label>
                     <input 
                       type="text" 
                       value={struct.name} 
                       onChange={(e) => setStructures(structures.map(s => s.id === struct.id ? {...s, name: e.target.value} : s))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                     />
                  </div>
                  <div className="md:col-span-3">
                     <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
                     <select 
                       value={struct.type} 
                       onChange={(e) => setStructures(structures.map(s => s.id === struct.id ? {...s, type: e.target.value} : s))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                     >
                       {Object.keys(entityTypes).map(k => (
                         <option key={k} value={k}>{entityTypes[k].label}</option>
                       ))}
                     </select>
                  </div>
                   <div className="md:col-span-3">
                     <label className="block text-xs font-bold text-gray-500 mb-1">Investable Amount</label>
                     <div className="relative w-full">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">$</span>
                       <input 
                         type="text" 
                         key={`${struct.id}-${struct.value}`}
                         defaultValue={(struct.value || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                         onBlur={(e) => {
                           const rawValue = e.target.value.replace(/[^0-9.-]/g, '');
                           const val = (rawValue === '' || rawValue === '-') ? 0 : parseFloat(rawValue);
                           if (!isNaN(val) && val !== struct.value) {
                             setStructures(structures.map(s => s.id === struct.id ? {...s, value: val} : s));
                           }
                         }}
                         onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                         className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold pl-7"
                       />
                     </div>
                   </div>
                  <div className="md:col-span-2">
                       <label className="block text-xs font-bold text-gray-500 mb-1">Tax Treatment</label>
                       <div className="flex items-center space-x-2">
                           {struct.useCustomTax ? (
                               <div className="flex gap-1">
                                   <div className="relative w-16">
                                       <input 
                                         type="number" className="w-full text-xs border rounded p-1 pr-3" placeholder="Inc"
                                         value={(struct.customTax?.incomeTax * 100) || 0}
                                         onChange={(e) => {
                                             const val = parseFloat(e.target.value)/100;
                                             setStructures(structures.map(s => s.id === struct.id ? {...s, customTax: { ...s.customTax, incomeTax: val }} : s));
                                         }}
                                       />
                                       <span className="absolute right-1 top-1 text-[10px] text-gray-400">%</span>
                                   </div>
                               </div>
                           ) : (
                               <div className="text-xs text-gray-500 py-2">
                                 {entityTypes[struct.type] ? formatPercent(entityTypes[struct.type].incomeTax) : '0%'} Tax
                               </div>
                           )}
                           <button 
                               onClick={() => setStructures(structures.map(s => s.id === struct.id ? {...s, useCustomTax: !s.useCustomTax} : s))}
                               className={`p-1 rounded ${struct.useCustomTax ? 'bg-fire-accent text-white' : 'bg-gray-200 text-gray-600'}`}
                               title="Toggle Custom Tax"
                           >
                               <Settings className="w-3 h-3" />
                           </button>
                       </div>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button 
                      onClick={() => {
                        if (structures.length > 1) {
                          setLastDeleted({ item: struct, index: structures.findIndex(s => s.id === struct.id) });
                          setStructures(structures.filter(s => s.id !== struct.id));
                          setTimeout(() => setLastDeleted(null), 5000); 
                        } else {
                          alert("You must have at least one entity.");
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
              </div>

              {/* Current Asset Allocation Toggle */}
              <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center mb-2">
                      <label className="flex items-center cursor-pointer">
                          <div className="relative">
                              <input type="checkbox" className="sr-only" 
                                checked={struct.useAssetAllocation}
                                onChange={() => setStructures(structures.map(s => s.id === struct.id ? {...s, useAssetAllocation: !s.useAssetAllocation} : s))}
                              />
                              <div className={`block w-10 h-6 rounded-full ${struct.useAssetAllocation ? 'bg-fire-accent' : 'bg-gray-300'}`}></div>
                              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${struct.useAssetAllocation ? 'transform translate-x-4' : ''}`}></div>
                          </div>
                          <div className="ml-3 text-sm font-medium text-gray-700">Current Asset Allocation</div>
                      </label>
                      <button 
                          onClick={() => {
                              const resetAlloc = struct.assetAllocation.map(a => ({
                                  ...a,
                                  weight: a.id === 'cash' ? 100 : 0
                              }));
                              setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: resetAlloc} : s));
                          }}
                          className="ml-auto text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-300"
                          title="Set Cash to 100%, others to 0%"
                      >
                          Reset to Cash
                      </button>
                  </div>

                  {struct.useAssetAllocation && (
                      <div className="mt-2 bg-white rounded border border-gray-200 overflow-hidden">
                          <table className="min-w-full text-xs">
                              <thead className="bg-gray-50">
                                  <tr>
                                      <th className="px-3 py-2 text-left">Asset Class</th>
                                      <th className="px-3 py-2 text-center">Allocation (%)</th>
                                      <th className="px-3 py-2 text-center">Expected Return (%)</th>
                                      {/* Risk Removed v1.244 */}
                                      <th className="px-3 py-2 text-center">Tolerance (Min %)</th>
                                      <th className="px-3 py-2 text-center">Tolerance (Max %)</th>
                                      <th className="px-3 py-2 text-center">Group Constraint</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {(() => {
                                    const allocations = struct.assetAllocation || DEFAULT_ASSETS.map(a => ({ id: a.id, weight: a.id === 'cash' ? 100 : 0, min: 0, max: 100 }));
                                    const totalWeight = allocations.reduce((sum, alloc) => sum + (alloc.weight || 0), 0);
                                    const totalExpectedReturn = allocations.reduce((sum, alloc) => {
                                      const assetDef = assets.find(a => a.id === alloc.id);
                                      return sum + (alloc.weight || 0) / 100 * (assetDef?.return || 0) * 100;
                                    }, 0);
                                    const totalExpectedRisk = allocations.reduce((sum, alloc) => {
                                      const assetDef = assets.find(a => a.id === alloc.id);
                                      return sum + (alloc.weight || 0) / 100 * (assetDef?.stdev || 0) * 100;
                                    }, 0);
                                    
                                    return (
                                      <>
                                        {allocations.map(alloc => {
                                          const assetDef = assets.find(a => a.id === alloc.id);
                                          if(!assetDef) return null;
                                          
                                          // v1.231 FIX: Show the ENTITY SPECIFIC NET RATE (not weighted contribution)
                                          // This allows user to see the "Real" return for this structure (e.g. Trust = 6.28%)
                                          const entRates = entityTypes[struct.type] || { incomeTax: 0, ltCgt: 0 };
                                          const incRatio = assetDef.incomeRatio !== undefined ? assetDef.incomeRatio : 1.0;
                                          
                                          // Use exact same rounding logic as Optimizer to ensure 1:1 match
                                          const incomeComponent = round6(incRatio * (1 - entRates.incomeTax));
                                          const growthComponent = round6((1 - incRatio) * (1 - entRates.ltCgt));
                                          const netReturn = round6(assetDef.return * (incomeComponent + growthComponent));
                                          
                                          // Approx Net Risk (Ratio based)
                                          const retention = assetDef.return > 0.0001 ? (netReturn / assetDef.return) : 1.0;
                                          const netRisk = round6((assetDef.stdev || 0) * retention);

                                          return (
                                              <tr key={alloc.id}>
                                                  <td className="px-3 py-1 font-medium text-black">{assetDef.name}</td>
                                                  <td className="px-3 py-1 text-center">
                                                      <input type="text" className="w-16 border rounded text-center text-black" 
                                                          key={`alloc-${alloc.id}-${alloc.weight}`}
                                                          defaultValue={alloc.weight}
                                                          onBlur={(e) => {
                                                              const val = parseFloat(e.target.value) || 0;
                                                              if (val !== alloc.weight) {
                                                                const newAlloc = allocations.map(x => x.id === alloc.id ? {...x, weight: val} : x);
                                                                setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: newAlloc} : s));
                                                              }
                                                          }}
                                                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                      />
                                                  </td>
                                                  <td className="px-3 py-1 text-center text-black">{(netReturn * 100).toFixed(6)}</td>
                                                  {/* Duplicate return column removed v1.244 */}
                                                  {/* Duplicate return column removed v1.244 */}
                                                  {/* Risk Removed v1.244 */}
                                                  <td className="px-3 py-1 text-center">
                                                      <input type="text" className="w-16 border rounded text-center text-black" 
                                                          key={`min-${alloc.id}-${alloc.min}`}
                                                          defaultValue={alloc.min}
                                                          onBlur={(e) => {
                                                              const val = parseFloat(e.target.value) || 0;
                                                              if (val !== alloc.min) {
                                                                const newAlloc = allocations.map(x => x.id === alloc.id ? {...x, min: val} : x);
                                                                setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: newAlloc} : s));
                                                              }
                                                          }}
                                                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                      />
                                                  </td>
                                                  <td className="px-3 py-1 text-center">
                                                      <input type="text" className="w-16 border rounded text-center text-black" 
                                                          key={`max-${alloc.id}-${alloc.max}`}
                                                          defaultValue={alloc.max}
                                                          onBlur={(e) => {
                                                              const val = parseFloat(e.target.value) || 0;
                                                              if (val !== alloc.max) {
                                                                const newAlloc = allocations.map(x => x.id === alloc.id ? {...x, max: val} : x);
                                                                setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: newAlloc} : s));
                                                              }
                                                          }}
                                                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                      />
                                                  </td>
                                                  <td className="px-3 py-1 text-center">
                                                      <input type="text" className="w-16 border rounded text-center text-black" 
                                                          key={`group-${alloc.id}-${alloc.groupLimit}`}
                                                          defaultValue={alloc.groupLimit || ''}
                                                          placeholder="-"
                                                          onBlur={(e) => {
                                                              const val = e.target.value;
                                                              if (val !== alloc.groupLimit) {
                                                                const newAlloc = allocations.map(x => x.id === alloc.id ? {...x, groupLimit: val} : x);
                                                                setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: newAlloc} : s));
                                                              }
                                                          }}
                                                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                      />
                                                  </td>
                                              </tr>
                                          );
                                        })}
                                          <tr className={`font-bold ${Math.abs(totalWeight - 100) > 0.01 ? 'bg-red-100 text-red-600' : 'bg-gray-100'}`}>
                                            <td className="px-3 py-2">Total</td>
                                            <td className={`px-3 py-2 text-center ${Math.abs(totalWeight - 100) > 0.01 ? 'text-red-600' : 'text-black'}`}>{totalWeight.toFixed(1)}%</td>
                                            {/* v1.244 Removed Total Returns/Risk */}
                                            <td className="px-3 py-2 text-center"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                          </tr>
                                      </>
                                    );
                                  })()}
                              </tbody>
                          </table>
                      </div>
                  )}
              </div>
            </div>
          ))}
          
          <div className="flex justify-between items-center pt-2">
            <button 
              onClick={() => {
                  const newStruct = { 
                      id: Date.now(), 
                      type: 'PERSONAL', 
                      name: 'New Entity', 
                      value: 0,
                      useAssetAllocation: false,
                      useCustomTax: false,
                      customTax: { incomeTax: 0.47, ltCgt: 0.235, stCgt: 0.47 },
                      assetAllocation: DEFAULT_ASSETS.map(a => ({ id: a.id, weight: a.id === 'cash' ? 100 : 0, min: 0, max: 100 }))
                  };
                  setStructures([...structures, newStruct]);
              }}
              className="flex items-center text-sm font-medium text-fire-accent hover:text-blue-800"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Entity
            </button>
            <div className="text-right">
              <span className="text-sm text-gray-500 block">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(totalWealth)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Projection Input Assumptions REMOVED (Moved to Projections Tab) */}

      {/* Cashflow Projections */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-fire-accent" />
            Cashflow Projections
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
             {/* Inflows */}
             <div>
               <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Inflows</h4>
               {incomeStreams.map((item) => (
                 <div key={item.id} className="flex flex-col gap-2 mb-3 bg-gray-50 p-2 rounded border border-gray-100">
                   <div className="flex gap-2 items-center text-sm w-full">
                       <input 
                         type="text" 
                         defaultValue={item.name} 
                         onBlur={(e) => setIncomeStreams(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                         className="flex-1 border rounded px-2 py-1 text-black" 
                         placeholder="Name" 
                       />
                       <div className="w-24">
                           <div className="relative w-full">
                             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">$</span>
                             <input 
                               type="text"
                               defaultValue={(item.amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                               onBlur={(e) => {
                                 const rawValue = e.target.value.replace(/[^0-9.-]/g, '');
                                 const val = (rawValue === '' || rawValue === '-') ? 0 : parseFloat(rawValue);
                                 if (!isNaN(val)) {
                                   setIncomeStreams(prev => prev.map(i => i.id === item.id ? { ...i, amount: val } : i));
                                 }
                               }}
                               onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                               className="w-full border rounded px-2 py-1 text-xs text-black pl-4"
                             />
                           </div>
                       </div>
                       <button 
                         onClick={() => setIncomeStreams(prev => prev.filter(i => i.id !== item.id))}
                         className="text-gray-400 hover:text-red-500"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                   </div>
                   <div className="flex flex-wrap items-center gap-2 text-xs">
                       <label className="flex items-center text-gray-600">
                           <input type="checkbox" className="mr-1" 
                             checked={item.isOneOff} 
                             onChange={() => setIncomeStreams(prev => prev.map(i => i.id === item.id ? { ...i, isOneOff: !i.isOneOff } : i))}
                           />
                           One-off
                       </label>
                       
                       {item.isOneOff ? (
                           <div className="flex items-center">
                               Year: <input type="number" className="w-12 border rounded ml-1 text-center text-black" 
                                 defaultValue={item.year || 1}
                                 onBlur={(e) => setIncomeStreams(prev => prev.map(i => i.id === item.id ? { ...i, year: parseInt(e.target.value) || 1 } : i))}
                               />
                           </div>
                       ) : (
                           <div className="flex items-center">
                               Yrs <input type="number" className="w-10 border rounded mx-1 text-center text-black" 
                                 defaultValue={item.startYear}
                                 onBlur={(e) => setIncomeStreams(prev => prev.map(i => i.id === item.id ? { ...i, startYear: parseInt(e.target.value) || 1 } : i))}
                               />
                               to <input type="number" className="w-10 border rounded mx-1 text-center text-black" 
                                 defaultValue={item.endYear}
                                 onBlur={(e) => setIncomeStreams(prev => prev.map(i => i.id === item.id ? { ...i, endYear: parseInt(e.target.value) || 30 } : i))}
                               />
                           </div>
                       )}

                       {/* Per-Item Entity Selector */}
                       <div className="flex items-center ml-auto gap-1">
                           <span className="text-gray-400">Owner:</span>
                           <select 
                              value={item.entityId || ''} 
                              onChange={(e) => setIncomeStreams(prev => prev.map(i => i.id === item.id ? { ...i, entityId: e.target.value } : i))}
                              className="border rounded px-1 py-0.5 text-xs text-black max-w-[100px]"
                           >
                              <option value="">Default (Personal)</option>
                              {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                       </div>
                   </div>
                 </div>
               ))}
               <button 
                 onClick={() => setIncomeStreams(prev => [...prev, { id: Date.now(), name: 'New Income', amount: 0, startYear: 1, endYear: 30, isOneOff: false }])}
                 className="flex items-center text-sm font-medium text-fire-accent hover:text-blue-800"
               >
                 <Plus className="w-4 h-4 mr-1" /> Add Inflow
               </button>
             </div>

             {/* Outflows */}
             <div>
               <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Outflows</h4>
               {expenseStreams.map((item) => (
                 <div key={item.id} className="flex flex-col gap-2 mb-3 bg-gray-50 p-2 rounded border border-gray-100">
                   <div className="flex gap-2 items-center text-sm w-full">
                       <input 
                         type="text" 
                         defaultValue={item.name} 
                         onBlur={(e) => setExpenseStreams(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                         className="flex-1 border rounded px-2 py-1 text-black" 
                         placeholder="Name" 
                       />
                       <div className="w-24">
                           <div className="relative w-full">
                             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">$</span>
                             <input 
                               type="text"
                               defaultValue={(item.amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                               onBlur={(e) => {
                                 const rawValue = e.target.value.replace(/[^0-9.-]/g, '');
                                 const val = (rawValue === '' || rawValue === '-') ? 0 : parseFloat(rawValue);
                                 if (!isNaN(val)) {
                                   setExpenseStreams(prev => prev.map(i => i.id === item.id ? { ...i, amount: val } : i));
                                 }
                               }}
                               onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                               className="w-full border rounded px-2 py-1 text-xs text-black pl-4"
                             />
                           </div>
                       </div>
                       <button 
                         onClick={() => setExpenseStreams(prev => prev.filter(i => i.id !== item.id))}
                         className="text-gray-400 hover:text-red-500"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                   </div>
                   <div className="flex flex-wrap items-center gap-2 text-xs">
                       <label className="flex items-center text-gray-600">
                           <input type="checkbox" className="mr-1" 
                             checked={item.isOneOff} 
                             onChange={() => setExpenseStreams(prev => prev.map(i => i.id === item.id ? { ...i, isOneOff: !i.isOneOff } : i))}
                           />
                           One-off
                       </label>
                       
                       {item.isOneOff ? (
                           <div className="flex items-center">
                               Year: <input type="number" className="w-12 border rounded ml-1 text-center text-black" 
                                 defaultValue={item.year || 1}
                                 onBlur={(e) => setExpenseStreams(prev => prev.map(i => i.id === item.id ? { ...i, year: parseInt(e.target.value) || 1 } : i))}
                               />
                           </div>
                       ) : (
                           <div className="flex items-center">
                               Yrs <input type="number" className="w-10 border rounded mx-1 text-center text-black" 
                                 defaultValue={item.startYear}
                                 onBlur={(e) => setExpenseStreams(prev => prev.map(i => i.id === item.id ? { ...i, startYear: parseInt(e.target.value) || 1 } : i))}
                               />
                               to <input type="number" className="w-10 border rounded mx-1 text-center text-black" 
                                 defaultValue={item.endYear}
                                 onBlur={(e) => setExpenseStreams(prev => prev.map(i => i.id === item.id ? { ...i, endYear: parseInt(e.target.value) || 30 } : i))}
                               />
                           </div>
                       )}

                       {/* Per-Item Entity Selector */}
                       <div className="flex items-center ml-auto gap-1">
                           <span className="text-gray-400">Owner:</span>
                           <select 
                              value={item.entityId || ''} 
                              onChange={(e) => setExpenseStreams(prev => prev.map(i => i.id === item.id ? { ...i, entityId: e.target.value } : i))}
                              className="border rounded px-1 py-0.5 text-xs text-black max-w-[100px]"
                           >
                              <option value="">Default (Personal)</option>
                              {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                       </div>
                   </div>
                 </div>
               ))}
               <button 
                 onClick={() => setExpenseStreams(prev => [...prev, { id: Date.now(), name: 'New Expense', amount: 0, startYear: 1, endYear: 30, isOneOff: false }])}
                 className="flex items-center text-sm font-medium text-fire-accent hover:text-blue-800"
               >
                 <Plus className="w-4 h-4 mr-1" /> Add Outflow
               </button>
             </div>
          </div>
      </div>
    </div>
  );

  const ProjectionsTab = () => {
    // Filter cash flows by selected entity if needed
    // Handle undefined entityId as 'all' effectively or just don't match? 
    // Actually, if I want default items to show up under 'all', I need to safeguard.
    // But if I want items with NO entityId to trigger default tax (Personal), maybe I should treat them as... 
    // Let's stick to strict match effectively, but handle legacy items.
    
    // Actually, simpler:
    const getFilteredStreams = (streams) => {
        if (selectedCashflowEntity === 'all') return streams;
        return streams.filter(item => {
             // If item has no entityId, assume it might depend on implementation. 
             // But let's assume strict filtering.
             return item.entityId == selectedCashflowEntity;
        });
    };

    const currentInflows = getFilteredStreams(incomeStreams);
    const currentOutflows = getFilteredStreams(expenseStreams);

    // Update handlers using ID lookup to avoid index issues with filtering
    const updateInflow = (id, field, value) => {
        setIncomeStreams(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const updateOutflow = (id, field, value) => {
        setExpenseStreams(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const deleteInflow = (id) => setIncomeStreams(prev => prev.filter(item => item.id !== id));
    const deleteOutflow = (id) => setExpenseStreams(prev => prev.filter(item => item.id !== id));



    return (
      <div className="space-y-6 animate-in fade-in">

        {/* Projection Parameters */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
             <Calculator className="w-5 h-5 mr-2 text-fire-accent" />
             Projection Parameters
           </h3>
           <div className="flex flex-wrap gap-8 items-end">
               <div>
                 <label className="block text-xs font-bold text-gray-500 mb-1">Timeframe (Years)</label>
                 <input 
                    type="number" 
                    value={projectionYears} 
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setProjectionYears(isNaN(val) ? 1 : val);
                    }}
                    className="w-32 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                 />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 mb-1">Inflation</label>
                 <div className="relative w-32">
                   <input 
                      type="number" step="0.1"
                      value={Math.round(inflationRate * 1000) / 10} 
                      onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setInflationRate(isNaN(val) ? 0 : val/100);
                      }}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 pr-6"
                   />
                   <span className="absolute right-2 top-1 text-xs text-gray-400">%</span>
                 </div>
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 mb-1">Fees</label>
                 <div className="relative w-32">
                   <input 
                      type="number" step="0.01"
                      value={Math.round(adviceFee * 10000) / 100} 
                      onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setAdviceFee(isNaN(val) ? 0 : val/100);
                      }}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 pr-6"
                   />
                   <span className="absolute right-2 top-1 text-xs text-gray-400">%</span>
                 </div>
               </div>
           </div>
        </div>

        {/* Cashflow Projections with Entity Selector */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-fire-accent" />
                Cashflow Projections
              </h3>
              
              {/* Entity Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Filter by Entity:</label>
                <select
                  value={selectedCashflowEntity}
                  onChange={(e) => setSelectedCashflowEntity(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-fire-accent focus:border-fire-accent"
                >
                  <option value="all">All Entities</option>
                  {structures.map(struct => (
                    <option key={struct.id} value={struct.id}>{struct.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
               {/* Inflows */}
               <div>
                 <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2 text-green-700">Inflows</h4>
                 {currentInflows.map((item) => (
                   <div key={item.id} className="flex flex-col gap-2 mb-3 bg-gray-50 p-2 rounded border border-gray-100">
                     <div className="flex gap-2 items-center text-sm w-full">
                         <input type="text" value={item.name} className="flex-1 border rounded px-2 py-1" placeholder="Name" 
                           onChange={(e) => updateInflow(item.id, 'name', e.target.value)}
                         />
                          <div className="w-24">
                              <div className="relative w-full">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">$</span>
                                <input 
                                  type="text"
                                  key={`${item.id}-${item.amount}`}
                                  defaultValue={(item.amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                  onBlur={(e) => {
                                    const rawValue = e.target.value.replace(/[^0-9.-]/g, '');
                                    const val = (rawValue === '' || rawValue === '-') ? 0 : parseFloat(rawValue);
                                    if (!isNaN(val) && val !== item.amount) {
                                      updateInflow(item.id, 'amount', val);
                                    }
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                  className="w-full border rounded px-2 py-1 text-xs pl-4"
                                />
                              </div>
                          </div>
                     </div>
                     <div className="flex flex-wrap items-center gap-2 text-xs">
                         <label className="flex items-center text-gray-600">
                             <input type="checkbox" className="mr-1" 
                               checked={item.isOneOff} 
                               onChange={() => updateInflow(item.id, 'isOneOff', !item.isOneOff)}
                             />
                             One-off
                         </label>
                         
                         {item.isOneOff ? (
                             <div className="flex items-center">
                                 Year: <input type="number" className="w-12 border rounded ml-1 text-center" value={item.year || 1} 
                                   onChange={(e) => updateInflow(item.id, 'year', parseInt(e.target.value))}
                                 />
                             </div>
                         ) : (
                             <div className="flex items-center">
                                 Yrs <input type="number" className="w-10 border rounded mx-1 text-center" value={item.startYear} 
                                   onChange={(e) => updateInflow(item.id, 'startYear', parseInt(e.target.value))}
                                 />
                                 to <input type="number" className="w-10 border rounded mx-1 text-center" value={item.endYear} 
                                   onChange={(e) => updateInflow(item.id, 'endYear', parseInt(e.target.value))}
                                 />
                             </div>
                         )}

                         {/* Per-Item Entity Selector */}
                         <div className="flex items-center ml-auto gap-1">
                             <span className="text-gray-400">Owner:</span>
                             <select 
                                value={item.entityId || ''} 
                                onChange={(e) => updateInflow(item.id, 'entityId', e.target.value)}
                                className="border rounded px-1 py-0.5 text-xs max-w-[100px]"
                             >
                                <option value="">Default (Personal)</option>
                                {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                         </div>

                         <button onClick={() => deleteInflow(item.id)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 className="w-3 h-3"/></button>
                     </div>
                   </div>
                 ))}
                 <button className="text-xs text-fire-accent flex items-center mt-2 font-medium" onClick={() => setIncomeStreams([...incomeStreams, { id: Date.now(), name: 'New Inflow', amount: 0, startYear: 1, endYear: 10, isOneOff: false, year: 1, entityId: selectedCashflowEntity === 'all' ? structures[0]?.id : selectedCashflowEntity }])}>
                   <Plus className="w-3 h-3 mr-1"/> Add Inflow
                 </button>
               </div>

               {/* Outflows */}
               <div>
                 <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2 text-red-700">Outflows</h4>
                 {currentOutflows.map((item) => (
                   <div key={item.id} className="flex flex-col gap-2 mb-3 bg-gray-50 p-2 rounded border border-gray-100">
                     <div className="flex gap-2 items-center text-sm w-full">
                         <input type="text" value={item.name} className="flex-1 border rounded px-2 py-1" placeholder="Name" 
                           onChange={(e) => updateOutflow(item.id, 'name', e.target.value)}
                         />
                          <div className="w-24">
                              <div className="relative w-full">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">$</span>
                                <input 
                                  type="text"
                                  key={`${item.id}-${item.amount}`}
                                  defaultValue={(item.amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                  onBlur={(e) => {
                                    const rawValue = e.target.value.replace(/[^0-9.-]/g, '');
                                    const val = (rawValue === '' || rawValue === '-') ? 0 : parseFloat(rawValue);
                                    if (!isNaN(val) && val !== item.amount) {
                                      updateOutflow(item.id, 'amount', val);
                                    }
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                  className="w-full border rounded px-2 py-1 text-xs text-red-600 pl-4"
                                />
                              </div>
                          </div>
                     </div>
                     <div className="flex flex-wrap items-center gap-2 text-xs">
                         <label className="flex items-center text-gray-600">
                             <input type="checkbox" className="mr-1" 
                               checked={item.isOneOff} 
                               onChange={() => updateOutflow(item.id, 'isOneOff', !item.isOneOff)}
                             />
                             One-off
                         </label>
                         
                         {item.isOneOff ? (
                             <div className="flex items-center">
                                 Year: <input type="number" className="w-12 border rounded ml-1 text-center" value={item.year || 1} 
                                   onChange={(e) => updateOutflow(item.id, 'year', parseInt(e.target.value))}
                                 />
                             </div>
                         ) : (
                             <div className="flex items-center">
                                 Yrs <input type="number" className="w-10 border rounded mx-1 text-center" value={item.startYear} 
                                   onChange={(e) => updateOutflow(item.id, 'startYear', parseInt(e.target.value))}
                                 />
                                 to <input type="number" className="w-10 border rounded mx-1 text-center" value={item.endYear} 
                                   onChange={(e) => updateOutflow(item.id, 'endYear', parseInt(e.target.value))}
                                 />
                             </div>
                         )}

                         {/* Per-Item Entity Selector */}
                         <div className="flex items-center ml-auto gap-1">
                             <span className="text-gray-400">Owner:</span>
                             <select 
                                value={item.entityId || ''} 
                                onChange={(e) => updateOutflow(item.id, 'entityId', e.target.value)}
                                className="border rounded px-1 py-0.5 text-xs max-w-[100px]"
                             >
                                <option value="">Default (Personal)</option>
                                {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                         </div>

                         <button onClick={() => deleteOutflow(item.id)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 className="w-3 h-3"/></button>
                     </div>
                   </div>
                 ))}
                 <button className="text-xs text-fire-accent flex items-center mt-2 font-medium" onClick={() => setExpenseStreams([...expenseStreams, { id: Date.now(), name: 'New Outflow', amount: 0, startYear: 1, endYear: 30, isOneOff: false, year: 1, entityId: selectedCashflowEntity === 'all' ? structures[0]?.id : selectedCashflowEntity }])}>
                   <Plus className="w-3 h-3 mr-1"/> Add Outflow
                 </button>
               </div>
            </div>
        </div>
    </div>
  );
  };


  const OptimizationTab = () => {
    // Pre-Tax mode is disabled for now to avoid hook issues
    const chartData = efficientFrontier;
    const simulationData = simulations;

    return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            {/* Removed heading and descriptive text */}
          </div>
          
           <div className="flex items-center gap-4">
             <div className="text-right">
                <label className="block text-xs font-bold text-gray-500 mb-1">Tax View</label>
                <div className="flex items-center h-[30px]">
                    <label className="text-xs text-gray-700 flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showPreTaxFrontier} 
                            onChange={(e) => setShowPreTaxFrontier(e.target.checked)}
                            className="mr-2"
                        />
                        <span>Pre-Tax</span>
                    </label>
                </div>
             </div>

             <div className="text-right">
               <label className="block text-xs font-bold text-gray-500 mb-1">Forecast Confidence</label>
               <select 
                  value={forecastConfidenceLevel}
                  onChange={(e) => setForecastConfidenceLevel(parseInt(e.target.value))}
                  className="w-32 text-right border border-gray-300 rounded px-2 py-1 text-sm bg-white"
               >
                   <option value={1}>Low (20 Sims)</option>
                   <option value={2}>Medium</option>
                   <option value={3}>High (100 Sims)</option>
               </select>
             </div>

             <div className="text-right">
               <label className="block text-xs font-bold text-gray-500 mb-1">Simulations</label>
               <NumberInput 
                 value={simulationCount} 
                 onChange={(val) => setSimulationCount(val || 50)}
                 className="w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm text-black"
                 placeholder="50"
                 prefix=""
               />
             </div>



        {/* Chart */}
        {isSimulating ? (
                <div className="w-48">
                  <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-fire-accent h-2.5 rounded-full transition-all duration-75 ease-linear" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleRunOptimization}
                    disabled={isSimulating}
                    className="flex items-center justify-center px-6 py-3 bg-fire-accent hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Cpu className="w-4 h-4 mr-2" /> Optimise
                  </button>
                  <button
                    onClick={() => setShowDebugModal(true)}
                    className="flex items-center justify-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors shadow-sm"
                    title="View Debug Logs"
                  >
                    <Activity className="w-4 h-4 mr-2" /> Debug
                  </button>
                </div>
              )}
          </div>
        </div>

        {efficientFrontier.length > 0 ? (
            <div className="h-[500px] w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  dataKey="risk" 
                  name="Risk" 
                  unit="" 
                  tickFormatter={(val) => formatPercent(val)}
                  label={{ value: 'Risk', position: 'bottom', offset: 0, fill: '#004876' }}
                  domain={['auto', 'auto']}
                  tick={{ fill: '#004876' }}
                  stroke="#004876"
                />
                <YAxis 
                  type="number" 
                  dataKey="return" 
                  name="Return" 
                  unit="" 
                  tickFormatter={(val) => formatPercent(val)}
                  label={{ value: 'Return', angle: -90, position: 'insideLeft', fill: '#004876' }}
                  domain={[0, 'auto']}
                  tick={{ fill: '#004876' }}
                  stroke="#004876"
                />
                {!isExporting && <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded text-xs z-50">
                          <p className="font-bold mb-1 text-black">{data.label || 'Simulation'}</p>
                          <p className="text-black">Return: <span className="font-mono text-black">{formatPercent(data.return)}</span></p>
                          <p className="text-black">Risk: <span className="font-mono text-black">{formatPercent(data.risk)}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />}
                {/* Simulation cloud */}
                <Scatter name="Portfolios" data={simulationData} fill="#cbd5e1" shape="circle" r={2} opacity={0.5} isAnimationActive={!isExporting} />
                
                <Scatter name="Models" data={chartData} fill="#2563eb" shape="diamond" r={8} isAnimationActive={!isExporting} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Activity className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No simulation data generated yet.</p>
            <p className="text-gray-400 text-sm">Click "Optimise" to start.</p>
          </div>
        )}

        {/* Michaud Portfolio Composition Map removed as requested */}
      </div>
    </div>
  );
  };

  const OutputTab = () => {
    if (efficientFrontier.length === 0) return <div className="p-8 text-center text-gray-500">Please run the optimization first.</div>;

    // Calculate blended allocation weights from all entity-specific optimizations
    // Each entity uses its own tax-optimized frontier when available
    const globalWeights = selectedPortfolio.weights;
    // v1.227 FIX: Use the Sanitized Weights directly for the Total Portfolio display
    // instead of re-calculating from raw entities. This ensures the table matches the sanitization.
    const blendedWeights = selectedPortfolio.weights; // Use the sanitized weights!

    /* 
    // OLD Logic: Re-calculated which bypassed sanitization
    const blendedWeights = optimizationAssets.map((asset, assetIdx) => {
      let totalWeightedAllocation = 0;
      structures.forEach(struct => {
         ...
      });
      return totalWeightedAllocation;
    }); 
    */

    const activeAssets = optimizationAssets.map((asset, idx) => ({
      ...asset,
      weight: blendedWeights[idx],
      value: blendedWeights[idx] * 100
    })); // Show all assets including 0% allocations 

    return (
      <div className="space-y-6 animate-in fade-in h-4/5">
        {/* Split View Layout: Data on Left, Charts on Right - items-stretch for equal height */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* LEFT COLUMN: Data & Selection */}
          <div className="space-y-6 flex flex-col h-full">
            {/* Portfolio Selection */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Portfolio</h3>
              
              <select
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-black focus:ring-2 focus:ring-fire-accent focus:border-fire-accent"
              >
                {efficientFrontier.map((p, i) => (
                  <option key={i+1} value={i+1}>
                    Portfolio {i+1}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="text-xs text-gray-500">Return (Net)</div>
                  {/* v1.242 FIX: Reverted to display Net Return (selectedPortfolio.return) for consistency with PDF */}
                  <div className="text-xl font-bold text-black">
                     {formatPercent(selectedPortfolio.return)}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="text-xs text-gray-500">Risk</div>
                  <div className="text-xl font-bold text-black">{formatPercent(selectedPortfolio.risk)}</div>
                </div>
              </div>
            </div>

            {/* Asset Allocation Table - Flex-1 to fill remaining height */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
              <h4 className="font-semibold text-gray-900 mb-4">Asset Allocation</h4>
              <div className="overflow-y-auto flex-1">
                <table className="min-w-full text-sm">
                   <thead>
                    <tr className="bg-gray-50 sticky top-0 text-[10px]">
                      <th className="px-3 py-1 text-left font-medium text-gray-500"></th>
                      <th className="px-3 py-1 text-right font-medium text-gray-500">Amount ($)</th>
                      <th className="px-3 py-1 text-right font-medium text-gray-500">%</th>
                    </tr>
                  </thead>
                   <tbody className="divide-y divide-gray-100">
                    {activeAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="px-3 py-1 font-medium text-black flex items-center whitespace-nowrap overflow-hidden text-ellipsis">
                          <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{backgroundColor:asset.color}}/>
                          {asset.name}
                        </td>
                        <td className="px-3 py-1 text-right text-black font-mono text-[11px]">{formatCurrency(asset.weight * totalWealth)}</td>
                        <td className="px-3 py-1 text-right text-black font-mono text-[11px]">{(asset.weight * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-3 py-1 text-left text-xs font-bold text-gray-900">Total</td>
                      <td className="px-3 py-1 text-right text-xs font-bold text-gray-900 font-mono">{formatCurrency(totalWealth)}</td>
                      <td className="px-3 py-1 text-right text-xs font-bold text-gray-900">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Charts */}
          <div className="flex flex-col h-full">
            {/* Pie Charts Row: Overall + Per Entity */}
            <div id="pie-chart-section" className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
              <h4 className="font-semibold text-gray-900 mb-4">Portfolio Asset Allocation</h4>
              
              <div className="flex flex-col items-center border-b border-gray-100 pb-4 mb-4">
                <h5 className="text-xs font-semibold text-gray-700 mb-1 text-center tracking-wider">Total Portfolio</h5>
                <div className="h-[250px] w-full max-w-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={activeAssets} 
                        cx="50%" cy="50%" 
                        outerRadius={85} 
                        paddingAngle={2} 
                        dataKey="value"
                        isAnimationActive={!isExporting}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          const radius = outerRadius + 12;
                          const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                          const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                          return percent > 0.03 ? (
                            <text x={x} y={y} fill="#4b5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={isExporting ? 14 : 9} fontWeight={isExporting ? "bold" : "normal"}>
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                          ) : null;
                        }}
                        labelLine={false}
                      >
                        {activeAssets.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      {!isExporting && <Tooltip formatter={(val) => `${val.toFixed(1)}%`} />}
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div id="entity-pies-section" className="flex flex-wrap justify-center gap-4">
                {/* Per-Entity Pie Charts */}
                {structures.map(struct => {
                  // Get entity-specific weights - try entityFrontiers first
                  const globalWeights = selectedPortfolio?.weights || activeAssets.map(a => a.weight);
                  const entityTypeFrontier = entityFrontiers[struct.type];
                  let entityWeights;
                  if (entityTypeFrontier && entityTypeFrontier[selectedPortfolioId - 1]) {
                    entityWeights = entityTypeFrontier[selectedPortfolioId - 1].weights;
                  } else {
                    entityWeights = getEntityConstrainedWeights(struct, globalWeights, optimizationAssets.length > 0 ? optimizationAssets : activeAssets);
                  }
                  
                  const entityAssets = activeAssets.map((asset) => {
                    const fullIdx = optimizationAssets.findIndex(a => a.id === asset.id);
                    const weight = fullIdx >= 0 ? (entityWeights[fullIdx] || 0) : 0;
                    return {
                      ...asset,
                      value: weight * 100
                    };
                  }).filter(a => a.value > 0.5);
                  
                  return (
                    <div key={struct.id} className="flex-shrink-0" style={{ width: `${Math.min(200, 100 / structures.length)}%`, minWidth: '130px', maxWidth: '180px' }}>
                      <h5 className="text-[10px] font-semibold text-gray-500 mb-1 text-center tracking-tight">{struct.name}</h5>
                      <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={entityAssets} 
                              cx="50%" cy="50%" 
                              outerRadius={50} 
                              paddingAngle={2} 
                              dataKey="value"
                              isAnimationActive={!isExporting}
                              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                const radius = outerRadius + 10;
                                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                                return percent > 0.05 ? (
                                  <text x={x} y={y} fill="#4b5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="9">
                                    {`${(percent * 100).toFixed(0)}%`}
                                  </text>
                                ) : null;
                              }}
                              labelLine={false}
                            >
                              {entityAssets.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            {!isExporting && <Tooltip formatter={(val) => `${val.toFixed(1)}%`} />}
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Shared Legend Below Pie Charts - Left Aligned */}
              <div className="mt-6 flex flex-wrap justify-start gap-4 border-t border-gray-100 pt-4">
                 {activeAssets.map(asset => (
                   <div key={asset.id} className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: asset.color }} />
                      <span className="text-xs text-gray-600">{asset.name}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>

        {/* Entity-Specific Allocations */}
        <div id="entity-allocation-details" className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Asset Allocation by Entity</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {structures.map(struct => {
                // Get entity-specific weights - try entityFrontiers first, fallback to constrained global
                const globalWeights = selectedPortfolio?.weights || activeAssets.map(a => a.weight);
                const entityTypeFrontier = entityFrontiers[struct.type];
                let entityWeights;
                if (entityTypeFrontier && entityTypeFrontier[selectedPortfolioId - 1]) {
                  // Use entity-specific optimized weights
                  entityWeights = entityTypeFrontier[selectedPortfolioId - 1].weights;
                } else {
                  // Fallback to constrained global weights
                  entityWeights = getEntityConstrainedWeights(struct, globalWeights, optimizationAssets.length > 0 ? optimizationAssets : activeAssets);
                }
                
                return (
               <div key={struct.id} className="border border-gray-200 rounded-lg p-3">
                 <div className="font-bold text-sm text-gray-800 mb-2 border-b pb-1">{struct.name}</div>
                 <div className="space-y-1">
                   <div className="grid grid-cols-12 text-[10px] font-bold text-gray-400 uppercase mb-1 border-b pb-1">
                     <div className="col-span-4"></div>
                     <div className="col-span-2 text-center">Current</div>
                     <div className="col-span-2 text-center">%</div>
                     <div className="col-span-2 text-center">Recommend</div>
                     <div className="col-span-2 text-center">%</div>
                   </div>
                    {activeAssets.map((asset) => {
                      // Find the correct index in the full optimizationAssets array by asset ID
                      const fullIdx = optimizationAssets.findIndex(a => a.id === asset.id);
                      // Recommended
                      const recWeight = fullIdx >= 0 ? (entityWeights[fullIdx] || 0) : 0;
                      const recVal = recWeight * struct.value;
                      const recPct = recWeight * 100;

                      // Current
                      let currWeight = 0;
                      if (struct.useAssetAllocation && struct.assetAllocation) {
                          const alloc = struct.assetAllocation.find(a => a.id === asset.id);
                          currWeight = alloc ? alloc.weight / 100 : 0;
                      } else {
                          if (asset.id === 'cash') currWeight = 1.0;
                      }
                      const currVal = currWeight * struct.value;
                      const currPct = currWeight * 100;

                     return (
                       <div key={asset.id} className="grid grid-cols-12 text-xs py-0.5 border-b border-gray-50 last:border-0 items-center">
                          <div className="col-span-4 text-gray-600 text-[8px] leading-tight" style={{wordBreak: 'break-word'}}>{asset.name}</div>
                         <div className="col-span-2 text-center font-mono text-gray-900 text-[10px]">{formatCurrency(currVal)}</div>
                         <div className="col-span-2 text-center font-mono text-gray-900 text-[10px]">{currPct.toFixed(1)}%</div>
                         <div className="col-span-2 text-center font-mono text-gray-900 text-[10px]">{formatCurrency(recVal)}</div>
                         <div className="col-span-2 text-center font-mono text-gray-900 text-[10px]">{recPct.toFixed(1)}%</div>
                       </div>
                     )
                   })}
                 </div>
                 <div className="mt-3 pt-2 border-t-2 border-gray-200 bg-gray-50 -mx-3 -mb-3 p-3 rounded-b-lg">
                    <div className="grid grid-cols-12 text-xs font-bold text-gray-900 uppercase">
                      <div className="col-span-4">Total</div>
                      <div className="col-span-2 text-center font-mono">{formatCurrency(struct.value)}</div>
                      <div className="col-span-2 text-center font-mono">100%</div>
                      <div className="col-span-2 text-center font-mono">{formatCurrency(struct.value)}</div>
                      <div className="col-span-2 text-center font-mono">100%</div>
                    </div>
                 </div>
               </div>
              )})}
          </div>
        </div>


      </div>
    );
  };

  const CashflowTab = () => {
    if (!selectedPortfolio || cfSimulationResults.length === 0) return <div className="p-8 text-center text-gray-500">Please select a portfolio in the Output tab first to run projections.</div>;

    // Collect active one-off events for chart callouts
    const oneOffEvents = [
        ...incomeStreams.filter(s => s.isOneOff),
        ...expenseStreams.filter(s => s.isOneOff)
    ].map(e => ({
        year: parseInt(e.year),
        label: e.name,
        amount: e.amount || 0,
        type: incomeStreams.includes(e) ? 'income' : 'expense'
    })).filter(e => !isNaN(e.year) && e.year > 0 && e.year <= projectionYears);

    // Calculate outcomes for display (with tax and inflation adjustments)
    const getAdjustedOutcomes = () => {
      if (!selectedPortfolio || cfSimulationResults.length === 0) return null;
      
      const years = [1, 3, 5, 10, 20];
      return years.map(yr => {
        const idx = yr;
        if (!cfSimulationResults[idx]) return null;
        const res = cfSimulationResults[idx];
        
        // Apply inflation adjustment if showing real values
        const inflationFactor = showNominal ? 1 : Math.pow(1 + inflationRate, -yr);
        
        // For before/after tax, we'd need to calculate differently
        // For now, the simulation already uses after-tax returns
        // Before tax would require running with pre-tax returns
        
        return {
          year: `${yr} Year`,
          p02: res.p02 * inflationFactor,
          p50: res.p50 * inflationFactor,
          p84: res.p84 * inflationFactor,
          range: [res.p02 * inflationFactor, res.p84 * inflationFactor]
        };
      }).filter(Boolean);
    };

    const adjustedOutcomes = getAdjustedOutcomes();

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
               <TrendingUp className="w-5 h-5 mr-2 text-fire-accent" />
               Wealth Projection
            </h3>
            
            <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
               {/* Portfolio Selector */}
               <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Portfolio:</span>
                  <select
                    value={selectedPortfolioId}
                    onChange={(e) => setSelectedPortfolioId(parseInt(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-fire-accent focus:border-fire-accent"
                  >
                    {efficientFrontier.map((p, i) => (
                      <option key={i+1} value={i+1}>Portfolio {i+1}</option>
                    ))}
                  </select>
               </div>

               {/* Tax Toggle */}
               <div className="flex items-center gap-2 border-l border-gray-300 pl-4 h-6">
                  <span className="text-xs font-medium text-gray-500">Display:</span>
                  <button
                     onClick={() => setShowBeforeTax(!showBeforeTax)}
                     className={`px-3 py-1 rounded text-xs font-medium transition-colors ${showBeforeTax ? 'bg-fire-accent text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                     {showBeforeTax ? 'Before Tax' : 'After Tax'}
                  </button>
               </div>

               {/* Nominal/Real Toggle */}
               <div className="flex items-center gap-2 border-l border-gray-300 pl-4 h-6">
                  <span className="text-xs font-medium text-gray-500">Values:</span>
                  <button
                     onClick={() => setShowNominal(!showNominal)}
                     className={`px-3 py-1 rounded text-xs font-medium transition-colors ${showNominal ? 'bg-fire-accent text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                     {showNominal ? 'Nominal' : 'Real'}
                  </button>
               </div>
            </div>
          </div>
          
          <div id="wealth-projection-chart" className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cfSimulationResults} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" label={{ value: 'Years', position: 'bottom', fill: '#004876' }} tick={{ fill: '#004876' }} stroke="#004876" />
                <YAxis tickFormatter={(val) => `$${(val/1000000).toFixed(1)}m`} tick={{ fill: '#004876' }} stroke="#004876" />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                {!isExporting && <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded text-sm z-50">
                          <p className="font-bold mb-2 text-black">{label}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-black">Upside:</span>
                              <span className="font-mono font-medium text-black">{formatCurrency(data.p84)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-black">Median:</span>
                              <span className="font-mono font-bold text-black">{formatCurrency(data.p50)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-black">Downside:</span>
                              <span className="font-mono font-medium text-black">{formatCurrency(data.p02)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />}
                
                <Area type="monotone" dataKey="p84" stroke="none" fill="url(#confidenceBand)" name="Upside" isAnimationActive={!isExporting} />
                <Area type="monotone" dataKey="p02" stroke="none" fill="#fff" name="Downside" isAnimationActive={!isExporting} /> 
                
                <Line type="monotone" dataKey="p50" stroke="#3B82F6" strokeWidth={3} dot={false} strokeDasharray="5 5" name="Median" isAnimationActive={!isExporting} />
                <Line type="monotone" dataKey="p84" stroke="#93C5FD" strokeWidth={1} dot={false} strokeDasharray="5 5" name="Upside" isAnimationActive={!isExporting} />
                <Line type="monotone" dataKey="p02" stroke="#93C5FD" strokeWidth={1} dot={false} strokeDasharray="5 5" name="Downside" isAnimationActive={!isExporting} />

                {/* One-Off Event Reference Lines - Rendered last to be on top */}
                {oneOffEvents.map((event, idx) => (
                    <ReferenceLine 
                        key={`${event.type}-${idx}`} 
                        x={event.year} 
                        stroke={event.type === 'income' ? '#22c55e' : '#ef4444'} 
                        strokeDasharray="3 3"
                        isFront={true}
                        label={<CustomEventLabel value={event.label} type={event.type} index={idx} amount={event.amount} />}
                    />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Outcomes - Estimated Outcomes only */}
        {selectedPortfolio && cfSimulationResults.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            {/* Estimating Outcomes Chart */}
            {/* Estimating Outcomes Chart */}
            <h4 className="font-semibold text-gray-900 mb-4">Estimating Outcomes ({projectionYears} Years)</h4>
            <div id="estimating-outcomes-chart" className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={adjustedOutcomes}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#004876' }} />
                  <YAxis tickFormatter={(val) => `$${(val/1000000).toFixed(1)}m`} tick={{ fill: '#004876' }} stroke="#004876" />
                  {!isExporting && <Tooltip 
                     cursor={{fill: 'transparent'}}
                     content={({ active, payload, label }) => {
                         if (active && payload && payload.length) {
                               const data = payload[0].payload;
                               return (
                                 <div className="bg-white p-3 border border-gray-200 shadow-xl rounded text-xs z-50">
                                   <p className="font-bold mb-2 text-black">{label}</p>
                                   <div className="space-y-1">
                                     <div className="flex justify-between gap-4">
                                       <span className="text-black">Upside:</span>
                                       <span className="font-mono font-bold text-black">{formatCurrency(data.p84)}</span>
                                     </div>
                                     <div className="flex justify-between gap-4">
                                       <span className="text-black">Median:</span>
                                       <span className="font-mono font-bold text-black">{formatCurrency(data.p50)}</span>
                                     </div>
                                     <div className="flex justify-between gap-4">
                                       <span className="text-black">Downside:</span>
                                       <span className="font-mono font-bold text-black">{formatCurrency(data.p02)}</span>
                                     </div>
                                   </div>
                                 </div>
                               );
                         }
                         return null;
                     }}
                  />}
                  <Bar dataKey="range" barSize={60} shape={<OutcomeCandlestick />} isAnimationActive={!isExporting} />
                  <Legend 
                     payload={[
                       { value: 'Upside', type: 'line', color: '#93C5FD' },
                       { value: 'Median', type: 'line', color: '#3B82F6' },
                       { value: 'Downside', type: 'line', color: '#1D4ED8' },
                     ]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-8 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Year</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Downside</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Median</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Upside</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {adjustedOutcomes.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.year}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900">{formatCurrency(item.p02)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900">{formatCurrency(item.p50)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900">{formatCurrency(item.p84)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans" style={{ fontFamily: 'var(--font-main)', color: '#004876' }}>
      <div className="max-w-7xl mx-auto">
        <div id="app-header" className="bg-fire-accent -mx-4 -mt-4 mb-8 md:-mx-8 md:-mt-8 p-6 shadow-md text-white">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
             <div className="flex items-center gap-4">
               <img src={fireLogo} alt="FIRE Wealth" className="h-12 w-auto object-contain" />
               <div className="hidden md:block border-l border-red-400 pl-4 ml-2">
                  <h1 className="text-4xl font-bold tracking-tight">{appSettings.title || "FIREBALL"}</h1>
                  {/* Banner Subtitle Removed */}
               </div>
             </div>
             <div className="text-right">
                <span className="bg-red-800 text-xs font-mono py-1 px-2 rounded text-red-100">v1.244</span>
             </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-8">
          <div></div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <input 
                type="text" 
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-48 focus:ring-2 focus:ring-fire-accent outline-none"
                placeholder="Scenario Name"
              />
            </div>

            <button 
              onClick={handleNewScenario}
              className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium text-gray-700"
              title="New Scenario"
            >
              <Plus className="w-4 h-4 mr-1"/> New
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowLoadMenu(!showLoadMenu)}
                className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
              >
                <FolderOpen className="w-4 h-4 mr-2"/> Load
                <ChevronDown className="w-3 h-3 ml-1"/>
              </button>
              
              {showLoadMenu && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100 text-xs font-semibold text-gray-500">Saved Scenarios</div>
                  {savedScenarios.length === 0 ? (
                     <div className="p-4 text-center text-sm text-gray-400">No saved scenarios</div>
                  ) : (
                    savedScenarios.map(s => (
                      <div 
                        key={s.id}
                        onClick={() => handleLoadScenario(s.id)}
                        className="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0 cursor-pointer group"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{s.name || 'Untitled'}</div>
                          <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</div>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteScenario(s.id, e)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          title="Delete Scenario"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={() => handleSaveScenario(true)}
              disabled={isSaving}
              className="flex items-center px-3 py-2 bg-fire-accent text-white border border-red-700 rounded hover:bg-red-700 text-sm font-medium disabled:opacity-50"
            >
               {isSaving ? <Loader className="w-4 h-4 mr-2 animate-spin"/> : <Cloud className="w-4 h-4 mr-2"/>}
               {isSaving ? 'Saving...' : 'Save As'}
            </button>
            {lastDeleted && (
                <div className="absolute top-16 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded shadow-lg flex items-center gap-3 animate-in slide-in-from-top-2">
                   <span className="text-sm">Deleted "{lastDeleted.item.name}"</span>
                   <button 
                     onClick={() => {
                        const newStructs = [...structures];
                        newStructs.splice(lastDeleted.index, 0, lastDeleted.item);
                        setStructures(newStructs);
                        setLastDeleted(null);
                     }}
                     className="text-fire-accent font-bold text-sm hover:underline"
                   >
                     Undo
                   </button>
                   <button onClick={() => setLastDeleted(null)} className="text-gray-500 hover:text-white ml-2">
                     <X className="w-3 h-3"/>
                   </button>
                </div>
            )}
            <button 
              onClick={handleExportPDF}
              className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
            >
               <FileText className="w-4 h-4 mr-2"/> Export PDF
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
              title="Export CSV"
            >
               <FileText className="w-4 h-4 mr-2"/> Export Excel
            </button>
             <button 
              onClick={() => setActiveTab('data')}
              className={`flex items-center px-3 py-2 border rounded text-sm font-medium shadow-sm transition-colors ${
                activeTab === 'data' 
                  ? 'bg-fire-accent text-white border-red-700' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Capital Market Estimates"
            >
               <Activity className="w-4 h-4"/>
            </button>

            <button 
              onClick={() => {
                  setSettingsDraft(appSettings); // Init draft with current settings
                  setIsSettingsOpen(true);
              }}
              className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium text-gray-700 shadow-sm"
              title="Settings"
            >
               <Settings className="w-4 h-4"/>
            </button>
          </div>
        </div>
        {Navigation()}
        <main id="report-content">
          {/* Settings Modal is Global */}
          <DebugLogsModal open={showDebugModal} onClose={() => setShowDebugModal(false)} logs={debugLogs} />
          <SettingsModal />
          
          {activeTab === 'data' && <div id="data-tab-content">{DataTab()}</div>}
          {activeTab === 'client' && <div id="client-tab-content">{ClientTab()}</div>}
          {activeTab === 'projections' && <div id="projections-tab-content">{ProjectionsTab()}</div>}
          {activeTab === 'optimization' && <div id="optimization-tab-content">
             {/* Pass isExporting to Optimization charts if we extracted them to components, 
                 but here they are inline. We need to update the inline charts. 
                 Since OptimizationTab is a function, we can't easily pass props unless we change it.
                 Let's assume we update the charts inside OptimizationTab to read isExporting from scope.
             */}
             {OptimizationTab()}
          </div>}
          {activeTab === 'output' && <div id="output-tab-content">{OutputTab()}</div>}
          {activeTab === 'cashflow' && <div id="cashflow-tab-content">
             {/* Same for CashflowTab */}
             {CashflowTab()}
          </div>}
        </main>
      </div>
      <footer className="mt-12 text-center text-gray-400 text-xs">
         <p>&copy; {new Date().getFullYear()} Fire Wealth Advisers Pty Ltd. All rights reserved.</p>
         <p className="mt-1">ABN {ABN} | AFSL {AFSL}</p>
      </footer>
    </div>
  );
}

const DebugLogsModal = ({ open, onClose, logs }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-fire-accent" />
            Optimization Debug Log
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-0 bg-gray-50">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No logs available. Run an optimization first.</div>
          ) : (
            <div className="p-4 space-y-4">
              {logs.map((log, idx) => {
                // Special handling for Entity Optimization logs to show "Tax Drag Proof" table
                if (log.step.startsWith('Entity Opt:') && Array.isArray(log.details)) {
                    return (
                        <div key={idx} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                          <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex justify-between items-center">
                            <span className="font-bold text-sm text-blue-900">{log.step} - Tax Drag Analysis</span>
                            <span className="text-xs text-blue-400 font-mono">Proof of Logic (Returns)</span>
                          </div>
                          <div className="p-0 overflow-x-auto">
                            <table className="min-w-full text-xs text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                    <tr>
                                        <th className="px-4 py-2">Asset</th>
                                        <th className="px-2 py-2 text-right">Pre-Tax Ret</th>
                                        <th className="px-2 py-2 text-center">Inc / Growth</th>
                                        <th className="px-2 py-2 text-center">Tax Rates</th>
                                        <th className="px-2 py-2 text-right font-bold text-gray-700">Net Return</th>
                                        <th className="px-2 py-2 text-center border-l text-gray-400">Risk Input</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {log.details.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 font-medium text-gray-700">{row.name}</td>
                                            <td className="px-2 py-2 text-right font-mono text-gray-500">{(row.preTax * 100).toFixed(2)}%</td>
                                            <td className="px-2 py-2 text-center text-gray-400">
                                                {(row.incomeRatio * 100).toFixed(0)} / {((1-row.incomeRatio)*100).toFixed(0)}
                                            </td>
                                            <td className="px-2 py-2 text-center text-gray-400">
                                                {(row.incTaxRate*100).toFixed(0)}% / {(row.cgtRate*100).toFixed(0)}%
                                            </td>
                                            <td className="px-2 py-2 text-right font-mono font-bold text-blue-700">
                                                {(row.postTax * 100).toFixed(4)}%
                                                <span className="block text-[9px] text-red-400 font-normal">
                                                    Drag: -{((row.preTax - row.postTax)*100).toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-center font-mono border-l text-gray-600">
                                                {(row.riskUsed * 100).toFixed(2)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                          </div>
                        </div>
                    );
                }

                // Handling for Entity Allocations (v1.238) - Full Matrix 10 Ports
                if (log.step.startsWith('Entity Allocations:') && log.details && log.details.assets && log.details.portfolios) {
                    const { assets, portfolios } = log.details;
                    
                    return (
                        <div key={idx} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                          <div className="bg-green-50 px-4 py-2 border-b border-green-100 flex justify-between items-center">
                            <span className="font-bold text-sm text-green-900">{log.step}</span>
                            <span className="text-xs text-green-600 font-mono">Full Allocation Matrix</span>
                          </div>
                          <div className="p-0 overflow-x-auto">
                             <table className="min-w-full text-[10px] text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                    <tr>
                                        <th className="px-2 py-1 sticky left-0 bg-gray-50 z-10">Asset Class</th>
                                        {portfolios.map(p => (
                                            <th key={p.id} className="px-1 py-1 text-center w-12 font-normal">
                                                P{p.id}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {assets.map((assetName, rowIdx) => (
                                        <tr key={rowIdx} className="hover:bg-gray-50">
                                            <td className="px-2 py-1 font-medium text-gray-700 sticky left-0 bg-white z-10 border-r">{assetName}</td>
                                            {portfolios.map(p => {
                                                const cw = p.weights[rowIdx];
                                                return (
                                                    <td key={p.id} className={`px-1 py-1 text-center font-mono ${cw > 0.001 ? 'text-black' : 'text-gray-200'}`}>
                                                        {(cw * 100).toFixed(1)}%
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold border-t border-gray-200">
                                    <tr>
                                        <td className="px-2 py-1 sticky left-0 bg-gray-100 z-10 border-r">Total</td>
                                        {portfolios.map(p => {
                                             const total = p.weights.reduce((a,b) => a+b, 0);
                                             return (
                                                 <td key={p.id} className="px-1 py-1 text-center font-mono">
                                                     {(total * 100).toFixed(0)}%
                                                 </td>
                                             );
                                        })}
                                    </tr>
                                </tfoot>
                             </table>
                          </div>
                        </div>
                    );
                }

                return (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-gray-700 uppercase">{log.step}</span>
                    <span className="text-xs text-gray-400 font-mono">{new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button 
            onClick={() => {
              const text = JSON.stringify(logs, null, 2);
              navigator.clipboard.writeText(text);
              alert("Logs copied to clipboard!");
            }}
            className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium text-gray-700 mr-2"
          >
            Copy JSON
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-fire-accent text-white rounded hover:bg-red-700 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};




