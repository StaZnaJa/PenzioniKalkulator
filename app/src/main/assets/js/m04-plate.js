// ============================================================================
// M04 — BAZA PROSEČNIH PLATA
// Odgovornost: Prosečne godišnje plate u RS po godinama (1995–2026).
// Pravni osnov: Član 63 — prosečna plata u RS za odgovarajuću godinu.
// Interfejs:
//   M04.getProsecnaPlata(godina) → number
//   M04.setProsecnaPlata(godina, iznos) → boolean
//   M04.resetujBazu() → void
//   M04.getSvePlate() → { godina: iznos, ... }
//   M04.getPlateZaOpseg(odGodine, doGodine) → { godina: iznos, ... }
//   M04.imaPlatu(godina) → boolean
//   M04.getGodine() → number[]
// Napomena:
//   - Vrednost za 2026. je PROCENA. Zameniti tačnim podatkom kada bude
//     zvanično objavljen (RZS / PIO fond).
// ============================================================================

const M04 = (function () {

    // Podrazumevana baza (1995–2026).
    const DEFAULT_PLATE = {
        1995: 4116,    1996: 7896,    1997: 9576,    1998: 12624,
        1999: 15132,   2000: 28668,   2001: 70080,   2002: 110496,
        2003: 199344,  2004: 246660,  2005: 306168,  2006: 380940,
        2007: 464928,  2008: 548088,  2009: 529764,  2010: 569400,
        2011: 632796,  2012: 689160,  2013: 728496,  2014: 737112,
        2015: 733740,  2016: 761688,  2017: 791712,  2018: 823548,
        2019: 909768,  2020: 995808,  2021: 1089408, 2022: 1239792,
        2023: 1423188, 2024: 1624836, 2025: 1813032,
        2026: 1985000   // PROCENA — zameniti zvaničnim podatkom
    };

    const MIN_GODINA = 1900;
    const MAX_GODINA = 2100;
    const MAX_IZNOS = 10000000; // 10 miliona RSD — razumna gornja granica

    // Radna kopija koju korisnik može menjati
    let plate = Object.assign({}, DEFAULT_PLATE);

    // ------------------------------------------------------------------------
    // Čitanje
    // ------------------------------------------------------------------------

    function getProsecnaPlata(godina) {
        const g = parseInt(godina, 10);
        if (isNaN(g)) return 0;
        return plate[g] || 0;
    }

    function imaPlatu(godina) {
        const g = parseInt(godina, 10);
        if (isNaN(g)) return false;
        return Object.prototype.hasOwnProperty.call(plate, g) && plate[g] > 0;
    }

    function getGodine() {
        return Object.keys(plate)
            .map(Number)
            .sort((a, b) => a - b);
    }

    function getSvePlate() {
        return Object.assign({}, plate);
    }

    function getPlateZaOpseg(odGodine, doGodine) {
        const od = parseInt(odGodine, 10);
        const doG = parseInt(doGodine, 10);
        const rezultat = {};

        if (isNaN(od) && isNaN(doG)) {
            return getSvePlate();
        }

        const donja = isNaN(od) ? -Infinity : od;
        const gornja = isNaN(doG) ? Infinity : doG;

        Object.keys(plate).forEach(k => {
            const g = parseInt(k, 10);
            if (g >= donja && g <= gornja) {
                rezultat[g] = plate[g];
            }
        });
        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Upis
    // ------------------------------------------------------------------------

    function setProsecnaPlata(godina, iznos) {
        const g = parseInt(godina, 10);
        const v = parseFloat(iznos);

        if (isNaN(g) || g < MIN_GODINA || g > MAX_GODINA) return false;
        if (isNaN(v) || v < 0 || v > MAX_IZNOS) return false;

        plate[g] = v;
        return true;
    }

    function resetujBazu() {
        plate = Object.assign({}, DEFAULT_PLATE);
    }

    // ------------------------------------------------------------------------
    // Javni interfejs
    // ------------------------------------------------------------------------

    return {
        getProsecnaPlata,
        setProsecnaPlata,
        resetujBazu,
        getSvePlate,
        getPlateZaOpseg,
        imaPlatu,
        getGodine,
        MIN_GODINA,
        MAX_GODINA,
        MAX_IZNOS
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M04;
}
