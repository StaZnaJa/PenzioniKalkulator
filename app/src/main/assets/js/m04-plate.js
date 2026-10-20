// ============================================================================
// M04 — BAZA PROSEČNIH PLATA
// Odgovornost: Prosečne godišnje plate u RS po godinama (1970–2025).
// Pravni osnov: Član 63 — prosečna plata u RS za odgovarajuću godinu.
// Interfejs:
//   M04.getProsecnaPlata(godina) → number
//   M04.setProsecnaPlata(godina, iznos) → void
//   M04.resetujBazu() → void
//   M04.getSvePlate() → { godina: iznos, ... }
// ============================================================================

const M04 = (function () {

    // Podrazumevana baza (1995–2025).
    const DEFAULT_PLATE = {
        1995: 4116,    1996: 7896,    1997: 9576,    1998: 12624,
        1999: 15132,   2000: 28668,   2001: 70080,   2002: 110496,
        2003: 199344,  2004: 246660,  2005: 306168,  2006: 380940,
        2007: 464928,  2008: 548088,  2009: 529764,  2010: 569400,
        2011: 632796,  2012: 689160,  2013: 728496,  2014: 737112,
        2015: 733740,  2016: 761688,  2017: 791712,  2018: 823548,
        2019: 909768,  2020: 995808,  2021: 1089408, 2022: 1239792,
        2023: 1423188, 2024: 1624836, 2025: 1813032
    };

    // Radna kopija koju korisnik može menjati
    let plate = Object.assign({}, DEFAULT_PLATE);

    function getProsecnaPlata(godina) {
        const g = parseInt(godina);
        return plate[g] || 0;
    }

    function setProsecnaPlata(godina, iznos) {
        const g = parseInt(godina);
        const v = parseFloat(iznos);
        if (isNaN(g) || g < 1900 || g > 2100) return false;
        if (isNaN(v) || v < 0) return false;
        plate[g] = v;
        return true;
    }

    function resetujBazu() {
        plate = Object.assign({}, DEFAULT_PLATE);
    }

    function getSvePlate() {
        return Object.assign({}, plate);
    }

    return {
        getProsecnaPlata,
        setProsecnaPlata,
        resetujBazu,
        getSvePlate
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M04;
}