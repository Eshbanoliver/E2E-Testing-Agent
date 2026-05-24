import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Play, Square, Globe, Activity, CheckCircle, Navigation, MousePointer, Edit3, HelpCircle } from 'lucide-react';
import { RecordedEvent, RecordingStatus } from '../types.js';

interface RecorderProps {
  backendUrl: string;
  socket: Socket | null;
  onNavigateToEditor: (testName: string) => void;
}

export default function Recorder({ backendUrl, socket, onNavigateToEditor }: RecorderProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<RecordingStatus>({
    isRecording: false,
    targetUrl: '',
    eventCount: 0
  });
  const [events, setEvents] = useState<RecordedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedTest, setCompletedTest] = useState<{ fileName: string; count: number } | null>(null);
  
  const eventLogEndRef = useRef<HTMLDivElement>(null);

  // Sync initial status
  useEffect(() => {
    fetch(`${backendUrl}/api/recording-status`)
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        if (data.isRecording) {
          setUrl(data.targetUrl);
        }
      })
      .catch(err => console.error('Error fetching recording status:', err));
  }, [backendUrl]);

  // Hook WebSockets for live events
  useEffect(() => {
    if (!socket) return;

    const handleEventRecorded = (data: { event: RecordedEvent; status: RecordingStatus }) => {
      setEvents(prev => [...prev, data.event]);
      setStatus(data.status);
    };

    const handleStatusUpdate = (newStatus: RecordingStatus) => {
      setStatus(newStatus);
      if (!newStatus.isRecording) {
        setLoading(false);
      }
    };

    socket.on('event-recorded', handleEventRecorded);
    socket.on('status-update', handleStatusUpdate);

    return () => {
      socket.off('event-recorded', handleEventRecorded);
      socket.off('status-update', handleStatusUpdate);
    };
  }, [socket]);

  // Auto-scroll event logs
  useEffect(() => {
    eventLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setError('');
    setLoading(true);
    setCompletedTest(null);
    setEvents([]);

    // Add protocol if missing
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
      setUrl(targetUrl);
    }

    try {
      const response = await fetch(`${backendUrl}/api/start-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start recording session.');
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${backendUrl}/api/stop-recording`, {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to stop recording session.');

      setCompletedTest({
        fileName: data.testFileName,
        count: data.eventsCount
      });
      setEvents([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Configuration & Launch Panel */}
      <div className="glass-panel">
        <h2 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe size={24} className="logo-accent" /> Web Session Recorder
        </h2>
        
        {!status.isRecording ? (
          <form onSubmit={handleStart} style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Enter target site URL to record (e.g. https://example.com)..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                style={{ paddingLeft: '38px' }}
              />
              <Globe size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !url}
              style={{ minWidth: '160px' }}
            >
              <Play size={16} /> {loading ? 'Launching...' : 'Start Recording'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(0, 240, 255, 0.1)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="pulse-recording"></span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: '600', color: 'var(--error)' }}>
                  LIVE RECORDING SESSION
                </span>
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Target: <strong style={{ color: '#ffffff' }}>{status.targetUrl}</strong>
              </div>
            </div>
            <button
              onClick={handleStop}
              className="btn btn-danger"
              disabled={loading}
              style={{ minWidth: '160px' }}
            >
              <Square size={16} /> Stop & Compile
            </button>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '6px',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Live Stream Panel */}
      {status.isRecording && (
        <div className="glass-panel">
          <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} className="logo-accent" /> Live Interaction Stream
          </h3>
          <div className="terminal-window">
            {events.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Waiting for actions inside the launched browser...
              </div>
            ) : (
              events.map((ev, index) => (
                <div key={ev.id} className="terminal-line" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>[{new Date(ev.timestamp).toLocaleTimeString()}]</span>
                  
                  {ev.type === 'navigate' && (
                    <>
                      <span className="badge badge-info" style={{ gap: '4px' }}><Navigation size={10} /> NAVIGATE</span>
                      <span style={{ color: 'var(--text-primary)' }}>{ev.url}</span>
                    </>
                  )}

                  {ev.type === 'click' && (
                    <>
                      <span className="badge badge-success" style={{ gap: '4px' }}><MousePointer size={10} /> CLICK</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {ev.role ? `Role [${ev.role}] "${ev.name}"` : `Selector "${ev.selector}"`}
                      </span>
                    </>
                  )}

                  {ev.type === 'fill' && (
                    <>
                      <span className="badge badge-warning" style={{ gap: '4px' }}><Edit3 size={10} /> INPUT</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        Fill {ev.role ? `Role [${ev.role}] "${ev.name}"` : `Selector "${ev.selector}"`} with value "<strong>{ev.value}</strong>"
                      </span>
                    </>
                  )}

                  {ev.type === 'assert_visible' && (
                    <>
                      <span className="badge badge-info" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}><CheckCircle size={10} /> ASSERT VISIBLE</span>
                      <span style={{ color: '#34d399' }}>Element exists at {ev.selector}</span>
                    </>
                  )}

                  {ev.type === 'assert_text' && (
                    <>
                      <span className="badge badge-info" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}><CheckCircle size={10} /> ASSERT TEXT</span>
                      <span style={{ color: '#34d399' }}>Element text matches "<strong>{ev.text}</strong>"</span>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={eventLogEndRef} />
          </div>
        </div>
      )}

      {/* Completion Panel */}
      {completedTest && (
        <div className="glass-panel" style={{
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <CheckCircle size={20} /> Playwright Test Generated!
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Successfully recorded <strong>{completedTest.count}</strong> actions and saved file as <strong style={{ color: '#ffffff' }}>{completedTest.fileName}</strong>.
            </p>
          </div>
          <button
            onClick={() => onNavigateToEditor(completedTest.fileName)}
            className="btn btn-success"
            style={{ fontWeight: '600' }}
          >
            Open in Code Editor
          </button>
        </div>
      )}

    </div>
  );
}
