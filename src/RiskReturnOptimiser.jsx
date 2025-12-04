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
  FolderOpen, ChevronDown
} from 'lucide-react';
import { supabase } from './supabase';

// --- Constants & Defaults ---

const DEFAULT_ASSETS = [
  { id: 'aus_eq', name: 'Australian Equities', return: 0.09, stdev: 0.16, incomeRatio: 0.4, min: 0, max: 1, color: '#003f5c', active: true, isDefault: true },
  { id: 'us_large', name: 'US Large Cap', return: 0.10, stdev: 0.15, incomeRatio: 0.2, min: 0, max: 1, color: '#2f4b7c', active: true, isDefault: true },
  { id: 'us_small', name: 'US Small Cap', return: 0.11, stdev: 0.20, incomeRatio: 0.1, min: 0, max: 1, color: '#665191', active: true, isDefault: true },
  { id: 'dev_world', name: 'Developed World', return: 0.095, stdev: 0.16, incomeRatio: 0.25, min: 0, max: 1, color: '#a05195', active: true, isDefault: true },
  { id: 'em_eq', name: 'Emerging Markets', return: 0.12, stdev: 0.22, incomeRatio: 0.2, min: 0, max: 1, color: '#d45087', active: true, isDefault: true },
  { id: 'reits', name: 'Global REITs', return: 0.08, stdev: 0.14, incomeRatio: 0.6, min: 0, max: 0.15, color: '#f95d6a', active: true, isDefault: true },
  { id: 'hedge', name: 'Hedge Fund', return: 0.07, stdev: 0.10, incomeRatio: 0.1, min: 0, max: 0.15, color: '#ff7c43', active: true, isDefault: true },
  { id: 'comm', name: 'Commodities', return: 0.04, stdev: 0.18, incomeRatio: 0.0, min: 0, max: 0.15, color: '#ffa600', active: true, isDefault: true },
  { id: 'aus_bond', name: 'Australian Bonds', return: 0.045, stdev: 0.05, incomeRatio: 1.0, min: 0, max: 1, color: '#0088FE', active: true, isDefault: true },
  { id: 'gl_bond', name: 'Global Bonds', return: 0.04, stdev: 0.05, incomeRatio: 1.0, min: 0, max: 1, color: '#00C49F', active: true, isDefault: true },
  { id: 'hy_bond', name: 'High Yield Bonds', return: 0.065, stdev: 0.10, incomeRatio: 1.0, min: 0, max: 1, color: '#FFBB28', active: true, isDefault: true },
  { id: 'em_bond', name: 'EM Bonds', return: 0.07, stdev: 0.12, incomeRatio: 1.0, min: 0, max: 1, color: '#FF8042', active: true, isDefault: true },
  { id: 'cash', name: 'Cash', return: 0.03, stdev: 0.01, incomeRatio: 1.0, min: 0, max: 1, color: '#8884d8', active: true, isDefault: true },
];

const generateDefaultCorrelations = () => {
  const size = DEFAULT_ASSETS.length;
  const matrix = Array(size).fill(0).map(() => Array(size).fill(0));
  for(let i=0; i<size; i++) {
    for(let j=0; j<size; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        const iEq = i < 5; 
        const jEq = j < 5;
        const iBond = i >= 8 && i <= 11;
        const jBond = j >= 8 && j <= 11;
        
        if (iEq && jEq) matrix[i][j] = 0.7; 
        else if (iBond && jBond) matrix[i][j] = 0.6; 
        else if (iEq && jBond) matrix[i][j] = 0.1; 
        else if (DEFAULT_ASSETS[i].id === 'cash' || DEFAULT_ASSETS[j].id === 'cash') matrix[i][j] = 0.0;
        else matrix[i][j] = 0.3; 
      }
    }
  }
  return matrix;
};

const DEFAULT_CORRELATIONS = generateDefaultCorrelations();

