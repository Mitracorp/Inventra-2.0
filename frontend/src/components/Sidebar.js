import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderOpen, 
  Package, 
  ClipboardCheck,
  Wrench, 
  Settings,
  Activity,
  LogOut,
  User,
  Users,
  Menu,
  X
} from 'lucide-react';
import mitracorpLogo from '../assets/MitracorpLogo_full.png';

const Sidebar = ({ onLogout, onMinimizeChange }) => {
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isPMDeleteMode, setIsPMDeleteMode] = useState(false);
  const [showDeleteModeToast, setShowDeleteModeToast] = useState(false);

  useEffect(() => {
    // Get username and role from localStorage
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        setUsername(user.username || 'User');
        setUserRole(user.role || '');
      } catch (error) {
        setUsername('User');
        setUserRole('');
      }
    }
  }, []);

  // Listen for PM delete mode changes
  useEffect(() => {
    const checkDeleteMode = () => {
      const deleteMode = sessionStorage.getItem('pmDeleteMode') === 'true';
      setIsPMDeleteMode(deleteMode);
    };

    // Check on mount
    checkDeleteMode();

    // Listen for changes
    window.addEventListener('pmDeleteModeChange', checkDeleteMode);
    return () => window.removeEventListener('pmDeleteModeChange', checkDeleteMode);
  }, []);

  const handleShowDeleteModeToast = () => {
    if (isPMDeleteMode) {
      setShowDeleteModeToast(true);
      setTimeout(() => {
        setShowDeleteModeToast(false);
      }, 4000);
    }
  };

  const clearPMDeleteMode = () => {
    sessionStorage.removeItem('pmDeleteMode');
    window.dispatchEvent(new Event('pmDeleteModeChange'));
    setIsPMDeleteMode(false);
  };

  // Handle window resize to detect mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      if (newWidth >= 80 && newWidth <= 400) {
        setSidebarWidth(newWidth);
        // Update CSS variable for main content margin
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const toggleMinimize = () => {
    const newMinimizedState = !isMinimized;
    setIsMinimized(newMinimizedState);
    if (onMinimizeChange) {
      onMinimizeChange(newMinimizedState);
    }
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/projects', icon: FolderOpen, label: 'Projects' },
    { path: '/assets', icon: Package, label: 'Assets' },
    { path: '/uat', icon: ClipboardCheck, label: 'UAT' },
    { path: '/maintenance', icon: Wrench, label: 'Preventive Maintenance' },
    { path: '/solution-principal', icon: Users, label: 'Solution Principal' },
    { path: '/audit-log', icon: Activity, label: 'Audit Log' },
    { path: '/settings', icon: Settings, label: 'Account Settings' }
  ];

  // Helper function to check if user is customer-type role
  const isCustomerRole = () => {
    if (!userRole) return false;
    const roleLower = userRole.toLowerCase();
    return roleLower !== 'admin' && roleLower !== 'staff';
  };

  // Filter nav items based on role
  const filteredNavItems = isCustomerRole() 
    ? navItems.filter(item => 
        ['/projects', '/assets', '/uat', '/maintenance', '/settings'].includes(item.path)
      )
    : navItems;


  return (
    <>
      {/* Mobile Hamburger Button */}
      {isMobile && (
        <button
          className="mobile-menu-toggle"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          style={{
            position: 'fixed',
            top: '15px',
            left: '15px',
            zIndex: 1002,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isMobileOpen ? <X size={24} color="white" /> : <Menu size={24} color="white" />}
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobile && isMobileOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            animation: 'fadeIn 0.3s ease'
          }}
        />
      )}

      <div 
        className={`sidebar ${isMinimized ? 'minimized' : ''} ${isMobile ? 'mobile' : ''} ${isMobileOpen ? 'mobile-open' : ''}`} 
        style={{ 
          width: isMobile ? '280px' : `${sidebarWidth}px`, 
          transition: isResizing ? 'none' : 'all 0.3s ease',
          transform: isMobile && !isMobileOpen ? 'translateX(-100%)' : 'translateX(0)'
        }}>
      <div className="sidebar-header">
        {sidebarWidth < 150 ? (
          <div className="sidebar-logo-compact-wrap">
            <img
              src={mitracorpLogo}
              alt="Mitracorp"
              className="sidebar-logo-image sidebar-logo-image-minimized"
            />
            <div className="sidebar-logo" style={{ textAlign: 'center', fontSize: '20px', marginBottom: 0 }}>I</div>
          </div>
        ) : (
          <>
            <img
              src={mitracorpLogo}
              alt="Mitracorp"
              className="sidebar-logo-image"
            />
            <div className="sidebar-logo">Inventra</div>
            <div className="sidebar-subtitle">Asset Management System</div>
          </>
        )}
      </div>
      
      <nav className="sidebar-nav">
        <div className="sidebar-main-nav">
          {filteredNavItems.map((item) => {
            const IconComponent = item.icon;
            // Highlight Assets when on root path "/" or "/assets"
            const isActive = location.pathname === item.path || 
                            (item.path === '/assets' && location.pathname === '/');
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={sidebarWidth < 150 ? item.label : ''}
                style={{
                  justifyContent: sidebarWidth < 150 ? 'center' : 'flex-start',
                  padding: sidebarWidth < 150 ? '12px' : '12px 20px',
                  cursor: isPMDeleteMode ? 'not-allowed' : 'pointer'
                }}
                onClick={(e) => {
                  if (isPMDeleteMode) {
                    clearPMDeleteMode();
                  }
                }}
              >
                <IconComponent className="nav-icon" />
                {sidebarWidth >= 150 && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
        
        <div className="sidebar-bottom-nav" style={{ borderTop: 'none', paddingTop: '0' }}>
          <div 
            className="nav-item user-item"
            title={sidebarWidth < 150 ? username : ''}
            style={{
              justifyContent: sidebarWidth < 150 ? 'center' : 'flex-start',
              padding: sidebarWidth < 150 ? '12px' : '12px 20px'
            }}
          >
            <User className="nav-icon" />
            {sidebarWidth >= 150 && <span>{username}</span>}
          </div>

          <button
            type="button"
            onClick={() => {
              if (isPMDeleteMode) {
                clearPMDeleteMode();
              }
              onLogout();
            }}
            className="logout-action-btn"
            title={sidebarWidth < 150 ? 'Logout' : ''}
            style={{
              justifyContent: sidebarWidth < 150 ? 'center' : 'center',
              padding: sidebarWidth < 150 ? '12px' : '12px 18px'
            }}
          >
            <LogOut className="nav-icon" />
            {sidebarWidth >= 150 && <span>Logout</span>}
          </button>
        </div>
      </nav>
      
      {/* Resize Handle - Hidden on mobile */}
      {!isMobile && (
        <div 
          className="sidebar-resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            cursor: 'ew-resize',
            backgroundColor: isResizing ? 'rgba(52, 152, 219, 0.5)' : 'transparent',
            transition: 'background-color 0.2s ease',
            zIndex: 1001
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(52, 152, 219, 0.3)'}
          onMouseLeave={(e) => !isResizing && (e.currentTarget.style.backgroundColor = 'transparent')}
        />
      )}
    </div>

    {/* Delete Mode Toast Notification */}
    {showDeleteModeToast && (
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10001,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: '14px',
          minWidth: '320px',
          animation: 'slideIn 0.3s ease-out'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Delete Mode Active</div>
            <div style={{ opacity: 0.9, fontSize: '13px' }}>Navigating or logging out will now exit delete mode automatically.</div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteModeToast(false);
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '20px',
            padding: 0,
            width: '24px',
            height: '24px',
            lineHeight: '1'
          }}
        >×</button>
      </div>
    )}

    <style>{`
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `}</style>
    </>
  );
};

export default Sidebar;