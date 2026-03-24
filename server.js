const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. BOOTSTRAP ---
const server = http.createServer(app);
server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});

// --- 2. CONFIG ---
app.use(express.json());
const distPath = path.join(__dirname, 'dist');

// Health Check
app.get('/api/health', (req, res) => res.status(200).send('Sergio is alive'));

// --- 3. IA ENGINE ---
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
            console.log('AI Engine ready');
        } catch (e) {
            console.error('AI Init Error:', e.message);
        }
    }
};

app.post('/api/chat', async (req, res) => {
    initAI();
    if (!genAI || !orchestrator) return res.status(500).send('IA Error');
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

// --- 4. STATIC & SPA ---
app.use(express.static(distPath));

// COMPATIBILIDAD TOTAL EXPRESS 5 PARA SPA
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const index = path.join(distPath, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.status(404).send('Not Found');
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).send('Internal Server Error');
});
