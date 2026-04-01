import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, Users, TrendingUp, BarChart3, AlertCircle, LayoutDashboard, Activity, Clock, CheckCircle, Edit, Trash, Monitor, DollarSign, Calendar } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts';
import apiService from '../services/apiService';
import usePageTitle from '../hooks/usePageTitle';
import './Dashboard.css';

const Dashboard = () => {
  usePageTitle('Dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State to track which cards are expanded (default: all minimized)
  const [expandedCards, setExpandedCards] = useState({
    deviceAnalysis: true,
    customerDistribution: true,
    modelDistribution: true,
    revenueByCategory: true,
    warrantyTimeline: true,
    peripheralDistribution: true,
    recentActivity: true
  });
  
  // Define adjacent card pairs
  const adjacentCards = {
    deviceAnalysis: 'customerDistribution',
    customerDistribution: 'deviceAnalysis',
    modelDistribution: 'revenueByCategory',
    revenueByCategory: 'modelDistribution',
    warrantyTimeline: 'peripheralDistribution',
    peripheralDistribution: 'warrantyTimeline',
    recentActivity: null // standalone card
  };
  
  // Toggle card expansion and toggle adjacent card as well
  const toggleCard = (cardName) => {
    setExpandedCards(prev => {
      const isExpanding = !prev[cardName];
      const adjacent = adjacentCards[cardName];
      
      // If has adjacent card, toggle both together
      if (adjacent) {
        return {
          ...prev,
          [cardName]: isExpanding,
          [adjacent]: isExpanding
        };
      }
      
      // Otherwise just toggle the current card
      return {
        ...prev,
        [cardName]: isExpanding
      };
    });
  };

  const headerButtonStyle = {
    background: 'white',
    color: '#667eea',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    transition: 'all 0.3s ease'
  };

  const handleHeaderButtonHover = (event, isHover) => {
    const target = event.currentTarget;
    target.style.transform = isHover ? 'translateY(-2px)' : 'translateY(0)';
    target.style.boxShadow = isHover
      ? '0 6px 20px rgba(0, 0, 0, 0.25)'
      : '0 4px 15px rgba(0, 0, 0, 0.2)';
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch dashboard statistics
        const response = await apiService.getDashboardData();

        console.log('Dashboard API Response:', response); // Debug log

        // Handle the statistics response structure
        if (response && response.success && response.data) {
          const stats = response.data;

          console.log('=== DASHBOARD DEBUG ===');
          console.log('stats.total:', stats.total);
          console.log('stats.totalValue:', stats.totalValue);
          console.log('stats.totalPeripherals:', stats.totalPeripherals);
          console.log('stats.byStatus:', stats.byStatus);
          console.log('stats.byCategory:', stats.byCategory);
          console.log('stats.byCustomer:', stats.byCustomer);
          console.log('stats.customersByCategory:', stats.customersByCategory);
          console.log('stats.totalProjects:', stats.totalProjects);

          // Find active assets with case-insensitive comparison
          const activeAssetCount = stats.byStatus?.find(s => 
            s.status && s.status.toUpperCase() === 'ACTIVE'
          )?.count || 0;

          console.log('Active asset count:', activeAssetCount);

          // Transform the backend statistics to match frontend expectations
          const dashboardData = {
            stats: {
              totalAssets: stats.total || 0,
              activeAssets: activeAssetCount,
              totalCustomers: stats.totalProjects || 0, // 1 project = 1 customer
              totalValue: stats.totalValue || 0, // Total asset value from monthly prices
              totalPeripherals: stats.totalPeripherals || 0 // Total peripherals for all assets
            },
            customerAssetData: stats.byCategory?.map((cat, index) => ({
              customer: cat.category,
              devices: cat.count.toString()
            })).sort((a, b) => parseInt(b.devices) - parseInt(a.devices)) || [],
            modelData: stats.byModel?.map((model, index) => ({
              model: model.model,
              count: model.count
            })).sort((a, b) => b.count - a.count) || [],
            revenueByCategory: stats.revenueByCategory?.map((item) => ({
              category: item.category,
              revenue: item.revenue,
              count: item.count
            })).sort((a, b) => b.revenue - a.revenue) || [],
            warrantyByProject: stats.warrantyByProject?.map((item) => ({
              project: item.project,
              customer: item.customer,
              refNumber: item.refNumber,
              warranty: item.warranty,
              startDate: item.startDate,
              endDate: item.endDate,
              totalDays: item.totalDays,
              daysElapsed: item.daysElapsed,
              daysRemaining: item.daysRemaining,
              warrantyProgress: item.warrantyProgress,
              warrantyRemainingPercentage: item.warrantyRemainingPercentage,
              assetCount: item.assetCount
            })).sort((a, b) => b.warrantyProgress - a.warrantyProgress) || [],
            peripheralTypeDistribution: stats.peripheralTypeDistribution?.map((item) => ({
              peripheralType: item.peripheralType,
              count: item.count,
              assetCount: item.assetCount
            })).sort((a, b) => b.count - a.count) || [],
            customerDistribution: stats.byCustomer || [],
            customersByCategory: stats.customersByCategory || {}
          };

          console.log('Final dashboardData:', dashboardData);
          console.log('======================');

          setDashboardData(dashboardData);
        } else {
          console.warn('Unexpected dashboard response structure:', response);
          setDashboardData({
            stats: { totalAssets: 0, activeAssets: 0, totalCustomers: 0, totalValue: 0 },
            customerAssetData: [],
            customerDistribution: [],
            customersByCategory: {}
          });
        }

        // Fetch recent activity
        try {
          const activityResponse = await apiService.getRecentActivity(10);
          if (activityResponse && activityResponse.success && activityResponse.data) {
            setRecentActivity(activityResponse.data);
          }
        } catch (activityError) {
          console.warn('Failed to fetch recent activity:', activityError);
          // Don't fail the whole dashboard if activity fails
          setRecentActivity([]);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data. Make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '30px',
          paddingBottom: '15px',
          borderBottom: '3px solid #3498db'
        }}>
          <LayoutDashboard size={28} color="#3498db" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Dashboard
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              System overview and statistics
            </p>
          </div>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="dashboard-container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '30px',
          paddingBottom: '15px',
          borderBottom: '3px solid #3498db'
        }}>
          <LayoutDashboard size={28} color="#3498db" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Dashboard
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              System overview and statistics
            </p>
          </div>
        </div>
        <div className="error-container">
          <div className="error-icon"><AlertCircle size={48} /></div>
          <div className="error-text">Error: {error}</div>
        </div>
      </div>
    );
  }

  // Extract data from API response
  const { stats, customerAssetData, modelData, revenueByCategory, warrantyByProject, peripheralTypeDistribution, customersByCategory } = dashboardData || {};
  const { totalAssets = 0, activeAssets = 0, totalCustomers = 0, totalValue = 0, totalPeripherals = 0 } = stats || {};

  const activeAssetsRate = totalAssets > 0 ? ((activeAssets / totalAssets) * 100).toFixed(1) : '0.0';
  const inactiveAssets = Math.max(totalAssets - activeAssets, 0);
  const inactiveAssetsRate = totalAssets > 0 ? ((inactiveAssets / totalAssets) * 100).toFixed(1) : '0.0';
  const assetsPerCustomer = totalCustomers > 0 ? (totalAssets / totalCustomers).toFixed(1) : '0.0';
  const avgAssetValue = totalAssets > 0 ? totalValue / totalAssets : 0;
  const peripheralsPerAsset = totalAssets > 0 ? (totalPeripherals / totalAssets).toFixed(2) : '0.00';

  const statCards = [
    {
      key: 'assets',
      label: 'Total Assets',
      value: totalAssets.toLocaleString('en-MY'),
      meta: `${assetsPerCustomer} assets per customer`,
      icon: Package,
      iconSize: 30
    },
    {
      key: 'customers',
      label: 'Total Customers',
      value: totalCustomers.toLocaleString('en-MY'),
      meta: totalCustomers > 0 ? 'Active project base' : 'No customer records yet',
      icon: Users,
      iconSize: 30
    },
    {
      key: 'active',
      label: 'Active Assets',
      value: activeAssets.toLocaleString('en-MY'),
      meta: `${activeAssetsRate}% of total assets`,
      icon: TrendingUp,
      iconSize: 30
    },
    {
      key: 'value',
      label: 'Total Value',
      value: totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      meta: `Avg RM ${avgAssetValue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per asset`,
      icon: DollarSign,
      iconSize: 30,
      isCurrency: true
    },
    {
      key: 'peripherals',
      label: 'Total Peripherals',
      value: totalPeripherals.toLocaleString('en-MY'),
      meta: `${peripheralsPerAsset} peripherals per asset`,
      icon: Monitor,
      iconSize: 30
    },
    {
      key: 'inactive',
      label: 'Inactive Assets',
      value: inactiveAssets.toLocaleString('en-MY'),
      meta: `${inactiveAssetsRate}% of total assets`,
      icon: AlertCircle,
      iconSize: 30
    }
  ];

  const chartPalette = ['#2563eb', '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#ec4899'];

  const formatCurrencyCompact = (value) => {
    const numericValue = Number(value) || 0;
    return `RM ${numericValue.toLocaleString('en-MY')}`;
  };

  const deviceAnalysisData = (customerAssetData || [])
    .map((item) => ({
      name: item.customer,
      devices: Number(item.devices) || 0
    }))
    .filter((item) => item.devices > 0)
    .slice(0, 10);

  const customerDistributionData = customersByCategory
    ? Object.entries(customersByCategory)
        .map(([customerName, data]) => ({
          name: customerName,
          assets: Number(data.total) || 0
        }))
        .filter((item) => item.assets > 0)
        .sort((a, b) => b.assets - a.assets)
    : [];

  const customerDistributionTotal = customerDistributionData.reduce(
    (sum, item) => sum + item.assets,
    0
  );

  const modelDistributionData = (modelData || [])
    .map((item) => ({
      name: item.model,
      assets: Number(item.count) || 0
    }))
    .filter((item) => item.assets > 0)
    .slice(0, 10);

  const revenueData = (revenueByCategory || [])
    .map((item) => ({
      name: item.category,
      revenue: Number(item.revenue) || 0,
      assets: Number(item.count) || 0
    }))
    .filter((item) => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenueByCategory = revenueData.reduce((sum, item) => sum + item.revenue, 0);

  const revenueChartData = revenueData.map((item) => ({
    ...item,
    share: totalRevenueByCategory > 0 ? Number(((item.revenue / totalRevenueByCategory) * 100).toFixed(1)) : 0
  }));

  const warrantyData = (warrantyByProject || [])
    .slice(0, 12)
    .map((item) => {
      const progressPct = Math.min(Math.max(Number(item.warrantyProgress) || 0, 0), 100);
      return {
        name: item.customer || item.project || item.refNumber,
        elapsed: Number(progressPct.toFixed(1)),
        remaining: Number((100 - progressPct).toFixed(1)),
        daysRemaining: Number(item.daysRemaining) || 0
      };
    });

  const peripheralData = (peripheralTypeDistribution || [])
    .map((item) => ({
      name: item.peripheralType,
      count: Number(item.count) || 0,
      assets: Number(item.assetCount) || 0
    }))
    .filter((item) => item.count > 0);

  return (
    <div className="dashboard-container">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #3498db',
        padding: '0 20px 15px 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LayoutDashboard size={28} color="#3498db" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.4rem' }}>
              Dashboard
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.9rem' }}>
              System overview and statistics
            </p>
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            to="/add-asset"
            className="btn btn-primary"
            style={headerButtonStyle}
            onMouseEnter={(e) => handleHeaderButtonHover(e, true)}
            onMouseLeave={(e) => handleHeaderButtonHover(e, false)}
          >
            <Plus size={16} />
            Add New Asset
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        {statCards.map((item) => {
          const IconComponent = item.icon;
          return (
            <div key={item.key} className={`stat-card stat-card--${item.key}`}>
              <div className="stat-chip">KPI</div>
              <div className="stat-icon">
                <IconComponent size={item.iconSize || 30} />
              </div>
              <div className="stat-info">
                <div className="stat-label">{item.label}</div>
                <div className="stat-number">
                  {item.isCurrency && <span className="currency-tag">RM</span>}
                  <span>{item.value}</span>
                </div>
                <div className="stat-meta">{item.meta}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-charts">
        {/* First Row - Device Analysis and Customer Distribution */}
        <div className="chart-card">
          <div 
            className="chart-header"
            onClick={() => toggleCard('deviceAnalysis')}
            style={{
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title={expandedCards.deviceAnalysis ? 'Click to minimize' : 'Click to maximize'}
          >
            <h2 className="chart-title">
              <BarChart3 size={24} className="chart-icon" />
              Device Analysis by Category
            </h2>
          </div>
          {expandedCards.deviceAnalysis && (<div className="chart-container">
            {deviceAnalysisData.length > 0 ? (
              <div className="dashboard-chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deviceAnalysisData} layout="vertical" margin={{ top: 8, right: 20, left: 10, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#1e293b', fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value} devices`, 'Count']} />
                    <Bar dataKey="devices" radius={[0, 6, 6, 0]}>
                      {deviceAnalysisData.map((entry, index) => (
                        <Cell key={`device-cell-${entry.name}`} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>No customer data available</p>
              </div>
            )}
          </div>)}
        </div>

        <div className="chart-card">
          <div 
            className="chart-header"
            onClick={() => toggleCard('customerDistribution')}
            style={{
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title={expandedCards.customerDistribution ? 'Click to minimize' : 'Click to maximize'}
          >
            <h2 className="chart-title">
              <Users size={24} className="chart-icon" />
              Customer Distribution
            </h2>
          </div>
          {expandedCards.customerDistribution && (<div className="chart-container">
            {customerDistributionData.length > 0 ? (
              <div className="dashboard-chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={customerDistributionData.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={106}
                      paddingAngle={2}
                      dataKey="assets"
                      nameKey="name"
                    >
                      {customerDistributionData.slice(0, 8).map((entry, index) => (
                        <Cell key={`customer-cell-${entry.name}`} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const numericValue = Number(value) || 0;
                        const percentage = customerDistributionTotal > 0
                          ? ((numericValue / customerDistributionTotal) * 100).toFixed(1)
                          : '0.0';
                        return [`${numericValue} assets (${percentage}%)`, props?.payload?.name || 'Customer'];
                      }}
                    />
                    <Legend verticalAlign="bottom" height={32} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <p>No customer distribution data available</p>
              </div>
            )}
          </div>)}
        </div>

        

        {/* Model Distribution Chart */}
        <div className="chart-card">
          <div 
            className="chart-header"
            onClick={() => toggleCard('modelDistribution')}
            style={{
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title={expandedCards.modelDistribution ? 'Click to minimize' : 'Click to maximize'}
          >
            <h2 className="chart-title">
              <Package size={24} className="chart-icon" />
              Top 10 Most Deployed Models
            </h2>
          </div>
          {expandedCards.modelDistribution && (<div className="chart-container">
            {modelDistributionData.length > 0 ? (
              <div className="dashboard-chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={modelDistributionData} margin={{ top: 10, right: 14, left: 2, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={80}
                      tick={{ fill: '#334155', fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value} assets`, 'Deployed']} />
                    <Bar dataKey="assets" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <p>No model data available</p>
              </div>
            )}
          </div>)}
        </div>

        {/* Revenue by Category Chart */}
        <div className="chart-card">
          <div 
            className="chart-header"
            onClick={() => toggleCard('revenueByCategory')}
            style={{
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title={expandedCards.revenueByCategory ? 'Click to minimize' : 'Click to maximize'}
          >
            <h2 className="chart-title">
              <DollarSign size={24} className="chart-icon" />
              Revenue by Category
            </h2>
          </div>
          {expandedCards.revenueByCategory && (<div className="chart-container">
            {revenueChartData.length > 0 ? (
              <div className="dashboard-chart-wrapper">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={revenueChartData} layout="vertical" margin={{ top: 8, right: 40, left: 10, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => `RM ${Number(value).toLocaleString('en-MY')}`}
                      tick={{ fill: '#475569', fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fill: '#1e293b', fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value, name, props) => {
                        if (name === 'revenue') {
                          return [`${formatCurrencyCompact(value)} (${props?.payload?.share || 0}%)`, 'Revenue'];
                        }
                        return [`${value} assets`, 'Asset Count'];
                      }}
                    />
                    <Legend formatter={(value) => value === 'revenue' ? 'Revenue' : value} />
                    <Bar dataKey="revenue" fill="#22c55e" radius={[0, 6, 6, 0]}>
                      <LabelList
                        dataKey="share"
                        position="right"
                        formatter={(value) => `${value}%`}
                        style={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <p>No revenue data available</p>
              </div>
            )}
          </div>)}
        </div>

        {/* Warranty Timeline per Project */}
        <div className="chart-card">
          <div 
            className="chart-header"
            onClick={() => toggleCard('warrantyTimeline')}
            style={{
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title={expandedCards.warrantyTimeline ? 'Click to minimize' : 'Click to maximize'}
          >
            <h2 className="chart-title">
              <Calendar size={24} className="chart-icon" />
              Warranty Timeline by Project
            </h2>
          </div>
          {expandedCards.warrantyTimeline && (<div className="chart-container">
            {warrantyData.length > 0 ? (
              <div className="dashboard-chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={warrantyData} margin={{ top: 8, right: 18, left: 8, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={70}
                      tick={{ fill: '#334155', fontSize: 11 }}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip
                      formatter={(value, name, props) => {
                        if (name === 'Elapsed') {
                          return [`${value}%`, name];
                        }
                        if (name === 'Remaining') {
                          return [`${value}%`, name];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Project: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="elapsed" stackId="warranty" name="Elapsed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="remaining" stackId="warranty" name="Remaining" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <p>No warranty data available</p>
              </div>
            )}
          </div>)}
        </div>
        {/* Peripheral Type Distribution */}
        <div className="chart-card">
          <div 
            className="chart-header"
            onClick={() => toggleCard('peripheralDistribution')}
            style={{
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title={expandedCards.peripheralDistribution ? 'Click to minimize' : 'Click to maximize'}
          >
            <h2 className="chart-title">
              <Monitor size={24} className="chart-icon" />
              Peripheral Type Distribution
            </h2>
          </div>
          {expandedCards.peripheralDistribution && (<div className="chart-container">
            {peripheralData.length > 0 ? (
              <div className="dashboard-chart-wrapper">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={peripheralData}
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      innerRadius={58}
                      dataKey="count"
                      nameKey="name"
                      paddingAngle={2}
                    >
                      {peripheralData.map((entry, index) => (
                        <Cell key={`peripheral-cell-${entry.name}`} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => [`${value} peripherals`, props?.payload?.name || name]} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🖱️</div>
                <p>No peripheral type data available</p>
              </div>
            )}
          </div>)}
        </div>
      </div>

      {/* Recent Activity Feed - Full Width Section */}
      <div className="chart-card" style={{ marginTop: '30px' }}>
        <div 
          className="chart-header"
          onClick={() => toggleCard('recentActivity')}
          style={{
            cursor: 'pointer',
            userSelect: 'none'
          }}
          title={expandedCards.recentActivity ? 'Click to minimize' : 'Click to maximize'}
        >
          <h2 className="chart-title">
            <Activity size={24} className="chart-icon" />
            Recent Activity
          </h2>
        </div>

        {expandedCards.recentActivity && (recentActivity && recentActivity.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.map((activity, index) => {
              // Helper function to get icon and color based on activity type
              const getActivityIcon = (type) => {
                switch(type) {
                  case 'asset_created':
                    return { icon: <CheckCircle size={20} />, color: '#10b981', bgColor: '#d1fae5' };
                  case 'asset_updated':
                    return { icon: <Edit size={20} />, color: '#3b82f6', bgColor: '#dbeafe' };
                  case 'asset_deleted':
                    return { icon: <Trash size={20} />, color: '#ef4444', bgColor: '#fee2e2' };
                  case 'pm_completed':
                    return { icon: <Clock size={20} />, color: '#8b5cf6', bgColor: '#ede9fe' };
                  case 'project_created':
                    return { icon: <CheckCircle size={20} />, color: '#06b6d4', bgColor: '#cffafe' };
                  default:
                    return { icon: <Activity size={20} />, color: '#6b7280', bgColor: '#f3f4f6' };
                }
              };

              // Helper function to format relative time
              const getRelativeTime = (timestamp) => {
                const now = new Date();
                const activityTime = new Date(timestamp);
                const diffMs = now - activityTime;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                return activityTime.toLocaleDateString();
              };

              const { icon, color, bgColor } = getActivityIcon(activity.activityType);

              return (
                <div 
                  key={index} 
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    transition: 'all 0.2s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fafafa';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  {/* Activity Icon */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: bgColor,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {icon}
                  </div>

                  {/* Activity Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#111827',
                      fontWeight: '500',
                      marginBottom: '4px',
                      lineHeight: '1.4'
                    }}>
                      {activity.description}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>{activity.entityType}: {activity.entityName}</span>
                      {activity.userName && (
                        <>
                          <span>•</span>
                          <span>by {activity.userName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    flexShrink: 0,
                    textAlign: 'right'
                  }}>
                    {getRelativeTime(activity.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Activity size={48} /></div>
            <p>No recent activity to display</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;