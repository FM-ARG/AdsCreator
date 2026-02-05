/**
 * Handles rendering of Ad Templates on HTML5 Canvas
 */
class TemplateEngine {
    constructor() {
        this.canvasSize = 1080; // 1:1 Aspect Ratio (1080x1080)
    }

    async render(canvas, templateId, data) {
        const ctx = canvas.getContext('2d');
        // Reset canvas
        ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

        // Load assets
        const bgImage = await this.loadImage(data.image);
        const logo = data.logo ? await this.loadImage(data.logo) : null;

        const colors = data.colors || ['#000000', '#ffffff'];
        const primaryColor = colors[0];
        const secondaryColor = colors[1] || '#ffffff';

        // Route to template logic
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
        // Layout: Top 60% Image, Bottom 40% Solid Color
        const splitY = this.canvasSize * 0.6;

        // Draw Image
        this.drawImageCover(ctx, img, 0, 0, this.canvasSize, splitY);

        // Draw Bottom Background
        ctx.fillStyle = color;
        ctx.fillRect(0, splitY, this.canvasSize, this.canvasSize - splitY);

        // Draw Text
        ctx.fillStyle = '#ffffff'; // Assuming dark primary color, logical improvement needed for contrast check
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Headline
        ctx.font = 'bold 60px Inter, sans-serif';
        this.wrapText(ctx, copy.headline, 50, splitY + 50, 980, 70);

        // CTA Button
        this.drawButton(ctx, copy.cta, 50, this.canvasSize - 150, '#ffffff', color);

        // Logo
        if (logo) {
            this.drawImageContain(ctx, logo, 850, splitY + 50, 180, 100);
        }
    }

    renderBoldCenter(ctx, img, logo, color, secColor, copy) {
        // Layout: Full Image with heavy tint, Center Text
        this.drawImageCover(ctx, img, 0, 0, this.canvasSize, this.canvasSize);

        // Overlay
        ctx.fillStyle = color + 'CC'; // 80% opacity hex
        ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 20;
        ctx.strokeRect(50, 50, 1080 - 100, 1080 - 100);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        ctx.font = '800 90px Outfit, sans-serif';
        this.wrapText(ctx, copy.headline.toUpperCase(), 540, 300, 900, 100);

        ctx.font = '400 40px Inter, sans-serif';
        this.wrapText(ctx, copy.body, 540, 600, 800, 50);

        // CTA
        this.drawButton(ctx, copy.cta, 540 - 150, 800, '#ffffff', color);

        if (logo) {
            this.drawImageContain(ctx, logo, 440, 100, 200, 100);
        }
    }

    renderGlassOverlay(ctx, img, logo, color, secColor, copy) {
        // Layout: Full Image, Glass card at bottom
        this.drawImageCover(ctx, img, 0, 0, this.canvasSize, this.canvasSize);

        // Glass Card
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

        // Text (Dark usually on white glass)
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'left';

        ctx.font = 'bold 50px Inter, sans-serif';
        this.wrapText(ctx, copy.headline, cardX + 40, cardY + 40, cardW - 80, 60);

        ctx.font = '400 30px Inter, sans-serif';
        this.wrapText(ctx, copy.body, cardX + 40, cardY + 120, cardW - 80, 40);

        // CTA
        this.drawButton(ctx, copy.cta, cardX + 40, cardY + 230, color, '#ffffff');

        if (logo) {
            this.drawImageContain(ctx, logo, cardX + cardW - 160, cardY + 40, 120, 80);
        }
    }

    // --- Helpers ---

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

        // If simple rect:
        ctx.roundRect(x, y, width, height, 40); // Pill shape
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(text, x + (width / 2), y + 26); // rough vertical center
        ctx.restore();
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous'; // Crucial for canvas export

            // 1. Try with corsproxy.io (Very reliable)
            const proxyUrl1 = 'https://corsproxy.io/?' + encodeURIComponent(src);

            // 2. Fallback to wsrv.nl (Image CDN, great for resizing/proxying)
            const proxyUrl2 = 'https://wsrv.nl/?url=' + encodeURIComponent(src) + '&w=1080&output=png';

            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn('Proxy 1 failed, trying fallback:', src);
                const retryImg = new Image();
                retryImg.crossOrigin = 'Anonymous';
                retryImg.onload = () => resolve(retryImg);
                retryImg.onerror = () => {
                    // Last resort: Original URL (might work if CORS is open)
                    console.warn('Fallback failed, trying direct:', src);
                    const finalImg = new Image();
                    finalImg.crossOrigin = 'Anonymous';
                    finalImg.onload = () => resolve(finalImg);
                    finalImg.onerror = () => resolve(null); // Give up
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
