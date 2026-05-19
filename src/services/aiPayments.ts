export async function extraerDatosPago(fileInput: any, cuentas: any[], proveedores: any[]) {
    try {
        const response = await fetch("/api/ai/extract-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileInput, cuentas, proveedores })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Error en el servidor AI");
        }
        
        const data = await response.json();
        return {
            monto: data.monto || 0,
            proveedorMatch: data.proveedorMatch || null,
            cuentaMatch: data.cuentaMatch || null,
            fechaMatch: data.fechaMatch || null,
            obsMatch: data.obsMatch || "",
            success: true,
            rawText: JSON.stringify(data)
        };
    } catch (err) {
        console.error("Error en extractDatosPago AI Proxy:", err);
        return {
           monto: 0,
           proveedorMatch: null,
           cuentaMatch: null,
           fechaMatch: null,
           obsMatch: "",
           success: false,
           rawText: String(err)
        };
    }
}
