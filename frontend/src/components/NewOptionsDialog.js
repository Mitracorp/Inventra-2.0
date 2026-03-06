import React from 'react';
import { Package, Cpu, HardDrive, Monitor, FileText, AlertCircle, CheckCircle } from 'lucide-react';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    animation: 'fadeIn 0.2s ease-in-out'
  },
  dialog: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    maxWidth: '700px',
    width: '90%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '28px 32px 24px',
    borderBottom: '2px solid #f3f4f6',
    background: 'linear-gradient(135deg, #fef3c7 0%, #fef3c7 100%)'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px'
  },
  headerTitle: {
    margin: '0 0 8px 0',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2937'
  },
  headerText: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#6b7280',
    lineHeight: 1.5
  },
  body: {
    padding: '24px 32px',
    overflowY: 'auto',
    flex: 1
  },
  infoBadge: {
    background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
    borderLeft: '4px solid #3b82f6',
    padding: '14px 18px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '0.9rem',
    color: '#1e40af',
    lineHeight: 1.5,
    marginBottom: '24px'
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  optionSection: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    overflow: 'hidden',
    transition: 'all 0.2s ease'
  },
  optionSectionHeader: {
    background: '#f9fafb',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderLeft: '4px solid transparent'
  },
  optionSectionTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#374151'
  },
  optionItems: {
    padding: '12px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'white'
  },
  optionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: '#f9fafb',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#4b5563',
    transition: 'all 0.15s ease'
  },
  optionItemText: {
    fontWeight: 500
  },
  footer: {
    padding: '20px 32px',
    borderTop: '2px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    background: '#fafafa'
  },
  btnCancel: {
    padding: '11px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#e5e7eb',
    color: '#4b5563'
  },
  btnConfirm: {
    padding: '11px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  }
};

const NewOptionsDialog = ({ newOptions, onConfirm, onCancel }) => {
  if (!newOptions) {
    console.warn('NewOptionsDialog: newOptions is null or undefined');
    return null;
  }

  const { categories = [], models = [], software = [], windows = [], office = [] } = newOptions;
  
  const totalNewOptions = 
    categories.length + 
    models.length + 
    software.length + 
    windows.length + 
    office.length;

  console.log('NewOptionsDialog rendering with:', { 
    totalNewOptions, 
    categories: categories.length,
    models: models.length,
    software: software.length,
    windows: windows.length,
    office: office.length
  });

  if (totalNewOptions === 0) {
    console.log('NewOptionsDialog: No new options to display');
    return null;
  }

  const OptionSection = ({ icon: Icon, title, items, color }) => {
    if (items.length === 0) return null;

    return (
      <div style={styles.optionSection}>
        <div style={{...styles.optionSectionHeader, borderLeftColor: color}}>
          <Icon size={18} color={color} />
          <h4 style={styles.optionSectionTitle}>{title} ({items.length})</h4>
        </div>
        <div style={styles.optionItems}>
          {items.map((item, index) => (
            <div key={index} style={styles.optionItem}>
              <CheckCircle size={14} color={color} />
              <span style={styles.optionItemText}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <AlertCircle size={28} color="#f59e0b" />
            <div>
              <h2 style={styles.headerTitle}>New Options Detected</h2>
              <p style={styles.headerText}>The following {totalNewOptions} new option{totalNewOptions !== 1 ? 's' : ''} will be created during import:</p>
            </div>
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.infoBadge}>
            <Package size={16} />
            <span>These options will be automatically added to the database and available for future use.</span>
          </div>

          <div style={styles.optionsContainer}>
            <OptionSection 
              icon={Package}
              title="Categories"
              items={categories}
              color="#10b981"
            />
            
            <OptionSection 
              icon={Cpu}
              title="Models"
              items={models}
              color="#3b82f6"
            />
            
            <OptionSection 
              icon={HardDrive}
              title="Software"
              items={software}
              color="#8b5cf6"
            />
            
            <OptionSection 
              icon={Monitor}
              title="Windows Versions"
              items={windows}
              color="#06b6d4"
            />
            
            <OptionSection 
              icon={FileText}
              title="Microsoft Office Versions"
              items={office}
              color="#f59e0b"
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button 
            style={styles.btnCancel}
            onClick={onCancel}
          >
            Cancel Import
          </button>
          <button 
            style={styles.btnConfirm}
            onClick={onConfirm}
          >
            <CheckCircle size={18} />
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewOptionsDialog;
