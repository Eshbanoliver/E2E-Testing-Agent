import { RecordedEvent } from './recorder.js';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

interface LLMConfig {
  provider: 'gemini' | 'openai' | 'none';
  apiKey: string;
  modelName?: string;
}

/**
 * Base compiler to compile recorded events into standard TypeScript Playwright test code.
 * Works out-of-the-box without requiring an LLM API key.
 */
export function compileToBasicPlaywright(events: RecordedEvent[], testName: string = 'Recorded User Session'): string {
  const steps: string[] = [];

  for (const event of events) {
    const timestampComment = `// Action recorded at ${new Date(event.timestamp).toLocaleTimeString()}`;
    
    switch (event.type) {
      case 'navigate':
        steps.push(`  ${timestampComment}`);
        steps.push(`  await page.goto('${event.url}');`);
        break;

      case 'click':
        steps.push(`  ${timestampComment}`);
        if (event.role && event.name) {
          // Use modern getByRole locator
          const escapedName = event.name.replace(/'/g, "\\'");
          steps.push(`  await page.getByRole('${event.role}', { name: '${escapedName}' }).click();`);
        } else if (event.selector) {
          steps.push(`  await page.locator('${event.selector}').click();`);
        }
        break;

      case 'fill':
        steps.push(`  ${timestampComment}`);
        const escapedValue = (event.value || '').replace(/'/g, "\\'");
        if (event.role && event.name) {
          const escapedName = event.name.replace(/'/g, "\\'");
          steps.push(`  await page.getByRole('${event.role}', { name: '${escapedName}' }).fill('${escapedValue}');`);
        } else if (event.selector) {
          steps.push(`  await page.locator('${event.selector}').fill('${escapedValue}');`);
        }
        break;

      case 'assert_visible':
        steps.push(`  // Assert Visibility recorded at ${new Date(event.timestamp).toLocaleTimeString()}`);
        if (event.selector) {
          steps.push(`  await expect(page.locator('${event.selector}')).toBeVisible();`);
        }
        break;

      case 'assert_text':
        steps.push(`  // Assert Text Content recorded at ${new Date(event.timestamp).toLocaleTimeString()}`);
        if (event.selector) {
          const escapedText = (event.text || '').replace(/'/g, "\\'");
          steps.push(`  await expect(page.locator('${event.selector}')).toContainText('${escapedText}');`);
        }
        break;
      
      case 'scroll':
        // Scroll is captured but usually optional in simple tests. We can add comment
        steps.push(`  // User scrolled page`);
        break;
    }
    steps.push(''); // Add spacing between steps
  }

  // Wrap in standard Playwright template
  return `import { test, expect } from '@playwright/test';

test('${testName}', async ({ page }) => {
${steps.join('\n')}
});
`;
}

/**
 * Refines the draft Playwright code using an LLM (Gemini or OpenAI) to add robust
 * selectors, descriptive test block naming, structured waits, and clean annotations.
 */
export async function refineTestWithLLM(
  draftCode: string, 
  events: RecordedEvent[], 
  config: LLMConfig
): Promise<string> {
  if (config.provider === 'none' || !config.apiKey) {
    return draftCode;
  }

  const prompt = `You are a senior QA automation engineer specializing in Playwright and TypeScript.
Your job is to optimize, clean up, and polish a draft Playwright test that was auto-generated from a user recording session.

Here is the raw action event log:
${JSON.stringify(events, null, 2)}

Here is the draft code generated:
\`\`\`typescript
${draftCode}
\`\`\`

Refine this test code by following these rules:
1. Ensure the Playwright test is written in clean, modern TypeScript.
2. Use accessibility locators like page.getByRole, page.getByLabel, page.getByPlaceholder, page.getByText where appropriate instead of fragile CSS selectors.
3. Keep the assertions (expect) that the user explicitly added (assert_visible, assert_text).
4. Add clear, descriptive comments inside the test explaining what each step does.
5. Create a descriptive test name inside the test() block.
6. Ensure any input or button target selector is robust.
7. Return ONLY the polished TypeScript code block. Do NOT include markdown code blocks (e.g. \`\`\`typescript) or any introductory/concluding chat text. Return just the raw code.`;

  try {
    if (config.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const model = config.modelName || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      
      let text = response.text || '';
      // Clean up markdown block wrappers if LLM returned them anyway
      text = text.replace(/^```typescript\n/, '').replace(/^```\n/, '').replace(/\n```$/, '').trim();
      return text;
    } else if (config.provider === 'openai') {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const model = config.modelName || 'gpt-4o-mini';
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      let text = response.choices[0].message.content || '';
      text = text.replace(/^```typescript\n/, '').replace(/^```\n/, '').replace(/\n```$/, '').trim();
      return text;
    }
  } catch (error) {
    console.error('LLM Code Refinement failed. Returning draft code.', error);
    return `// Note: LLM refinement failed: ${(error as Error).message}\n// Returning default generated draft.\n\n` + draftCode;
  }

  return draftCode;
}
