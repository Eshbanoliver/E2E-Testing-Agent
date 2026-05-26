import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

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

/**
 * Runs a specific Playwright test spec file inside backend/tests.
 * Returns structured results after parsing Playwright's JSON report.
 */
export async function runPlaywrightTest(
  testFileName: string,
  onLog?: (log: string) => void
): Promise<TestRunResult> {
  const testPath = path.join('tests', testFileName);
  
  // Ensure the test-results directory exists and clean old results
  const resultsJsonPath = path.join(BACKEND_DIR, 'test-results', 'results.json');
  if (fs.existsSync(resultsJsonPath)) {
    try {
      fs.unlinkSync(resultsJsonPath);
    } catch (e) {
      console.error('Could not delete old results.json:', e);
    }
  }

  // Build the command
  // We use --config to point to our config file
  const cmd = `npx playwright test "${testPath}" --config=playwright.config.ts`;
  console.log(`Executing test command: ${cmd} in Cwd: ${BACKEND_DIR}`);

  return new Promise((resolve) => {
    const child = exec(cmd, { cwd: BACKEND_DIR }, (error, stdout, stderr) => {
      const output = stdout + '\n' + stderr;
      console.log('Test run stdout/stderr captured.');

      // Check if the JSON report was written
      if (!fs.existsSync(resultsJsonPath)) {
        // Playwright failed to compile or run, return raw output
        resolve({
          success: false,
          output,
          error: {
            message: error ? error.message : 'Playwright failed to execute and did not produce a report.',
            stack: stderr
          }
        });
        return;
      }

      try {
        const reportRaw = fs.readFileSync(resultsJsonPath, 'utf8');
        const report = JSON.parse(reportRaw);
        
        let success = true;
        let testError: any = undefined;
        let screenshotPath: string | undefined = undefined;
        let tracePath: string | undefined = undefined;

        // Helper to extract specs recursively from nested suites
        const extractSpecsRecursive = (suite: any): any[] => {
          let specs = [...(suite.specs || [])];
          if (suite.suites) {
            for (const subSuite of suite.suites) {
              specs.push(...extractSpecsRecursive(subSuite));
            }
          }
          return specs;
        };

        // Traverse JSON structure to extract errors and attachments
        if (report.suites && report.suites.length > 0) {
          const allSpecs: any[] = [];
          for (const suite of report.suites) {
            allSpecs.push(...extractSpecsRecursive(suite));
          }
          
          if (allSpecs.length === 0) {
            success = false;
            testError = {
              message: 'No tests found in suite.',
              stack: output
            };
          } else {
            for (const spec of allSpecs) {
              for (const testItem of spec.tests) {
                for (const result of testItem.results) {
                  if (result.status !== 'passed') {
                    success = false;
                    
                    if (result.errors && result.errors.length > 0) {
                      const firstErr = result.errors[0];
                      
                      // Try to parse out the locator / selector from error message
                      let selector: string | undefined = undefined;
                      const selectorMatch = firstErr.message.match(/waiting for locator\('([^']+)'\)/) 
                         || firstErr.message.match(/locator\('([^']+)'\)/);
                      if (selectorMatch) {
                        selector = selectorMatch[1];
                      }

                      testError = {
                        message: firstErr.message,
                        stack: firstErr.stack,
                        line: firstErr.location?.line,
                        file: firstErr.location?.file,
                        selector
                      };
                    }
                  }

                  // Look for attachments
                  if (result.attachments) {
                    for (const att of result.attachments) {
                      if (att.name === 'screenshot') {
                        screenshotPath = att.path;
                      } else if (att.name === 'trace') {
                        tracePath = att.path;
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          // If suites is empty, maybe there was no test found
          success = false;
          testError = {
            message: 'No tests found in suite.',
            stack: output
          };
        }

        resolve({
          success,
          output,
          error: testError,
          screenshotPath,
          tracePath
        });

      } catch (err) {
        resolve({
          success: false,
          output,
          error: {
            message: `Failed to parse Playwright JSON report: ${(err as Error).message}`,
            stack: (err as Error).stack
          }
        });
      }
    });

    if (onLog) {
      child.stdout?.on('data', (data) => onLog(data.toString()));
      child.stderr?.on('data', (data) => onLog(data.toString()));
    }
  });
}

/**
 * Lists all test spec files inside backend/tests directory.
 */
export function listTestSpecs(): string[] {
  const testsDir = path.join(BACKEND_DIR, 'tests');
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
    return [];
  }
  
  return fs.readdirSync(testsDir)
    .filter(file => file.endsWith('.spec.ts') || file.endsWith('.spec.js'));
}

/**
 * Reads the content of a test spec file.
 */
export function readTestSpec(fileName: string): string {
  const filePath = path.join(BACKEND_DIR, 'tests', fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${fileName} does not exist.`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Writes/Updates the content of a test spec file.
 */
export function writeTestSpec(fileName: string, content: string): void {
  const testsDir = path.join(BACKEND_DIR, 'tests');
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  
  const filePath = path.join(testsDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
}
