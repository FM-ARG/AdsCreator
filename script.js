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

    // State
    let currentBrandData = {
        name: 'Brand',
        colors: [],
        vibe: ''
    };

    // --- 1. Analyze Step ---
    analyzeBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Por favor, ingresa una URL válida.');
            return;
        }

        // Simulate Analysis Loading
        analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando...';
        analyzeBtn.disabled = true;

        setTimeout(() => {
            // Mock Analysis Result
            currentBrandData = mockAnalyzeUrl(url);
            
            // UI Transition
            heroSection.classList.add('hidden');
            configSection.classList.remove('hidden');
            
            // Populate Config UI
            renderBrandTraits(currentBrandData);
            
            analyzeBtn.innerHTML = 'Analizar URL <i class="fa-solid fa-arrow-right"></i>';
            analyzeBtn.disabled = false;
        }, 1500);
    });

    // --- 2. Generate Step ---
    generateBtn.addEventListener('click', () => {
        const objective = document.getElementById('objectiveDetail').value;
        const tone = document.getElementById('toneSelect').value;
        const cta = document.getElementById('ctaSelect').value;

        // Show Loader
        loadingOverlay.classList.remove('hidden');
        let steps = ['Analizando identidad visual...', 'Redactando copy persuasivo...', 'Generando composiciones...'];
        let stepIndex = 0;

        const updateLoadingText = setInterval(() => {
            if (stepIndex < steps.length) {
                loadingText.innerText = steps[stepIndex];
                stepIndex++;
            }
        }, 800);

        setTimeout(() => {
            clearInterval(updateLoadingText);
            
            // Mock Ad Generation
            const ads = generateAds(currentBrandData, objective, tone, cta);
            
            // UI Transition
            loadingOverlay.classList.add('hidden');
            configSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            
            renderAds(ads);
        }, 3000);
    });

    // --- 3. Reset ---
    resetBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        heroSection.classList.remove('hidden');
        urlInput.value = '';
        // Scroll to top
        window.scrollTo(0, 0);
    });

    // --- Mock Functions ---

    function mockAnalyzeUrl(url) {
        // Pretend to infer from URL
        const domains = ['tech', 'fashion', 'food', 'fitness'];
        const randomDomain = domains[Math.floor(Math.random() * domains.length)];
        
        let colors = [];
        let vibe = '';

        if (url.includes('coffee') || randomDomain === 'food') {
            colors = ['#4B2C20', '#A67B5B', '#F5E6E0'];
            vibe = 'Acogedor & Artesanal';
        } else if (url.includes('gym') || randomDomain === 'fitness') {
            colors = ['#FF4D4D', '#1A1A1A', '#FFFFFF'];
            vibe = 'Enérgico & Fuerte';
        } else if (url.includes('fashion') || randomDomain === 'fashion') {
            colors = ['#000000', '#F0F0F0', '#D4AF37'];
            vibe = 'Elegante & Minimalista';
        } else {
            // Tech / Default
            colors = ['#3B82F6', '#1E3A8A', '#EFF6FF'];
            vibe = 'Innovador & Limpio';
        }

        return {
            name: extractDomainName(url) || 'Tu Marca',
            colors: colors,
            vibe: vibe,
            logoUrl: 'https://via.placeholder.com/150' // Placeholder
        };
    }

    function extractDomainName(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace('www.', '').split('.')[0].toUpperCase();
        } catch (e) {
            return null;
        }
    }

    function renderBrandTraits(data) {
        detectedColors.innerHTML = '';
        data.colors.forEach(color => {
            const dot = document.createElement('div');
            dot.className = 'color-dot';
            dot.style.backgroundColor = color;
            dot.title = color;
            detectedColors.appendChild(dot);
        });
        detectedVibe.innerText = data.vibe;
    }

    function generateAds(brand, objective, tone, cta) {
        // Templates
        const templates = [
            {
                // Template 1: Minimalist Product Focus
                bg: brand.colors[2] || '#f3f3f3',
                text: brand.colors[0],
                layout: 'center'
            },
            {
                // Template 2: Bold
                bg: brand.colors[0],
                text: '#ffffff',
                layout: 'bold'
            },
            {
                // Template 3: Image Heavy
                bg: '#000000',
                text: '#ffffff',
                layout: 'overlay'
            }
        ];

        // Copy Generation (Mock)
        const copyVariations = getCopyVariations(objective, tone, cta, brand.name);

        return templates.map((tpl, i) => {
            return {
                id: i,
                image: `https://source.unsplash.com/random/800x800/?${brand.vibe.split('&')[0].trim().toLowerCase()}&sig=${i}`, // Note: Unsplash Source is deprecated/unreliable, in real app use API. For demo, might use Placehold.co if Unsplash fails, but let's try. 
                // Using a more reliable placeholder for demo to avoid broken images if Unsplash API changed
                imageUrl: `https://placehold.co/600x600/${tpl.bg.replace('#', '')}/${tpl.text.replace('#', '')}?text=${encodeURIComponent(brand.name + ' ' + (i+1))}&font=outfit`,
                headline: copyVariations[i].headline,
                body: copyVariations[i].body,
                cta: copyVariations[i].cta
            };
        });
    }

    function getCopyVariations(objective, tone, cta, brandName) {
        // Simple mapping logic
        const copies = [];
        
        // Variation 1
        copies.push({
            headline: tone === 'humorous' ? `¿Tu ${brandName} está triste?` : `Transforma tu rutina con ${brandName}`,
            body: `Descubre la calidad que todos están comentando. No te quedes fuera.`,
            cta: formatCTA(cta)
        });

        // Variation 2
        copies.push({
            headline: objective === 'sales' ? 'Oferta por tiempo limitado' : `La excelencia de ${brandName}`,
            body: `Consigue el estilo que buscas hoy mismo. Envío gratis en pedidos superiores.`,
            cta: formatCTA(cta)
        });

        // Variation 3
        copies.push({
            headline: tone === 'urgent' ? '¡ÚLTIMAS UNIDADES!' : 'Diseñado para ti',
            body: `Calidad premium, precio irresistible. Haz clic antes de que se agote.`,
            cta: formatCTA(cta)
        });

        return copies;
    }

    function formatCTA(value) {
        const map = {
            'shop_now': 'Comprar Ahora',
            'learn_more': 'Más Información',
            'sign_up': 'Registrarse',
            'get_offer': 'Obtener Oferta'
        };
        return map[value] || 'Ver Más';
    }

    function renderAds(ads) {
        resultsGrid.innerHTML = '';
        ads.forEach(ad => {
            const card = document.createElement('div');
            card.className = 'ad-card glass';
            card.innerHTML = `
                <div class="ad-preview">
                    <!-- Simulate Ad Visual -->
                    <img src="${ad.imageUrl}" alt="Ad Preview">
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
});
