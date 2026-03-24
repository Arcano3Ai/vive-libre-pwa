document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const lucideInit = () => { if (window.lucide) window.lucide.createIcons(); };

  // --- PARALLAX & NAVBAR ---
  window.addEventListener("scroll", () => {
    const s = window.pageYOffset;
    const parallaxBgs = document.querySelectorAll(".parallax-bg");
    parallaxBgs.forEach(bg => {
      const speed = 0.3;
      bg.style.transform = `translateY(${s * speed}px)`;
    });
    
    const navbar = $("navbar");
    if (navbar) {
        if (window.scrollY > 50) navbar.classList.add("scrolled");
        else navbar.classList.remove("scrolled");
    }
  });

  // --- REVEAL ON SCROLL ---
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting) e.target.classList.add("active"); });
  }, { threshold: 0.1 });

  // --- CABIN DATA & SWIPER CAROUSELS ---
  const loadCabins = async () => {
    const grid = $("cabin-grid");
    if (!grid) return;
    try {
      const res = await fetch('/cabins_data.json');
      const cabins = await res.json();
      
      grid.innerHTML = cabins.map(c => {
        const slides = c.images.map(img => `
          <div class="swiper-slide">
            <img src="${img}" alt="${c.title}" />
          </div>
        `).join('');

        return `
          <div class="cabin-card reveal">
            <div class="swiper cabin-swiper" id="swiper-${c.id}">
              <div class="swiper-wrapper">
                ${slides}
              </div>
              <div class="swiper-pagination"></div>
              <div class="swiper-button-next"></div>
              <div class="swiper-button-prev"></div>
            </div>
            <div class="cabin-details">
              <span class="price">Desde $${Math.round(c.price).toLocaleString()} MXN</span>
              <h3>${c.title}</h3>
              <div class="cabin-actions">
                <a href="https://wa.me/528121912778?text=Hola,%20quisiera%20información%20sobre%20${c.title}" target="_blank" class="btn-primary">RESERVAR</a>
              </div>
            </div>
          </div>
        `;
      }).join('');

      lucideInit();
      document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));
      
      // Initialize Swiper for each card
      cabins.forEach(c => {
        new Swiper(`#swiper-${c.id}`, {
          loop: true,
          pagination: { el: '.swiper-pagination', clickable: true },
          navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        });
      });
    } catch (e) { console.error("Error loading cabins:", e); }
  };

  // --- CONCIERGE BOT (TEXT & VOICE) ---
  const voiceBtn = $("toggle-voice");
  const muteBtn = $("toggle-mute");
  const botMsgs = $("bot-messages");
  const botInput = $("bot-input");
  const sendBtn = $("send-bot-msg");
  const botWindow = $("bot-window");
  const botLauncher = $("bot-launcher");
  const closeBot = $("close-bot");

  let history = [];
  let voiceActive = false;
  let isMuted = false;
  let wsSession = null;
  let audioContext = null;
  let micContext = null;
  let aiAnalyser = null;
  let nextAudioTime = 0;
  let activeAudioSources = [];

  const MODEL = 'models/gemini-2.5-flash';
  const SYSTEM_INSTRUCTION = `
Eres Sergio, el Concierge de Vive Libre Travel Club. 
Tu personalidad es atenta, servicial y relajada (casual), pero siempre profesional. 
Regla de oro: Habla de 'tú' al huésped. Sé breve (máximo 3 oraciones) y muéstrate siempre dispuesto a ayudar con una vibra positiva.

CONOCIMIENTO DE NUESTRAS VILLAS:
- Pájaro Azul: $3100, Contenedor de lujo, ventana cenital. Capacidad: 2 adultos (1 Queen). Jacuzzi extra $2000.
- El Búho: $3900, Inspiración en carpas africanas, malla de descanso. Capacidad: 2 adultos (1 King).
- El Colibrí: $3900, Diseño moderno en contenedor. Capacidad: 2 adultos (1 Queen). Jacuzzi extra $2000.
- El Águila: $3900, Estilo alpino romántico. Capacidad: 2 adultos (1 Matrimonial). Jacuzzi extra $2000.
- El Águila 2: $3900, Alpino moderno con tina. Capacidad: 2 adultos (1 Queen). Jacuzzi extra $1500.
- El Cotorro: $3900, Villa de lujo para parejas. Capacidad: 2 adultos (1 King). Alberca extra $2000.
- Los Cotorritos: $16500, Conjunto de 3 villas para familias. 4 adultos y 2 menores. (Adulto extra $1200).
- La Cotorra: $16500, Infinity pool, grupos grandes. 4 adultos y 2 menores. (Adulto extra $1200).

SANTIAGO, N.L. (ACTIVIDADES): Cascada Cola de Caballo, Presa de la Boca, Pueblo Mágico, Matacanes, Mirador.
GASTRONOMÍA: Las Palomas (alta cocina), El Mesón (rústico), Los Cavazos (antojitos), La Enchilada, Tacos de la Vía.

Usted habla directamente con el usuario por voz. Mantenga el tono cordial, atento y casual.
`;

  const addMsg = (txt, type) => {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerHTML = txt.replace(/\n/g, '<br>');
    botMsgs.appendChild(div);
    botMsgs.scrollTop = botMsgs.scrollHeight;
    return div;
  };

  // --- Mute Logic ---
  if (muteBtn) {
    muteBtn.onclick = () => {
      isMuted = !isMuted;
      muteBtn.style.color = isMuted ? "#ff4444" : "#f37021";
      muteBtn.innerHTML = isMuted ? '<i data-lucide="mic-off"></i>' : '<i data-lucide="mic"></i>';
      lucideInit();
    };
  }

  // --- VOICE LOGIC (NATIVE SYNC) ---
  async function startMic() {
    try {
        console.log("Starting Mic...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        
        // Cargar el procesador de audio
        const processorUrl = '/audio-processor.js';
        console.log("Loading AudioWorklet from:", processorUrl);
        await micContext.audioWorklet.addModule(processorUrl);
        
        const source = micContext.createMediaStreamSource(stream);
        const processor = new AudioWorkletNode(micContext, 'audio-processor');
        
        processor.port.onmessage = (e) => {
            if (!voiceActive || !wsSession || wsSession.readyState !== WebSocket.OPEN) return;
            if (isMuted) return;

            const f32 = e.data;
            const pcm16 = new Int16Array(f32.length);
            let max = 0;
            for (let i = 0; i < f32.length; i++) {
                const s = Math.max(-1, Math.min(1, f32[i]));
                if (Math.abs(s) > max) max = Math.abs(s);
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            if (max > 0.15) { stopAIAudio(); }

            const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
            wsSession.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }] } }));
        };
        source.connect(processor);
        processor.connect(micContext.destination);
        console.log("Mic successfully started and connected to AudioWorklet");
    } catch (e) { 
        console.error("Mic error:", e); 
        addMsg("¡Ups! Parece que no puedo acceder al micro. ¿Me das permiso para escucharte?", "bot");
    }
  }

  function playPCM(base64) {
    if (!audioContext || !aiAnalyser) return;
    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const pcm16 = new Int16Array(bytes.buffer);
        const buf = audioContext.createBuffer(1, pcm16.length, 24000);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < pcm16.length; i++) ch[i] = pcm16[i] / 32768;
        const src = audioContext.createBufferSource();
        src.buffer = buf;
        
        src.connect(aiAnalyser);
        aiAnalyser.connect(audioContext.destination);
        
        const now = audioContext.currentTime;
        if (nextAudioTime < now) nextAudioTime = now + 0.1;
        src.start(now); // Modified to avoid potential buffering issues
        activeAudioSources.push(src);
        nextAudioTime += buf.duration;
    } catch (e) { console.error("Audio play error:", e); }
  }

  function stopAIAudio() {
    activeAudioSources.forEach(s => { try { s.stop(); } catch(e) {} });
    activeAudioSources = [];
    nextAudioTime = 0;
  }

  function connectVoice() {
    console.log("Connecting WebSocket for voice...");
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = `${protocol}//${window.location.host}/`;
    wsSession = new WebSocket(WS_URL);

    wsSession.onopen = () => {
        console.log("WebSocket connection opened. Sending setup...");
        wsSession.send(JSON.stringify({
            setup: {
                model: MODEL,
                generationConfig: { 
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                },
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
            }
        }));
    };

    wsSession.onmessage = async (event) => {
        let data = event.data;
        if (data instanceof Blob) data = await data.text();
        let parsed; try { parsed = JSON.parse(data); } catch(e) { console.error("Parse error:", e); return; }

        if (parsed.setupComplete || parsed.setup_complete) {
            console.log("Gemini Live Setup Complete");
            addMsg("¡Hola! Ya estoy listo. ¿En qué puedo ayudarte?", "bot");
            voiceBtn.style.color = "#f37021";
            muteBtn.style.color = "#f37021";
            
            wsSession.send(JSON.stringify({
                clientContent: { 
                    turns: [{ role: 'user', parts: [{ text: "System Online. Greet me in a friendly and casual way as Sergio." }] }], 
                    turnComplete: true 
                }
            }));
        }

        const sc = parsed.serverContent ?? parsed.server_content;
        if (sc?.modelTurn?.parts) {
            sc.modelTurn.parts.forEach(p => {
                if (p.inlineData?.data) {
                    playPCM(p.inlineData.data);
                }
                if (p.text) {
                    addMsg(p.text, "bot");
                }
            });
        }
        if (parsed.interrupted) {
            console.log("AI Interrupted by server");
            stopAIAudio();
        }
    };

    wsSession.onerror = (err) => {
        console.error("WebSocket Error:", err);
        addMsg("Híjole, algo falló en la conexión de voz.", "bot");
    };

    wsSession.onclose = (e) => { 
        console.log("WebSocket Closed:", e.code, e.reason);
        stopVoice(); 
    };
  }

  function stopVoice() {
    voiceActive = false;
    isMuted = false;
    if (wsSession) wsSession.close();
    if (micContext) micContext.close();
    if (audioContext) audioContext.close();
    if (voiceBtn) voiceBtn.style.color = "#ccc";
    if (muteBtn) {
        muteBtn.style.color = "#ccc";
        muteBtn.innerHTML = '<i data-lucide="mic"></i>';
        lucideInit();
    }
    addMsg("Modo voz apagado.", "bot");
  }

  if (voiceBtn) {
    voiceBtn.onclick = async () => {
        if (voiceActive) {
            stopVoice();
        } else {
            console.log("Activating voice mode...");
            voiceActive = true;
            isMuted = false;
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            if (audioContext.state === 'suspended') await audioContext.resume();
            aiAnalyser = audioContext.createAnalyser();
            aiAnalyser.fftSize = 256;
            await startMic();
            connectVoice();
        }
    };
  }

  // --- TEXT LOGIC ---
  const getAIResponse = async (msg) => {
    const loader = addMsg("...", "bot");
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history })
      });
      const text = await res.text();
      loader.innerHTML = text.replace(/\n/g, '<br>');
      history.push({ role: 'user', text: msg }, { role: 'bot', text: text });
    } catch (e) { loader.innerText = "¡Huy! Se me cortó la señal. ¿Me lo repites?"; }
  };

  if (botLauncher) botLauncher.onclick = () => botWindow.classList.add("active");
  if (closeBot) closeBot.onclick = () => botWindow.classList.remove("active");
  
  if (sendBtn) {
    sendBtn.onclick = () => {
      const val = botInput.value.trim();
      if (val) { addMsg(val, "user"); botInput.value = ""; getAIResponse(val); }
    };
  }
  if (botInput) {
    botInput.onkeypress = (e) => { if (e.key === 'Enter') sendBtn.click(); };
  }

  // --- CALENDAR ---
  if (window.flatpickr) {
    window.flatpickr("#date-range", { 
      mode: "range", 
      minDate: "today", 
      dateFormat: "d M, Y", 
      locale: "es",
      onOpen: (s, d, inst) => inst.calendarContainer.classList.add("luxury-picker")
    });
  }

  // --- THREE.JS ORB ATMOSPHERE (REACTIVE & ORANGE) ---
  let orb;
  const initOrb = () => {
    const container = $("hero-visual");
    if (!container || !window.THREE) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.offsetWidth/container.offsetHeight, 0.1, 1000);
    camera.position.z = 25;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    container.appendChild(renderer.domElement);

    // Color Naranja Vive Libre (#f37021)
    orb = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(12, 1)), 
      new THREE.LineBasicMaterial({ color: 0xf37021, transparent: true, opacity: 0.4 })
    );
    scene.add(orb);

    const animate = () => {
      requestAnimationFrame(animate);
      
      // Rotación base
      orb.rotation.y += 0.005;
      orb.rotation.z += 0.002;

      // Reactividad al volumen de la IA
      if (aiAnalyser && voiceActive) {
        const dataArray = new Uint8Array(aiAnalyser.frequencyBinCount);
        aiAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        
        // Escala dinámica (pulso)
        const scale = 1 + (average / 100);
        orb.scale.set(scale, scale, scale);
        // Opacidad dinámica
        orb.material.opacity = 0.3 + (average / 150);
      } else {
        orb.scale.set(1, 1, 1);
        orb.material.opacity = 0.2;
      }

      renderer.render(scene, camera);
    };
    animate();
  };

  // --- INIT ---
  loadCabins();
  initOrb();
  lucideInit();
});
