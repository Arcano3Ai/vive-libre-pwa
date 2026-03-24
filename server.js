const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. ARRANQUE INSTANTÁNEO ---
const server = http.createServer(app);
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Butler online on port ${port}`);
});

// --- 2. MIDDLEWARES ---
app.use(express.json());
const distPath = path.join(__dirname, 'dist');

// Health Check
app.get('/api/health', (req, res) => res.status(200).send('Sergio is alive'));

// --- 3. CARGA SEGURA DE IA ---
let genAI = null;
let orchestrator = null;

const initAI = () => {
    if (!genAI) {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const cors = require('cors');
            app.use(cors());
            orchestrator = require('./agents/orchestrator');
            genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
            console.log('✅ IA Engine ready');
        } catch (e) {
            console.error('❌ IA Load Error:', e.message);
        }
    }
};

// --- 4. ENDPOINTS ---
app.post('/api/chat', async (req, res) => {
    initAI();
    if (!genAI || !orchestrator) return res.status(500).send('IA no inicializada');
    
    const { message, history } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: orchestrator.unifiedSystemInstruction });
        const chat = model.startChat({
            history: (history || []).map(h => ({
                role: h.role === 'bot' || h.role === 'model' ? 'model' : 'user',
                parts: [{ text: h.text || '' }]
            }))
        });
        const result = await chat.sendMessage(message);
        const resp = await result.response;
        res.send(resp.text());
    } catch (e) {
        res.status(500).send('Error: ' + e.message);
    }
});

// --- 5. SERVIR WEB Y PWA ---
app.use(express.static(distPath));

// CORRECCIÓN EXPRESS 5: Wildcard debe ser (.*) o regex
app.get('/:path((.*))', (req, res) => {
    if (req.path.startsWith('/api')) return;
    const index = path.join(distPath, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.status(404).send('Sitio en construcción. Build de Vite no detectado.');
});
