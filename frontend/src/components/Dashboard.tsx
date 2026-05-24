import React, { useState, useEffect } from 'react';
import { Play, Sparkles, ShieldAlert, Cpu, Terminal, Plus, Layers, ShieldCheck } from 'lucide-react';

interface DashboardProps {
  backendUrl: string;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ backendUrl, onNavigate }: DashboardProps) {
  const [testCount, setTestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    // Fetch tests
    fetch(`${backendUrl}/api/tests`)
      .then(res => res.json())
      .then(data => {
        setTestCount(data.tests?.length || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    // Fetch settings key status
    fetch(`${backendUrl}/api/settings`)
      .then(res => res.json())
      .then(data => {
        setHasKeys(data.provider !== 'none' && data.apiKey !== '');
      })
      .catch(err => console.error(err));
  }, [backendUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Welcome Banner */}
      <div className="glass-panel" style={{
        background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
        borderColor: 'rgba(0, 240, 255, 0.25)',
        padding: '30px 40px'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          Welcome to <span className="logo-accent">E2E Testing Agent</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxHeight: '400px', maxWidth: '780px', lineHeight: '1.6' }}>
          An autonomous test-builder and self-maintenance workspace. Observe manual user sessions inside a headful browser, generate clean TypeScript Playwright specifications, and let the agent repair selectors automatically when the DOM changes.
        </p>
      </div>

      {/* Grid of stats cards */}
      <div className="grid-3">
        
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{
            background: 'rgba(0, 240, 255, 0.1)',
            color: 'var(--primary)',
            padding: '16px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={28} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>TOTAL TEST SUITES</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#ffffff' }}>
              {loading ? '...' : testCount}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{
            background: hasKeys ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            color: hasKeys ? 'var(--success)' : 'var(--warning)',
            padding: '16px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Cpu size={28} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>LLM AGENT STATE</div>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 'bold', 
              fontFamily: 'var(--font-display)',
              color: hasKeys ? 'var(--success)' : 'var(--warning)',
              marginTop: '4px'
            }}>
              {hasKeys ? 'HEALING ENABLED' : 'RULES ONLY (NO KEY)'}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
          <div style={{
            background: 'rgba(0, 240, 255, 0.05)',
            color: 'var(--primary)',
            padding: '16px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>RUNTIME ENVIRONMENT</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: '#ffffff', marginTop: '4px' }}>
              PLAYWRIGHT 1.44
            </div>
          </div>
        </div>

      </div>

      {/* Feature Walkthrough Grid */}
      <div className="grid-2">
        
        {/* Quick Actions Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3>Get Started</h3>
          
          <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('recorder')}>
            <div>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#ffffff', marginBottom: '4px' }}>
                <Plus size={16} className="logo-accent" /> Record New Test spec
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Launch an interactive browser to capture your manual operations.</span>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>Start</button>
          </div>

          <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('editor')}>
            <div>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#ffffff', marginBottom: '4px' }}>
                <Terminal size={16} className="logo-accent" /> Open Code Editor
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Review the compiled Playwright TypeScript scripts.</span>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>Open</button>
          </div>
          
          <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('settings')}>
            <div>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#ffffff', marginBottom: '4px' }}>
                <Cpu size={16} className="logo-accent" /> Setup AI Core
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Connect Gemini or OpenAI API keys to enable autonomous self-healing.</span>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>Config</button>
          </div>
        </div>

        {/* Informative Walkthrough */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>How Self-Healing Works</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            When running tests via our program runner, a locator mismatch (like a changed CSS class or button text) triggers a failure. Click the <strong>"Auto-Heal"</strong> button on the failing log card to initiate:
          </p>

          <ol style={{
            paddingLeft: '20px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            lineHeight: '1.5'
          }}>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Replay Steps:</strong> The agent spins up a browser and executes all preceding test statements to recreate the exact DOM state before failure.
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Inspect Context:</strong> It scans the page outerHTML, locating candidates corresponding to the user's intent.
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Selector Repair:</strong> Using the LLM, the agent evaluates accessible role attributes and proposes a patched Playwright statement.
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Verification:</strong> The healer runs the verification suite. If it passes, it commits the changes and outputs a side-by-side code diff.
            </li>
          </ol>
        </div>

      </div>

    </div>
  );
}
