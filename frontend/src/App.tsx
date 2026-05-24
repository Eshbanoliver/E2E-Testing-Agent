import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { LayoutDashboard, Radio, FileCode2, PlayCircle, Settings as SettingsIcon, Terminal } from 'lucide-react';

import Dashboard from './components/Dashboard.jsx';
import Recorder from './components/Recorder.jsx';
import TestEditor from './components/TestEditor.jsx';
import TestRunner from './components/TestRunner.jsx';
import Settings from './components/Settings.jsx';

const BACKEND_URL = 'http://localhost:3001';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedTestFile, setSelectedTestFile] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize socket.io connection
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to backend WebSocket server.');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from backend WebSocket server.');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleNavigateToEditor = (testName: string) => {
    setSelectedTestFile(testName);
    setActiveTab('editor');
  };

  const handleRunTest = (testName: string) => {
    setSelectedTestFile(testName);
    setActiveTab('runner');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Sidebar Navigation */}
      <div className="sidebar">
        
        {/* App Logo */}
        <div className="app-logo">
          <Terminal size={26} className="logo-accent" />
          <div className="logo-text">
            E2E <span className="logo-accent">AGENT</span>
          </div>
        </div>

        {/* Navigation links */}
        <div style={{ flex: 1 }}>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`btn nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none' }}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('recorder')} 
            className={`btn nav-link ${activeTab === 'recorder' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none' }}
          >
            <Radio size={18} /> Session Recorder
          </button>
          
          <button 
            onClick={() => setActiveTab('editor')} 
            className={`btn nav-link ${activeTab === 'editor' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none' }}
          >
            <FileCode2 size={18} /> Test Editor
          </button>
          
          <button 
            onClick={() => setActiveTab('runner')} 
            className={`btn nav-link ${activeTab === 'runner' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none' }}
          >
            <PlayCircle size={18} /> Test Runner
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`btn nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none' }}
          >
            <SettingsIcon size={18} /> Settings
          </button>
        </div>

        {/* Socket status indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: connected ? 'var(--success)' : 'var(--error)',
            boxShadow: connected ? '0 0 8px var(--success-glow)' : '0 0 8px var(--error-glow)'
          }}></span>
          <span>{connected ? 'SERVER: ONLINE' : 'SERVER: OFFLINE'}</span>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="main-content" style={{ flex: 1 }}>
        {activeTab === 'dashboard' && (
          <Dashboard backendUrl={BACKEND_URL} onNavigate={setActiveTab} />
        )}
        
        {activeTab === 'recorder' && (
          <Recorder 
            backendUrl={BACKEND_URL} 
            socket={socket} 
            onNavigateToEditor={handleNavigateToEditor} 
          />
        )}
        
        {activeTab === 'editor' && (
          <TestEditor 
            backendUrl={BACKEND_URL}
            selectedTestFile={selectedTestFile}
            setSelectedTestFile={setSelectedTestFile}
            onRunTest={handleRunTest}
          />
        )}
        
        {activeTab === 'runner' && (
          <TestRunner 
            backendUrl={BACKEND_URL}
            socket={socket}
            selectedTestFile={selectedTestFile}
            setSelectedTestFile={setSelectedTestFile}
          />
        )}
        
        {activeTab === 'settings' && (
          <Settings backendUrl={BACKEND_URL} />
        )}
      </div>

    </div>
  );
}
