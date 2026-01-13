// Deployment trigger: 2026-01-07T17:14
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, PieChart, Pie, Cell, AreaChart, Area, ReferenceLine,
  BarChart, Bar, ComposedChart
} from 'recharts';
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

const DEFAULT_ASSETS = [
  { id: 'aus_eq', name: 'Australian Equities', return: 0.09, stdev: 0.16, incomeRatio: 0.4, minWeight: 0, maxWeight: 100, color: '#003f5c', active: true, isDefault: true },
  { id: 'us_large', name: 'US Large Cap Equities', return: 0.10, stdev: 0.15, incomeRatio: 0.2, minWeight: 0, maxWeight: 100, color: '#2f4b7c', active: true, isDefault: true },
  { id: 'us_small', name: 'US Small Cap Equities', return: 0.11, stdev: 0.20, incomeRatio: 0.1, minWeight: 0, maxWeight: 100, color: '#665191', active: true, isDefault: true },
  { id: 'dev_world', name: 'Developed World Equities', return: 0.095, stdev: 0.16, incomeRatio: 0.25, minWeight: 0, maxWeight: 100, color: '#a05195', active: true, isDefault: true },
  { id: 'em_eq', name: 'Emerging Markets Equities', return: 0.12, stdev: 0.22, incomeRatio: 0.2, minWeight: 0, maxWeight: 100, color: '#d45087', active: true, isDefault: true },
  { id: 'reits', name: 'Global REITs', return: 0.08, stdev: 0.14, incomeRatio: 0.6, minWeight: 0, maxWeight: 100, color: '#f95d6a', active: true, isDefault: true },
  { id: 'hedge', name: 'Hedge Fund', return: 0.07, stdev: 0.10, incomeRatio: 0.1, minWeight: 0, maxWeight: 100, color: '#ff7c43', active: true, isDefault: true },
  { id: 'comm', name: 'Commodities', return: 0.04, stdev: 0.18, incomeRatio: 0.0, minWeight: 0, maxWeight: 100, color: '#ffa600', active: true, isDefault: true },
  { id: 'aus_bond', name: 'Australian Bonds', return: 0.045, stdev: 0.05, incomeRatio: 1.0, minWeight: 0, maxWeight: 100, color: '#0088FE', active: true, isDefault: true },
  { id: 'gl_bond', name: 'Global Bonds', return: 0.04, stdev: 0.05, incomeRatio: 1.0, minWeight: 0, maxWeight: 100, color: '#00C49F', active: true, isDefault: true },
  { id: 'hy_bond', name: 'High Yield Bonds', return: 0.065, stdev: 0.10, incomeRatio: 1.0, minWeight: 0, maxWeight: 100, color: '#FFBB28', active: true, isDefault: true },
  { id: 'em_bond', name: 'Emerging Markets Bonds', return: 0.07, stdev: 0.12, incomeRatio: 1.0, minWeight: 0, maxWeight: 100, color: '#FF8042', active: true, isDefault: true },
  { id: 'cash', name: 'Cash', return: 0.03, stdev: 0.01, incomeRatio: 1.0, minWeight: 0, maxWeight: 100, color: '#8884d8', active: true, isDefault: true },
];

