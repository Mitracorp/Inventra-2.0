import React, { useState } from 'react';
import { Calendar, Save, X, Trash2, RotateCcw } from 'lucide-react';
import './PMScheduleEditModal.css';

const PMScheduleEditModal = ({ 
  isOpen, 
  onClose, 
  scheduleData, 
  onSave 
}) => {
  const [editedDate, setEditedDate] = useState(scheduleData?.date || '');
  const [notes, setNotes] = useState('');
  const [isAutoReschedule, setIsAutoReschedule] = useState(false);
  const [autoStartDate, setAutoStartDate] = useState('');
  const [autoFrequency, setAutoFrequency] = useState(2);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveIndividual = async () => {
    if (!editedDate) return;
    
    setIsSaving(true);
    try {
      await onSave({
        type: 'individual',
        projectId: scheduleData.projectId,
        scheduledDate: editedDate,
        notes: notes
      });
      onClose();
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoReschedule = async () => {
    if (!autoStartDate || !autoFrequency) return;
    
    console.log('Auto-reschedule triggered with:', {
      projectId: scheduleData.projectId,
      startDate: autoStartDate,
      frequency: parseInt(autoFrequency)
    });
    
    setIsSaving(true);
    try {
      await onSave({
        type: 'auto',
        projectId: scheduleData.projectId,
        startDate: autoStartDate,
        frequency: parseInt(autoFrequency)
      });
      onClose();
    } catch (error) {
      console.error('Error auto-rescheduling:', error);
      console.error('Error response:', error.response);
      alert(`Failed to auto-reschedule: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    
    setIsSaving(true);
    try {
      await onSave({
        type: 'delete',
        scheduleId: scheduleData.scheduleId
      });
      onClose();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Failed to delete schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToCalculated = async () => {
    if (!window.confirm('This will remove all custom schedules and revert to auto-calculated dates. Continue?')) return;
    
    setIsSaving(true);
    try {
      await onSave({
        type: 'reset',
        projectId: scheduleData.projectId
      });
      onClose();
    } catch (error) {
      console.error('Error resetting schedule:', error);
      alert('Failed to reset schedule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pm-schedule-modal-overlay" onClick={onClose}>
      <div className="pm-schedule-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="pm-schedule-modal-header">
          <h2>
            <Calendar size={24} />
            Edit PM Schedule
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pm-schedule-modal-body">
          <div className="schedule-info">
            <h3>{scheduleData?.projectTitle}</h3>
            <p>{scheduleData?.customerName}</p>
          </div>

          <div className="edit-mode-selector">
            <button 
              className={`mode-button ${!isAutoReschedule ? 'active' : ''}`}
              onClick={() => setIsAutoReschedule(false)}
            >
              Edit Individual Date
            </button>
            <button 
              className={`mode-button ${isAutoReschedule ? 'active' : ''}`}
              onClick={() => setIsAutoReschedule(true)}
            >
              Auto-Reschedule
            </button>
          </div>

          {!isAutoReschedule ? (
            <div className="individual-edit-section">
              <div className="form-group">
                <label>Scheduled Date</label>
                <input
                  type="date"
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  className="date-input"
                />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this schedule change..."
                  className="notes-textarea"
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-save"
                  onClick={handleSaveIndividual}
                  disabled={isSaving || !editedDate}
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Date'}
                </button>
                
                {scheduleData?.scheduleId && (
                  <button 
                    className="btn-delete"
                    onClick={handleDelete}
                    disabled={isSaving}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="auto-reschedule-section">
              <div className="form-group">
                <label>New Start Date</label>
                <input
                  type="date"
                  value={autoStartDate}
                  onChange={(e) => setAutoStartDate(e.target.value)}
                  className="date-input"
                />
              </div>

              <div className="form-group">
                <label>PM Frequency (per year)</label>
                <select
                  value={autoFrequency}
                  onChange={(e) => setAutoFrequency(e.target.value)}
                  className="frequency-select"
                >
                  <option value="1">1 time/year</option>
                  <option value="2">2 times/year</option>
                  <option value="3">3 times/year</option>
                  <option value="4">4 times/year (Quarterly)</option>
                  <option value="6">6 times/year (Bi-monthly)</option>
                  <option value="12">12 times/year (Monthly)</option>
                </select>
              </div>

              <div className="warning-message">
                <p>⚠️ This will replace all existing PM schedules for this year with new calculated dates.</p>
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-save"
                  onClick={handleAutoReschedule}
                  disabled={isSaving || !autoStartDate}
                >
                  <RotateCcw size={16} />
                  {isSaving ? 'Rescheduling...' : 'Apply Auto-Reschedule'}
                </button>
              </div>
            </div>
          )}

          <div className="reset-section">
            <button 
              className="btn-reset"
              onClick={handleResetToCalculated}
              disabled={isSaving}
            >
              <RotateCcw size={16} />
              Reset to Auto-Calculated Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PMScheduleEditModal;
