# E2E Testing Agent

An autonomous, agentic web-application that writes and maintains Playwright tests by recording interactive user sessions in a headful browser and automatically healing failing tests using Large Language Models (LLMs). Built entirely in **TypeScript**, **Node.js**, **Express**, and **React (Vite)** with a premium glassmorphic UI.

## Key Features

- **Interactive User Session Recorder**: Launch a headful Chromium browser from the dashboard, perform your manual actions on the target site, and let the agent capture elements, clicks, keystrokes, and navigations.
- **Assertion Overlay Assistant**: While recording, use our on-page floating dashboard to select elements and add assertions like `toBeVisible()` or `toContainText()` instantly.
- **Smart TypeScript Playwright Generator**: Direct compiler of actions into clean Playwright scripts, refined by LLMs (Google Gemini or OpenAI) to apply accessibility roles (`getByRole`) and format appropriately.
- **Programmatic Runner**: Run tests directly from the web dashboard. Watch console outputs stream in real-time, view traces, and see screenshots of any failing states.
- **Self-Healing Agent**: If a selector breaks because a developer changed class names, IDs, or text:
  1. The agent re-runs the test in the background to the exact failure point.
  2. It grabs the HTML DOM and Accessibility Tree.
  3. It uses the LLM to locate the correct element, calculates the new selector, and replaces the broken code.
  4. It verifies the fix automatically.

---

## System Architecture

```
                                  +-----------------------+
                                  |   React Vite Client   |
                                  | (Glassmorphic Theme)  |
                                  +-----------+-----------+
                                              |
                                     Socket.io / HTTP
                                              |
                                              v
                                  +-----------+-----------+
                                  | Express Node.js Server|
                                  +-----+-----+-----+-----+
                                        |     |     |
                 +----------------------+     |     +----------------------+
                 |                            |                            |
                 v                            v                            v
      +----------+----------+       +---------+---------+       +----------+----------+
      |  Playwright Session |       | LLM Engine APIs   |       |  Playwright Runner  |
      |   (Chrome Browser)  |       | (Gemini / OpenAI) |       | & Self-Healing Loop |
      +---------------------+       +-------------------+       +---------------------+
```

---

## Project Structure

```
.
├── package.json             # Root monorepo configuration
├── tsconfig.json            # Global TypeScript compiler configuration
├── README.md                # This user guide
├── implementation_plan.md   # Architectural implementation blueprint
├── backend/                 # Node.js TypeScript API server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts        # Entrypoint (Express, Socket.io, API routing)
│   │   ├── recorder.ts      # Launches Playwright & injects event listeners
│   │   ├── generator.ts     # Generates and refines tests using LLMs
│   │   ├── runner.ts        # Executes test files programmatically
│   │   └── healer.ts        # Self-healing controller (re-run, DOM scan, LLM fix)
│   └── tests/               # Saved Playwright test specs (.spec.ts)
└── frontend/                # React Vite TypeScript Single Page App
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx         # Frontend bootloader
        ├── App.tsx          # Main Shell and Router
        ├── index.css        # Cyberpunk glassmorphic global styling
        ├── types.ts         # Shared interfaces
        └── components/      # UI Dashboard tabs
            ├── Dashboard.tsx
            ├── Recorder.tsx
            ├── TestEditor.tsx
            ├── TestRunner.tsx
            └── Settings.tsx
```

---

## Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Git](https://git-scm.com/)

### Step-by-step Setup

1. **Clone the repository and install root dependencies**:
   ```bash
   git clone https://github.com/Eshbanoliver/E2E-Testing-Agent.git
   cd E2E-Testing-Agent
   npm install
   ```

2. **Configure API Keys**:
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=3001
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   *(Alternatively, you can configure these keys dynamically directly within the **Settings** tab in the dashboard).*

3. **Install Playwright Browsers**:
   Ensure Playwright has its browser binaries installed:
   ```bash
   npx playwright install chromium
   ```

4. **Start in Development Mode**:
   From the root folder, run:
   ```bash
   npm run dev
   ```
   This will boot both the frontend client and backend server in parallel.

---

## How to Use the E2E Testing Agent

1. **Record a Test**:
   - Go to the **Recorder** tab on localhost.
   - Enter a target URL (e.g. `http://localhost:3000` or a live web application).
   - Click **"Start Recording"**. A headful browser will open.
   - Interact with the website. You will see events stream in real-time in the dashboard.
   - To verify elements, click the floating **"Assert Visible"** button on the target page, then click the element you want to assert.
   - Once finished, click **"Stop Recording"** inside the target page overlay or the dashboard.
   
2. **Review & Refine Code**:
   - In the **Test Editor** tab, view your generated TypeScript test suite.
   - If enabled, the agent uses the LLM to inject annotations, explain steps, and clean up selector syntax.
   - Save your changes directly from the editor.

3. **Run & Auto-Heal**:
   - Navigate to **Test Runner**.
   - Click **"Run Test"** next to your recorded file.
   - If it passes, a green success banner is shown.
   - If it fails (e.g. a selector was broken), click the **"Auto-Heal"** button. The autonomous agent will run the healing loop, pinpoint the updated selector in the page DOM via LLM, rewrite the test file, and present the fixed diff for validation.

---

## License

MIT License.
