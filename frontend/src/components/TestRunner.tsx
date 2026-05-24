import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Play, Sparkles, AlertTriangle, CheckCircle, Terminal, HelpCircle, RefreshCw, FileImage, FileCode2 } from 'lucide-react';
import { TestRunResult, HealingResult } from '../types.js';

interface TestRunnerProps {
  backendUrl: string;
  socket: Socket | null;
  selectedTestFile: string | null;
  setSelectedTestFile: (name: string | null) => void;
}

export default function TestRunner({ backendUrl, socket, selectedTestFile, setSelectedTestFile }: TestRunnerProps) {
  const [testFiles, setTestFiles] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<TestRunResult | null>(null);
  
  // Healing state
  const [healing, setHealing] = useState(false);
  const [healStep, setHealStep] = useState<string>('');
  const [healResult, setHealResult] = useState<HealingResult | null>(null);
  const [healError, setHealError] = useState<string>('');

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Fetch test files list
  const fetchFiles = () => {
    fetch(`${backendUrl}/api/tests`)
      .then(res => res.json())
      .then(data => {
        const tests = data.tests || [];
        setTestFiles(tests);
        if (tests.length > 0 && !selectedTestFile) {
          setSelectedTestFile(tests[0]);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchFiles();
  }, [backendUrl]);

  // Hook WebSockets for logs and execution status
  useEffect(() => {
    if (!socket) return;

    const handleRunStarted = (data: { name: string }) => {
      if (data.name === selectedTestFile) {
        setRunning(true);
        setLogs([]);
        setResult(null);
        setHealResult(null);
        setHealError('');
      }
    };

    const handleRunLog = (data: { name: string; log: string }) => {
      if (data.name === selectedTestFile) {
        setLogs(prev => [...prev, data.log]);
      }
    };

    const handleRunFinished = (data: { name: string; result: TestRunResult }) => {
      if (data.name === selectedTestFile) {
        setRunning(false);
        setResult(data.result);
      }
    };

    const handleHealStatus = (data: { name: string; status: string; message: string; result?: HealingResult }) => {
      if (data.name === selectedTestFile) {
        setHealStep(data.message);
        if (data.status === 'success' && data.result) {
          setHealing(false);
          setHealResult(data.result);
          // Update code result success state to true
          setResult(prev => prev ? { ...prev, success: true } : null);
        } else if (data.status === 'failed') {
          setHealing(false);
          setHealError(data.message);
        }
      }
    };

    socket.on('run-started', handleRunStarted);
    socket.on('run-log', handleRunLog);
    socket.on('run-finished', handleRunFinished);
    socket.on('heal-status', handleHealStatus);

    return () => {
      socket.off('run-started', handleRunStarted);
      socket.off('run-log', handleRunLog);
      socket.off('run-finished', handleRunFinished);
      socket.off('heal-status', handleHealStatus);
    };
  }, [socket, selectedTestFile]);

  // Auto scroll terminal logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRun = async () => {
    if (!selectedTestFile || running) return;
    
    setRunning(true);
    setLogs([]);
    setResult(null);
    setHealResult(null);
    setHealError('');

    try {
      const response = await fetch(`${backendUrl}/api/tests/${selectedTestFile}/run`, {
        method: 'POST'
      });
      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleHeal = async () => {
    if (!selectedTestFile || healing) return;
    
    setHealing(true);
    setHealStep('Initializing Self-Healing Agent...');
    setHealError('');
    setHealResult(null);

    try {
      const response = await fetch(`${backendUrl}/api/tests/${selectedTestFile}/heal`, {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to complete self-healing.');
    } catch (err) {
      setHealError((err as Error).message);
      setHealing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* File select controls */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={24} className="logo-accent" /> Test Runner & Diagnostics
        </h2>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={selectedTestFile || ''} 
            onChange={(e) => {
              setSelectedTestFile(e.target.value || null);
              setResult(null);
              setLogs([]);
              setHealResult(null);
              setHealError('');
            }}
            disabled={running || healing}
            style={{ flex: 1 }}
          >
            {testFiles.map(file => (
              <option key={file} value={file}>{file}</option>
            ))}
          </select>
          
          <button 
            onClick={handleRun}
            className="btn btn-primary"
            disabled={running || healing || !selectedTestFile}
            style={{ minWidth: '130px' }}
          >
            <Play size={16} /> {running ? 'Running...' : 'Run Test'}
          </button>
        </div>
      </div>

      {/* Grid containing logs terminal and outputs */}
      <div className="grid-2">
        
        {/* Terminal Logs */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} className="logo-accent" /> Real-time Console Log
          </h3>
          <div className="terminal-window" style={{ flex: 1, minHeight: '380px' }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Test run logs will be output here...
              </div>
            ) : (
              logs.map((log, i) => (
                <div 
                  key={i} 
                  className={`terminal-line ${
                    log.includes('passed') || log.includes('Passed') ? 'terminal-success' : 
                    log.includes('failed') || log.includes('Failed') ? 'terminal-error' : 
                    log.includes('warning') || log.includes('Warning') ? 'terminal-warning' : ''
                  }`}
                >
                  {log}
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Diagnostic Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Main Status Panel */}
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Execution Result
            </h3>
            
            {!running && !result && !healing && !healResult && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: 'var(--text-secondary)',
                gap: '8px',
                textAlign: 'center',
                padding: '40px 0'
              }}>
                <HelpCircle size={36} style={{ opacity: 0.15 }} />
                <div style={{ fontSize: '13px' }}>Select a spec file above and click "Run Test" to verify.</div>
              </div>
            )}

            {running && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                gap: '12px',
                padding: '40px 0'
              }}>
                <RefreshCw size={36} className="logo-accent" style={{ animation: 'spin 2s linear infinite' }} />
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                <div style={{ fontSize: '14px', color: 'var(--primary)' }}>Running Playwright Test...</div>
              </div>
            )}

            {/* Self-healing in progress spinner */}
            {healing && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                gap: '16px',
                padding: '40px 0',
                background: 'rgba(0, 240, 255, 0.02)',
                border: '1px dashed rgba(0, 240, 255, 0.2)',
                borderRadius: '8px'
              }}>
                <Sparkles size={36} className="logo-accent" style={{ animation: 'pulse-animation 1.5s infinite' }} />
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)' }}>AUTONOMOUS AGENT ACTIVE</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '280px' }}>
                  {healStep}
                </div>
              </div>
            )}

            {/* Finished Test Run Outputs */}
            {result && !running && !healing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                
                {/* Result header banner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  background: result.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  border: `1px solid ${result.success ? 'var(--success)' : 'var(--error)'}`
                }}>
                  {result.success ? (
                    <>
                      <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                      <div>
                        <strong style={{ color: 'var(--success)' }}>TEST SUITE PASSED</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>All assertions and locators validated.</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
                      <div>
                        <strong style={{ color: 'var(--error)' }}>TEST SPEC FAILED</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>An error was encountered during execution.</div>
                      </div>
                    </>
                  )}
                </div>

                {/* If failed, show error stack trace card */}
                {result.error && !result.success && (
                  <div className="glass-card" style={{ borderLeft: '3px solid var(--error)', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--error)' }}>FAILURE DETAILS</span>
                      <button 
                        onClick={handleHeal} 
                        className="btn btn-primary"
                        style={{ fontSize: '11px', padding: '6px 10px', gap: '4px' }}
                      >
                        <Sparkles size={12} /> Auto-Heal Test
                      </button>
                    </div>
                    
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                      Line {result.error.line}: {result.error.message.split('\n')[0]}
                    </div>
                    
                    {result.error.selector && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Failing selector: <code style={{ color: '#fb7185', fontFamily: 'var(--font-mono)' }}>{result.error.selector}</code>
                      </div>
                    )}
                  </div>
                )}

                {/* Display failure screenshot if it exists */}
                {result.screenshotPath && !result.success && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileImage size={14} /> Failure Screenshot
                    </span>
                    <a href={result.screenshotPath} target="_blank" rel="noreferrer">
                      <img 
                        src={result.screenshotPath} 
                        alt="Playwright failure" 
                        style={{
                          width: '100%',
                          maxHeight: '180px',
                          objectFit: 'contain',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          background: '#000000',
                          cursor: 'zoom-in'
                        }}
                      />
                    </a>
                  </div>
                )}

              </div>
            )}

            {/* Healed Code Display Card */}
            {healResult && !running && !healing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid var(--success)'
                }}>
                  <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                  <div>
                    <strong style={{ color: 'var(--success)' }}>HEALING SUCCEEDED & VERIFIED</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>The selector was successfully updated and test has passed.</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileCode2 size={14} /> Code Diff Committed
                  </span>
                  
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    padding: '12px',
                    borderRadius: '6px',
                    background: '#050608',
                    border: '1px solid var(--border-color)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.5'
                  }}>
                    <div style={{ color: '#f43f5e', background: 'rgba(244, 63, 94, 0.05)', padding: '2px 4px', borderRadius: '4px' }}>
                      {healResult.originalLine.trim()}
                    </div>
                    <div style={{ color: '#34d399', background: 'rgba(16, 185, 129, 0.05)', padding: '2px 4px', borderRadius: '4px', marginTop: '4px' }}>
                      {healResult.healedLine.trim()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Healing error card */}
            {healError && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '6px',
                background: 'rgba(244, 63, 94, 0.05)',
                border: '1px solid var(--error)',
                color: 'var(--error)',
                fontSize: '13px'
              }}>
                <strong>Healing Failed:</strong> {healError}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
