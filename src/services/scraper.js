/**
 * Service to handle scraping and asset extraction via CORS Proxy
 */
class ScraperService {
    constructor() {
        // Using allorigins.win as a free public CORS proxy
        this.proxyUrl = 'https://api.allorigins.win/get?url=';
    }

    /**
     * Fetches and parses the URL content
     * @param {string} url - Target website URL
     * @returns {Promise<{doc: Document, html: string, url: string}>}
     */
    async scrape(url) {
        try {
            const encodedUrl = encodeURIComponent(url);
            const response = await fetch(`${this.proxyUrl}${encodedUrl}`);
            const data = await response.json();

            if (!data.contents) {
                throw new Error('No content received from proxy');
            }

            // Parse HTML first to find CSS links
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            // Fetch CSS files to improve analysis (Heuristic: extract hex codes from CSS)
            const cssLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
                .map(link => link.href)
                .filter(href => href && !href.startsWith('data:'));

            // Helper to fetch text content via proxy
            const fetchText = async (targetUrl) => {
                try {
                    // Handle relative URLs
                    const absoluteUrl = new URL(targetUrl, url).href;
                    const res = await fetch(`${this.proxyUrl}${encodeURIComponent(absoluteUrl)}`);
                    const json = await res.json();
                    return json.contents || '';
                } catch (e) {
                    return '';
                }
            };

            // Fetch top 3 CSS files max to save time
            const cssPromises = cssLinks.slice(0, 3).map(link => fetchText(link));
            const cssContents = await Promise.all(cssPromises);

            // Combine HTML and CSS for the analyzer to scan
            const fullContent = data.contents + ' ' + cssContents.join(' ');

            return {
                doc,
                html: fullContent, // Now contains CSS text too!
                url
            };
        } catch (error) {
            console.error('Scraping failed:', error);
            throw new Error(`Failed to load website: ${error.message}`);
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

        // Attempt to find logo (heuristic: img with 'logo' in class or id, or first image in header)
        const logo = images.find(img => img.src.toLowerCase().includes('logo') || img.alt?.toLowerCase().includes('logo'))
            || images[0];

        return { images, meta, logo };
    }
}
