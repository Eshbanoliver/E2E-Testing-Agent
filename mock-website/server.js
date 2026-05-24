const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  const isBroken = req.query.break === 'true';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mock E2E Testing Site</title>
      <style>
        body {
          background: #0f172a;
          color: #f8fafc;
          font-family: sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background: #1e293b;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          text-align: center;
        }
        button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          margin-top: 15px;
          transition: all 0.2s;
        }
        button:hover { background: #2563eb; }
        .success { color: #10b981; margin-top: 15px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>E2E Testing Agent Sandbox</h2>
        <p>This is a mock page to test recording and healing loops.</p>
        
        <!-- Simulate change in selector attributes -->
        \${isBroken ? \`
          <button id="healed-btn">Send Data</button>
        \` : \`
          <button id="action-btn">Submit Query</button>
        \`}
        
        <div id="result" style="display:none;" class="success">✓ Success! Interaction Recorded.</div>
      </div>
      <script>
        const btn = document.querySelector('button');
        btn.addEventListener('click', () => {
          document.getElementById('result').style.display = 'block';
        });
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Mock test website running on http://localhost:\${PORT}`);
});
