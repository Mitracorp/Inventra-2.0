import React, { useRef, useEffect, useState } from 'react';
import { X, Trash2, PenTool } from 'lucide-react';

const SignatureModal = ({ isOpen, onClose, onConfirm, pmId }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatureMode, setSignatureMode] = useState('draw');
  const [typedRecipientName, setTypedRecipientName] = useState('');
  // "Signed on Behalf" toggle and fields
  const [onBehalf, setOnBehalf] = useState(false);
  const [onBehalfName, setOnBehalfName] = useState('');
  const [onBehalfDepartment, setOnBehalfDepartment] = useState('');

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = 600;
      canvas.height = 300;
      
      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Set drawing style
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [isOpen]);

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    // Scale mouse coords to canvas coordinate space
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear and reset to white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setHasSignature(false);
  };

  const handleConfirm = async () => {
    if (signatureMode === 'draw' && !hasSignature) {
      alert('Please draw your signature first');
      return;
    }

    if (signatureMode === 'draw' && onBehalf) {
      if (!onBehalfName.trim()) {
        alert('Please fill in Name for Signed on Behalf');
        return;
      }
    }

    if (signatureMode === 'full-name' && !typedRecipientName.trim()) {
      alert('Please enter full recipient name');
      return;
    }

    let signatureBase64 = '';
    let payload = {};

    if (signatureMode === 'draw') {
      const canvas = canvasRef.current;
      signatureBase64 = canvas.toDataURL('image/png');
      payload = {
        signature: signatureBase64,
        onBehalf,
        name: onBehalf ? onBehalfName.trim() : '',
        department: onBehalf ? onBehalfDepartment.trim() : ''
      };
    } else {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 600;
      tempCanvas.height = 300;
      const ctx = tempCanvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 42px Segoe Script, cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedRecipientName.trim(), tempCanvas.width / 2, tempCanvas.height / 2);
      signatureBase64 = tempCanvas.toDataURL('image/png');
      payload = {
        signature: signatureBase64,
        onBehalf: true,
        name: typedRecipientName.trim(),
        department: 'Recipient Name Sign',
        fromFullName: true
      };
    }
    
    setSubmitting(true);
    try {
      await onConfirm(payload);
    } catch (error) {
      console.error('Error submitting signature:', error);
      alert('Failed to save signature. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '700px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        animation: 'slideUp 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '25px',
          paddingBottom: '15px',
          borderBottom: '2px solid #667eea'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PenTool size={28} color="#667eea" />
            <div>
              <h2 style={{ 
                margin: 0, 
                color: '#2c3e50', 
                fontSize: '1.5rem',
                fontWeight: '600'
              }}>
                Recipient Signature
              </h2>
              <p style={{ 
                margin: '5px 0 0 0', 
                color: '#7f8c8d', 
                fontSize: '0.9rem' 
              }}>
                PM Record #{pmId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              color: '#95a5a6',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: submitting ? 0.5 : 1
            }}
            onMouseOver={(e) => !submitting && (e.currentTarget.style.background = '#ecf0f1')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={24} />
          </button>
        </div>

        {/* Instructions */}
        <div style={{
          background: '#e8f4fd',
          border: '1px solid #bee5eb',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          color: '#31708f',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <PenTool size={18} />
          <span>Choose digital draw signature or type recipient full name</span>
        </div>

        {/* Signature Mode */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px'
        }}>
          <button
            type="button"
            onClick={() => setSignatureMode('draw')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: signatureMode === 'draw' ? '2px solid #4f46e5' : '1px solid #d1d5db',
              background: signatureMode === 'draw' ? '#eef2ff' : 'white',
              color: '#1f2937',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Digital Signature
          </button>
          <button
            type="button"
            onClick={() => setSignatureMode('full-name')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: signatureMode === 'full-name' ? '2px solid #4f46e5' : '1px solid #d1d5db',
              background: signatureMode === 'full-name' ? '#eef2ff' : 'white',
              color: '#1f2937',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Sign By Full Name
          </button>
        </div>

        {/* Signed on Behalf Toggle (prominent) */}
        {signatureMode === 'draw' && (
        <div style={{
          border: '1px solid #e9ecef',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          background: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#2c3e50' }}>Signed on Behalf</div>
              <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>Turn ON if signing on behalf</div>
            </div>
            <button
              type="button"
              aria-label="Toggle Signed on Behalf"
              role="switch"
              aria-checked={onBehalf}
              onClick={() => {
                setOnBehalf(prev => {
                  const next = !prev;
                  if (!next) {
                    setOnBehalfName('');
                    setOnBehalfDepartment('');
                  }
                  return next;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOnBehalf(prev => {
                    const next = !prev;
                    if (!next) {
                      setOnBehalfName('');
                      setOnBehalfDepartment('');
                    }
                    return next;
                  });
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '64px',
                height: '32px',
                borderRadius: '16px',
                background: onBehalf ? '#10b981' : '#c7cdd1',
                position: 'relative',
                transition: 'background 0.2s'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '2px',
                  left: onBehalf ? '34px' : '2px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  transition: 'left 0.2s'
                }} />
              </div>
            </button>
          </div>

          {onBehalf && (
            <div style={{
              marginTop: '14px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#7f8c8d', marginBottom: '6px' }}>Name:</label>
                <input
                  type="text"
                  value={onBehalfName}
                  onChange={(e) => setOnBehalfName(e.target.value)}
                  placeholder="Enter name"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e9ecef',
                    borderRadius: '6px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#7f8c8d', marginBottom: '6px' }}>Department:</label>
                <input
                  type="text"
                  value={onBehalfDepartment}
                  onChange={(e) => setOnBehalfDepartment(e.target.value)}
                  placeholder="Enter department (optional)"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e9ecef',
                    borderRadius: '6px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
            </div>
          )}
        </div>
        )}

        {signatureMode === 'full-name' && (
          <div style={{
            border: '1px solid #fbbf24',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '16px',
            background: '#fffbeb'
          }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
              Recipient Full Name
            </label>
            <input
              type="text"
              value={typedRecipientName}
              onChange={(e) => setTypedRecipientName(e.target.value)}
              placeholder="Enter recipient full name"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                fontSize: '0.95rem'
              }}
            />
            <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#92400e' }}>
              Use this when recipient cannot provide digital signature at that moment.
            </div>
          </div>
        )}

        {/* Canvas Container */}
        {signatureMode === 'draw' && (
        <div style={{
          border: '2px dashed #bdc3c7',
          borderRadius: '12px',
          padding: '10px',
          marginBottom: '20px',
          background: '#f8f9fa',
          position: 'relative'
        }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              width: '100%',
              height: 'auto',
              cursor: 'crosshair',
              borderRadius: '8px',
              background: 'white',
              display: 'block',
              touchAction: 'none'
            }}
          />
          
          {/* Clear button overlay */}
          <button
            onClick={clearSignature}
            disabled={!hasSignature || submitting}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              padding: '8px 16px',
              background: hasSignature && !submitting ? '#e74c3c' : '#bdc3c7',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: hasSignature && !submitting ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              opacity: hasSignature && !submitting ? 1 : 0.6
            }}
            onMouseOver={(e) => {
              if (hasSignature && !submitting) {
                e.currentTarget.style.background = '#c0392b';
              }
            }}
            onMouseOut={(e) => {
              if (hasSignature && !submitting) {
                e.currentTarget.style.background = '#e74c3c';
              }
            }}
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
        )}

        {/* Action Buttons */}
        {(() => {
          const canConfirm = signatureMode === 'draw'
            ? (hasSignature && (!onBehalf || (onBehalfName.trim().length > 0)))
            : typedRecipientName.trim().length > 0;
          return (
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '12px 28px',
              background: 'white',
              color: '#7f8c8d',
              border: '2px solid #bdc3c7',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: submitting ? 0.5 : 1
            }}
            onMouseOver={(e) => {
              if (!submitting) {
                e.currentTarget.style.borderColor = '#95a5a6';
                e.currentTarget.style.color = '#2c3e50';
              }
            }}
            onMouseOut={(e) => {
              if (!submitting) {
                e.currentTarget.style.borderColor = '#bdc3c7';
                e.currentTarget.style.color = '#7f8c8d';
              }
            }}
          >
            Later
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            style={{
              padding: '12px 28px',
              background: canConfirm && !submitting ? '#667eea' : '#bdc3c7',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: canConfirm && !submitting ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: canConfirm && !submitting ? 1 : 0.6
            }}
            onMouseOver={(e) => {
              if (canConfirm && !submitting) {
                e.currentTarget.style.background = '#5568d3';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              if (canConfirm && !submitting) {
                e.currentTarget.style.background = '#667eea';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {submitting ? 'Saving...' : 'Confirm Signed'}
          </button>
        </div>
          );
        })()}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default SignatureModal;
