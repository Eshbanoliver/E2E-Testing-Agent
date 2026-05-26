import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FileText, Save, Trash2, Play, RefreshCw, FolderOpen } from 'lucide-react';

interface TestEditorProps {
  backendUrl: string;
  selectedTestFile: string | null;
  setSelectedTestFile: (name: string | null) => void;
  onRunTest: (testName: string) => void;
}

export default function TestEditor({ backendUrl, selectedTestFile, setSelectedTestFile, onRunTest }: TestEditorProps) {
  const [testFiles, setTestFiles] = useState<string[]>([]);
  const [code, setCode] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fetch test files list
  const fetchFiles = () => {
    setLoading(true);
    fetch(`${backendUrl}/api/tests`)
      .then(res => res.json())
      .then(data => {
        setTestFiles(data.tests || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFiles();
  }, [backendUrl]);

  // Load code when selected file changes
  useEffect(() => {
    if (!selectedTestFile) {
      setCode('');
      return;
    }

    fetch(`${backendUrl}/api/tests/${selectedTestFile}`)
      .then(res => res.json())
      .then(data => {
        setCode(data.content || '');
        setSaveStatus('');
      })
      .catch(err => console.error(err));
  }, [selectedTestFile, backendUrl]);

  const handleSave = () => {
    if (!selectedTestFile) return;
    setSaveStatus('Saving...');
    
    fetch(`${backendUrl}/api/tests/${selectedTestFile}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: code })
    })
      .then(res => {
        if (!res.ok) throw new Error('Save failed.');
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
      })
      .catch(err => {
        setSaveStatus(`Error: ${err.message}`);
      });
  };

  const handleDelete = () => {
    if (!selectedTestFile) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedTestFile}?`)) return;

    fetch(`${backendUrl}/api/tests/${selectedTestFile}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (!res.ok) throw new Error('Delete failed.');
        setSelectedTestFile(null);
        fetchFiles();
      })
      .catch(err => alert(err.message));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px', height: 'calc(100vh - 120px)' }}>
      
      {/* File list sidebar */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          <FolderOpen size={18} className="logo-accent" /> Test Suites
          <button 
            onClick={fetchFiles}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <RefreshCw size={14} />
          </button>
        </h3>

        {loading && testFiles.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
        ) : testFiles.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
            No recorded specs found. Use the Recorder to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {testFiles.map(file => (
              <button
                key={file}
                onClick={() => setSelectedTestFile(file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  textAlign: 'left',
                  background: selectedTestFile === file ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                  border: 'none',
                  borderLeft: selectedTestFile === file ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '10px 8px',
                  borderRadius: '0 6px 6px 0',
                  color: selectedTestFile === file ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: selectedTestFile === file ? '600' : '400',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                <FileText size={14} style={{ flexShrink: 0 }} />
                {file}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Code Editor view */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
        {selectedTestFile ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Editor Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(255, 255, 255, 0.01)'
            }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>EDITING FILE</span>
                <h4 style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{selectedTestFile}</h4>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {saveStatus && (
                  <span style={{
                    fontSize: '12px',
                    color: saveStatus.includes('Error') ? 'var(--error)' : 'var(--success)',
                    marginRight: '8px'
                  }}>{saveStatus}</span>
                )}
                
                <button onClick={handleSave} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
                  <Save size={14} /> Save
                </button>
                
                <button 
                  onClick={() => onRunTest(selectedTestFile)} 
                  className="btn btn-primary" 
                  style={{ padding: '8px 12px' }}
                >
                  <Play size={14} /> Run Test
                </button>

                <button 
                  onClick={handleDelete} 
                  className="btn btn-danger" 
                  style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.05)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Editor
                height="100%"
                language="typescript"
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  automaticLayout: true,
                  padding: { top: 12 }
                }}
              />
            </div>
            
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-secondary)',
            gap: '12px'
          }}>
            <FileText size={48} style={{ opacity: 0.15 }} />
            <div style={{ fontSize: '14px' }}>Select a test spec file from the sidebar to view or edit.</div>
          </div>
        )}
      </div>

    </div>
  );
}
