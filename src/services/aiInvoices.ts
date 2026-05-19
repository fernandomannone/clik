export async function extraerFacturaProveedor(fileInput: any, proveedores: any[], articulos: any[]) {
    try {
        const response = await fetch("/api/ai/extract-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileInput, proveedores, articulos })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Error en el servidor AI");
        }
        
        const data = await response.json();
        return {
            success: true,
            data: data,
            rawText: JSON.stringify(data)
        };
    } catch (err) {
        console.error("Error en extractFactura AI Proxy:", err);
        return { success: false, data: null, rawText: String(err) };
    }
}
