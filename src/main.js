// Imports removed for static file protocol compatibility
// Scripts are loaded sequentially in index.html

class App {
    constructor() {
        this.scraper = new ScraperService();
        this.analyzer = new AnalyzerService();
        this.adEngine = new AdEngine();
        this.templateEngine = new TemplateEngine();

        this.init();
    }

    init() {
        console.log("Ads Creator App Initialized");
        this.form = document.getElementById('adForm');
        this.inputSection = document.getElementById('input-section');
        this.resultsSection = document.getElementById('results-section');
        this.inputHeader = document.querySelector('.input-header');

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async handleSubmit(e) {
        e.preventDefault();

        const url = document.getElementById('urlInput').value;
        const objective = document.getElementById('objectiveSelect').value;
        const tone = document.getElementById('toneSelect').value;
        const cta = document.getElementById('ctaInput').value;

        this.setLoading(true);

        try {
            // 1. Scrape
            const { doc, html, url: finalUrl } = await this.scraper.scrape(url);
            const assets = this.scraper.extractAssets(doc, finalUrl);

            // 2. Analyze
            const analysis = this.analyzer.analyze(html, assets.meta);
            console.log('Analysis:', analysis);

            const brandData = {
                image: assets.images[0]?.src || '', // Taking first big image as hero
                logo: assets.logo?.src || '',
                colors: analysis.colors,
                fonts: analysis.fonts
            };

            if (!brandData.image) {
                throw new Error("No usable images found on the site.");
            }

            // 3. Generate Ads (3 Variations)
            const variations = [
                { id: 'minimal-split', title: 'Minimalist' },
                { id: 'bold-center', title: 'Bold Impact' },
                { id: 'glass-overlay', title: 'Modern Glass' }
            ];

            // Clear previous results
            this.resultsSection.innerHTML = '<h2 class="section-title">Resultados Generados</h2><div class="results-grid"></div><button class="btn-primary" onclick="location.reload()" style="margin-top: 2rem;">Crear Nuevo</button>';
            const grid = this.resultsSection.querySelector('.results-grid');

            // Copy variation seed
            let copyIndex = 0;

            for (let i = 0; i < variations.length; i++) {
                const variant = variations[i];

                // Cycle through available images
                // e.g. Variation 1 -> Image 1, Var 2 -> Image 2 (or 1 if only 1 exists)
                const imgIndex = i % assets.images.length;
                const specificImage = assets.images[imgIndex]?.src || brandData.image;

                // Create variation-specific brand data
                const variantData = {
                    ...brandData,
                    image: specificImage
                };

                // Generate Copy per variation (try to get unique copy if possible)
                // We'll pass a different "seed" or just rely on randomness. 
                // Since generatesCopy is random, we call it fresh each time.
                const copy = this.adEngine.generateCopy(brandData, objective, tone, cta);

                // Create Container
                const card = document.createElement('div');
                card.className = 'glass-panel ad-card';
                card.innerHTML = `
                    <h3>${variant.title}</h3>
                    <div class="canvas-container"></div>
                    <div class="copy-box">
                        <p><strong>Option 1:</strong> ${copy.headline}</p>
                        <p><strong>Option 2:</strong> ${copy.body}</p>
                    </div>
                `;
                grid.appendChild(card);

                // Render Canvas
                const canvas = document.createElement('canvas');
                canvas.width = 1080;
                canvas.height = 1080;
                canvas.style.width = '100%';
                canvas.style.borderRadius = '12px';

                card.querySelector('.canvas-container').appendChild(canvas);

                await this.templateEngine.render(canvas, variant.id, {
                    ...variantData, // Use the specific image
                    copy
                });

                // Add Download Button
                const btn = document.createElement('button');
                btn.className = 'btn-primary';
                btn.style.marginTop = '1rem';
                btn.style.width = '100%';
                btn.innerHTML = '<i class="fa-solid fa-download"></i> Descargar PNG';
                btn.onclick = () => this.downloadCanvas(canvas, `ad-${variant.id}.png`);
                card.appendChild(btn);
            }

            this.showResults();

        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        const btn = this.form.querySelector('button[type="submit"]');
        if (isLoading) {
            btn.innerHTML = '<div class="spinner"></div> Analizando...';
            btn.disabled = true;
            this.form.style.opacity = '0.5';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Generar Anuncios';
            btn.disabled = false;
            this.form.style.opacity = '1';
        }
    }

    showResults() {
        this.inputSection.classList.add('hidden');
        this.inputHeader.classList.add('hidden'); // Also hide the header for cleaner view
        this.resultsSection.classList.remove('hidden');
    }

    downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}

// Start App
new App();
