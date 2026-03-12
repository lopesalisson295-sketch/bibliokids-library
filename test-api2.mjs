import fetch from 'node-fetch';

const isbn = '6585348249';

async function logApi() {
    const gd = await fetch('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn + '&maxResults=3').then(r => r.json());
    console.log("gd authors:", gd.items?.[0]?.volumeInfo?.authors);

    const bd = await fetch('https://brasilapi.com.br/api/isbn/v1/' + isbn).then(r => r.json());
    console.log("bd authors:", bd.authors);

    const ol = await fetch('https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data').then(r => r.json());
    console.log("ol authors:", ol['ISBN:' + isbn]?.authors);

    const qStr = encodeURIComponent('inauthor:Hannah Nicole Maehrer Assistente do Vilão');
    const gf = await fetch('https://www.googleapis.com/books/v1/volumes?q=' + qStr + '&langRestrict=pt&maxResults=5').then(r => r.json());
    console.log("gf authors:", gf.items?.[0]?.volumeInfo?.authors);
}
logApi();
