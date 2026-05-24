import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, Page, expect } from 'playwright';
import { runPlaywrightTest, TestRunResult, readTestSpec, writeTestSpec } from './runner.js';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

interface HealerConfig {
  provider: 'gemini' | 'openai' | 'none';
  apiKey: string;
  modelName?: string;
}

export interface HealingResult {
  success: boolean;
  originalCode: string;
  healedCode: string;
  healedLine: string;
  originalLine: string;
  diff: string;
}

/**
 * Extracts individual executable commands from the body of a Playwright test spec.
 */
function parseTestCommands(fileContent: string): { commands: string[]; testHeader: string; testFooter: string } {
  // Regex to match the body of test('...', async ({ page }) => { BODY })
  const testRegex = /(test\s*\(\s*['"][^'"]+['"]\s*,\s*async\s*\(\{\s*page\s*\}\)\s*=>\s*\{)([\s\S]*?)(\}\s*\);?\s*$)/;
  const match = fileContent.match(testRegex);
  
  if (!match) {
    throw new Error('Could not parse test structure. Ensure it follows standard Playwright test syntax.');
  }

  const testHeader = match[1];
  const body = match[2];
  const testFooter = match[3];

  // Split body by lines, clean up and keep only lines starting with await page or await expect
  const commands = body.split('\n')
    .map(line => line.trim())
    .filter(line => {
      return line.startsWith('await page.') || line.startsWith('await expect(');
    });

  return { commands, testHeader, testFooter };
}

/**
 * Executes commands sequentially up to the failedCommandIndex using eval.
 */
async function executeStepsUpTo(page: Page, commands: string[], stopBeforeIndex: number): Promise<void> {
  console.log(`Replaying ${stopBeforeIndex} setup steps in browser...`);
  
  for (let i = 0; i < stopBeforeIndex; i++) {
    const command = commands[i];
    console.log(`Replaying: ${command}`);
    
    // Evaluate in context. Eval has lexical access to 'page' and 'expect' parameters.
    try {
      await eval(command);
    } catch (err) {
      console.error(`Setup command failed during replay at step ${i}: ${command}`);
      throw new Error(`Replay setup failed at step [${command}]: ${(err as Error).message}`);
    }
  }
}

/**
 * The core self-healing controller.
 */
