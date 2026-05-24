export interface RecordedEvent {
  id: string;
  timestamp: number;
  type: 'navigate' | 'click' | 'fill' | 'assert_visible' | 'assert_text' | 'scroll';
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
  role?: string;
  name?: string;
  tagName?: string;
}

export interface RecordingStatus {
  isRecording: boolean;
  targetUrl: string;
  eventCount: number;
}

export interface TestRunResult {
  success: boolean;
  output: string;
  error?: {
    message: string;
    stack?: string;
    line?: number;
    file?: string;
    selector?: string;
  };
  screenshotPath?: string;
  tracePath?: string;
}

export interface AppSettings {
  provider: 'gemini' | 'openai' | 'none';
  apiKey: string;
  modelName: string;
}

export interface HealingResult {
  success: boolean;
  originalCode: string;
  healedCode: string;
  healedLine: string;
  originalLine: string;
  diff: string;
}
