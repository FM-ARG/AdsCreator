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
        industry: 'general', // New field for improved templates
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

    // --- 1. Analyze Step ---
    analyzeBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Por favor, ingresa una URL válida.');
            return;
        }

        analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando...';
        analyzeBtn.disabled = true;

        try {
            // Priority: Real Scraping -> Fallback: Keyword Analysis
            const realData = await scrapeUrl(url);
            currentBrandData = realData;
        } catch (error) {
            console.warn('Scraping error used fallback:', error);
            // Even if scraping fails, we try to deduce from URL string
            currentBrandData = inferFromUrlString(url);
        }
        
        // UI Transition
        heroSection.classList.add('hidden');
        configSection.classList.remove('hidden');
        
        renderBrandTraits(currentBrandData);
        
        analyzeBtn.innerHTML = 'Analizar URL <i class="fa-solid fa-arrow-right"></i>';
        analyzeBtn.disabled = false;
    });

    // --- 2. Generate Step ---
    generateBtn.addEventListener('click', async () => {
        const objective = document.getElementById('objectiveDetail').value;
        const tone = document.getElementById('toneSelect').value;
        const cta = document.getElementById('ctaSelect').value;

        // Show Loader
        loadingOverlay.classList.remove('hidden');
        const steps = ['Consultando biblioteca de marketing...', 'Adaptando tono y mensaje...', 'Diseñando creatividades...'];
        let stepIndex = 0;
        loadingText.innerText = steps[0];

        const updateLoadingText = setInterval(() => {
            stepIndex++;
            if (stepIndex < steps.length) {
                loadingText.innerText = steps[stepIndex];
            }
        }, 1000);

        try {
            let ads = [];
            
            // HYBRID ENGINE: Use Gemini if Key exists, otherwise Smart Templates
            if (appSettings.apiKey && appSettings.apiKey.length > 10) {
                // PRO: Gemini 2.0
                ads = await generateAdsWithGemini(currentBrandData, objective, tone, cta);
            } else {
                // FREE: Smart Templates (Robust, no API needed)
                // Simulated delay to feel like "work" is being done
                await new Promise(r => setTimeout(r, 2000)); 
                ads = generateSmartTemplateAds(currentBrandData, objective, tone, cta);
            }
            
            clearInterval(updateLoadingText);
            
            loadingOverlay.classList.add('hidden');
            configSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            
            renderAds(ads);

        } catch (error) {
            clearInterval(updateLoadingText);
            loadingOverlay.classList.add('hidden');
            alert('Ocurrió un error: ' + error.message);
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
    //              LOGIC ENGINES
    // ============================================

    // --- 1. SCRAPING & INFERENCE ---
    async function scrapeUrl(url) {
        if (!url.startsWith('http')) url = 'https://' + url;
        
        // Try Proxy
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Proxy error');
            const data = await response.json();
            if (!data.contents) throw new Error('No content');

            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            const title = doc.querySelector('title')?.innerText || '';
            const desc = doc.querySelector('meta[name="description"]')?.content || '';
            const ogImage = doc.querySelector('meta[property="og:image"]')?.content || '';

            return processBrandData(title, desc, url, ogImage);
        } catch (e) {
            // If proxy fails, fall back to pure URL analysis
            return inferFromUrlString(url);
        }
    }

    function inferFromUrlString(url) {
        return processBrandData('', '', url, '');
    }

    function processBrandData(title, desc, url, ogImage) {
        const combinedText = (title + ' ' + desc + ' ' + url).toLowerCase();
        let colors = ['#333333', '#888888', '#ffffff']; 
        let vibe = 'Moderno';
        let industry = 'general';

        // Industry Detection Heuristics
        if (matches(combinedText, ['food', 'comida', 'burger', 'pizza', 'caf', 'restaurante', 'sushi'])) {
            colors = ['#FF9F43', '#D35400', '#F5E6E0']; vibe = 'Delicioso & Fresco'; industry = 'food';
        } else if (matches(combinedText, ['fashion', 'moda', 'ropa', 'clothing', 'shoes', 'style', 'boutique'])) {
            colors = ['#000000', '#F8F8F8', '#D4AF37']; vibe = 'Elegante & Trendy'; industry = 'fashion';
        } else if (matches(combinedText, ['tech', 'software', 'app', 'digital', 'saas', 'startup', 'ia'])) {
            colors = ['#2563EB', '#60A5FA', '#EFF6FF']; vibe = 'Innovador & Smart'; industry = 'tech';
        } else if (matches(combinedText, ['gym', 'fitness', 'sport', 'deporte', 'crossfit', 'yoga'])) {
            colors = ['#EF4444', '#111827', '#F3F4F6']; vibe = 'Enérgico & Power'; industry = 'fitness';
        } else if (matches(combinedText, ['travel', 'viaje', 'hotel', 'resort', 'vacation', 'turismo'])) {
            colors = ['#0EA5E9', '#F0F9FF', '#F59E0B']; vibe = 'Aventurero & Relax'; industry = 'travel';
        }

        let name = title.split(/[-|]/)[0].trim() || new URL(url).hostname.replace('www.', '').split('.')[0];
        name = name.substring(0, 20); // Keep it short

        return {
            name: name,
            description: desc.substring(0, 150) || 'La mejor calidad para ti.',
            colors: colors,
            vibe: vibe,
            industry: industry,
            logoUrl: ogImage 
        };
    }

    function matches(text, keywords) {
        return keywords.some(k => text.includes(k));
    }

    // --- 2. SMART TEMPLATE ENGINE (No API Key) ---
    function generateSmartTemplateAds(brand, objective, tone, cta) {
        // Industry Image Keywords
        const industryKeywords = {
            'food': ['burger', 'coffee', 'pizza', 'salad', 'restaurant'],
            'fashion': ['fashion model', 'clothing store', 'streetwear', 'luxury bag'],
            'tech': ['laptop', 'coding', 'smartphone', 'modern office'],
            'fitness': ['gym workout', 'running', 'yoga', 'healthy food'],
            'travel': ['beach', 'mountain', 'hotel room', 'airplane'],
            'general': ['business meeting', 'happy person', 'abstract background', 'working']
        };

        const bgKeyword = industryKeywords[brand.industry] || industryKeywords['general'];

        // Copywriting Formulas
        const templates = [];

        // Ad 1: Benefit / Hook (Based on Objective)
        let t1 = {};
        if (objective === 'sales') {
            t1.headline = `🔥 Oferta Exclusiva en ${brand.name}`;
            t1.body = `Consigue la mejor calidad con un descuento especial por tiempo limitado. ¡No dejes pasar esta oportunidad!`;
        } else if (objective === 'traffic') {
            t1.headline = `Descubre lo Nuevo de ${brand.name}`;
            t1.body = `Explora nuestra nueva colección y encuentra justo lo que necesitas. Visita nuestra web hoy.`;
        } else {
            t1.headline = `Bienvenido al Mundo ${brand.name}`;
            t1.body = `Calidad, estilo y servicio excepcional. Conócenos y mejora tu día a día.`;
        }
        templates.push(t1);

        // Ad 2: Problem / Solution (Tone adaption)
        let t2 = {};
        if (tone === 'humorous') {
            t2.headline = `¿Cansado de lo aburrido?`;
            t2.body = `Dale vida a tu rutina con ${brand.name}. Porque te mereces algo mejor (y lo sabes).`;
        } else if (tone === 'urgent') {
            t2.headline = `¡Se está acabando! ⏳`;
            t2.body = `Últimas unidades disponibles. Compra ahora en ${brand.name} antes de que vuelen.`;
        } else {
            t2.headline = `La Solución que Buscabas`;
            t2.body = `Diseñado pensando en ti. ${brand.name} te ofrece la combinación perfecta de rendimiento y estilo.`;
        }
        templates.push(t2);

        // Ad 3: Social Proof / Authority
        let t3 = {};
        t3.headline = `Únete a miles de clientes felices`;
        t3.body = `Descubre por qué todos eligen ${brand.name}. Calidad garantizada y envíos rápidos.`;
        templates.push(t3);


        // Assembly
        return templates.map((tpl, i) => {
            // Pick a varied keyword
            const keyword = bgKeyword[i % bgKeyword.length];
            const imageUrl = `https://loremflickr.com/800/800/${encodeURIComponent(keyword)}?lock=${Math.floor(Math.random() * 500)}`;

            return {
                imageUrl: imageUrl,
                headline: tpl.headline,
                body: tpl.body,
                cta: formatCTA(cta)
            };
        });
    }

    // --- 3. GEMINI AI ENGINE (Pro Mode) ---
    async function generateAdsWithGemini(brand, objective, tone, cta) {
        // ... (Existing Gemini logic, kept as Pro upgrade)
        const modelName = 'gemini-2.0-flash'; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${appSettings.apiKey}`;

        const prompt = `
            Actúa como un experto en marketing digital.
            Contexto: Marca "${brand.name}", Industria: "${brand.industry}".
            Objetivo: ${objective}. Tono: ${tone}. CTA: ${cta}.
            
            Crea 3 anuncios (JSON array) con:
            - headline
            - body
            - image_keyword (una palabra en inglés para stock photo: ej: ${brand.industry})
        `;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Gemini Error');
        }

        const json = await response.json();
        const rawText = json.candidates[0].content.parts[0].text;
        const adContent = JSON.parse(rawText);

        return adContent.map((ad, i) => {
            const keyword = ad.image_keyword || brand.industry;
            const imageUrl = `https://loremflickr.com/800/800/${encodeURIComponent(keyword)}?lock=${Math.random()}`;
            return {
                imageUrl: imageUrl,
                headline: ad.headline,
                body: ad.body,
                cta: formatCTA(cta)
            };
        });
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
                    <img src="${ad.imageUrl}" alt="Ad Preview" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://placehold.co/600x600/333/FFF?text=Anuncio'">
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
