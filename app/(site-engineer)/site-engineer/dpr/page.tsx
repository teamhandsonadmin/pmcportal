'use client';

import { useState, useRef } from 'react';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  border: '1px solid #F3F4F6',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const cardTitle = 'text-[13.5px] font-bold text-gray-900 mb-4';
const fieldLabel = 'text-[12px] font-semibold text-gray-600 mb-1.5 block';
const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:border-gray-400 transition-colors bg-white';
const selectClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:border-gray-400 transition-colors bg-white appearance-none';

function PillToggle({ options, value, onChange, multi = false }: {
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const isSelected = (opt: string) =>
    multi ? (value as string[]).includes(opt) : value === opt;

  const handle = (opt: string) => {
    if (multi) {
      const arr = value as string[];
      onChange(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]);
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => handle(opt)}
          style={{
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 12px',
            borderRadius: '9999px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: isSelected(opt) ? '#111111' : '#fff',
            color: isSelected(opt) ? '#fff' : '#4B5563',
            border: isSelected(opt) ? '1px solid #111' : '1px solid #D1D5DB',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        background: '#111',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 500,
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.2s, transform 0.2s',
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  );
}

const CATEGORIES = ['HVAC','Electrical','Plumbing','Civil Works','Flooring','False Ceiling','Carpentry','POP Works','Painting','Aluminium D&W','Glass Works','Modular Works','Fabrication','Waterproofing','Lighting','Landscape'];
const FLOORS = ['Basement','Ground Floor','First Floor','Second Floor','Third Floor','Terrace'];
const TRADES = ['Electrical','Plumbing','HVAC','Civil','Flooring','Painting','Carpentry'];
const CONSULTANTS = ['Architect Consultant','Structural Consultant','Electrical Consultant','MEP Consultant','HVAC Consultant','Plumbing Consultant','Home Theater Consultant','Landscape Consultant','Interior Consultant','Other'];
const MATERIAL_STATUS = ['Material Available','Partially Available','Material Awaited','Material Delivered Today','Material Shortage'];
const SITE_STATUS = ['Normal Progress','Work Completed','Material Awaited','Drawing Pending','Approval Pending','Contractor Delay','Labour Shortage','Equipment Issue','Weather Impact','Site Access Issue'];
const PREDEFINED_COMMENTS = ['Material Delay','Drawing Not Received','Approval Pending','Labour Shortage','Low Productivity','Contractor Delay','Site Access Issue','Weather Delay','Equipment Breakdown','Safety Concern','Quality Issue','Design Change','Material Damage','Vendor Delay','Inspection Pending'];
const TIME_SLOTS = ['11:30 AM','2:30 PM','5:30 PM'];

export default function DPRPage() {
  const [formData, setFormData] = useState({
    updateTime: '5:30 PM',
    taskId: '',
    taskName: '',
    category: '',
    floor: '',
    room: '',
    consultant: '',
    materialStatus: '',
    contractorName: '',
    trade: '',
    workersPresent: '',
    workCompleted: '',
    progressPct: 50,
    siteStatus: 'Normal Progress',
    comments: [] as string[],
    additionalObservations: '',
  });

  const [toast, setToast] = useState({ visible: false, message: '' });
  const photoRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const set = (field: string, val: unknown) =>
    setFormData(prev => ({ ...prev, [field]: val }));

  const showToast = (msg: string) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: msg }), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('DPR submitted successfully!');
  };

  const handleDraft = () => showToast('Draft saved.');

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '32px 24px' }}>
      <Toast message={toast.message} visible={toast.visible} />

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111', margin: 0 }}>
          Daily Progress Report
        </h1>
        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
          ABC Villa Construction · Submit today's site update · Jun 22, 2026
        </p>
      </div>

      {/* Update Time Selector */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '10px' }}>
          UPDATE TIME
        </div>
        <div className="flex gap-3">
          {TIME_SLOTS.map(slot => {
            const sel = formData.updateTime === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => set('updateTime', slot)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: sel ? '#111' : '#fff',
                  color: sel ? '#fff' : '#4B5563',
                  border: sel ? '1px solid #111' : '1px solid #D1D5DB',
                }}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' }}>

          {/* Card 1: Task Selection */}
          <div style={cardStyle}>
            <div className={cardTitle}>Task Selection</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className={fieldLabel}>Task ID</label>
                <input className={inputClass} placeholder="e.g. TASK-001" value={formData.taskId}
                  onChange={e => set('taskId', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Task Name</label>
                <input className={inputClass} placeholder="e.g. AC Units Level Marking" value={formData.taskName}
                  onChange={e => set('taskName', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={fieldLabel}>Category</label>
              <div style={{ position: 'relative' }}>
                <select className={selectClass} value={formData.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: '11px' }}>▼</span>
              </div>
            </div>
          </div>

          {/* Card 2: Location Details */}
          <div style={cardStyle}>
            <div className={cardTitle}>Location Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className={fieldLabel}>Floor Worked On</label>
                <div style={{ position: 'relative' }}>
                  <select className={selectClass} value={formData.floor} onChange={e => set('floor', e.target.value)}>
                    <option value="">Select floor</option>
                    {FLOORS.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: '11px' }}>▼</span>
                </div>
              </div>
              <div>
                <label className={fieldLabel}>Room Worked On</label>
                <input className={inputClass} placeholder="e.g. Master Bedroom, Kitchen, Toilet 01"
                  value={formData.room} onChange={e => set('room', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Card 3: Consultant Drawing Reference */}
          <div style={cardStyle}>
            <div className={cardTitle}>Consultant Drawing Reference</div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
              Which consultant drawing was used today?
            </div>
            <PillToggle options={CONSULTANTS} value={formData.consultant}
              onChange={v => set('consultant', v)} />
          </div>

          {/* Card 4: Material Procurement Status */}
          <div style={cardStyle}>
            <div className={cardTitle}>Material Procurement Status</div>
            <PillToggle options={MATERIAL_STATUS} value={formData.materialStatus}
              onChange={v => set('materialStatus', v)} />
          </div>

          {/* Card 5: Workforce Status */}
          <div style={cardStyle}>
            <div className={cardTitle}>Workforce Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / 2' }}>
                <label className={fieldLabel}>Contractor Name</label>
                <input className={inputClass} placeholder="Contractor name" value={formData.contractorName}
                  onChange={e => set('contractorName', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Trade</label>
                <div style={{ position: 'relative' }}>
                  <select className={selectClass} value={formData.trade} onChange={e => set('trade', e.target.value)}>
                    <option value="">Select trade</option>
                    {TRADES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: '11px' }}>▼</span>
                </div>
              </div>
              <div>
                <label className={fieldLabel}>Workers Present Today</label>
                <input className={inputClass} type="number" min={0} placeholder="18"
                  value={formData.workersPresent} onChange={e => set('workersPresent', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Card 6: Progress Update */}
          <div style={cardStyle}>
            <div className={cardTitle}>Progress Update</div>
            <div style={{ marginBottom: '16px' }}>
              <label className={fieldLabel}>Work Completed Today</label>
              <textarea className={inputClass} rows={4}
                placeholder="Describe the work completed today in detail..."
                value={formData.workCompleted}
                onChange={e => set('workCompleted', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div>
              <label className={fieldLabel}>
                Progress Percentage
                <span style={{ marginLeft: '8px', fontWeight: 700, color: '#111' }}>{formData.progressPct}%</span>
              </label>
              <input type="range" min={0} max={100} value={formData.progressPct}
                onChange={e => set('progressPct', Number(e.target.value))}
                style={{ width: '100%', accentColor: '#111' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                <span>0%</span><span>100%</span>
              </div>
            </div>
          </div>

          {/* Card 7: Photo Updates */}
          <div style={cardStyle}>
            <div className={cardTitle}>Photo Updates</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {(['11:30 AM Photos', '2:30 PM Photos', '5:30 PM Photos'] as const).map((label, i) => (
                <div key={label}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', marginBottom: '6px' }}>{label}</div>
                  <div
                    onClick={() => showToast('Photo upload integration coming soon')}
                    style={{
                      border: '1.5px dashed #D1D5DB',
                      borderRadius: '12px',
                      background: '#F9FAFB',
                      padding: '20px 12px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#9CA3AF')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#D1D5DB')}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, lineHeight: 1.4 }}>
                      Click to upload or drag photos
                    </div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '4px' }}>JPG, PNG up to 10MB each</div>
                    <input ref={photoRefs[i]} type="file" accept="image/*" multiple style={{ display: 'none' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 8: Site Status */}
          <div style={cardStyle}>
            <div className={cardTitle}>Site Status</div>
            <PillToggle options={SITE_STATUS} value={formData.siteStatus}
              onChange={v => set('siteStatus', v)} />
          </div>

          {/* Card 9: Comments / Observations */}
          <div style={cardStyle}>
            <div className={cardTitle}>Comments / Observations</div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '10px' }}>
                Select applicable comments
              </div>
              <PillToggle options={PREDEFINED_COMMENTS} value={formData.comments}
                onChange={v => set('comments', v)} multi />
            </div>
            <div>
              <label className={fieldLabel}>Additional Observations</label>
              <textarea className={inputClass} rows={3}
                placeholder="Any other observations or notes..."
                value={formData.additionalObservations}
                onChange={e => set('additionalObservations', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Card 10: Submit Actions */}
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={handleDraft}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#fff',
                color: '#4B5563',
                border: '1px solid #D1D5DB',
                transition: 'border-color 0.15s',
              }}
            >
              Save Draft
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#111',
                color: '#fff',
                border: '1px solid #111',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'opacity 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Submit Daily Report
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