const INITIAL_CORRELATIONS_DATA = {
  // Symmetric Data (Upper Triangle + Diagonals + some Lower provided in image, mapping to full matrix)
  // We use a helper to construct the full map.
  // Format: "ROW_ID": { "COL_ID": value, ... }
  "aus_eq": { "us_large": 0.463, "us_small": 0.528, "dev_world": 0.582, "em_eq": 0.598, "reits": 0.560, "hedge": -0.162, "comm": 0.124, "aus_bond": 0.006, "gl_bond": 0.139, "hy_bond": 0.673, "em_bond": 0.073, "cash": -0.039 },
  "us_large": { "us_small": 0.791, "dev_world": 0.771, "em_eq": 0.507, "reits": 0.604, "hedge": 0.467, "comm": 0.100, "aus_bond": 0.107, "gl_bond": 0.000, "hy_bond": 0.287, "em_bond": 0.488, "cash": -0.067 },
  "us_small": { "dev_world": 0.664, "em_eq": 0.525, "reits": 0.607, "hedge": 0.344, "comm": 0.164, "aus_bond": 0.048, "gl_bond": -0.058, "hy_bond": 0.376, "em_bond": 0.350, "cash": -0.036 },
  "dev_world": { "em_eq": 0.619, "reits": 0.627, "hedge": 0.300, "comm": 0.140, "aus_bond": 0.069, "gl_bond": 0.002, "hy_bond": 0.430, "em_bond": 0.365, "cash": -0.059 },
  "em_eq": { "reits": 0.485, "hedge": 0.079, "comm": 0.082, "aus_bond": -0.028, "gl_bond": -0.016, "hy_bond": 0.598, "em_bond": 0.325, "cash": -0.027 },
  "reits": { "hedge": 0.206, "comm": 0.066, "aus_bond": 0.231, "gl_bond": 0.236, "hy_bond": 0.470, "em_bond": 0.412, "cash": 0.002 },
  "hedge": { "comm": 0.188, "aus_bond": 0.153, "gl_bond": -0.115, "hy_bond": -0.302, "em_bond": 0.646, "cash": 0.051 },
  "comm": { "aus_bond": -0.127, "gl_bond": -0.195, "hy_bond": 0.088, "em_bond": 0.038, "cash": 0.011 },
  "aus_bond": { "gl_bond": 0.707, "hy_bond": 0.079, "em_bond": 0.446, "cash": 0.230 },
  "gl_bond": { "hy_bond": 0.282, "em_bond": 0.244, "cash": 0.228 },
  "hy_bond": { "em_bond": 0.177, "cash": 0.025 },
  "em_bond": { "cash": 0.115 }
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
  COMPANY: { label: 'Company', incomeTax: 0.25, ltCgt: 0.25, stCgt: 0.25 },
  TRUST: { label: 'Family Trust', incomeTax: 0.30, ltCgt: 0.15, stCgt: 0.30 }, // Avg dist rate
  SUPER_ACCUM: { label: 'Superannuation (Accumulation Phase)', incomeTax: 0.15, ltCgt: 0.10, stCgt: 0.15 },
  PENSION: { label: 'Superannuation (Pensions Phase)', incomeTax: 0.00, ltCgt: 0.00, stCgt: 0.00 },
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
  const { p16, p50, p95 } = payload;
  
  // Recharts Bar passed us the box for the range (p16 to p95).
  // y is the top (p95), height is the distance to bottom (p16).
  // We can draw the box and the specific lines within it.
  
  // Using specific colors from request
  const color95 = "#fbbf24"; // Amber 400 (Top)
  const color50 = "#ea580c"; // Orange 600 (Median)
  const color16 = "#ce2029"; // Red 700 (Bottom)
  const boxFill = "#ffedd5"; // Orange 100

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
  
  const range = p95 - p16;
  if(range === 0) return null;
  
  const medianRatio = (p95 - p50) / range; // Distance from top
  const medianY = y + (height * medianRatio);

  return (
    <g>
      {/* Box */}
      <rect x={x} y={y} width={width} height={height} fill={boxFill} stroke="none" />
      
      {/* 95th Line (Top) */}
      <line x1={x} y1={y} x2={x+width} y2={y} stroke={color95} strokeWidth={3} />
      
      {/* Median Line */}
      <line x1={x} y1={medianY} x2={x+width} y2={medianY} stroke={color50} strokeWidth={3} />
      
      {/* 16th Line (Bottom) */}
      <line x1={x} y1={y+height} x2={x+width} y2={y+height} stroke={color16} strokeWidth={3} />
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
  
  const boxY = chartY + 10 + ((index || 0) % 3) * 25; // Increased stagger for 2 lines

  const boxHeight = 24; // Taller for 2 lines
  const textWidth = value.length * 6 + 30; 
  const boxWidth = Math.max(textWidth, 100);
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
        y={boxY + 10} 
        textAnchor="middle" 
        fill={color} 
        fontSize={8} 
        fontWeight="bold"
      >
        {value}
      </text>
      
      {/* Amount */}
      <text 
        x={xPos} 
        y={boxY + 20} 
        textAnchor="middle" 
        fill={color} 
        fontSize={9} 
        fontWeight="bold"
      >
        {formatAmount(amount)}
      </text>
    </g>
  );
};

