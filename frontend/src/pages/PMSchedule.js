import React, { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Building2, FileText, AlertCircle, CheckCircle, Wrench, Package, Edit, ArrowLeft } from 'lucide-react';
import { API_URL } from '../config/api';
import PMScheduleEditModal from '../components/PMScheduleEditModal';
import pmScheduleService from '../services/pmScheduleService';
import toast from '../utils/toast';

const PMSchedule = () => {
  usePageTitle('PM Schedule');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [pmRecords, setPMRecords] = useState([]);
  const [expandedSchedules, setExpandedSchedules] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchPMSchedules();
    fetchPMRecords();
    fetchProjects();
  }, [selectedYear]);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchPMSchedules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/projects/pm-schedules?year=${selectedYear}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch PM schedules');
      
      const data = await response.json();
      setSchedules(data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching PM schedules:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchPMRecords = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/pm`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Filter PM records for the selected year with Status = 'Completed'
        const yearRecords = (data.data || []).filter(pm => {
          const pmDate = new Date(pm.PM_Date);
          return pmDate.getFullYear() === selectedYear && pm.PM_Status === 'Completed';
        });
        setPMRecords(yearRecords);
      }
    } catch (error) {
      console.error('Error fetching PM records:', error);
    }
  };

  const getScheduleForMonth = (monthIndex) => {
    const monthSchedules = [];
    
    // Show PMs in their SCHEDULED month only (no extended range)
    // Example: PM scheduled Jan 25 → shows in January view only
    // The +1 month buffer is for completion tracking (backend handles this)
    // This prevents duplicates - each PM appears in only ONE month view
    const year = selectedYear;
    const monthStart = new Date(year, monthIndex, 1); // First day of month
    const monthEnd = new Date(year, monthIndex + 1, 0); // Last day of month
    
    schedules.forEach(project => {
      project.pmDates.forEach(pmDateInfo => {
        const date = new Date(pmDateInfo.date);
        
        // Include PM only if scheduled within this specific month
        if (date >= monthStart && date <= monthEnd) {
          const pmInfo = pmDateInfo.pmInfo;
          
          monthSchedules.push({
            ...project,
            scheduledDate: pmDateInfo.date,
            completed: pmInfo?.Status === 'Completed',
            inProgress: pmInfo?.Status === 'In-Process',
            completionPercentage: pmInfo?.completionPercentage,
            pmCount: pmInfo?.pmCount,
            totalAssets: pmInfo?.totalAssets,
            branchStats: pmInfo?.branchStats || [],
            isCustom: pmDateInfo.isCustom || false,
            scheduleId: pmDateInfo.scheduleId,
            notes: pmDateInfo.notes
          });
        }
      });
    });

    return monthSchedules;
  };

  const getMonthStatus = (monthIndex) => {
    const schedules = getScheduleForMonth(monthIndex);
    if (schedules.length === 0) return 'none';
    
    const allCompleted = schedules.every(s => s.completed);
    const someCompleted = schedules.some(s => s.completed || s.inProgress);
    
    if (allCompleted) return 'completed';
    if (someCompleted) return 'partial';
    return 'pending';
  };

  const handlePreviousYear = () => {
    setSelectedYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setSelectedYear(prev => prev + 1);
  };

  const goToPreventiveMaintenance = () => {
    navigate('/pm');
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule({
      projectId: schedule.Project_ID,
      projectTitle: schedule.Project_Title,
      customerName: schedule.Customer_Name,
      date: schedule.scheduledDate,
      scheduleId: schedule.scheduleId // Will be undefined for non-custom schedules
    });
    setEditModalOpen(true);
  };

  const handleCreateSchedule = async (createData) => {
    try {
      await pmScheduleService.createSchedule(
        createData.projectId,
        createData.scheduledDate,
        createData.notes
      );
      
      setCreateModalOpen(false);
      await fetchPMSchedules();
      toast.success('PM schedule created successfully!');
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  };

  const handleSaveSchedule = async (data) => {
    try {
      if (data.type === 'individual') {
        await pmScheduleService.upsertSchedule(data.projectId, data.scheduledDate, data.notes);
      } else if (data.type === 'auto') {
        await pmScheduleService.autoReschedule(data.projectId, data.startDate, data.frequency);
      } else if (data.type === 'delete') {
        await pmScheduleService.deleteSchedule(data.scheduleId);
      } else if (data.type === 'reset') {
        await pmScheduleService.resetToCalculated(data.projectId);
      }
      
      // Refresh schedules after save
      await fetchPMSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px 30px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <Clock size={48} color="#3498db" style={{ marginBottom: '15px', animation: 'spin 2s linear infinite' }} />
          <p style={{ color: '#666', fontSize: '1.1rem' }}>Loading PM schedules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px 30px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <AlertCircle size={48} color="#e74c3c" style={{ marginBottom: '15px' }} />
          <p style={{ color: '#e74c3c', fontSize: '1.1rem' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 30px', maxWidth: '100%', margin: '0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '3px solid #667eea'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={goToPreventiveMaintenance}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: 'rgba(102, 126, 234, 0.1)',
              color: '#667eea',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
              e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
              e.target.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            }}
          >
            <ArrowLeft size={18} />
            Back to PM
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, marginLeft: '20px' }}>
          <Calendar size={32} color="#667eea" />
          <div>
            <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.8rem' }}>
              PM Schedule Calendar
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '0.95rem' }}>
              Plan and track preventive maintenance schedules
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          style={{
            padding: '10px 20px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = '#229954'}
          onMouseOut={(e) => e.target.style.background = '#27ae60'}
        >
          <Calendar size={18} />
          Add PM Schedule
        </button>
      </div>

      {/* Year Selector */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handlePreviousYear}
            style={{
              padding: '10px 20px',
              background: '#ecf0f1',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#bdc3c7'}
            onMouseOut={(e) => e.target.style.background = '#ecf0f1'}
          >
            <ChevronLeft size={20} />
            Previous
          </button>
          
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#2c3e50', fontWeight: '700' }}>
            {selectedYear}
          </h3>
          
          <button
            onClick={handleNextYear}
            style={{
              padding: '10px 20px',
              background: '#ecf0f1',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#bdc3c7'}
            onMouseOut={(e) => e.target.style.background = '#ecf0f1'}
          >
            Next
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Scheduled PMs</p>
              <h3 style={{ margin: '5px 0 0 0', fontSize: '2rem', fontWeight: '700' }}>
                {schedules.reduce((sum, s) => sum + s.pmDates.length, 0)}
              </h3>
            </div>
            <Calendar size={40} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Completed</p>
              <h3 style={{ margin: '5px 0 0 0', fontSize: '2rem', fontWeight: '700' }}>
                {schedules.reduce((sum, s) => sum + s.pmDates.filter(d => d.pmInfo?.Status === 'Completed').length, 0)}
              </h3>
            </div>
            <CheckCircle size={40} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>In Progress</p>
              <h3 style={{ margin: '5px 0 0 0', fontSize: '2rem', fontWeight: '700' }}>
                {schedules.reduce((sum, s) => sum + s.pmDates.filter(d => d.pmInfo?.Status === 'In-Process').length, 0)}
              </h3>
            </div>
            <Wrench size={40} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Pending</p>
              <h3 style={{ margin: '5px 0 0 0', fontSize: '2rem', fontWeight: '700' }}>
                {schedules.reduce((sum, s) => sum + s.pmDates.filter(d => !d.pmInfo).length, 0)}
              </h3>
            </div>
            <Clock size={40} style={{ opacity: 0.8 }} />
          </div>
        </div>
      </div>

      {/* Monthly Calendar Grid */}
      <div className="card">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {months.map((month, index) => {
            const monthSchedules = getScheduleForMonth(index);
            const status = getMonthStatus(index);
            const isCurrentMonth = index === currentMonth && selectedYear === currentYear;
            const isPastMonth = selectedYear < currentYear || (selectedYear === currentYear && index < currentMonth);

            let borderColor = '#e0e0e0';
            if (status === 'completed') borderColor = '#27ae60';
            else if (status === 'partial') borderColor = '#f39c12';
            else if (status === 'pending') borderColor = '#e74c3c';

            return (
              <div
                key={month}
                style={{
                  padding: '15px',
                  border: `2px solid ${borderColor}`,
                  borderRadius: '12px',
                  background: isCurrentMonth ? '#f0f8ff' : 'white',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}
              >
                {/* Month Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  paddingBottom: '10px',
                  borderBottom: `2px solid ${borderColor}`
                }}>
                  <h4 style={{ margin: 0, color: '#2c3e50', fontSize: '1.1rem', fontWeight: '700' }}>
                    {month}
                  </h4>
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: monthSchedules.length > 0 ? '#e3f2fd' : '#f5f5f5',
                    color: monthSchedules.length > 0 ? '#1976d2' : '#999'
                  }}>
                    {monthSchedules.length} {monthSchedules.length === 1 ? 'PM' : 'PMs'}
                  </div>
                </div>

                {/* PM List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {monthSchedules.length > 0 ? (
                    monthSchedules.map((schedule, idx) => {
                      const isOverdue = !schedule.completed && !schedule.inProgress && isPastMonth;
                      
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '10px',
                            background: schedule.completed ? '#d4edda' : schedule.inProgress ? '#d1ecf1' : isOverdue ? '#f8d7da' : '#fff3cd',
                            borderRadius: '8px',
                            border: `1px solid ${schedule.completed ? '#c3e6cb' : schedule.inProgress ? '#bee5eb' : isOverdue ? '#f5c6cb' : '#ffeaa7'}`,
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            {schedule.completed ? (
                              <CheckCircle size={16} color="#28a745" style={{ flexShrink: 0, marginTop: '2px' }} />
                            ) : schedule.inProgress ? (
                              <Clock size={16} color="#17a2b8" style={{ flexShrink: 0, marginTop: '2px' }} />
                            ) : isOverdue ? (
                              <AlertCircle size={16} color="#dc3545" style={{ flexShrink: 0, marginTop: '2px' }} />
                            ) : (
                              <Clock size={16} color="#ffc107" style={{ flexShrink: 0, marginTop: '2px' }} />
                            )}
                            <div style={{ flex: 1 }}>
                              {schedule.Customer_Name && (
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  marginBottom: '3px'
                                }}>
                                  <div style={{ fontWeight: '600', color: '#2c3e50', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                                    {schedule.Customer_Name}
                                    {schedule.isCustom && (
                                      <span style={{
                                        fontSize: '0.65rem',
                                        fontWeight: '600',
                                        padding: '2px 6px',
                                        borderRadius: '8px',
                                        background: '#667eea',
                                        color: 'white'
                                      }}>
                                        Custom
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditSchedule(schedule);
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid #999',
                                      borderRadius: '4px',
                                      padding: '4px 8px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '0.7rem',
                                      color: '#666',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#667eea';
                                      e.currentTarget.style.borderColor = '#667eea';
                                      e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.borderColor = '#999';
                                      e.currentTarget.style.color = '#666';
                                    }}
                                  >
                                    <Edit size={12} />
                                  </button>
                                </div>
                              )}
                              <div style={{ color: '#999', fontSize: '0.75rem', marginTop: '4px' }}>
                                Scheduled: {new Date(schedule.scheduledDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                              {/* Completion Percentage - Show for both In-Progress and Completed */}
                              {(schedule.inProgress || schedule.completed) && schedule.completionPercentage != null && (
                                <div style={{ marginTop: '6px' }}>
                                  <div style={{ fontSize: '0.7rem', color: '#666', marginBottom: '3px', fontWeight: '600' }}>
                                    Overall: {schedule.pmCount || 0}/{schedule.totalAssets || 0} PMs completed
                                  </div>
                                  <div 
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px',
                                      cursor: schedule.branchStats && schedule.branchStats.length > 0 ? 'pointer' : 'default'
                                    }}
                                    onClick={() => {
                                      if (schedule.branchStats && schedule.branchStats.length > 0) {
                                        const key = `${schedule.Project_ID}-${schedule.scheduledDate}`;
                                        setExpandedSchedules(prev => ({
                                          ...prev,
                                          [key]: !prev[key]
                                        }));
                                      }
                                    }}
                                  >
                                    <div style={{ 
                                      flex: 1, 
                                      height: '6px', 
                                      background: '#e0e0e0', 
                                      borderRadius: '3px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${schedule.completionPercentage}%`,
                                        height: '100%',
                                        background: schedule.completionPercentage === 100 ? '#28a745' : schedule.completionPercentage >= 50 ? '#17a2b8' : '#ffc107',
                                        transition: 'width 0.3s ease'
                                      }} />
                                    </div>
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      fontWeight: '600',
                                      color: schedule.completionPercentage === 100 ? '#28a745' : '#666',
                                      minWidth: '35px',
                                      textAlign: 'right'
                                    }}>
                                      {schedule.completionPercentage}%
                                    </span>
                                    {schedule.branchStats && schedule.branchStats.length > 0 && (
                                      expandedSchedules[`${schedule.Project_ID}-${schedule.scheduledDate}`] ? 
                                        <ChevronUp size={14} color="#666" /> : 
                                        <ChevronDown size={14} color="#666" />
                                    )}
                                  </div>

                                  {/* Branch-level breakdown - Expandable */}
                                  {schedule.branchStats && schedule.branchStats.length > 0 && expandedSchedules[`${schedule.Project_ID}-${schedule.scheduledDate}`] && (
                                    <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e0e0e0' }}>
                                      <div style={{ fontSize: '0.65rem', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        By Branch
                                      </div>
                                      {schedule.branchStats.map((branch, idx) => (
                                        <div key={idx} style={{ marginBottom: '4px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: '#666', marginBottom: '2px' }}>
                                            <span style={{ fontWeight: '500' }}>{branch.branch || 'N/A'}</span>
                                            <span>{branch.pmCount}/{branch.totalAssets} ({branch.completionPercentage}%)</span>
                                          </div>
                                          <div style={{ 
                                            height: '3px', 
                                            background: '#e0e0e0', 
                                            borderRadius: '2px',
                                            overflow: 'hidden'
                                          }}>
                                            <div style={{
                                              width: `${branch.completionPercentage}%`,
                                              height: '100%',
                                              background: branch.completionPercentage === 100 ? '#28a745' : branch.completionPercentage >= 50 ? '#17a2b8' : '#ffc107',
                                              transition: 'width 0.3s ease'
                                            }} />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Status Badge */}
                              {(schedule.completed || schedule.inProgress) && (
                                <div style={{ marginTop: '6px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                    background: schedule.completed ? '#28a745' : '#17a2b8',
                                    color: 'white'
                                  }}>
                                    {schedule.completed ? 'Completed' : 'In Progress'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: '#999', fontSize: '0.85rem', textAlign: 'center', margin: '20px 0', fontStyle: 'italic' }}>
                      No PM scheduled
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '1rem' }}>Legend</h4>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} color="#28a745" />
            <span style={{ fontSize: '0.9rem', color: '#666' }}>Completed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#17a2b8" />
            <span style={{ fontSize: '0.9rem', color: '#666' }}>In Progress</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} color="#dc3545" />
            <span style={{ fontSize: '0.9rem', color: '#666' }}>Overdue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#ffc107" />
            <span style={{ fontSize: '0.9rem', color: '#666' }}>Upcoming</span>
          </div>
        </div>
      </div>
      
      {/* Edit Modal */}
      <PMScheduleEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingSchedule(null);
        }}
        scheduleData={editingSchedule}
        onSave={handleSaveSchedule}
      />
      
      {/* Create Modal */}
      {createModalOpen && (
        <CreatePMScheduleModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          projects={projects}
          onSave={handleCreateSchedule}
        />
      )}
    </div>
  );
};

// Create PM Schedule Modal Component
const CreatePMScheduleModal = ({ isOpen, onClose, projects, onSave }) => {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedProjectId || !scheduledDate) {
      toast.error('Please select a project and date');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        projectId: selectedProjectId,
        scheduledDate,
        notes
      });
      
      // Reset form
      setSelectedProjectId('');
      setScheduledDate('');
      setNotes('');
    } catch (error) {
      toast.error(error.message || 'Failed to create schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProject = projects.find(p => p.Project_ID === parseInt(selectedProjectId));

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={24} color="#27ae60" />
            Add PM Schedule
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#7f8c8d',
              padding: '0',
              width: '30px',
              height: '30px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>
            Select Project *
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem'
            }}
          >
            <option value="">-- Select Project --</option>
            {projects.map(project => (
              <option key={project.Project_ID} value={project.Project_ID}>
                {project.Customer_Name}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '6px', 
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            <div><strong>Customer:</strong> {selectedProject.Customer_Name}</div>
            <div><strong>Ref:</strong> {selectedProject.Project_Ref_Number}</div>
            <div><strong>Frequency:</strong> {selectedProject.Preventive_Maintenance}x per year</div>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>
            Scheduled Date *
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem'
            }}
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this PM schedule..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '10px 20px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !selectedProjectId || !scheduledDate}
            style={{
              padding: '10px 20px',
              background: selectedProjectId && scheduledDate ? '#27ae60' : '#bdc3c7',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedProjectId && scheduledDate ? 'pointer' : 'not-allowed',
              fontWeight: '600'
            }}
          >
            {isSaving ? 'Creating...' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PMSchedule;
