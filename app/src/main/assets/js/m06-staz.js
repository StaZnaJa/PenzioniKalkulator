// ============================================================================
// M06 — KALKULATOR PENZIJSKOG STAŽA
// Odgovornost: Efektivni staž, beneficirani staž, uvećani staž, ukupan staž
//              osiguranja, staž za obračun bodova.
// Pravni osnov:
//   - Član 54 (kvalifikacija beneficije, min. 10 god.) — provera u M07.
//   - Član 60 (poseban staž za decu).
//   - Član 68 (max 45 godina za obračun bodova).
//   - Član 69 (žene +6% na staž za obračun visine penzije).
// ============================================================================

const M06 = (function () {

    const MAX_STAZ_BODOVI = 45.0;

    const DECA_STAZ = {
        0: 0,
        1: 0.5,
        2: 1.0,
        3: 2.0
    };

    // ------------------------------------------------------------------------
    // Koeficijent uvećanja po režimu
    // ------------------------------------------------------------------------

    function koefRezima(tip) {
        switch (tip) {
            case '1214': return 14 / 12;
            case '1215': return 15 / 12;
            case '1216': return 16 / 12;
            case '1218': return 18 / 12;
            default:     return 1;
        }
    }

    // ------------------------------------------------------------------------
    // Poseban staž za decu (samo za žene)
    // ------------------------------------------------------------------------

    function decaDodatak(brojDece) {
        const n = parseInt(brojDece) || 0;
        if (n <= 0) return 0;
        if (n >= 3) return DECA_STAZ[3];
        return DECA_STAZ[n] || 0;
    }

    // ------------------------------------------------------------------------
    // Glavna funkcija obračuna staža
    // ------------------------------------------------------------------------

    function izracunajStaz(stazNiz, pol, brojDece, priznajeSeBeneficija) {
        const rezultat = {
            efektivniDani: 0,
            beneficiraniDani: 0,
            uvecaniDani: 0,
            ukupnoOsiguranjeDani: 0,
            stazZaBodoveGodine: 0,
            decaDodatakGodine: 0,
            poRezimu: {}
        };

        if (!stazNiz || !stazNiz.length) return rezultat;

        // 1. Sabiranje efektivnog i beneficiranog staža
        stazNiz.forEach(s => {
            const efM = s.efektivniMeseci || 0;
            const efD = s.efektivniDani || 0;
            const benM = s.beneficiraniMeseci || 0;
            const benD = s.beneficiraniDani || 0;
            const tip = s.tipBeneficiranja || '1212';

            const efDani = efM * 30 + efD;
            const benDani = benM * 30 + benD;

            rezultat.efektivniDani += efDani;
            rezultat.beneficiraniDani += benDani;

            // Grupisanje po režimu — samo beneficirani dani (za M08)
            if (benDani > 0) {
                if (!rezultat.poRezimu[tip]) {
                    rezultat.poRezimu[tip] = { beneficiraniDani: 0 };
                }
                rezultat.poRezimu[tip].beneficiraniDani += benDani;
            }
        });

        // 2. Uvećani staž (samo ako je beneficija priznata)
        if (priznajeSeBeneficija) {
            stazNiz.forEach(s => {
                const benM = s.beneficiraniMeseci || 0;
                const benD = s.beneficiraniDani || 0;
                const tip = s.tipBeneficiranja || '1212';
                const koef = koefRezima(tip);
                const benDani = benM * 30 + benD;
                rezultat.uvecaniDani += Math.round(benDani * (koef - 1));
            });
        }

        // 3. Ukupan staž osiguranja = efektivni + uvećani (BEZ ograničenja)
        //    Ograničenje na 45 godina primenjuje se samo na stazZaBodoveGodine.
        rezultat.ukupnoOsiguranjeDani = rezultat.efektivniDani + rezultat.uvecaniDani;

        // 4. Staž za obračun bodova
        const ukupnoGodine = rezultat.ukupnoOsiguranjeDani / 360;
        const dodatakDece = (pol === 'Ž') ? decaDodatak(brojDece) : 0;
        rezultat.decaDodatakGodine = dodatakDece;

        let stazBodovi;
        if (pol === 'Ž') {
            // Čl. 69: +6% na staž za obračun visine penzije
            stazBodovi = ukupnoGodine * 1.06 + dodatakDece;
        } else {
            stazBodovi = ukupnoGodine;
        }
        rezultat.stazZaBodoveGodine = Math.min(stazBodovi, MAX_STAZ_BODOVI);

        return rezultat;
    }

    return {
        izracunajStaz,
        koefRezima,
        decaDodatak,
        MAX_STAZ_BODOVI,
        DECA_STAZ
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M06;
}
