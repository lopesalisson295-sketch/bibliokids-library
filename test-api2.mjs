async function testFetch() {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=Um+dia+sem+reclamar&maxResults=5`);
    const txt = await res.text();
    console.log("Response:", txt.slice(0, 100));
}
testFetch();
