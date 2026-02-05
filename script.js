/* =========================================
   ADS CREATOR APP - MAIN SCRIPT
   ========================================= */

/**
 * Service to handle scraping and asset extraction via CORS Proxy
 */
class ScraperService {
    constructor() {
        this.proxies = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/get?url=',
            'https://thingproxy.freeboard.io/fetch/'
        ];
    }

    /**
     * Fetches and parses the URL content with fallback proxies
     * @param {string} url - Target website URL
     * @returns {Promise<{doc: Document, html: string, url: string}>}
     */
    async scrape(url) {
        let content = null;
        let lastError = null;

        for (const proxyBase of this.proxies) {
            try {
                console.log(`Trying proxy: ${proxyBase}`);
                // Construct URL based on proxy type
                const target = proxyBase.includes('allorigins')
                    ? `${proxyBase}${encodeURIComponent(url)}`
                    : `${proxyBase}${encodeURIComponent(url)}`; // corsproxy.io simply appends encoded URL

                const response = await fetch(target);

                if (proxyBase.includes('allorigins')) {
                    const data = await response.json();
                    if (data.contents) content = data.contents;
                } else {
                    const text = await response.text();
                    if (text && text.length > 500) content = text; // heuristics for valid content
                }

                if (content) break; // Success

            } catch (error) {
                console.warn(`Proxy ${proxyBase} failed:`, error);
                lastError = error;
            }
        }

        if (!content) {
            throw new Error(`Failed to load website. Is it online? Last error: ${lastError?.message}`);
        }

        try {
            // Parse HTML first to find CSS links
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');

            // Fetch CSS files to improve analysis (Heuristic: extract hex codes from CSS)
            const cssLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
                .map(link => link.href)
                .filter(href => href && !href.startsWith('data:'));

            // Helper to fetch text content via proxy
            const fetchText = async (targetUrl) => {
                try {
                    // Handle relative URLs
                    const absoluteUrl = new URL(targetUrl, url).href;
                    // Use simple fetch for now as CSS usually less protected, or use same proxy logic
                    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(absoluteUrl)}`);
                    const text = await res.text();
                    return text || '';
                } catch (e) {
                    return '';
                }
            };

            // Fetch top 3 CSS files max to save time
            const cssPromises = cssLinks.slice(0, 3).map(link => fetchText(link));
            const cssContents = await Promise.all(cssPromises);

            // Combine HTML and CSS for the analyzer to scan
            const fullContent = content + ' ' + cssContents.join(' ');

            return {
                doc,
                html: fullContent,
                url
            };
        } catch (error) {
            console.error('Scraping parsing failed:', error);
            throw new Error(`Failed to parse website: ${error.message}`);
        }
    }

    /**
     * Extracts high-value assets effectively
     * @param {Document} doc 
     * @param {string} baseUrl 
     */
    extractAssets(doc, baseUrl) {
        // Helper to resolve relative URLs
        const resolveUrl = (path) => {
            try {
                return new URL(path, baseUrl).href;
            } catch (e) {
                return path;
            }
        };

        const images = Array.from(doc.querySelectorAll('img'))
            .map(img => ({
                src: resolveUrl(img.src || img.dataset.src),
                width: img.width,
                height: img.height,
                alt: img.alt
            }))
            .filter(img => img.src && (img.width > 200 || !img.width)); // Filter tiny icons

        const meta = {
            title: doc.querySelector('title')?.innerText || '',
            description: doc.querySelector('meta[name="description"]')?.content || '',
            ogImage: doc.querySelector('meta[property="og:image"]')?.content
                ? resolveUrl(doc.querySelector('meta[property="og:image"]').content)
                : null
        };

        // Sort images by size (width * height) descending
        const sortedImages = images
            .sort((a, b) => (b.width * b.height) - (a.width * a.height));

        // Get unique images (avoid duplicates by src)
        const uniqueImages = [];
        const seenSrc = new Set();

        for (const img of sortedImages) {
            if (!seenSrc.has(img.src)) {
                seenSrc.add(img.src);
                uniqueImages.push(img);
                if (uniqueImages.length >= 3) break; // We need at most 3 top images
            }
        }

        // Attempt to find logo (heuristic: img with 'logo' in class, id, or alt)
        const logo = images.find(img =>
            (img.src.toLowerCase().includes('logo') || img.alt?.toLowerCase().includes('logo')) &&
            !img.src.endsWith('.svg') // Prefer PNG/JPG for canvas compatibility if possible, though SVG works usually
        ) || images[images.length - 1]; // Fallback to smallest image (usually logo-like)

        return {
            images: uniqueImages.length > 0 ? uniqueImages : (images.length > 0 ? [images[0]] : []),
            meta,
            logo
        };
    }
}

/**
 * Analyzes raw HTML/CSS to extract design tokens (Colors, Fonts)
 */
class AnalyzerService {

    analyze(html, meta) {
        return {
            colors: this.extractDominantColors(html),
            fonts: this.extractFonts(html),
            keywords: this.extractKeywords(meta)
        };
    }

    extractDominantColors(html) {
        const hexRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g;
        const matches = html.match(hexRegex) || [];

        const colorCounts = {};
        matches.forEach(color => {
            const normalized = color.length === 4 ?
                '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3] :
                color;
            const upper = normalized.toUpperCase();

            // Filter out white, black, transparent-ish
            if (['#FFFFFF', '#000000', '#F8F9FA', '#212529'].includes(upper)) return;

            colorCounts[upper] = (colorCounts[upper] || 0) + 1;
        });

        // Sort by frequency
        const sortedColors = Object.entries(colorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])
            .slice(0, 5); // Return top 5

        return sortedColors.length > 0 ? sortedColors : ['#3B82F6', '#10B981', '#F59E0B']; // Fallbacks
    }

    extractFonts(html) {
        const fontRegex = /font-family:\s*([^;"]+)/g;
        const matches = [];
        let match;
        while ((match = fontRegex.exec(html)) !== null) {
            matches.push(match[1].split(',')[0].replace(/['"]/g, '').trim());
        }

        const fontCounts = {};
        matches.forEach(font => {
            if (['inherit', 'sans-serif', 'serif', 'initial'].includes(font.toLowerCase())) return;
            fontCounts[font] = (fontCounts[font] || 0) + 1;
        });

        return Object.entries(fontCounts)
            .sort((a, b) => b[1] - a[1])
            .map(e => e[0])
            .slice(0, 2); // Top 2 fonts
    }

    extractKeywords(meta) {
        const text = (meta.title + ' ' + meta.description).toLowerCase();
        return text.split(/\s+/).filter(w => w.length > 4);
    }
}

/**
 * Generates Ad Copy and selects visual templates
 */
class AdEngine {

    constructor() {
        this.copyTemplates = {
            sales: {
                profesional: [
                    { headline: "Potencia tu Rendimiento", body: "La solución definitiva para expertos.", cta: "Comprar Ahora" },
                    { headline: "Calidad Garantizada", body: "Invierte en excelencia hoy mismo.", cta: "Ver Catálogo" }
                ],
                friendly: [
                    { headline: "¿Listo para esto?", body: "Te va a encantar lo que tenemos para ti.", cta: "Lo quiero" },
                    { headline: "¡No te lo pierdas!", body: "La mejor opción para tu día a día.", cta: "Ver Oferta" }
                ],
                energetic: [
                    { headline: "¡Rompe los Límites!", body: "Lleva tu experiencia al siguiente nivel AHORA.", cta: "¡Vamos!" },
                    { headline: "¡Oferta Explosiva!", body: "Solo por tiempo limitado. ¡Corre!", cta: "Comprar Ya" }
                ],
                minimal: [
                    { headline: "Esencial.", body: "Menos es más. Descúbrelo.", cta: "Adquirir" },
                    { headline: "Diseño Puro.", body: "Para quienes valoran el detalle.", cta: "Ver" }
                ],
                luxury: [
                    { headline: "Exclusividad.", body: "Solo para unos pocos elegidos.", cta: "Reservar" },
                    { headline: "El Estándar de Oro.", body: "Eleva tu estilo de vida.", cta: "Solicitar Acceso" }
                ]
            }
        };
    }

    generateCopy(brandInfo, objective, tone, userCta) {
        const objectiveGroup = this.copyTemplates[objective] || this.copyTemplates['sales'];
        const toneGroup = objectiveGroup[tone] || objectiveGroup['profesional'];

        const template = toneGroup[Math.floor(Math.random() * toneGroup.length)];

        return {
            headline: template.headline,
            body: template.body,
            cta: userCta || template.cta
        };
    }
}

/**
 * Handles rendering of Ad Templates on HTML5 Canvas
 */
class TemplateEngine {
    constructor() {
        this.canvasSize = 1080; // 1:1 Aspect Ratio (1080x1080)
    }

    async render(canvas, templateId, data) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

        const bgImage = await this.loadImage(data.image);
        const logo = data.logo ? await this.loadImage(data.logo) : null;

        const colors = data.colors || ['#000000', '#ffffff'];
        const primaryColor = colors[0];
        const secondaryColor = colors[1] || '#ffffff';

        switch (templateId) {
            case 'minimal-split':
                this.renderMinimalSplit(ctx, bgImage, logo, primaryColor, secondaryColor, data.copy);
                break;
            case 'bold-center':
                this.renderBoldCenter(ctx, bgImage, logo, primaryColor, secondaryColor, data.copy);
                break;
            case 'glass-overlay':
                this.renderGlassOverlay(ctx, bgImage, logo, primaryColor, secondaryColor, data.copy);
                break;
        }
    }

    renderMinimalSplit(ctx, img, logo, color, secColor, copy) {
        const splitY = this.canvasSize * 0.6;
        this.drawImageCover(ctx, img, 0, 0, this.canvasSize, splitY);
        ctx.fillStyle = color;
        ctx.fillRect(0, splitY, this.canvasSize, this.canvasSize - splitY);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 60px Inter, sans-serif';
        this.wrapText(ctx, copy.headline, 50, splitY + 50, 980, 70);

        this.drawButton(ctx, copy.cta, 50, this.canvasSize - 150, '#ffffff', color);
        if (logo) this.drawImageContain(ctx, logo, 850, splitY + 50, 180, 100);
    }

    renderBoldCenter(ctx, img, logo, color, secColor, copy) {
        this.drawImageCover(ctx, img, 0, 0, this.canvasSize, this.canvasSize);
        ctx.fillStyle = color + 'CC';
        ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 20;
        ctx.strokeRect(50, 50, 1080 - 100, 1080 - 100);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = '800 90px Outfit, sans-serif';
        this.wrapText(ctx, copy.headline.toUpperCase(), 540, 300, 900, 100);

        ctx.font = '400 40px Inter, sans-serif';
        this.wrapText(ctx, copy.body, 540, 600, 800, 50);

        this.drawButton(ctx, copy.cta, 540 - 150, 800, '#ffffff', color);
        if (logo) this.drawImageContain(ctx, logo, 440, 100, 200, 100);
    }

    renderGlassOverlay(ctx, img, logo, color, secColor, copy) {
        this.drawImageCover(ctx, img, 0, 0, this.canvasSize, this.canvasSize);
        const cardH = 350;
        const cardY = this.canvasSize - cardH - 50;
        const cardX = 50;
        const cardW = 1080 - 100;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 20;
        ctx.roundRect(cardX, cardY, cardW, cardH, 20);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'left';
        ctx.font = 'bold 50px Inter, sans-serif';
        this.wrapText(ctx, copy.headline, cardX + 40, cardY + 40, cardW - 80, 60);

        ctx.font = '400 30px Inter, sans-serif';
        this.wrapText(ctx, copy.body, cardX + 40, cardY + 120, cardW - 80, 40);

        this.drawButton(ctx, copy.cta, cardX + 40, cardY + 230, color, '#ffffff');
        if (logo) this.drawImageContain(ctx, logo, cardX + cardW - 160, cardY + 40, 120, 80);
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }

    drawButton(ctx, text, x, y, bgColor, textColor) {
        ctx.save();
        ctx.fillStyle = bgColor;
        const padding = 40;
        const height = 80;
        ctx.font = 'bold 30px Inter, sans-serif';
        const textWidth = ctx.measureText(text).width;
        const width = textWidth + (padding * 2);
        ctx.roundRect(x, y, width, height, 40);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(text, x + (width / 2), y + 26);
        ctx.restore();
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            const proxyUrl1 = 'https://corsproxy.io/?' + encodeURIComponent(src);
            const proxyUrl2 = 'https://wsrv.nl/?url=' + encodeURIComponent(src) + '&w=1080&output=png';
            img.onload = () => resolve(img);
            img.onerror = () => {
                const retryImg = new Image();
                retryImg.crossOrigin = 'Anonymous';
                retryImg.onload = () => resolve(retryImg);
                retryImg.onerror = () => {
                    const finalImg = new Image();
                    finalImg.crossOrigin = 'Anonymous';
                    finalImg.onload = () => resolve(finalImg);
                    finalImg.onerror = () => resolve(null);
                    finalImg.src = src;
                };
                retryImg.src = proxyUrl2;
            };
            img.src = proxyUrl1;
        });
    }

    drawImageCover(ctx, img, x, y, w, h) {
        if (!img) {
            ctx.fillStyle = '#ccc';
            ctx.fillRect(x, y, w, h);
            return;
        }
        const ratio = w / h;
        let nw = img.naturalWidth;
        let nh = img.naturalHeight;
        let nRatio = nw / nh;
        let sx, sy, sWidth, sHeight;
        if (nRatio > ratio) {
            sHeight = nh;
            sWidth = nh * ratio;
            sx = (nw - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = nw;
            sHeight = nw / ratio;
            sx = 0;
            sy = (nh - sHeight) / 2;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    }

    drawImageContain(ctx, img, x, y, w, h) {
        if (!img) return;
        const ratio = w / h;
        let nw = img.naturalWidth;
        let nh = img.naturalHeight;
        let nRatio = nw / nh;
        let dw, dh, dx, dy;
        if (nRatio > ratio) {
            dw = w;
            dh = w / nRatio;
            dx = x;
            dy = y + (h - dh) / 2;
        } else {
            dh = h;
            dw = h * nRatio;
            dy = y;
            dx = x + (w - dw) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
    }
}

/**
 * MAIN APP LOGIC
 */
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
                image: assets.images[0]?.src || '',
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

            this.resultsSection.innerHTML = '<h2 class="section-title">Resultados Generados</h2><div class="results-grid"></div><button class="btn-primary" onclick="location.reload()" style="margin-top: 2rem;">Crear Nuevo</button>';
            const grid = this.resultsSection.querySelector('.results-grid');

            for (let i = 0; i < variations.length; i++) {
                const variant = variations[i];
                const imgIndex = i % assets.images.length;
                const specificImage = assets.images[imgIndex]?.src || brandData.image;

                const variantData = {
                    ...brandData,
                    image: specificImage
                };

                const copy = this.adEngine.generateCopy(brandData, objective, tone, cta);

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

                const canvas = document.createElement('canvas');
                canvas.width = 1080;
                canvas.height = 1080;
                canvas.style.width = '100%';
                canvas.style.borderRadius = '12px';

                card.querySelector('.canvas-container').appendChild(canvas);

                await this.templateEngine.render(canvas, variant.id, {
                    ...variantData,
                    copy
                });

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
        this.inputHeader.classList.add('hidden');
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
