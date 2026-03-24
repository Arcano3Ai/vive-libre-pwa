const path = require('path');
const fs = require('fs');

const express = require('express');
const { WebSocket, WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// FORCE CLOUD RUN PORT (8080) OR LOCAL (4000)
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Health check responding IMMEDIATELY
app.get('/api/health', (req, res) => res.status(200).send('OK'));

const { unifiedSystemInstruction } = require('./agents/orchestrator');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).send('Incompleto');
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: unifiedSystemInstruction });
    const chat = model.startChat({
      history: (history || []).map(h => ({
        role: h.role === 'bot' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text || '' }],
      })),
    });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    res.send(response.text());
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const googleWs = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`);
    googleWs.on('open', () => console.log('AI Connected'));
    ws.on('message', (msg) => { if (googleWs.readyState === 1) googleWs.send(msg); });
    googleWs.on('message', (data) => { if (ws.readyState === 1) ws.send(data); });
    ws.on('close', () => googleWs.close());
    googleWs.on('close', () => ws.close());
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return;
    const indexFile = path.join(distPath, 'index.html');
    if (fs.existsSync(indexFile)) res.sendFile(indexFile);
    else res.status(404).send('Not Found');
});

// START LISTENING ON 0.0.0.0
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
