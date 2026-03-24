const path = require('path');
const fs = require('fs');
const express = require('express');
const { WebSocket, WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
// Google Cloud Run usa la variable PORT (usualmente 8080 o 4000 según tu config)
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distPath = path.join(__dirname, 'dist');

// --- RUTAS CRÍTICAS ---

// 1. Salud (Health Check)
app.get('/api/health', (req, res) => res.status(200).send('OK'));

// 2. Servir la página principal explícitamente
app.get('/', (req, res) => {
    const indexFile = path.join(distPath, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send('Sitio en construcción. Si ves esto, el build de Vite falló.');
    }
});

// 3. Servir archivos estáticos
app.use(express.static(distPath));

// --- LÓGICA DE SERGIO ---
let orchestrator = null;
try {
    orchestrator = require('./agents/orchestrator');
} catch (e) {
    console.error('Error cargando agentes:', e);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).send('Incompleto');

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: orchestrator ? orchestrator.unifiedSystemInstruction : "Eres un asistente servicial."
    });
    
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
    res.status(500).send('Error de Sergio: ' + error.message);
  }
});

// --- SERVIDOR Y WEBSOCKETS ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const googleWs = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`);
    googleWs.on('open', () => console.log('Google AI Voice Connected'));
    ws.on('message', (msg) => { if (googleWs.readyState === 1) googleWs.send(msg); });
    googleWs.on('message', (data) => { if (ws.readyState === 1) ws.send(data); });
    ws.on('close', () => googleWs.close());
    googleWs.on('close', () => ws.close());
});

// Fallback para SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return;
    res.sendFile(path.join(distPath, 'index.html'));
});

// ESCUCHA OBLIGATORIA EN 0.0.0.0
server.listen(port, '0.0.0.0', () => {
  console.log(`>>> VIVE LIBRE ACTIVO EN PUERTO ${port} <<<`);
});
