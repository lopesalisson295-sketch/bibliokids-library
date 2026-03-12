import https from 'https';
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
    console.log("Testing BrasilAPI with providers...");
    let b = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}?providers=mercado-editorial,cbl,open-library`).then(r => r.json()).catch(() => ({}));
    console.log(JSON.stringify(b, null, 2));
}
test();
