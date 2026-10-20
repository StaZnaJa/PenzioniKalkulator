// ============================================================================
// M07 — PROVERA USLOVA 2/3 I ČLANA 54
// Odgovornost: Kvalifikacioni uslov 10 godina beneficije (Čl. 54) i uslov
//              2/3 beneficiranog u ukupnom efektivnom stažu (Čl. 20).
// Pravni osnov:
//   - Član 54. st. 1: min. 10 god. efektivnog beneficiranog rada.
//   - Član 20. st. 1: min. 2/3 beneficiranog u ukupnom efektivnom stažu.
// Napomena: Prag od 5 godina za invalide se NE primenjuje (van obuhvata).
// ============================================================================

const M07 = (function () {

    const MIN_BENEFICIRANO_DANI = 10 * 360;  // 10 godina
    const PRAG_2_3 = 200 / 3;                // 66.666...%

    // ------------------------------------------------------------------------
    // Glavna provera
    // ------------------------------------------------------------------------

    function proveri(stazNiz) {
        const rezultat = {
            priznajeSeBeneficija: false,
            uslov23Ispunjen: false,
            procenat23: 0,
            efektivniBeneficiraniDani: 0,
            efektivniDani: 0,
            efektivniGodine: 0,
            beneficiraniGodine: 0,
            zahtevaniMinimumGodine: 0,
            status: 'Nema podataka'
        };

        if (!stazNiz || !stazNiz.length) return rezultat;

        // 1. Sabiranje
        stazNiz.forEach(s => {
            const efM = s.efektivniMeseci || 0;
            const efD = s.efektivniDani || 0;
            const benM = s.beneficiraniMeseci || 0;
            const benD = s.beneficiraniDani || 0;

            rezultat.efektivniDani += efM * 30 + efD;
            rezultat.efektivniBeneficiraniDani += benM * 30 + benD;
        });

        rezultat.efektivniGodine = rezultat.efektivniDani / 360;
        rezultat.beneficiraniGodine = rezultat.efektivniBeneficiraniDani / 360;

        // 2. Član 54. st. 1: min. 10 godina beneficije
        rezultat.priznajeSeBeneficija =
            rezultat.efektivniBeneficiraniDani >= MIN_BENEFICIRANO_DANI;

        // 3. Uslov 2/3: beneficirani / ukupan efektivni ≥ 2/3
        if (rezultat.efektivniDani > 0) {
            rezultat.procenat23 =
                (rezultat.efektivniBeneficiraniDani / rezultat.efektivniDani) * 100;
        }
        rezultat.zahtevaniMinimumGodine =
            rezultat.efektivniGodine * (2 / 3);

        rezultat.uslov23Ispunjen =
            rezultat.priznajeSeBeneficija &&
            rezultat.procenat23 >= PRAG_2_3;

        // 4. Status
        if (!rezultat.priznajeSeBeneficija) {
            const nedostajeDana = MIN_BENEFICIRANO_DANI - rezultat.efektivniBeneficiraniDani;
            const nedostajeGod = (nedostajeDana / 360).toFixed(2);
            rezultat.status = 'Nedovoljno godina beneficiranog rada (minimum 10 godina) — nedostaje '
                + nedostajeGod + ' god';
        } else if (rezultat.uslov23Ispunjen) {
            rezultat.status = 'USLOV ISPUNJEN (' + rezultat.procenat23.toFixed(2) + '%)';
        } else {
            const nedostaje = (PRAG_2_3 - rezultat.procenat23).toFixed(2);
            rezultat.status = 'USLOV NIJE ISPUNJEN (2/3) — nedostaje ' + nedostaje + '%';
        }

        return rezultat;
    }

    return {
        proveri,
        MIN_BENEFICIRANO_DANI,
        PRAG_2_3
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M07;
}