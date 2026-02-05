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
            // Add other objectives... fallback logic will handle missing ones
        };
    }

    generateCopy(brandInfo, objective, tone, userCta) {
        // Fallback to 'sales' if objective not found, fallback to 'profesional' if tone not found
        const objectiveGroup = this.copyTemplates[objective] || this.copyTemplates['sales'];
        const toneGroup = objectiveGroup[tone] || objectiveGroup['profesional'];

        // Pick random template
        const template = toneGroup[Math.floor(Math.random() * toneGroup.length)];

        return {
            headline: template.headline,
            body: template.body,
            cta: userCta || template.cta
        };
    }

    selectVisualTemplate(style) {
        // Return 3 distinct template IDs
        return ['minimal-split', 'bold-center', 'glass-overlay'];
    }
}
