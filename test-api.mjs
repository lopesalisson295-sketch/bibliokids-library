const extractTranslators = (names) => {
    if (!names || names.length === 0) return { authors: "", translators: "" };
    const authorsList = [];
    const translatorsList = [];
    names.forEach(name => {
        if (/traduto|translato|traduçã/i.test(name)) {
            translatorsList.push(name.replace(/\s*\(\s*(Tradutor|Translator|Tradução|Trad)\s*\)/i, "").trim());
        } else {
            authorsList.push(name.trim());
        }
    });
    return {
        authors: authorsList.join(", "),
        translators: translatorsList.join(", ")
    };
};

async function test(isbn) {
    const bd = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}`).then(r => r.json()).catch(() => null);
    console.log("BrasilAPI title:", bd?.title, "authors:", bd?.authors);
    if (bd?.authors) {
        console.log("Extract BrasilAPI:", extractTranslators(bd.authors));
    }
}

test('6585348249');
