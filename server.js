const path = require('path');
const fs = require('fs');

// Solo cargar dotenv en local
if (process.env.NODE_ENV !== 'production') {
    try { require('dotenv').config(); } catch (e) {}
}

const express = require('express');
const { WebSocket, WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Variables para carga perezosa (lazy load)
let unifiedSystemInstruction = null;
let genAI = null;

function getAI() {
    if (!genAI) {
        const { unifiedSystemInstruction: instr } = require('./agents/orchestrator');
        unifiedSystemInstruction = instr;
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    }
    return { genAI, unifiedSystemInstruction };
}

// --- Health Check Inmediato ---
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', port });
});

// --- API de Chat ---
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).send('Mensaje vacío.');

  try {
    const { genAI, unifiedSystemInstruction } = getAI();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: unifiedSystemInstruction 
    });
    
    const chat = model.startChat({
      history: (history || []).map(h => ({
        role: h.role === 'bot' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text || (h.parts && h.parts[0].text) || '' }],
      })),
    });
    
    const result = await chat.sendMessage(message);
    const response = await result.response;
    res.send(response.text());
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// --- Servidor HTTP y WebSockets ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Voice session started');
    const apiKey = process.env.GEMINI_API_KEY;
    const googleWs = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`);

    googleWs.on('open', () => console.log('Connected to Google AI'));
    ws.on('message', (msg) => { if (googleWs.readyState === WebSocket.OPEN) googleWs.send(msg); });
    googleWs.on('message', (data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data); });
    ws.on('close', () => googleWs.close());
    googleWs.on('close', () => ws.close());
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  const indexFile = path.join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send('Build not found. Check Cloud Build logs.');
  }
});

// ARRANQUE CRÍTICO: Escuchar inmediatamente en 0.0.0.0
server.listen(port, '0.0.0.0', () => {
  console.log(`Butler is live on 0.0.0.0:${port}`);
});