const ENTITY_TYPES = {
  PERSONAL: { label: 'Personal (Top Rate)', incomeTax: 0.47, stCgt: 0.47, ltCgt: 0.235 },
  TRUST: { label: 'Family Trust', incomeTax: 0.30, stCgt: 0.30, ltCgt: 0.15 }, 
  COMPANY: { label: 'Company', incomeTax: 0.30, stCgt: 0.30, ltCgt: 0.30 },
  SUPER_ACCUM: { label: 'Super (Accumulation)', incomeTax: 0.15, stCgt: 0.15, ltCgt: 0.10 },
  SUPER_PENSION: { label: 'Super (Pension)', incomeTax: 0.00, stCgt: 0.00, ltCgt: 0.00 },
  // Additional entities can be added here
};

const DEFAULT_STRUCTURES = [
  { id: 1, type: 'PERSONAL', name: 'Personal Name', value: 980000 },
  { id: 2, type: 'TRUST', name: 'Family Trust', value: 5000000 },
  { id: 3, type: 'SUPER_ACCUM', name: 'Super Fund (Accum)', value: 4000000 },
];

const DEFAULT_INCOME_STREAMS = [
  { id: 1, name: 'Husband Salary', amount: 350000, startYear: 1, endYear: 5 },
  { id: 2, name: 'Wife Salary', amount: 150000, startYear: 1, endYear: 5 },
];

const DEFAULT_EXPENSE_STREAMS = [
  { id: 1, name: 'Living Expenses', amount: 200000, startYear: 1, endYear: 30 },
];

