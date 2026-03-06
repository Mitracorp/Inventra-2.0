import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, Users, TrendingUp, BarChart3, AlertCircle, LayoutDashboard, Activity, Clock, CheckCircle, XCircle, Edit, Trash, Monitor, DollarSign, Calendar } from 'lucide-react';
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
    deviceAnalysis: false,
    customerDistribution: false,
    modelDistribution: false,
    revenueByCategory: false,
    warrantyTimeline: false,
    peripheralDistribution: false,
    recentActivity: false
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
  const { stats, customerAssetData, modelData, revenueByCategory, warrantyByProject, peripheralTypeDistribution, customerDistribution, customersByCategory, recentAssets } = dashboardData || {};
  const { totalAssets = 0, activeAssets = 0, totalCustomers = 0, totalValue = 0, totalPeripherals = 0 } = stats || {};

  const maxDevices = customerAssetData?.length > 0
    ? Math.max(...customerAssetData.map(item => parseInt(item.devices)))
    : 0;

  const maxModels = modelData?.length > 0
    ? Math.max(...modelData.map(item => item.count))
    : 0;

  const maxPeripheralCount = peripheralTypeDistribution?.length > 0
    ? Math.max(...peripheralTypeDistribution.map(item => item.count))
    : 0;

  const maxRevenue = revenueByCategory?.length > 0
    ? Math.max(...revenueByCategory.map(item => item.revenue))
    : 0;

  // Find max total assets across all customers for scaling
  const maxCustomerAssets = customersByCategory && Object.keys(customersByCategory).length > 0
    ? Math.max(...Object.values(customersByCategory).map(c => c.total))
    : 0;

  // Dynamically generate category colors based on actual categories in the data
  const getCategoryColors = () => {
    if (!customersByCategory || Object.keys(customersByCategory).length === 0) {
      return {};
    }

    // Extract all unique categories from the data
    const uniqueCategories = new Set();
    Object.values(customersByCategory).forEach(customerData => {
      customerData.categories.forEach(cat => {
        uniqueCategories.add(cat.category);
      });
    });

    // Define a color palette
    const colorPalette = [
      '#60a5fa', // Light Blue
      '#34d399', // Green
      '#a78bfa', // Purple
      '#f87171', // Red
      '#fbbf24', // Yellow
      '#fb923c', // Orange
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#8b5cf6', // Violet
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#6366f1', // Indigo
      '#ef4444', // Rose
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#d946ef', // Fuchsia
    ];

    // Assign colors to categories
    const categoryColors = {};
    Array.from(uniqueCategories).sort().forEach((category, index) => {
      categoryColors[category] = colorPalette[index % colorPalette.length];
    });

    return categoryColors;
  };

  const categoryColors = getCategoryColors();

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
        <div className="stat-card">
          <div className="stat-icon">
            <Package size={40} />
          </div>
          <div className="stat-info">
            <div className="stat-number">{totalAssets}</div>
            <div className="stat-label">Total Assets</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Users size={40} />
          </div>
          <div className="stat-info">
            <div className="stat-number">{totalCustomers}</div>
            <div className="stat-label">Total Customers</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={40} />
          </div>
          <div className="stat-info">
            <div className="stat-number">{activeAssets}</div>
            <div className="stat-label">Active Assets</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <BarChart3 size={40} />
          </div>
          <div className="stat-info">
            <div className="stat-number" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              <span style={{ 
                fontSize: '0.5em', 
                fontWeight: '900',
                background: 'rgba(107, 114, 128, 0.12)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                color: '#000000',
                padding: '4px 8px',
                borderRadius: '6px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                display: 'inline-block',
                lineHeight: '1.2'
              }}>RM</span>
              <span style={{ letterSpacing: '1px' }}>{totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="stat-label">Total Value</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Monitor size={40} />
          </div>
          <div className="stat-info">
            <div className="stat-number">{totalPeripherals}</div>
            <div className="stat-label">Total Peripherals</div>
          </div>
        </div>
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
            {customerAssetData && customerAssetData.length > 0 ? (
              customerAssetData.map((item, index) => (
                <div key={index} className="chart-bar-item" style={{ '--index': index }}>
                  <div className="chart-bar-info">
                    <span className="customer-name">{item.customer}</span>
                    <span className="device-count">{item.devices} devices</span>
                  </div>
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar"
                      style={{
                        width: `${(parseInt(item.devices) / maxDevices) * 100}%`,
                        backgroundColor: `hsl(${200 + index * 30}, 70%, 50%)`
                      }}
                    ></div>
                  </div>
                </div>
              ))
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
            {customersByCategory && Object.entries(customersByCategory).length > 0 ? (
              Object.entries(customersByCategory).map(([customerName, data], index) => (
                <div key={index} className="chart-bar-item" style={{ '--index': index }}>
                  <div className="chart-bar-info">
                    <span className="customer-name">{customerName}</span>
                    <span className="device-count">{data.total} {data.total === 1 ? 'asset' : 'assets'}</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    width: '100%', 
                    height: '32px',
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    backgroundColor: '#f3f4f6',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    {data.categories.map((cat, catIndex) => {
                      const percentage = (cat.count / data.total) * 100;
                      const color = categoryColors[cat.category] || '#94a3b8';
                      return (
                        <div
                          key={catIndex}
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                            minWidth: percentage > 0 ? '2px' : '0',
                            borderRight: catIndex < data.categories.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none'
                          }}
                          title={`${cat.category}: ${cat.count} assets (${percentage.toFixed(1)}%)`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.85';
                            e.currentTarget.style.transform = 'scaleY(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'scaleY(1)';
                          }}
                        >
                          {percentage > 8 && (
                            <span style={{ 
                              color: 'white', 
                              fontSize: '11px', 
                              fontWeight: '700',
                              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                              userSelect: 'none'
                            }}>
                              {cat.count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <p>No customer distribution data available</p>
              </div>
            )}
            
            {/* Category Legend */}
            {customersByCategory && Object.keys(customersByCategory).length > 0 && Object.keys(categoryColors).length > 0 && (
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '15px', 
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                {Object.entries(categoryColors).sort(([a], [b]) => a.localeCompare(b)).map(([category, color]) => (
                  <div key={category} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: color,
                      borderRadius: '3px'
                    }}></div>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>{category}</span>
                  </div>
                ))}
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
            {modelData && modelData.length > 0 ? (
              modelData.slice(0, 10).map((item, index) => (
                <div key={index} className="chart-bar-item" style={{ '--index': index }}>
                  <div className="chart-bar-info">
                    <span className="customer-name">{item.model}</span>
                    <span className="device-count">{item.count} {item.count === 1 ? 'asset' : 'assets'}</span>
                  </div>
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar"
                      style={{
                        width: `${(item.count / maxModels) * 100}%`,
                        backgroundColor: `hsl(${280 + index * 25}, 65%, 55%)`
                      }}
                    ></div>
                  </div>
                </div>
              ))
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
            {revenueByCategory && revenueByCategory.length > 0 ? (
              revenueByCategory.map((item, index) => (
                <div key={index} className="chart-bar-item" style={{ '--index': index }}>
                  <div className="chart-bar-info">
                    <span className="customer-name">{item.category}</span>
                    <span className="device-count">RM {item.revenue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({item.count} {item.count === 1 ? 'asset' : 'assets'})</span>
                  </div>
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar"
                      style={{
                        width: `${(item.revenue / maxRevenue) * 100}%`,
                        background: `linear-gradient(90deg, hsl(${140 + index * 20}, 70%, 50%), hsl(${140 + index * 20}, 70%, 60%))`
                      }}
                    ></div>
                  </div>
                </div>
              ))
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
            {warrantyByProject && warrantyByProject.length > 0 ? (
              warrantyByProject.map((item, index) => {
                const progressPct = Number(item.warrantyProgress) || 0;
                const remainingPct = Number(item.warrantyRemainingPercentage) || 0;
                const daysLeft = Number(item.daysRemaining) || 0;
                const isExpired = progressPct >= 100;
                const isExpiringSoon = remainingPct > 0 && remainingPct < 20;
                const barColor = isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#10b981';
                
                return (
                  <div key={index} className="chart-bar-item" style={{ '--index': index }}>
                    <div className="chart-bar-info">
                      <span className="customer-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                        <span style={{ fontWeight: '600' }}>{item.customer}</span>
                        <span style={{ fontSize: '0.85em', opacity: 0.7 }}>{item.refNumber} • {item.assetCount} asset{item.assetCount !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="device-count" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.9em',
                          fontWeight: '700',
                          color: barColor
                        }}>
                          {progressPct.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: '0.85em', opacity: 0.8 }}>
                          {isExpired ? 'Expired' : `${daysLeft} days left`}
                        </span>
                      </span>
                    </div>
                    <div className="chart-bar-container">
                      <div
                        className="chart-bar"
                        style={{
                          width: `${Math.min(Math.max(progressPct, 2), 100)}%`,
                          background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                          transition: 'all 0.3s ease'
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })
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
            {peripheralTypeDistribution && peripheralTypeDistribution.length > 0 ? (
              peripheralTypeDistribution.map((item, index) => (
                <div key={index} className="chart-bar-item" style={{ '--index': index }}>
                  <div className="chart-bar-info">
                    <span className="customer-name">{item.peripheralType}</span>
                    <span className="device-count">{item.count} peripheral{item.count !== 1 ? 's' : ''} ({item.assetCount} asset{item.assetCount !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="chart-bar-container">
                    <div className="chart-bar" style={{
                      width: `${(item.count / maxPeripheralCount) * 100}%`,
                      background: `linear-gradient(90deg, hsl(${180 + index * 20}, 65%, 55%), hsl(${180 + index * 20}, 65%, 65%))`
                    }}></div>
                  </div>
                </div>
              ))
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