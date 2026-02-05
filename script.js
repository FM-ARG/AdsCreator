document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const heroSection = document.getElementById('hero');
    const configSection = document.getElementById('configSection');
    const detectedColors = document.getElementById('detectedColors');
    const detectedVibe = document.getElementById('detectedVibe');
    const generateBtn = document.getElementById('generateBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const resultsSection = document.getElementById('resultsSection');
    const resultsGrid = document.getElementById('resultsGrid');
    const resetBtn = document.getElementById('resetBtn');

    // Settings Elements
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');

    // State
    let currentBrandData = {
        name: 'Brand',
        description: '',
        colors: [],
        vibe: ''
    };

    let appSettings = {
        apiKey: localStorage.getItem('gemini_api_key') || ''
    };

    // --- Settings Logic ---
    if (appSettings.apiKey) apiKeyInput.value = appSettings.apiKey;

    settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        settingsModal.classList.remove('hidden');
    });

    closeSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();

        localStorage.setItem('gemini_api_key', key);
        appSettings.apiKey = key;

        settingsModal.classList.add('hidden');
        alert('Configuración guardada.');
    });

    // --- 1. Analyze Step (Real + Mock Fallback) ---
    analyzeBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Por favor, ingresa una URL válida.');
            return;
        }

        analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando...';
        analyzeBtn.disabled = true;

        try {
            // Attempt Real Scraping
            const realData = await scrapeUrl(url);
            currentBrandData = realData;
        } catch (error) {
            console.warn('Scraping failed, falling back to mock:', error);
            currentBrandData = mockAnalyzeUrl(url);
        }

        // UI Transition
        heroSection.classList.add('hidden');
        configSection.classList.remove('hidden');

        renderBrandTraits(currentBrandData);

        analyzeBtn.innerHTML = 'Analizar URL <i class="fa-solid fa-arrow-right"></i>';
        analyzeBtn.disabled = false;
    });

    // --- 2. Generate Step (Gemini + Mock Fallback) ---
    generateBtn.addEventListener('click', async () => {
        const objective = document.getElementById('objectiveDetail').value;
        const tone = document.getElementById('toneSelect').value;
        const cta = document.getElementById('ctaSelect').value;

        // Show Loader
        loadingOverlay.classList.remove('hidden');
        const steps = ['Analizando identidad visual...', 'Consultando a Gemini AI...', 'Diseñando creatividades...'];
        let stepIndex = 0;
        loadingText.innerText = steps[0];

        const updateLoadingText = setInterval(() => {
            stepIndex++;
            if (stepIndex < steps.length) {
                loadingText.innerText = steps[stepIndex];
            }
        }, 1500);

        try {
            let ads = [];

            // Check if key looks valid (Gemini keys usually start with AIza)
            if (appSettings.apiKey && appSettings.apiKey.length > 10) {
                // REAL AI MODE (Gemini)
                ads = await generateAdsWithGemini(currentBrandData, objective, tone, cta);
            } else {
                // MOCK MODE
                if (appSettings.apiKey) alert('API Key parece inválida. Usando modo simulación.');
                await new Promise(r => setTimeout(r, 2000)); // Fake delay
                ads = mockGenerateAds(currentBrandData, objective, tone, cta);
            }

            clearInterval(updateLoadingText);

            loadingOverlay.classList.add('hidden');
            configSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            renderAds(ads);

        } catch (error) {
            clearInterval(updateLoadingText);
            loadingOverlay.classList.add('hidden');
            alert('Error generando anuncios: ' + error.message);
            console.error(error);
        }
    });

    // --- 3. Reset ---
    resetBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        heroSection.classList.remove('hidden');
        urlInput.value = '';
        currentBrandData = {};
        window.scrollTo(0, 0);
    });

    // ============================================
    //              HELPER FUNCTIONS
    // ============================================

    // --- SCRAPING (Via AllOrigins) ---
    async function scrapeUrl(url) {
        if (!url.startsWith('http')) url = 'https://' + url;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        if (!data.contents) throw new Error('No content found');

        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');

        const title = doc.querySelector('title')?.innerText || '';
        const desc = doc.querySelector('meta[name="description"]')?.content || '';
        const ogImage = doc.querySelector('meta[property="og:image"]')?.content || '';

        const combinedText = (title + ' ' + desc).toLowerCase();
        let colors = ['#333333', '#888888', '#ffffff'];
        let vibe = 'Moderno';

        if (combinedText.includes('food') || combinedText.includes('comida') || combinedText.includes('café')) {
            colors = ['#FF9F43', '#2C3A47', '#D6A2E8']; vibe = 'Delicioso';
        } else if (combinedText.includes('fashion') || combinedText.includes('moda')) {
            colors = ['#000000', '#F8F8F8', '#FFD700']; vibe = 'Elegante';
        } else if (combinedText.includes('tech') || combinedText.includes('software')) {
            colors = ['#54A0FF', '#2E86DE', '#00d2d3']; vibe = 'Innovador';
        } else if (combinedText.includes('gym') || combinedText.includes('fitness')) {
            colors = ['#FF4D4D', '#1A1A1A', '#FFFFFF']; vibe = 'Enérgico';
        }

        return {
            name: title.split(/[-|]/)[0].trim().substring(0, 20) || 'Tu Marca',
            description: desc.substring(0, 150),
            colors: colors,
            vibe: vibe,
            logoUrl: ogImage
        };
    }

    // --- GEMINI AI GENERATION ---
    async function generateAdsWithGemini(brand, objective, tone, cta) {
        // API Endpoint for Gemini 3.0 Flash Preview
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${appSettings.apiKey}`;

        const prompt = `
            Act as an expert marketing copywriter. 
            Create 3 distinct Facebook/Instagram ads (in Spanish) for a brand named "${brand.name}".
            Context from website: "${brand.description || 'General Service'}".
            Objective: ${objective}. Tone: ${tone}. CTA: ${cta}.
            
            Return ONLY a valid JSON array of objects. Do not include markdown code blocks.
            Structure:
            [
              {
                "headline": "Short punchy headline",
                "body": "Persuasive body text (max 150 chars)",
                "img_text": "Short text to put on the image (max 3 words)"
              }
            ]
        `;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Gemini API Error');
        }

        const json = await response.json();

        let adContent = [];
        try {
            const rawText = json.candidates[0].content.parts[0].text;
            adContent = JSON.parse(rawText);
        } catch (e) {
            console.error("Gemini Parse Error", e, json);
            throw new Error('Failed to parse Gemini response');
        }

        // Generate Ads with Smart Placeholders
        return adContent.map((ad, i) => {
            // Pick a color from the brand palette
            const color = brand.colors[i % brand.colors.length]?.replace('#', '') || '000000';
            const textHex = 'FFFFFF'; // White text on colored bg usually safe

            // Construct Smart Placeholder URL
            // Using placehold.co with the 'img_text' suggested by AI
            const imageUrl = `https://placehold.co/600x600/${color}/${textHex}?text=${encodeURIComponent(ad.img_text)}&font=outfit`;

            return {
                imageUrl: imageUrl,
                headline: ad.headline,
                body: ad.body,
                cta: formatCTA(cta)
            };
        });
    }

    // --- MOCK FUNCTIONS (Fallback) ---
    function mockAnalyzeUrl(url) {
        const domains = ['tech', 'fashion', 'fitness'];
        const randomDomain = domains[Math.floor(Math.random() * domains.length)];
        // ... (Simplified logic)
        return {
            name: 'Mock Brand',
            description: 'A simulation brand',
            colors: ['#3B82F6', '#1E3A8A', '#EFF6FF'],
            vibe: 'Moderno'
        };
    }

    function mockGenerateAds(brand, objective, tone, cta) {
        return [1, 2, 3].map(i => ({
            imageUrl: `https://placehold.co/600x600/333/FFF?text=Anuncio+${i}`,
            headline: `Titulo Simulado ${i} para ${brand.name}`,
            body: `Este es un texto generado simulando el tono ${tone}.`,
            cta: formatCTA(cta)
        }));
    }

    // --- UI HELPERS ---
    function renderBrandTraits(data) {
        detectedColors.innerHTML = '';
        if (data.colors && data.colors.length > 0) {
            data.colors.forEach(color => {
                const dot = document.createElement('div');
                dot.className = 'color-dot';
                dot.style.backgroundColor = color;
                detectedColors.appendChild(dot);
            });
        }
        detectedVibe.innerText = data.vibe;
    }

    function renderAds(ads) {
        resultsGrid.innerHTML = '';
        ads.forEach(ad => {
            const card = document.createElement('div');
            card.className = 'ad-card glass';
            card.innerHTML = `
                <div class="ad-preview">
                    <img src="${ad.imageUrl}" alt="Ad Preview" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="ad-content">
                    <h3>${ad.headline}</h3>
                    <p>${ad.body}</p>
                    <div class="ad-meta">
                        <span class="tag" style="background:rgba(255,255,255,0.1)">${ad.cta}</span>
                        <button class="copy-btn" onclick="navigator.clipboard.writeText('${ad.headline}\\n${ad.body}')"><i class="fa-regular fa-copy"></i> Copiar</button>
                    </div>
                </div>
            `;
            resultsGrid.appendChild(card);
        });
    }

    function formatCTA(value) {
        const map = {
            'shop_now': 'Comprar Ahora', 'learn_more': 'Más Información',
            'sign_up': 'Registrarse', 'get_offer': 'Obtener Oferta'
        };
        return map[value] || 'Ver Más';
    }
});
