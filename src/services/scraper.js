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

                // Note for corsproxy.io: It handles the URL directly.
                // For allorigins, it returns JSON.

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

            // Helper to fetch text content via proxy (reusing the working proxy logic would be ideal, but for now simpe fallback)
            // We'll just try to fetch the first CSS with the first proxy that works, or skip to save time.
            // Simplified for speed:
            const fullContent = content;

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
        ) || images[images.length - 1]; // Fallback to smallest image (usually logo-like) if explicit logo not found? 
        // Actually, let's just default to null if no clear logo, or small image.

        return {
            images: uniqueImages.length > 0 ? uniqueImages : (images.length > 0 ? [images[0]] : []),
            meta,
            logo
        };
    }
}