export default function RiskReturnOptimiser() {
  const [activeTab, setActiveTab] = useState('data');
  
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
  
  // Cashflow Inputs
  const [incomeStreams, setIncomeStreams] = useState(DEFAULT_INCOME_STREAMS);
  const [expenseStreams, setExpenseStreams] = useState(DEFAULT_EXPENSE_STREAMS);
  const [projectionYears, setProjectionYears] = useState(30);
  const [inflationRate, setInflationRate] = useState(0.025);
  const [adviceFee, setAdviceFee] = useState(0.011); // 1.1% Default incl GST maybe? Let's say 1.1% or just 0.0. User implies they want to add it. Let's default 0.0 to be safe or 0.01. Let's do 0.8% + GST = ~0.88%. Let's default to 0.0 for now so it doesn't surprise, or 0.01. Let's stick to 0.008 (0.8%).
  
  // Simulation State
  const [simulations, setSimulations] = useState([]);
  const [efficientFrontier, setEfficientFrontier] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [simulationCount, setSimulationCount] = useState(1000); // Default number of simulations
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(5);

  // --- Settings State ---
  const DEFAULT_APP_SETTINGS = {
     title: "FIREBALL",
     logo: fireLogo,
     colors: {
         accent: '#E84E1B',
         heading: '#1C2E4A',
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
  
  // Cashflow Result State
  const [cfSimulationResults, setCfSimulationResults] = useState([]);
  
  // Projections Tab State
  const [selectedCashflowEntity, setSelectedCashflowEntity] = useState('all'); // 'all' or entity id
  const [showBeforeTax, setShowBeforeTax] = useState(false); // false = after tax, true = before tax
  const [showNominal, setShowNominal] = useState(true); // true = nominal, false = real (inflation-adjusted)
  
  // Supabase State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [scenarioName, setScenarioName] = useState('');
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
    const { data, error } = await supabase
      .from('scenarios')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });
    
    if (data) setSavedScenarios(data);
  };

  // --- Helpers ---
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;

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
      const { data: existingData } = await supabase
        .from('scenarios')
        .select('id')
        .eq('name', scenarioName)
        .single();

      let shouldSave = true;
      let isUpdate = false;

      if (existingData) {
        if (saveAsNew) {
             alert(`Scenario "${scenarioName}" already exists. Please choose a different name for "Save As".`);
             setIsSaving(false);
             return;
        }
        shouldSave = window.confirm(`Scenario "${scenarioName}" already exists. Do you want to overwrite it?`);
        isUpdate = true;
      }

      if (!shouldSave) {
        setIsSaving(false);
        return;
      }

      const payload = {
        name: scenarioName,
        assets,
        structures,
        income_streams: incomeStreams,
        expense_streams: expenseStreams,
        projection_years: projectionYears,
        inflation_rate: inflationRate,
        advice_fee: adviceFee,
        created_at: new Date().toISOString()
      };

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

      setLastSaved(new Date());
      fetchScenarios();
      alert('Scenario saved successfully!');
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert('Failed to save scenario. Please check console for details.');
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
      const modelName = MODEL_NAMES[selectedPortfolio.id] || "Custom";
      addText(`Selected Portfolio: ${selectedPortfolio.label} ${modelName}`, 12, 'bold', accentRgb, 'center'); y += 7;
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
      
      y += boxHeight + 10;

      // ==================== PAGE 1: PIE CHARTS ====================
      // Overall Pie Chart
      addText("Target Asset Allocation", 12, 'bold', headingRgb); y += 5;
      setActiveTab('output');
      await new Promise(r => setTimeout(r, 1500));

      const pieSize = 45; // Smaller to give room for labels on all sides
      const pieX = (pageWidth - pieSize) / 2;
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
            await pdf.svg(clone, { x: pieX, y: y, width: pieSize, height: pieSize });
          } catch (err) { console.error("SVG Pie Error", err); }
          finally { document.body.removeChild(tempDiv); }
        }
      }
      y += pieSize + 5;

      // Entity Pie Charts - capture from UI
      addText("Allocation by Entity", 10, 'bold', headingRgb); y += 5;
      
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

      // 1. Detailed Asset Allocation Table
      addText("Detailed Asset Allocation", 14, 'bold', headingRgb); y += 6;
      
      // Table Header
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pdfWidth, 7, 'F');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(50, 50, 50);
      pdf.text("Asset Class", margin + 2, y + 5);
      pdf.text("Weight", margin + pdfWidth * 0.6, y + 5);
      pdf.text("Value", margin + pdfWidth * 0.8, y + 5);
      y += 7;

      // Table Rows
      pdf.setFont('helvetica', 'normal');
      let totalValue = 0;
      activeOnly.forEach((asset, idx) => {
        const weight = selectedPortfolio.weights[activeOnly.findIndex(a => a.id === asset.id)] || 0;
        const value = weight * totalWealth;
        totalValue += value;
        
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, y, pdfWidth, 5, 'F');
        }
        
        pdf.setFillColor(asset.color);
        pdf.rect(margin + 2, y + 1, 2, 3, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.text(asset.name, margin + 6, y + 4);
        pdf.text(formatPercent(weight), margin + pdfWidth * 0.6, y + 4);
        pdf.text(formatCurrency(value), margin + pdfWidth * 0.8, y + 4);
        y += 5;
      });
      
      // Total Row
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y, pdfWidth, 6, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.text("Total", margin + 6, y + 4);
      pdf.text("100.0%", margin + pdfWidth * 0.6, y + 4);
      pdf.text(formatCurrency(totalWealth), margin + pdfWidth * 0.8, y + 4);
      y += 12;

      // 2. Model Portfolios Summary
      addText("Model Portfolios Summary", 14, 'bold', headingRgb); y += 6;
      
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pdfWidth, 7, 'F');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(50, 50, 50);
      pdf.text("Model", margin + 2, y + 5);
      pdf.text("Name", margin + 25, y + 5);
      pdf.text("Return", margin + pdfWidth * 0.65, y + 5);
      pdf.text("Risk", margin + pdfWidth * 0.85, y + 5);
      y += 7;

      pdf.setFont('helvetica', 'normal');
      efficientFrontier.forEach((port, idx) => {
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, y, pdfWidth, 5, 'F');
        }
        
        const isSelected = port.id === selectedPortfolio.id;
        if (isSelected) {
          pdf.setFillColor(255, 240, 220);
          pdf.rect(margin, y, pdfWidth, 5, 'F');
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.text(String(port.id || idx + 1), margin + 2, y + 4);
        pdf.text(MODEL_NAMES[port.id] || 'Custom', margin + 25, y + 4);
        pdf.text(formatPercent(port.return), margin + pdfWidth * 0.65, y + 4);
        pdf.text(formatPercent(port.risk), margin + pdfWidth * 0.85, y + 4);
        y += 5;
      });
      y += 10;

      // 3. Estimated Outcomes Table
      addText("Estimated Outcomes", 14, 'bold', headingRgb); y += 6;
      
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pdfWidth, 7, 'F');
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(50, 50, 50);
      pdf.text("Year", margin + 2, y + 5);
      pdf.text("Best (95th)", margin + pdfWidth * 0.3, y + 5);
      pdf.text("Median (50th)", margin + pdfWidth * 0.55, y + 5);
      pdf.text("Worst (16th)", margin + pdfWidth * 0.8, y + 5);
      y += 7;

      pdf.setFont('helvetica', 'normal');
      const outcomeYears = [1, 3, 5, 10, 20];
      outcomeYears.forEach((yr, idx) => {
        const res = cfSimulationResults[yr];
        if (!res) return;
        
        if (idx % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, y, pdfWidth, 5, 'F');
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${yr} Year`, margin + 2, y + 4);
        pdf.text(formatCurrency(res.p95), margin + pdfWidth * 0.3, y + 4);
        pdf.setFont('helvetica', 'bold');
        pdf.text(formatCurrency(res.p50), margin + pdfWidth * 0.55, y + 4);
        pdf.setFont('helvetica', 'normal');
        pdf.text(formatCurrency(res.p16), margin + pdfWidth * 0.8, y + 4);
        y += 5;
      });

      // ==================== PAGE 3: CHARTS ====================
      pdf.addPage();
      addPageBorder();
      y = margin;

      const chartH = 75;

      // 1. Efficient Frontier
      addText("Efficient Frontier Analysis", 14, 'bold', headingRgb); y += 8;
      setActiveTab('optimization');
      await new Promise(r => setTimeout(r, 1000));
      const frontierEl = document.getElementById('optimization-tab-content')?.querySelector('.h-\\[500px\\]');
      if (frontierEl) {
         const originalId = frontierEl.id;
         frontierEl.id = 'temp-frontier-chart';
         const img = await captureChart('temp-frontier-chart');
         frontierEl.id = originalId;
         if (img) {
            pdf.addImage(img, 'PNG', margin, y, pdfWidth, chartH, undefined, 'FAST');
            y += chartH + 10;
         }
      } else {
         y += chartH + 10;
      }

      // 2. Monte Carlo Wealth Projection
      setActiveTab('cashflow');
      await new Promise(r => setTimeout(r, 1500));
      addText("Wealth Projection", 14, 'bold', headingRgb); y += 8;
      const wealthImg = await captureChart('wealth-projection-chart');
      if (wealthImg) {
          pdf.addImage(wealthImg, 'PNG', margin, y, pdfWidth, chartH, undefined, 'FAST');
          y += chartH + 10;
      }
      
      // 3. Estimating Outcomes Chart
      addText("Estimated Outcomes", 14, 'bold', headingRgb); y += 8;
      const outcomesImg = await captureChart('estimating-outcomes-chart');
      if (outcomesImg) {
          pdf.addImage(outcomesImg, 'PNG', margin, y, pdfWidth, chartH, undefined, 'FAST');
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

  const handleLoadScenario = async (id) => {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setScenarioName(data.name || 'Untitled');
      if (data.assets) setAssets(data.assets);
      if (data.structures) setStructures(data.structures);
      if (data.income_streams) setIncomeStreams(data.income_streams);
      if (data.expense_streams) setExpenseStreams(data.expense_streams);
      // Legacy one_off_events are ignored or could be migrated here if needed
      if (data.projection_years) setProjectionYears(data.projection_years);
      if (data.inflation_rate) setInflationRate(data.inflation_rate);
      if (data.advice_fee !== undefined) setAdviceFee(data.advice_fee);
      
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
  const calculateEffectiveConstraints = (assetList, structuresList) => {
    const totalValue = structuresList.reduce((sum, s) => sum + (s.value || 0), 0);
    if (totalValue === 0) return assetList;

    // Get entities that have custom allocation enabled
    const customEntities = structuresList.filter(s => s.useAssetAllocation && s.assetAllocation);
    
    if (customEntities.length === 0) {
      // No custom allocation, use global constraints
      return assetList;
    }

    // Calculate the weight of custom entities
    const customTotalValue = customEntities.reduce((sum, s) => sum + (s.value || 0), 0);
    const customWeight = customTotalValue / totalValue;

    // Calculate weighted min/max for each asset
    return assetList.map(asset => {
      let weightedMin = 0;
      let weightedMax = 0;

      customEntities.forEach(entity => {
        const alloc = entity.assetAllocation.find(a => a.id === asset.id);
        if (alloc && entity.value) {
          const entityWeight = entity.value / customTotalValue;
          weightedMin += (alloc.min || 0) * entityWeight;
          weightedMax += (alloc.max !== undefined ? alloc.max : 100) * entityWeight;
        }
      });

      // If custom entities don't cover 100% of value, blend with global constraints
      if (customWeight < 1) {
        const remainingWeight = 1 - customWeight;
        const globalMin = asset.minWeight || 0;
        const globalMax = asset.maxWeight || 100;
        weightedMin = weightedMin * customWeight + globalMin * remainingWeight;
        weightedMax = weightedMax * customWeight + globalMax * remainingWeight;
      }

      return {
        ...asset,
        minWeight: Math.max(0, Math.round(weightedMin)),
        maxWeight: Math.min(100, Math.round(weightedMax))
      };
    });
  };

  const handleRunOptimization = () => {
    // Apply per-entity constraints to get effective global constraints
    const effectiveAssets = calculateEffectiveConstraints(assets, structures);
    
    // Validation
    const activeAssets = effectiveAssets.filter(a => a.active);
    if (activeAssets.length < 2) {
      alert("Please select at least 2 active assets to optimize.");
      return;
    }

    setIsSimulating(true);
    setProgress(0);
    setSimulations([]);

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

    const afterTaxReturns = calculateClientTaxAdjustedReturns(activeAssets, structures, entityTypes);
    
    // Simulation Configuration from User Input
    const TOTAL_SIMS = simulationCount;
    // Adaptive batch size: aim for ~50 updates total for smooth animation
    // e.g. 20,000 sims -> 400 batch size. Min 100 to avoid too much overhead.
    const BATCH_SIZE = Math.max(100, Math.floor(TOTAL_SIMS / 50));
    
    let completedSims = 0;
    let allResults = [];

    // Recursive Batch Runner
    const runBatch = () => {
      // Calculate how many to run in this batch (don't over-run total)
      const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_SIMS - completedSims);
      
      const batchResults = runSingleBatchSimulation(activeAssets, afterTaxReturns, activeCorrelations, currentBatchSize);
      allResults = [...allResults, ...batchResults];
      completedSims += currentBatchSize;
      
      // Update Progress
      // Percentage logic: 0 to 100
      const newProgress = Math.floor((completedSims / TOTAL_SIMS) * 100);
      setProgress(newProgress);

      if (completedSims < TOTAL_SIMS) {
        // Schedule next batch with small delay to allow UI paint
        setTimeout(runBatch, 20);
      } else {
        // Finished - call finishOptimization which will set progress to 100%
        setTimeout(() => finishOptimization(allResults, activeAssets), 100);
      }
    };

    // Start first batch
    setTimeout(runBatch, 100);
  };

  const finishOptimization = (sims, activeAssets) => {
    // 4. Find Efficient Frontier (Bins)
    sims.sort((a, b) => a.risk - b.risk);
    
    if (sims.length === 0) {
      setIsSimulating(false);
      return;
    }

    const minRisk = sims[0].risk;
    const maxRisk = sims[sims.length-1].risk;
    const step = (maxRisk - minRisk) / 9; // 10 steps

    const frontier = [];
    for(let i=0; i<10; i++) {
      const lower = minRisk + (i * step) - (step/2);
      const upper = minRisk + (i * step) + (step/2);
      const bin = sims.filter(p => p.risk >= lower && p.risk <= upper);
      
      if (bin.length > 0) {
        // Maximize Return in this risk bucket
        const best = bin.reduce((prev, curr) => prev.return > curr.return ? prev : curr);
        frontier.push({ ...best, id: i+1, label: `Model ${i+1}` });
      }
    }

    // Fallback if bins empty
    while(frontier.length < 10 && sims.length > 0) {
      frontier.push({ ...sims[Math.floor(Math.random()*sims.length)], id: frontier.length+1, label: `Model ${frontier.length+1}` });
    }

    setOptimizationAssets(activeAssets);
    setSimulations(sims);
    setEfficientFrontier(frontier.sort((a,b) => a.risk - b.risk).map((p,i) => ({...p, id: i+1, label: `Model ${i+1}`})));
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
        
        results[y].paths.push(balance);
      }
    }

    const finalData = results.map(r => ({
      year: r.year,
      p05: calculatePercentile(r.paths, 5), // Keep p05 for safety/legacy checks
      p16: calculatePercentile(r.paths, 16),
      p50: calculatePercentile(r.paths, 50),
      p95: calculatePercentile(r.paths, 95)
    }));

    setCfSimulationResults(finalData);
  }, [selectedPortfolio, totalWealth, incomeStreams, expenseStreams, projectionYears, inflationRate, adviceFee, structures, entityTypes, showBeforeTax, optimizationAssets, assets, correlations]);

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
        { id: 'client', label: 'Client details', icon: User },
        { id: 'projections', label: 'Projections Input', icon: TrendingUp },
        { id: 'optimization', label: 'Optimisation', icon: Calculator },
        { id: 'output', label: 'Output', icon: PieIcon },
        { id: 'cashflow', label: 'Projections Output', icon: FileText },
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
                                    value={settingsDraft.title}
                                    onChange={(e) => setSettingsDraft(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-fire-accent/50 outline-none transition-all"
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
                                        <span className="text-xs font-mono text-gray-500">{settingsDraft.colors.accent}</span>
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
                                        <span className="text-xs font-mono text-gray-500">{settingsDraft.colors.heading}</span>
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
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-12 text-center">Include</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Asset Class</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Expected Return %</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Expected SD %</th>
                {/* Removed Income Yield % column */}
                <th className="px-2 py-3 text-left font-medium text-gray-500 text-center">Proportion of return – gains (%)</th>
                <th className="px-2 py-3 text-left font-medium text-gray-500 text-center">Proportion of return – income (%)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map((asset) => (
                <tr key={asset.id} className={!asset.active ? 'opacity-50 bg-gray-50' : ''}>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => handleAssetToggle(asset.id)}
                      className={`p-1 rounded transition-colors ${asset.active ? 'text-fire-accent hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-200'}`}
                    >
                      {asset.active ? <CheckSquare className="w-4 h-4"/> : <Square className="w-4 h-4"/>}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center">
                      {/* Removed colored dot */}
                      {asset.isDefault ? (
                        asset.name
                      ) : (
                        <input 
                          type="text" 
                          value={asset.name}
                          onChange={(e) => setAssets(assets.map(a => a.id === asset.id ? {...a, name: e.target.value} : a))}
                          className="border border-gray-300 rounded px-2 py-1 w-full text-xs"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                      <input type="number" step="0.01" className="w-20 border rounded px-2 py-1 text-xs"
                        disabled={!asset.active}
                        value={(asset.return * 100).toFixed(2)}
                        onChange={(e) => {
                           const val = parseFloat(e.target.value);
                           setAssets(assets.map(a => a.id === asset.id ? {...a, return: isNaN(val) ? 0 : val/100} : a));
                        }}
                      />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" step="0.01" className="w-20 border rounded px-2 py-1 text-xs"
                      disabled={!asset.active}
                      value={(asset.stdev * 100).toFixed(2)}
                      onChange={(e) => {
                           const val = parseFloat(e.target.value);
                           setAssets(assets.map(a => a.id === asset.id ? {...a, stdev: isNaN(val) ? 0 : val/100} : a));
                      }}
                    />
                  </td>
                  {/* Removed Income Yield input */}
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="number" step="1" min="0" max="100"
                      value={Math.round((1 - asset.incomeRatio) * 100)} 
                      onChange={(e) => {
                         let val = parseFloat(e.target.value);
                         if (isNaN(val)) val = 0;
                         if (val > 100) val = 100;
                         if (val < 0) val = 0;
                         // Set incomeRatio (which is income portion) to 1 - gains portion
                         setAssets(assets.map(a => a.id === asset.id ? { ...a, incomeRatio: 1 - (val / 100) } : a));
                      }}
                      className="w-16 border border-gray-300 rounded px-1 py-1 text-xs text-center"
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="number" step="1" min="0" max="100"
                      value={Math.round(asset.incomeRatio * 100)} 
                      onChange={(e) => {
                         let val = parseFloat(e.target.value);
                         if (isNaN(val)) val = 0;
                         if (val > 100) val = 100;
                         if (val < 0) val = 0;
                         setAssets(assets.map(a => a.id === asset.id ? { ...a, incomeRatio: val / 100 } : a));
                      }}
                      className="w-16 border border-gray-300 rounded px-1 py-1 text-xs text-center"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!asset.isDefault && (
                      <button onClick={() => handleDeleteAsset(asset.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
              <Plus className="w-4 h-4 mr-2" /> Add Custom Asset Class
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
        {/* Removed descriptive text "Manage correlation factors..." */}
        
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map(rowAsset => (
                <tr key={rowAsset.id} className={!rowAsset.active ? 'opacity-50' : ''}>
                  <td className="px-2 py-2 font-medium text-gray-900 bg-gray-50 whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 w-24 overflow-hidden text-ellipsis" title={rowAsset.name}>
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
                              type="number"
                              step="0.000001"
                              min="-1"
                              max="1"
                              className="w-16 border border-gray-200 rounded px-1 py-1 text-center text-xs focus:ring-1 focus:ring-fire-accent focus:border-fire-accent"
                              value={val.toFixed(6)}
                              disabled={!rowAsset.active || !colAsset.active} 
                              onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleCorrelationChange(rowAsset.id, colAsset.id, isNaN(val) ? 0 : val);
                              }}
                            />
                          )}
                       </td>
                     );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
                className={`${className} ${prefix ? 'pl-7' : ''}`} // Add padding if prefix exists
                placeholder={placeholder}
            />
        </div>
    );
  };
    
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
                    <NumberInput 
                       value={struct.value}
                       onChange={(val) => setStructures(structures.map(s => s.id === struct.id ? {...s, value: val} : s))}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold"
                    />
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
                  </div>

                  {struct.useAssetAllocation && (
                      <div className="mt-2 bg-white rounded border border-gray-200 overflow-hidden">
                          <table className="min-w-full text-xs">
                              <thead className="bg-gray-50">
                                  <tr>
                                      <th className="px-3 py-2 text-left">Asset Class</th>
                                      <th className="px-3 py-2 text-center">Allocation (%)</th>
                                      <th className="px-3 py-2 text-center">Constraints (Min %)</th>
                                      <th className="px-3 py-2 text-center">Constraints (Max %)</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {(struct.assetAllocation || DEFAULT_ASSETS.map(a => ({ id: a.id, weight: 0, min: 0, max: 100 }))).map(alloc => {
                                      const assetDef = assets.find(a => a.id === alloc.id);
                                      if(!assetDef) return null;
                                      return (
                                          <tr key={alloc.id}>
                                              <td className="px-3 py-1 font-medium text-gray-700">{assetDef.name}</td>
                                              <td className="px-3 py-1 text-center">
                                                  <input type="number" className="w-16 border rounded text-center" 
                                                      value={alloc.weight}
                                                      onChange={(e) => {
                                                          const val = parseFloat(e.target.value) || 0;
                                                          const newAlloc = (struct.assetAllocation || DEFAULT_ASSETS.map(a => ({ id: a.id, weight: 0, min: 0, max: 100 }))).map(x => x.id === alloc.id ? {...x, weight: val} : x);
                                                          setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: newAlloc} : s));
                                                      }}
                                                  />
                                              </td>
                                              <td className="px-3 py-1 text-center">
                                                  <input type="number" className="w-16 border rounded text-center" 
                                                      value={alloc.min}
                                                      onChange={(e) => {
                                                          const val = parseFloat(e.target.value) || 0;
                                                          const newAlloc = (struct.assetAllocation || DEFAULT_ASSETS.map(a => ({ id: a.id, weight: 0, min: 0, max: 100 }))).map(x => x.id === alloc.id ? {...x, min: val} : x);
                                                          setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: newAlloc} : s));
                                                      }}
                                                  />
                                              </td>
                                              <td className="px-3 py-1 text-center">
                                                  <input type="number" className="w-16 border rounded text-center" 
                                                      value={alloc.max}
                                                      onChange={(e) => {
                                                          const val = parseFloat(e.target.value) || 0;
                                                          const newAlloc = (struct.assetAllocation || DEFAULT_ASSETS.map(a => ({ id: a.id, weight: 0, min: 0, max: 100 }))).map(x => x.id === alloc.id ? {...x, max: val} : x);
                                                          setStructures(structures.map(s => s.id === struct.id ? {...s, assetAllocation: newAlloc} : s));
                                                      }}
                                                  />
                                              </td>
                                          </tr>
                                      );
                                  })}
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
                      assetAllocation: DEFAULT_ASSETS.map(a => ({ id: a.id, weight: 0, min: 0, max: 100 }))
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
                             <NumberInput value={item.amount} onChange={(val) => updateInflow(item.id, 'amount', val)} className="w-full border rounded px-2 py-1" prefix="$" />
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
                             <NumberInput value={item.amount} onChange={(val) => updateOutflow(item.id, 'amount', val)} className="w-full border rounded px-2 py-1 text-red-600" prefix="$" />
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

  const OptimizationTab = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            {/* Removed heading and descriptive text */}
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right">
               <label className="block text-xs font-bold text-gray-500 mb-1">Simulations</label>
               <NumberInput 
                 value={simulationCount} 
                 onChange={(val) => setSimulationCount(val || 1000)}
                 className="w-32 text-right border border-gray-300 rounded px-2 py-1 text-sm"
                 placeholder="1000"
                 prefix=""
               />
             </div>

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
                <button
                  onClick={handleRunOptimization}
                  disabled={isSimulating}
                  className="flex items-center justify-center px-6 py-3 bg-fire-accent hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Cpu className="w-4 h-4 mr-2" /> Optimise
                </button>
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
                  label={{ value: 'Risk', position: 'bottom', offset: 0 }}
                  domain={['auto', 'auto']}
                />
                <YAxis 
                  type="number" 
                  dataKey="return" 
                  name="Return" 
                  unit="" 
                  tickFormatter={(val) => formatPercent(val)}
                  label={{ value: 'Return', angle: -90, position: 'insideLeft' }}
                  domain={[0, 'auto']}
                />
                {!isExporting && <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded text-xs z-50">
                          <p className="font-bold mb-1 text-gray-900">{data.label || 'Simulation'}</p>
                          <p className="text-gray-600">Return: <span className="font-mono text-green-600">{formatPercent(data.return)}</span></p>
                          <p className="text-gray-600">Risk: <span className="font-mono text-red-600">{formatPercent(data.risk)}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />}
                {/* Legend removed as requested */}
                <Scatter name="Portfolios" data={simulations} fill="#cbd5e1" shape="circle" r={2} opacity={0.5} isAnimationActive={!isExporting} />
                <Scatter name="Models" data={efficientFrontier} fill="#2563eb" shape="diamond" r={8} isAnimationActive={!isExporting} />
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
      </div>
    </div>
  );

  const OutputTab = () => {
    if (efficientFrontier.length === 0) return <div className="p-8 text-center text-gray-500">Please run the optimization first.</div>;

    const activeAssets = optimizationAssets.map((asset, idx) => ({
      ...asset,
      weight: selectedPortfolio.weights[idx],
      value: selectedPortfolio.weights[idx] * 100
    })).filter(a => a.weight > 0.005); 

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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-fire-accent focus:border-fire-accent"
              >
                {efficientFrontier.map((p, i) => (
                  <option key={i+1} value={i+1}>
                    Portfolio {i+1} - {MODEL_NAMES[i+1] || 'Custom'}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase">Return</div>
                  <div className="text-xl font-bold text-green-600">{formatPercent(selectedPortfolio.return)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase">Risk</div>
                  <div className="text-xl font-bold text-red-600">{formatPercent(selectedPortfolio.risk)}</div>
                </div>
              </div>
            </div>

            {/* Asset Allocation Table - Flex-1 to fill remaining height */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col">
              <h4 className="font-semibold text-gray-900 mb-4">Asset Allocation</h4>
              <div className="overflow-y-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 sticky top-0">
                      <th className="px-3 py-1 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                      <th className="px-3 py-1 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="px-3 py-1 font-medium flex items-center">
                          <div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor:asset.color}}/>
                          {asset.name}
                        </td>
                        <td className="px-3 py-1 text-right text-gray-900 font-mono">{formatPercent(asset.weight)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-3 py-1 text-left text-xs font-bold text-gray-900 uppercase">Total</td>
                      <td className="px-3 py-1 text-right text-xs font-bold text-gray-900 uppercase">100.0%</td>
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
                <h5 className="text-xs font-semibold text-gray-700 mb-1 text-center uppercase tracking-wider">Total Portfolio</h5>
                <div className="h-[200px] w-full max-w-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={activeAssets.map((a, i) => ({ ...a, value: selectedPortfolio.weights[optimizationAssets.findIndex(x=>x.id===a.id)] * 100 }))} 
                        cx="50%" cy="50%" 
                        outerRadius={70} 
                        paddingAngle={2} 
                        dataKey="value"
                        isAnimationActive={!isExporting}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          const radius = outerRadius + 12;
                          const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                          const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                          return percent > 0.03 ? (
                            <text x={x} y={y} fill="#4b5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="9">
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
                  const entityAssets = activeAssets.map(asset => ({
                    ...asset,
                    value: (asset.weight * struct.value / totalWealth) * 100
                  })).filter(a => a.value > 0.5);
                  
                  return (
                    <div key={struct.id} className="flex-shrink-0" style={{ width: `${Math.min(200, 100 / structures.length)}%`, minWidth: '130px', maxWidth: '180px' }}>
                      <h5 className="text-[10px] font-semibold text-gray-500 mb-1 text-center uppercase tracking-tight">{struct.name}</h5>
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Asset Allocation by Entity</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {structures.map(struct => (
               <div key={struct.id} className="border border-gray-200 rounded-lg p-3">
                 <div className="font-bold text-sm text-gray-800 mb-2 border-b pb-1">{struct.name}</div>
                 <div className="space-y-1">
                   {activeAssets.map((asset) => {
                     const structPercent = (asset.weight * struct.value / totalWealth) * 100;
                     if (structPercent < 0.1) return null; // Skip very small allocations
                     return (
                       <div key={asset.id} className="flex justify-between text-xs">
                         <span className="text-gray-500">{asset.name}</span>
                         <span className="font-mono text-gray-900">{structPercent.toFixed(1)}%</span>
                       </div>
                     )
                   })}
                 </div>
                 <div className="mt-3 pt-2 border-t-2 border-gray-200 flex justify-between items-center bg-gray-50 -mx-3 -mb-3 p-3 rounded-b-lg">
                    <span className="text-xs font-bold text-gray-900 uppercase">Total</span>
                    <span className="text-xs font-bold text-gray-900 uppercase font-mono">{((struct.value / totalWealth) * 100).toFixed(1)}%</span>
                 </div>
               </div>
             ))}
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
          p16: res.p16 * inflationFactor,
          p50: res.p50 * inflationFactor,
          p95: res.p95 * inflationFactor,
          range: [res.p16 * inflationFactor, res.p95 * inflationFactor]
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
                      <option key={i+1} value={i+1}>Portfolio {i+1} - {MODEL_NAMES[i+1] || 'Custom'}</option>
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
                    <stop offset="5%" stopColor="#E03A3E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#E03A3E" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" label={{ value: 'Years', position: 'bottom' }} />
                <YAxis tickFormatter={(val) => `$${(val/1000000).toFixed(1)}m`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                {!isExporting && <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded text-xs z-50">
                          <p className="font-bold mb-2 text-gray-900">Year {label}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Best Case (95th):</span>
                              <span className="font-mono font-medium text-red-400">{formatCurrency(data.p95)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Median (50th):</span>
                              <span className="font-mono font-bold text-fire-accent">{formatCurrency(data.p50)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-500">Worst Case (16th):</span>
                              <span className="font-mono font-medium text-red-400">{formatCurrency(data.p16)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />}
                
                <Area type="monotone" dataKey="p95" stroke="none" fill="url(#confidenceBand)" name="95th Percentile" isAnimationActive={!isExporting} />
                <Area type="monotone" dataKey="p16" stroke="none" fill="#fff" name="16th Percentile" isAnimationActive={!isExporting} /> 
                
                <Line type="monotone" dataKey="p50" stroke="#E03A3E" strokeWidth={3} dot={false} strokeDasharray="5 5" name="Median (50th)" isAnimationActive={!isExporting} />
                <Line type="monotone" dataKey="p95" stroke="#fca5a5" strokeWidth={1} dot={false} strokeDasharray="5 5" name="Best Case (95th)" isAnimationActive={!isExporting} />
                <Line type="monotone" dataKey="p16" stroke="#fca5a5" strokeWidth={1} dot={false} strokeDasharray="5 5" name="Worst Case (16th)" isAnimationActive={!isExporting} />

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
            <h4 className="font-semibold text-gray-900 mb-4">Estimating Outcomes</h4>
            <div id="estimating-outcomes-chart" className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={adjustedOutcomes}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(val) => `$${(val/1000000).toFixed(1)}m`} />
                  {!isExporting && <Tooltip 
                     cursor={{fill: 'transparent'}}
                     content={({ active, payload, label }) => {
                         if (active && payload && payload.length) {
                               const data = payload[0].payload;
                               return (
                                 <div className="bg-white p-3 border border-gray-200 shadow-xl rounded text-xs z-50">
                                   <p className="font-bold mb-2 text-gray-900">{label}</p>
                                   <div className="space-y-1">
                                     <div className="flex justify-between gap-4">
                                       <span className="text-gray-500">95th Percentile:</span>
                                       <span className="font-mono font-bold text-amber-400">{formatCurrency(data.p95)}</span>
                                     </div>
                                     <div className="flex justify-between gap-4">
                                       <span className="text-gray-500">Median (50th):</span>
                                       <span className="font-mono font-bold text-orange-600">{formatCurrency(data.p50)}</span>
                                     </div>
                                     <div className="flex justify-between gap-4">
                                       <span className="text-gray-500">16th Percentile:</span>
                                       <span className="font-mono font-bold text-red-700">{formatCurrency(data.p16)}</span>
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
                       { value: '95th Percentile (Best)', type: 'line', color: '#fbbf24' },
                       { value: 'Median (50th)', type: 'line', color: '#ea580c' },
                       { value: '16th Percentile (Worst)', type: 'line', color: '#ce2029' },
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
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Best (95th)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Median (50th)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Worst (16th)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {adjustedOutcomes.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.year}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900">{formatCurrency(item.p95)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900">{formatCurrency(item.p50)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900">{formatCurrency(item.p16)}</td>
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
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-slate-800" style={{ fontFamily: 'var(--font-main)' }}>
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
                <span className="bg-red-800 text-xs font-mono py-1 px-2 rounded text-red-100">v1.2</span>
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
