// ============================================================================
// M01 — MODEL PODATAKA
// Odgovornost: Definicije struktura Korisnik, Zarada, Staž; validacija;
//              konverzije GMD <-> dani; pomoćne funkcije za datum.
// Pravni osnov: nije primenjivo (tehnički sloj).
// Interfejs:
//   M01.gmdUDane(godine, meseci, dani) → number
//   M01.daneUGMD(dani) → { g, m, d2 }
//   M01.kreirajKorisnika(podaci) → Korisnik
//   M01.validirajKorisnika(korisnik) → { valid, greske }
//   M01.formatGMD(g, m, d) → string
//   M01.formatDate(date) → 'DD.MM.YYYY'
//   M01.parseDate('DD.MM.YYYY') → Date | null
//   M01.formatDateFromInput('YYYY-MM-DD') → 'DD.MM.YYYY'
//   M01.formatCurrency(amount, showRSD) → string
//   M01.formatGodine(godine) → 'X god Y mes'
// ============================================================================

const M01 = (function () {

    // ------------------------------------------------------------------------
    // Konverzije GMD <-> dani (GMD = Godine, Meseci, Dani; 1 god = 360 dana)
    // ------------------------------------------------------------------------

    function gmdUDane(godine, meseci, dani) {
        return (godine * 360) + (meseci * 30) + dani;
    }

    function daneUGMD(dani) {
        const godine = Math.floor(dani / 360);
        const ostatak = dani % 360;
        const meseci = Math.floor(ostatak / 30);
        const preostaliDani = Math.round(ostatak % 30);
        return { g: godine, m: meseci, d2: preostaliDani };
    }

    // ------------------------------------------------------------------------
    // Kreiranje i validacija korisnika
    // ------------------------------------------------------------------------

    function kreirajKorisnika(podaci) {
        const sada = new Date().toISOString();
        return {
            id: podaci.id || ('k' + Date.now()),
            ime: (podaci.ime || '').trim(),
            pol: podaci.pol === 'Ž' ? 'Ž' : 'M',
            datumRodjenja: podaci.datumRodjenja || '',
            brojDece: parseInt(podaci.brojDece) || 0,
            kategorija: podaci.kategorija || 'NE',
            datumPoslednjegStaza: podaci.datumPoslednjegStaza || '',
            opstiBod: parseFloat(podaci.opstiBod) || 1674.67,
            zarade: podaci.zarade || [],
            staz: podaci.staz || [],
            penzijaMesecno: podaci.penzijaMesecno || 0,
            penzijaGodisnja: podaci.penzijaGodisnja || 0,
            datumKreiranja: podaci.datumKreiranja || sada,
            datumAzuriranja: podaci.datumAzuriranja || sada
        };
    }

    function validirajKorisnika(k) {
        const greske = [];
        if (!k) { greske.push('Korisnik je prazan'); return { valid: false, greske }; }
        if (!k.ime || !k.ime.trim()) greske.push('Ime je obavezno');
        if (k.pol !== 'M' && k.pol !== 'Ž') greske.push('Pol mora biti M ili Ž');
        if (k.pol === 'Ž' && (k.brojDece < 0 || k.brojDece > 20)) {
            greske.push('Broj dece mora biti između 0 i 20');
        }
        if (k.datumRodjenja) {
            const d = parseDate(k.datumRodjenja);
            if (!d) greske.push('Datum rođenja nije validan (DD.MM.YYYY)');
        }
        return { valid: greske.length === 0, greske };
    }

    // ------------------------------------------------------------------------
    // Formatiranje
    // ------------------------------------------------------------------------

    function formatGMD(g, m, d) {
        if (g === 0 && m === 0 && d === 0) return '0 dana';
        let r = '';
        if (g > 0) r += g + ' god ';
        if (m > 0) r += m + ' mes ';
        if (d > 0) r += d + ' dana';
        return r.trim();
    }

    function formatDate(date) {
        if (!date) return '';
        return String(date.getDate()).padStart(2, '0') + '.' +
               String(date.getMonth() + 1).padStart(2, '0') + '.' +
               date.getFullYear();
    }

    function parseDate(str) {
        if (!str) return null;
        const parts = str.split('.');
        if (parts.length !== 3) return null;
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const y = parseInt(parts[2]);
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        return new Date(y, m, d);
    }

    function formatDateFromInput(dateValue) {
        if (!dateValue) return '';
        const d = new Date(dateValue);
        if (isNaN(d.getTime())) return '';
        return formatDate(d);
    }

    function formatCurrency(amt, showRSD) {
        if (showRSD === undefined) showRSD = true;
        const f = new Intl.NumberFormat('sr-RS', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amt || 0);
        return showRSD ? f + ' RSD' : f;
    }

    function formatGodine(godine) {
        const g = Math.floor(godine);
        const m = Math.floor((godine - g) * 12);
        return g + ' god ' + m + ' mes';
    }

    // ------------------------------------------------------------------------
    // Javni interfejs
    // ------------------------------------------------------------------------

    return {
        gmdUDane,
        daneUGMD,
        kreirajKorisnika,
        validirajKorisnika,
        formatGMD,
        formatDate,
        parseDate,
        formatDateFromInput,
        formatCurrency,
        formatGodine
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M01;
}