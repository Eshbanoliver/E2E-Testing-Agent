import React, { useState, useEffect } from 'react';
import { Save, ShieldAlert, Sparkles, Key, Cpu } from 'lucide-react';
import { AppSettings } from '../types.js';

interface SettingsProps {
  backendUrl: string;
}

export default function Settings({ backendUrl }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>({
    provider: 'none',
    apiKey: '',
    modelName: ''
  });
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({
    type: '',
    message: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${backendUrl}/api/settings`)
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching settings:', err);
        setLoading(false);
      });
  }, [backendUrl]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    fetch(`${backendUrl}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save settings.');
        return res.json();
      })
      .then(() => {
        setStatus({ type: 'success', message: 'Configuration saved successfully!' });
      })
      .catch(err => {
        setStatus({ type: 'error', message: err.message });
      });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading settings config...</div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '680px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Sparkles size={24} className="logo-accent" /> LLM Integration Settings
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
        Configure your Artificial Intelligence engine. The agent uses LLMs to refine recorded test cases into clean page-object-like TypeScript selectors and autonomously heal broken locators at runtime.
      </p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} /> AI Provider
          </label>
          <select
            value={settings.provider}
            onChange={(e) => setSettings({ ...settings, provider: e.target.value as any, modelName: '' })}
          >
            <option value="none">No LLM (Compile Raw Selectors Only)</option>
            <option value="gemini">Google Gemini Developer API</option>
            <option value="openai">OpenAI API</option>
          </select>
        </div>

        {settings.provider !== 'none' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={16} /> API Key
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={settings.provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                  value={settings.apiKey}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minWidth: '80px' }}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Model Name (Optional)
              </label>
              <input
                type="text"
                placeholder={settings.provider === 'gemini' ? 'gemini-2.5-flash (default)' : 'gpt-4o-mini (default)'}
                value={settings.modelName}
                onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Leave empty to use the recommended default lightweight speed-optimized model.
              </span>
            </div>
          </>
        )}

        {settings.provider === 'none' && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '6px',
            padding: '12px 16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            fontSize: '13px',
            color: 'var(--warning)',
            marginTop: '8px'
          }}>
            <ShieldAlert size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>Note:</strong> Without an active AI provider, recorded tests will be generated using basic DOM selectors and self-healing will not be available.
            </div>
          </div>
        )}

        {status.message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
            color: status.type === 'success' ? 'var(--success)' : 'var(--error)'
          }}>
            {status.message}
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '10px' }}>
          <Save size={18} /> Save Settings
        </button>
      </form>
    </div>
  );
}
