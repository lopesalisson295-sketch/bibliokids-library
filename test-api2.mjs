async function testFetch() {
    const titulo = "A Menina que Roubava Livros";
    const qs = encodeURIComponent(titulo);
    
    // Teste Mercado Livre API (como busca de fallback)
    try {
        console.log("Mercado Livre API:");
        const mlRes = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${qs}`);
        const mlData = await mlRes.json();
        
        console.log("Resultados:", mlData.results?.length);
        if (mlData.results && mlData.results.length > 0) {
            const first = mlData.results[0];
            console.log("Título:", first.title);
            console.log("Thumbnail:", first.thumbnail);
            
            console.log(first.attributes?.map(a => `${a.name}: ${a.value_name}`).join(" | "));
        }
    } catch (e) {
        console.error("Failed ML", e);
    }
}
testFetch();
