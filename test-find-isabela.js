const https = require('https');
async function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve({ json: () => JSON.parse(data) }) } catch (e) { resolve({ json: () => ({}) }) } });
        }).on('error', reject);
    })
}

async function test() {
    const isbn = '6585348249';
    console.log("Testing BrasilAPI...");
    let b = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}`).then(r => r.json()).catch(() => ({}));
    console.log("B:", b.authors);

    console.log("Testing Google ISBN...");
    let g1 = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`).then(r => r.json()).catch(() => ({}));
    console.log("G1:", g1.items?.[0]?.volumeInfo?.authors);

    console.log("Testing Google PT-BR search directly...");
    let g2 = await fetch(`https://www.googleapis.com/books/v1/volumes?q=inauthor:Hannah%20Nicole%20Maehrer%20Assistente%20do%20Vil%C3%A3o&langRestrict=pt`).then(r => r.json()).catch(() => ({}));
    console.log("G2:", g2.items?.[0]?.volumeInfo?.authors);
}
test();
