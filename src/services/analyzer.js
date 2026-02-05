/**
 * Analyzes raw HTML/CSS to extract design tokens (Colors, Fonts)
 * Uses heuristics since we cannot compute styles on non-rendered DOM
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
        // Regex to find all Hex codes (6 digits only for quality, ignoring short ones to avoid #fff false positives if common)
        // Actually, let's include 3 digits but filter out common ones like white/black later
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
            // Filter out generic system fonts if possible, or just count all
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
        // Very basic keyword extraction (could be improved)
        return text.split(/\s+/).filter(w => w.length > 4);
    }
}