export async function healTestFile(
  testFileName: string,
  config: HealerConfig
): Promise<HealingResult> {
  if (config.provider === 'none' || !config.apiKey) {
    throw new Error('Self-healing requires Gemini or OpenAI API Key configuration.');
  }

  // 1. Run the test first to capture the exact failure location and message
  console.log(`Running initial test for ${testFileName} to diagnose failure...`);
  const initialRun: TestRunResult = await runPlaywrightTest(testFileName);
  
  if (initialRun.success) {
    throw new Error(`Test ${testFileName} passed successfully; no healing needed.`);
  }

  if (!initialRun.error) {
    throw new Error(`Test failed but did not return a structured error message: ${initialRun.output}`);
  }

  const { message: errorMessage, line: failedLineNumber, selector: failedSelector } = initialRun.error;
  
  // 2. Read and parse the test file
  const originalCode = readTestSpec(testFileName);
  const { commands } = parseTestCommands(originalCode);
  
  // Find which command in our commands list matches the failed line number
  const originalCodeLines = originalCode.split('\n');
  const rawFailedLine = originalCodeLines[(failedLineNumber || 1) - 1]?.trim() || '';
  
  console.log(`Failed line in file: "${rawFailedLine}" at line number: ${failedLineNumber}`);

  let failedCommandIndex = commands.findIndex(cmd => cmd.includes(rawFailedLine) || rawFailedLine.includes(cmd));
  
  if (failedCommandIndex === -1) {
    // Fallback: search by selector
    if (failedSelector) {
      failedCommandIndex = commands.findIndex(cmd => cmd.includes(failedSelector));
    }
  }

  if (failedCommandIndex === -1) {
    throw new Error(`Could not locate the failing statement in the parsed command list. Failing text: "${rawFailedLine}"`);
  }

  console.log(`Failing command index: ${failedCommandIndex} of ${commands.length}`);
  const failedLine = commands[failedCommandIndex];

  // 3. Launch browser programmatically, play commands up to the failed command index, and grab page DOM context
  const browser = await chromium.launch({ headless: true });
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  
  let pageHtml = '';
  
  try {
    // Run setup steps before the failure
    await executeStepsUpTo(page, commands, failedCommandIndex);
    
    // Give the page a moment to stabilize
    await page.waitForTimeout(2000);
    
    // Capture page source
    pageHtml = await page.content();
  } catch (replayError) {
    await browser.close();
    throw new Error(`Failed to recreate page state before failure: ${(replayError as Error).message}`);
  } finally {
    await browser.close();
  }

  // Truncate DOM snapshot to avoid massive tokens if page is huge (e.g. max 100k chars)
  const maxDomLength = 120000;
  if (pageHtml.length > maxDomLength) {
    pageHtml = pageHtml.substring(0, maxDomLength) + '\n\n... [HTML TRUNCATED] ...';
  }

  // 4. Query the LLM to get the healed line
  const prompt = `You are a self-healing test automation agent specializing in Playwright and TypeScript.
A test statement has failed during execution on a web page. Your task is to analyze the page HTML context and propose a corrected Playwright statement (TypeScript) to fix the failure.

Failed statement:
\`\`\`typescript
${failedLine}
\`\`\`

Playwright error message:
\`\`\`
${errorMessage}
\`\`\`

Failed selector/locator extracted:
${failedSelector || 'Unknown'}

Here is the HTML code of the page at the exact moment of failure:
\`\`\`html
${pageHtml}
\`\`\`

Find the correct element the statement was trying to target (e.g., text might have changed slightly, classes might have changed, or structure was altered).
Return the updated, fully-formed Playwright TypeScript command to replace the failed statement.

RULES:
1. Prefer accessible locators like page.getByRole('button', { name: 'Name' }), page.getByLabel, page.getByPlaceholder, page.getByText where applicable.
2. Return ONLY the single replacement line of code.
3. Do NOT wrap the code in markdown code blocks (no \`\`\`typescript or \`\`\`).
4. Do NOT add notes, greetings, explanations, or comments. Just the line of code.

Example Output:
await page.getByRole('button', { name: 'Submit Request' }).click();`;

  let healedLine = '';
  console.log('Requesting healed selector from LLM...');
  
  if (config.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const model = config.modelName || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    healedLine = response.text || '';
  } else if (config.provider === 'openai') {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const model = config.modelName || 'gpt-4o-mini';
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });
    healedLine = response.choices[0].message.content || '';
  }

  // Clean up LLM response
  healedLine = healedLine.replace(/^```typescript\n/, '').replace(/^```\n/, '').replace(/\n```$/, '').trim();
  
  if (!healedLine) {
    throw new Error('LLM failed to return a healed statement.');
  }

  console.log(`Proposed healed line: "${healedLine}"`);

  // 5. Replace in file content
  // Find where failedLine occurs in the original text file and replace it
  const originalIndexInFile = originalCodeLines.findIndex(line => line.trim() === failedLine);
  if (originalIndexInFile === -1) {
    throw new Error('Could not find the exact line matching the failed statement inside the raw file content.');
  }

  const originalLineContent = originalCodeLines[originalIndexInFile];
  // Preserve leading whitespace indentation
  const indentation = originalLineContent.match(/^\s*/)?.[0] || '';
  const healedLineWithIndents = indentation + healedLine;

  const updatedCodeLines = [...originalCodeLines];
  updatedCodeLines[originalIndexInFile] = healedLineWithIndents;
  const healedCode = updatedCodeLines.join('\n');

  // Write temporary healed code to test file
  writeTestSpec(testFileName, healedCode);

  // 6. Run the verification test
  console.log('Verifying healed code by running test suite again...');
  const verificationRun = await runPlaywrightTest(testFileName);

  if (verificationRun.success) {
    console.log('Verification SUCCESS. Test passed with healed code!');
    
    // Generate a simple unified diff
    const diff = `- ${originalLineContent.trim()}\n+ ${healedLine.trim()}`;
    
    return {
      success: true,
      originalCode,
      healedCode,
      healedLine,
      originalLine: originalLineContent,
      diff
    };
  } else {
    console.log('Verification FAILED. Reverting file back to original.');
    // Revert code back to original
    writeTestSpec(testFileName, originalCode);
    
    throw new Error(`Proposed fix ["${healedLine}"] failed verification test. Reverting changes. Error: ${verificationRun.error?.message}`);
  }
}
