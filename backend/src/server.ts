import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { startRecording, stopRecording, recordEvent, getRecordingStatus } from './recorder.js';
import { compileToBasicPlaywright, refineTestWithLLM } from './generator.js';
import { listTestSpecs, readTestSpec, writeTestSpec, runPlaywrightTest } from './runner.js';
import { healTestFile } from './healer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;
const CONFIG_PATH = path.join(BACKEND_DIR, 'config.json');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static screenshots and traces
app.use('/test-results', express.static(path.join(BACKEND_DIR, 'test-results')));

// Ensure default tests directory exists
const testsDir = path.join(BACKEND_DIR, 'tests');
if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir, { recursive: true });
}

// Helpers for Settings Config
interface AppSettings {
  provider: 'gemini' | 'openai' | 'none';
  apiKey: string;
  modelName: string;
}

function loadSettings(): AppSettings {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading config.json, using defaults.', e);
    }
  }
  
  // Try environment variables as fallback
  return {
    provider: (process.env.LLM_PROVIDER as any) || 'none',
    apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
    modelName: process.env.LLM_MODEL || ''
  };
}

function saveSettings(settings: AppSettings) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

// API Endpoints

// 1. Settings management
app.get('/api/settings', (req, res) => {
  res.json(loadSettings());
});

app.post('/api/settings', (req, res) => {
  const { provider, apiKey, modelName } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'LLM Provider is required' });
  }
  
  const settings: AppSettings = {
    provider,
    apiKey: apiKey || '',
    modelName: modelName || ''
  };
  saveSettings(settings);
  res.json({ message: 'Settings saved successfully.', settings });
});

// 2. Start browser session recording
app.post('/api/start-recording', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Target URL is required.' });
  }

  console.log(`Starting recording session for target URL: ${url}`);
  try {
    // Start headful browser and inject recorder script.
    // Pass backend port so browser script knows where to stream events.
    await startRecording(url, Number(PORT));
    io.emit('status-update', getRecordingStatus());
    res.json({ message: 'Recording session started.' });
  } catch (err) {
    console.error('Failed to start recording browser:', err);
    res.status(500).json({ error: `Could not launch browser: ${(err as Error).message}` });
  }
});

// 3. Receive recording event from injected browser script
app.post('/api/record-event', (req, res) => {
  const event = req.body;
  if (!event || !event.type) {
    return res.status(400).json({ error: 'Invalid event payload.' });
  }

  console.log(`Event captured: ${event.type} on selector ${event.selector || 'N/A'}`);
  recordEvent(event);
  
  // Stream event update to frontend
  io.emit('event-recorded', {
    event,
    status: getRecordingStatus()
  });
  
  res.sendStatus(200);
});

// 4. Stop recording session and trigger code generator
app.post('/api/stop-recording', async (req, res) => {
  console.log('Stopping recording session...');
  try {
    const statusBefore = getRecordingStatus();
    const events = await stopRecording();
    io.emit('status-update', getRecordingStatus());

    if (events.length === 0) {
      return res.status(400).json({ error: 'No user events were recorded.' });
    }

    // Process target test name
    const timestamp = Date.now();
    const parsedUrl = new URL(statusBefore.targetUrl);
    const domainClean = parsedUrl.hostname.replace(/[^a-zA-Z0-9]/g, '_');
    const testFileName = `test_${domainClean}_${timestamp}.spec.ts`;
    const testSuiteName = `Recorded suite for ${parsedUrl.hostname}`;

    // Compile events to raw TypeScript Playwright code
    const draftCode = compileToBasicPlaywright(events, testSuiteName);

    // If API keys are set up, refine with LLM
    const settings = loadSettings();
    let finalCode = draftCode;
    
    if (settings.provider !== 'none' && settings.apiKey) {
      console.log(`Refining generated test code using LLM provider: ${settings.provider}`);
      io.emit('status-message', { message: 'Refining test code using Artificial Intelligence...' });
      finalCode = await refineTestWithLLM(draftCode, events, settings);
    }

    // Save spec to tests dir
    writeTestSpec(testFileName, finalCode);

    res.json({
      message: 'Recording stopped. Playwright test compiled.',
      testFileName,
      eventsCount: events.length,
      code: finalCode
    });
  } catch (err) {
    console.error('Failed to stop recording:', err);
    res.status(500).json({ error: `Could not save recording: ${(err as Error).message}` });
  }
});

// 5. Check recording status
app.get('/api/recording-status', (req, res) => {
  res.json(getRecordingStatus());
});

// 6. Test spec files management
app.get('/api/tests', (req, res) => {
  try {
    const tests = listTestSpecs();
    res.json({ tests });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/tests/:name', (req, res) => {
  const { name } = req.params;
  try {
    const content = readTestSpec(name);
    res.json({ name, content });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.post('/api/tests/:name', (req, res) => {
  const { name } = req.params;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required.' });
  }
  try {
    writeTestSpec(name, content);
    res.json({ message: 'File saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/tests/:name', (req, res) => {
  const { name } = req.params;
  const filePath = path.join(testsDir, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }
  try {
    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 7. Run a test file programmatically
app.post('/api/tests/:name/run', async (req, res) => {
  const { name } = req.params;
  console.log(`Triggering test run for: ${name}`);
  
  // Notify frontend execution started
  io.emit('run-started', { name });

  try {
    // Run the test and bind log callback to Socket.io stream
    const result = await runPlaywrightTest(name, (log) => {
      io.emit('run-log', { name, log });
    });
    
    // Normalize attachment screenshot paths if they exist
    if (result.screenshotPath) {
      // Convert absolute path to a URL reachable via our static server
      const relative = path.relative(path.join(BACKEND_DIR, 'test-results'), result.screenshotPath);
      result.screenshotPath = `http://localhost:${PORT}/test-results/${relative.replace(/\\/g, '/')}`;
    }
    
    io.emit('run-finished', { name, result });
    res.json(result);
  } catch (err) {
    console.error(`Error during running test ${name}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// 8. Self-heal a failing test
app.post('/api/tests/:name/heal', async (req, res) => {
  const { name } = req.params;
  console.log(`Triggering self-healing agent loop for: ${name}`);
  
  const settings = loadSettings();
  if (settings.provider === 'none' || !settings.apiKey) {
    return res.status(400).json({ error: 'Self-healing requires Gemini or OpenAI API keys to be configured.' });
  }

  try {
    io.emit('heal-status', { name, status: 'diagnosing', message: 'Analyzing test failure and stack trace...' });
    
    // Execute self-healing loop
    const result = await healTestFile(name, settings);
    
    io.emit('heal-status', { 
      name, 
      status: 'success', 
      message: 'Test successfully healed and verified!', 
      result 
    });
    
    res.json(result);
  } catch (err) {
    console.error(`Self-healing failed for ${name}:`, err);
    io.emit('heal-status', { 
      name, 
      status: 'failed', 
      message: `Healing failed: ${(err as Error).message}` 
    });
    res.status(500).json({ error: (err as Error).message });
  }
});

// Server listener
server.listen(PORT, () => {
  console.log(`E2E Testing Agent backend running on http://localhost:${PORT}`);
});
