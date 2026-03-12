async function testFetch() {
    console.log("OL url q:", `https://openlibrary.org/search.json?q=Assistente+do+Vilao&limit=2`);
    try {
        const resAny = await fetch(`https://openlibrary.org/search.json?q=Assistente+do+Vilao&limit=2`);
        const rAny = await resAny.json();
        console.log("Items found:", rAny.docs ? rAny.docs.length : 0);
        if (rAny.docs && rAny.docs.length > 0) {
            console.log("First item:", rAny.docs[0].title);
        }
    } catch (e) {
        console.error("Failed OL", e);
    }
}
testFetch();