const DEFAULT_ONE_OFF_EVENTS = [
  { id: 1, name: 'Gift to Children', amount: -1500000, year: 5 },
  { id: 2, name: 'Downsize Home', amount: 2000000, year: 15 },
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

const calculateClientTaxAdjustedReturns = (assets, structures) => {
  const totalValue = structures.reduce((sum, s) => sum + s.value, 0);
  if (totalValue === 0) return assets.map(a => a.return);
  
  return assets.map(asset => {
    let weightedReturn = 0;

    structures.forEach(struct => {
      const entityProp = struct.value / totalValue;
      const rates = ENTITY_TYPES[struct.type] || ENTITY_TYPES.PERSONAL;
      
      // Safety checks for NaN
      const ret = isNaN(asset.return) ? 0 : asset.return;
      const incRatio = isNaN(asset.incomeRatio) ? 0 : asset.incomeRatio;

      const incomeComponent = ret * incRatio;
      const capitalComponent = ret * (1 - incRatio);
      
      const afterTaxIncome = incomeComponent * (1 - rates.incomeTax);
      const afterTaxCapital = capitalComponent * (1 - rates.ltCgt);
      
      const entityAfterTaxReturn = afterTaxIncome + afterTaxCapital;
      
      weightedReturn += entityProp * entityAfterTaxReturn;
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

const randn_bm = () => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
};

// Batch Runner logic handled inside handler to access closure state properly

// --- Main Application ---

export default function RiskReturnOptimiser() {
  const [activeTab, setActiveTab] = useState('data');
  
  // Data State
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [structures, setStructures] = useState(DEFAULT_STRUCTURES);
  
  // Cashflow Inputs
  const [incomeStreams, setIncomeStreams] = useState(DEFAULT_INCOME_STREAMS);
  const [expenseStreams, setExpenseStreams] = useState(DEFAULT_EXPENSE_STREAMS);
  const [oneOffEvents, setOneOffEvents] = useState(DEFAULT_ONE_OFF_EVENTS);
  const [projectionYears, setProjectionYears] = useState(30);
  const [inflationRate, setInflationRate] = useState(0.025);

  // Simulation State
  const [simulations, setSimulations] = useState([]);
  const [efficientFrontier, setEfficientFrontier] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [simulationCount, setSimulationCount] = useState(20000); // Default number of simulations
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(5);
  const [optimizationAssets, setOptimizationAssets] = useState([]);
  
  // Cashflow Result State
  const [cfSimulationResults, setCfSimulationResults] = useState([]);
  
  // Supabase State
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [scenarioName, setScenarioName] = useState('My Strategy');
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  useEffect(() => {
    fetchScenarios();
  }, []);

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

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      alert('Please enter a scenario name');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: scenarioName,
        assets,
        structures,
        income_streams: incomeStreams,
        expense_streams: expenseStreams,
        one_off_events: oneOffEvents,
        projection_years: projectionYears,
        inflation_rate: inflationRate,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('scenarios')
        .insert([payload])
        .select();

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
      if (data.one_off_events) setOneOffEvents(data.one_off_events);
      if (data.projection_years) setProjectionYears(data.projection_years);
      if (data.inflation_rate) setInflationRate(data.inflation_rate);
      
      // Reset simulation state
      setSimulations([]);
      setEfficientFrontier([]);
      setCfSimulationResults([]);
      setActiveTab('data');
      setShowLoadMenu(false);
    }
  };

  const handleAssetToggle = (id) => {
    setAssets(assets.map(a => a.id === id ? { ...a, active: !a.active } : a));
    setEfficientFrontier([]);
    setSimulations([]);
  };

  const handleAddAsset = () => {
    const newAsset = {
      id: `custom_${Date.now()}`,
      name: 'New Asset Class',
      return: 0.05,
      stdev: 0.10,
      incomeRatio: 0.5,
      min: 0,
      max: 1,
      color: '#' + Math.floor(Math.random()*16777215).toString(16), // Random Color
      active: true,
      isDefault: false
    };
    setAssets([...assets, newAsset]);
  };

  const handleDeleteAsset = (id) => {
    setAssets(assets.filter(a => a.id !== id));
  };

  // Re-defined batch simulation here to be used in handler
  const runSingleBatchSimulation = (activeAssets, afterTaxReturns, activeCorrelations, batchSize) => {
    const results = [];
    for (let k = 0; k < batchSize; k++) {
      let weights = activeAssets.map(() => Math.random());
      let sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
      
      const stats = calculatePortfolioStats(weights, afterTaxReturns, activeAssets, activeCorrelations);
      results.push(stats);
    }
    return results;
  };

  const handleRunOptimization = () => {
    // Validation
    const activeAssets = assets.filter(a => a.active);
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
        // If it's a default asset, use the default matrix
        if (rowIdx < DEFAULT_CORRELATIONS.length && colIdx < DEFAULT_CORRELATIONS.length) {
          return DEFAULT_CORRELATIONS[rowIdx][colIdx];
        }
        // Self correlation is always 1
        if (rowIdx === colIdx) return 1.0;
        // Default assumption for custom/new assets
        return 0.3;
      })
    );

    const afterTaxReturns = calculateClientTaxAdjustedReturns(activeAssets, structures);
    
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
        // Finished
        // Ensure we show 100% for a moment before completing
        setProgress(100);
        setTimeout(() => finishOptimization(allResults, activeAssets), 500);
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
    setActiveTab('optimization');
  };

  const runCashflowMonteCarlo = useCallback(() => {
    if (!selectedPortfolio) return;

    const numRuns = 1000;
    const years = projectionYears;
    
    const annualNetFlows = new Array(years + 1).fill(0);
    
    for (let y = 1; y <= years; y++) {
      let flow = 0;
      const inflationFactor = Math.pow(1 + inflationRate, y);
      
      incomeStreams.forEach(s => { 
        if(y >= s.startYear && y <= s.endYear) {
          flow += s.amount * inflationFactor; 
        }
      });
      
      expenseStreams.forEach(s => { 
        if(y >= s.startYear && y <= s.endYear) {
          flow -= s.amount * inflationFactor; 
        }
      });
      
      oneOffEvents.forEach(e => { if(e.year === y) flow += e.amount; }); 
      
      annualNetFlows[y] = flow;
    }

    const portReturn = selectedPortfolio.return;
    const portRisk = selectedPortfolio.risk;

    const results = [];

    for (let y = 0; y <= years; y++) {
      results.push({ year: y, p05: 0, p50: 0, p95: 0, paths: [] });
    }

    for (let r = 0; r < numRuns; r++) {
      let balance = totalWealth;
      results[0].paths.push(balance);

      for (let y = 1; y <= years; y++) {
        const rnd = randn_bm(); 
        const annualReturn = portReturn + (rnd * portRisk);
        
        balance = balance * (1 + annualReturn);
        balance += annualNetFlows[y];
        
        if (balance < 0) balance = 0;
        
        results[y].paths.push(balance);
      }
    }

    const finalData = results.map(r => ({
      year: r.year,
      p05: calculatePercentile(r.paths, 5),
      p50: calculatePercentile(r.paths, 50),
      p95: calculatePercentile(r.paths, 95)
    }));

    setCfSimulationResults(finalData);
  }, [selectedPortfolio, totalWealth, incomeStreams, expenseStreams, oneOffEvents, projectionYears, inflationRate]);

  useEffect(() => {
    if (activeTab === 'cashflow' && selectedPortfolio) {
      runCashflowMonteCarlo();
    }
  }, [activeTab, selectedPortfolio, runCashflowMonteCarlo]);


  // --- Sub-Components ---

  const Navigation = () => (
    <div className="flex flex-col md:flex-row gap-2 mb-6 border-b border-gray-200 pb-4 overflow-x-auto">
      {[
        { id: 'data', label: '1. Data Input', icon: Settings },
        { id: 'client', label: '2. Client & Structure', icon: User },
        { id: 'optimization', label: '3. Optimisation', icon: Calculator },
        { id: 'output', label: '4. Output', icon: PieIcon },
        { id: 'cashflow', label: '5. Projections', icon: TrendingUp },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === tab.id 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <tab.icon className="w-4 h-4 mr-2" />
          {tab.label}
        </button>
      ))}
    </div>
  );

  const DataTab = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          Capital Market Assumptions
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Select applicable asset classes and define their expected returns, risk, and yield. Unchecked assets will be excluded from optimization.
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-12 text-center">Include</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Asset Class</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Total Return (%)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Risk (StdDev %)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Income Yield %</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Constraints</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map((asset) => (
                <tr key={asset.id} className={!asset.active ? 'opacity-50 bg-gray-50' : ''}>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => handleAssetToggle(asset.id)}
                      className={`p-1 rounded transition-colors ${asset.active ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-200'}`}
                    >
                      {asset.active ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: asset.color }}></div>
                      {asset.isDefault ? (
                        asset.name
                      ) : (
                        <input 
                          type="text" 
                          value={asset.name}
                          onChange={(e) => setAssets(assets.map(a => a.id === asset.id ? {...a, name: e.target.value} : a))}
                          className="border border-gray-300 rounded px-2 py-1 w-full"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" step="0.1" className="w-20 border rounded px-2 py-1"
                      disabled={!asset.active}
                      value={Math.round(asset.return * 1000) / 10}
                      onChange={(e) => setAssets(assets.map(a => a.id === asset.id ? {...a, return: parseFloat(e.target.value)/100} : a))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" step="0.1" className="w-20 border rounded px-2 py-1"
                      disabled={!asset.active}
                      value={Math.round(asset.stdev * 1000) / 10}
                      onChange={(e) => setAssets(assets.map(a => a.id === asset.id ? {...a, stdev: parseFloat(e.target.value)/100} : a))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="1" 
                        min="0"
                        max="100"
                        disabled={!asset.active}
                        className="w-16 border rounded px-2 py-1"
                        value={Math.round(asset.incomeRatio * 100)}
                        onChange={(e) => {
                          let val = parseInt(e.target.value);
                          if (val > 100) val = 100;
                          if (val < 0) val = 0;
                          if (isNaN(val)) val = 0;
                          setAssets(assets.map(a => a.id === asset.id ? {...a, incomeRatio: val/100} : a))
                        }}
                      />
                      <span className="text-xs text-gray-400">Yield</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                     Min: {(asset.min*100).toFixed(0)}% | Max: {(asset.max*100).toFixed(0)}%
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
              className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Custom Asset Class
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const ClientTab = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-blue-600" />
          Entity Structure
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Define investment entities. The Optimizer uses specific tax rates (Income vs CGT) for each entity type to calculate after-tax returns.
        </p>

        <div className="space-y-4">
          {structures.map((struct, idx) => (
            <div key={struct.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Entity Name</label>
                <input type="text" value={struct.name}
                  onChange={(e) => setStructures(structures.map(s => s.id === struct.id ? {...s, name: e.target.value} : s))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
                <select 
                  value={struct.type}
                  onChange={(e) => setStructures(structures.map(s => s.id === struct.id ? {...s, type: e.target.value} : s))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                >
                  {Object.keys(ENTITY_TYPES).map(k => (
                    <option key={k} value={k}>{ENTITY_TYPES[k].label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Value ($)</label>
                <input type="number" value={struct.value}
                  onChange={(e) => setStructures(structures.map(s => s.id === struct.id ? {...s, value: parseInt(e.target.value) || 0} : s))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold"
                />
              </div>
              <div className="md:col-span-3">
                 <div className="text-xs text-gray-500">
                   Tax: {formatPercent(ENTITY_TYPES[struct.type].incomeTax)} Inc / {formatPercent(ENTITY_TYPES[struct.type].ltCgt)} CGT
                 </div>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <div className="text-right">
              <span className="text-sm text-gray-500 block">Total Investable Assets</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(totalWealth)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-blue-600" />
          Cashflow Projection Inputs
        </h3>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 grid md:grid-cols-2 gap-4">
           <div>
             <label className="flex items-center text-xs font-bold text-blue-800 mb-1">
               <Clock className="w-3 h-3 mr-1"/> Projection Period (Years)
             </label>
             <input 
                type="number" 
                value={projectionYears} 
                onChange={(e) => setProjectionYears(parseInt(e.target.value) || 1)}
                className="w-full border border-blue-200 rounded px-2 py-1 text-sm text-blue-900"
             />
             <div className="text-xs text-blue-600 mt-1">E.g. 30 years (Age 60 to 90)</div>
           </div>
           <div>
             <label className="flex items-center text-xs font-bold text-blue-800 mb-1">
               <Percent className="w-3 h-3 mr-1"/> Inflation Rate (% p.a.)
             </label>
             <div className="relative">
               <input 
                  type="number" 
                  step="0.1"
                  value={Math.round(inflationRate * 1000) / 10} 
                  onChange={(e) => setInflationRate(parseFloat(e.target.value)/100 || 0)}
                  className="w-full border border-blue-200 rounded px-2 py-1 text-sm text-blue-900 pr-6"
               />
               <span className="absolute right-2 top-1 text-xs text-blue-400">%</span>
             </div>
             <div className="text-xs text-blue-600 mt-1">Applied to recurring Income & Expenses</div>
           </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Income Streams (Today's Dollars)</h4>
            {incomeStreams.map((item, i) => (
              <div key={item.id} className="flex gap-2 mb-2 items-center text-sm">
                <input type="text" value={item.name} className="w-1/3 border rounded px-2 py-1" onChange={(e) => {
                  const n = [...incomeStreams]; n[i].name = e.target.value; setIncomeStreams(n);
                }}/>
                <input type="number" value={item.amount} className="w-1/4 border rounded px-2 py-1" onChange={(e) => {
                  const n = [...incomeStreams]; n[i].amount = parseInt(e.target.value); setIncomeStreams(n);
                }}/>
                <div className="flex items-center text-xs text-gray-500">
                  Yr <input type="number" value={item.startYear} className="w-10 border rounded mx-1 text-center" onChange={(e) => {
                     const n = [...incomeStreams]; n[i].startYear = parseInt(e.target.value); setIncomeStreams(n);
                  }}/>
                  to <input type="number" value={item.endYear} className="w-10 border rounded mx-1 text-center" onChange={(e) => {
                     const n = [...incomeStreams]; n[i].endYear = parseInt(e.target.value); setIncomeStreams(n);
                  }}/>
                </div>
              </div>
            ))}
            <button className="text-xs text-blue-600 flex items-center mt-2" onClick={() => setIncomeStreams([...incomeStreams, { id: Date.now(), name: 'New Income', amount: 0, startYear: 1, endYear: 10 }])}>
              <Plus className="w-3 h-3 mr-1"/> Add Income
            </button>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Expense Streams (Today's Dollars)</h4>
            {expenseStreams.map((item, i) => (
              <div key={item.id} className="flex gap-2 mb-2 items-center text-sm">
                <input type="text" value={item.name} className="w-1/3 border rounded px-2 py-1" onChange={(e) => {
                  const n = [...expenseStreams]; n[i].name = e.target.value; setExpenseStreams(n);
                }}/>
                <input type="number" value={item.amount} className="w-1/4 border rounded px-2 py-1 text-red-600" onChange={(e) => {
                  const n = [...expenseStreams]; n[i].amount = parseInt(e.target.value); setExpenseStreams(n);
                }}/>
                <div className="flex items-center text-xs text-gray-500">
                  Yr <input type="number" value={item.startYear} className="w-10 border rounded mx-1 text-center" onChange={(e) => {
                     const n = [...expenseStreams]; n[i].startYear = parseInt(e.target.value); setExpenseStreams(n);
                  }}/>
                  to <input type="number" value={item.endYear} className="w-10 border rounded mx-1 text-center" onChange={(e) => {
                     const n = [...expenseStreams]; n[i].endYear = parseInt(e.target.value); setExpenseStreams(n);
                  }}/>
                </div>
              </div>
            ))}
            <button className="text-xs text-blue-600 flex items-center mt-2" onClick={() => setExpenseStreams([...expenseStreams, { id: Date.now(), name: 'New Expense', amount: 0, startYear: 1, endYear: 30 }])}>
              <Plus className="w-3 h-3 mr-1"/> Add Expense
            </button>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-100">
           <h4 className="text-sm font-bold text-gray-700 mb-3">One-Off Events (Costs are negative)</h4>
           {oneOffEvents.map((item, i) => (
             <div key={item.id} className="flex gap-4 mb-2 items-center text-sm max-w-2xl">
                <input type="text" value={item.name} className="flex-grow border rounded px-2 py-1" onChange={(e) => {
                  const n = [...oneOffEvents]; n[i].name = e.target.value; setOneOffEvents(n);
                }}/>
                <input type="number" value={item.amount} className={`w-32 border rounded px-2 py-1 ${item.amount < 0 ? 'text-red-600' : 'text-green-600'}`} onChange={(e) => {
                  const n = [...oneOffEvents]; n[i].amount = parseInt(e.target.value); setOneOffEvents(n);
                }}/>
                <div className="flex items-center text-xs text-gray-500">
                   Year: <input type="number" value={item.year} className="w-16 border rounded ml-2 px-1" onChange={(e) => {
                     const n = [...oneOffEvents]; n[i].year = parseInt(e.target.value); setOneOffEvents(n);
                   }}/>
                </div>
                <button onClick={() => setOneOffEvents(oneOffEvents.filter(e => e.id !== item.id))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
             </div>
           ))}
           <button className="text-xs text-blue-600 flex items-center mt-2" onClick={() => setOneOffEvents([...oneOffEvents, { id: Date.now(), name: 'New Event', amount: -100000, year: 5 }])}>
              <Plus className="w-3 h-3 mr-1"/> Add Event
            </button>
        </div>
      </div>
    </div>
  );

  const OptimizationTab = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calculator className="w-5 h-5 mr-2 text-blue-600" />
              Optimization Engine
            </h3>
            <p className="text-sm text-gray-500">Run Monte Carlo simulations to generate tax-optimized Efficient Frontier.</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right">
               <label className="block text-xs font-bold text-gray-500 mb-1">Simulations</label>
               <input 
                 type="number" 
                 value={simulationCount} 
                 onChange={(e) => setSimulationCount(parseInt(e.target.value) || 1000)}
                 className="w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm"
                 disabled={isSimulating}
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
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-75 ease-linear" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleRunOptimization}
                  disabled={isSimulating}
                  className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Cpu className="w-4 h-4 mr-2" /> Run Analysis
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
                  label={{ value: 'Risk (Standard Deviation)', position: 'bottom', offset: 0 }}
                  domain={['auto', 'auto']}
                />
                <YAxis 
                  type="number" 
                  dataKey="return" 
                  name="Return" 
                  unit="" 
                  tickFormatter={(val) => formatPercent(val)}
                  label={{ value: 'Expected Return (After Tax)', angle: -90, position: 'insideLeft' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
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
                />
                <Legend />
                <Scatter name="Simulated Portfolios" data={simulations} fill="#cbd5e1" shape="circle" r={2} opacity={0.5} />
                <Scatter name="Efficient Models" data={efficientFrontier} fill="#2563eb" shape="diamond" r={8} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Activity className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No simulation data generated yet.</p>
            <p className="text-gray-400 text-sm">Click "Run Analysis" to start.</p>
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
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-0 z-10">
           <div className="flex justify-between items-end mb-4">
             <h3 className="text-lg font-semibold text-gray-900">Select Model Portfolio</h3>
             <span className="text-sm font-medium px-3 py-1 bg-blue-100 text-blue-800 rounded-full">{selectedPortfolio.label}</span>
           </div>
           
           <input 
              type="range" min="1" max="10" 
              value={selectedPortfolioId} 
              onChange={(e) => setSelectedPortfolioId(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Conservative</span>
              <span>Balanced</span>
              <span>Aggressive</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
               <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                 <div className="text-xs text-gray-500 uppercase">Return (After-Tax)</div>
                 <div className="text-xl font-bold text-green-600">{formatPercent(selectedPortfolio.return)}</div>
               </div>
               <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                 <div className="text-xs text-gray-500 uppercase">Risk (StdDev)</div>
                 <div className="text-xl font-bold text-red-600">{formatPercent(selectedPortfolio.risk)}</div>
               </div>
               <div className="text-center p-3 bg-gray-50 rounded border border-gray-200">
                 <div className="text-xs text-gray-500 uppercase">Sharpe Ratio</div>
                 <div className="text-xl font-bold text-blue-600">{(selectedPortfolio.return / selectedPortfolio.risk).toFixed(2)}</div>
               </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
            <h4 className="font-semibold text-gray-900 mb-4 w-full text-left">Overall Asset Allocation</h4>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={activeAssets} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {activeAssets.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(val) => `${val.toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <h4 className="font-semibold text-gray-900 mb-4">Detailed Allocation</h4>
             <div className="overflow-y-auto max-h-[300px]">
               <table className="min-w-full text-sm">
                 <thead>
                   <tr className="bg-gray-50 sticky top-0">
                     <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                     <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Weight</th>
                     <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {activeAssets.map((asset) => (
                       <tr key={asset.id}>
                         <td className="px-3 py-2 font-medium flex items-center">
                           <div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor:asset.color}}/>
                           {asset.name}
                         </td>
                         <td className="px-3 py-2 text-right text-gray-600">{formatPercent(asset.weight)}</td>
                         <td className="px-3 py-2 text-right text-gray-900 font-mono">{formatCurrency(asset.weight * totalWealth)}</td>
                       </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Entity-Specific Allocations (Proportional MVP)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {structures.map(struct => (
               <div key={struct.id} className="border border-gray-200 rounded-lg p-3">
                 <div className="font-bold text-sm text-gray-800 mb-2 border-b pb-1">{struct.name}</div>
                 <div className="space-y-1">
                   {activeAssets.map((asset) => {
                     const structValue = asset.weight * struct.value; 
                     return (
                       <div key={asset.id} className="flex justify-between text-xs">
                         <span className="text-gray-500">{asset.name}</span>
                         <span className="font-mono text-gray-900">{formatCurrency(structValue)}</span>
                       </div>
                     )
                   })}
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

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
             <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
             Monte Carlo Wealth Projection
          </h3>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cfSimulationResults} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" label={{ value: 'Years', position: 'bottom' }} />
                <YAxis tickFormatter={(val) => `$${(val/1000000).toFixed(1)}m`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <Tooltip 
                  formatter={(val) => formatCurrency(val)}
                  labelFormatter={(val) => `Year ${val}`}
                />
                
                <Area type="monotone" dataKey="p95" stroke="none" fill="url(#confidenceBand)" name="95th Percentile" />
                <Area type="monotone" dataKey="p05" stroke="none" fill="#fff" name="5th Percentile" /> 
                
                <Line type="monotone" dataKey="p50" stroke="#2563eb" strokeWidth={3} dot={false} name="Median (50th)" />
                <Line type="monotone" dataKey="p95" stroke="#93c5fd" strokeWidth={1} dot={false} strokeDasharray="5 5" name="Best Case (95th)" />
                <Line type="monotone" dataKey="p05" stroke="#93c5fd" strokeWidth={1} dot={false} strokeDasharray="5 5" name="Worst Case (5th)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <strong>Analysis:</strong> Based on 1,000 simulations using the <strong>{selectedPortfolio.label}</strong> over <strong>{projectionYears} years</strong>.
              The shaded area represents the 90% confidence interval.
              <ul className="list-disc ml-5 mt-2 space-y-1 text-xs">
                 <li>Median Result (Year {projectionYears}): <strong>{formatCurrency(cfSimulationResults[cfSimulationResults.length-1].p50)}</strong></li>
                 <li>Worst Case (Year {projectionYears}): <strong>{formatCurrency(cfSimulationResults[cfSimulationResults.length-1].p05)}</strong></li>
                 <li>Assumed Inflation: <strong>{(inflationRate * 100).toFixed(1)}% p.a.</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-8 h-8 text-blue-600" />
              Risk/Return Optimiser
            </h1>
            <p className="text-gray-500 text-sm mt-1">PRD Compliant v1.0 • Tax-Aware Optimization</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <input 
                type="text" 
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-48 focus:ring-2 focus:ring-blue-500 outline-none"
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
                      <button 
                        key={s.id}
                        onClick={() => handleLoadScenario(s.id)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{s.name || 'Untitled'}</div>
                        <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString()}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={handleSaveScenario}
              disabled={isSaving}
              className="flex items-center px-3 py-2 bg-blue-600 text-white border border-blue-700 rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
               {isSaving ? <Loader className="w-4 h-4 mr-2 animate-spin"/> : <Cloud className="w-4 h-4 mr-2"/>}
               {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium">
               <FileText className="w-4 h-4 mr-2"/> Summary PDF
            </button>
          </div>
        </div>
        {Navigation()}
        <main>
          {activeTab === 'data' && DataTab()}
          {activeTab === 'client' && ClientTab()}
          {activeTab === 'optimization' && OptimizationTab()}
          {activeTab === 'output' && OutputTab()}
          {activeTab === 'cashflow' && CashflowTab()}
        </main>
      </div>
    </div>
  );
}
