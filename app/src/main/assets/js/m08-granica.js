// ============================================================================
// M08 — KALKULATOR STAROSNE GRANICE I SNIŽENJA
// Odgovornost: Opšta granica (pol + godina), snižena granica (režimi),
//              donji limit 55/50 godina.
// Pravni osnov:
//   - Član 19a: prelazni uslovi za žene (2023–2032).
//   - Član 20. st. 1: sniženje 1 god. na 5/4/3/1.5 god. beneficiranog rada.
//   - Član 20. st. 2: opšti donji limit 55.
//   - Član 20. st. 3: izuzetak 50 za režim 12/18 (ako 2/3 na 12/18).
// ============================================================================

const M08 = (function () {

    // ------------------------------------------------------------------------
    // Opšta starosna granica
    // ------------------------------------------------------------------------

    const ZENE_PRELAZ = {
        2023: 63 + 6 / 12,
        2024: 63 + 8 / 12,
        2025: 63 + 10 / 12,
        2026: 64 + 0 / 12,
        2027: 64 + 2 / 12,
        2028: 64 + 4 / 12,
        2029: 64 + 6 / 12,
        2030: 64 + 8 / 12,
        2031: 64 + 10 / 12,
        2032: 65
    };

    function opstaGranica(pol, godinaPenzionisanja) {
        const god = parseInt(godinaPenzionisanja) || new Date().getFullYear();
        if (pol !== 'Ž') return 65;
        if (god >= 2032) return 65;
        if (god <= 2023) return ZENE_PRELAZ[2023];
        return ZENE_PRELAZ[god] || 65;
    }

    // ------------------------------------------------------------------------
    // Sniženje po režimima (Član 20. st. 1)
    // Svaki režim: 1 god. sniženja za svakih N godina BENEFICIRANOG rada.
    // Koriste se PUNE godine beneficije (bez decimala).
    // ------------------------------------------------------------------------

    const REZIMI = {
        '1214': { zaSniženje: 5,   donjiLimit: 55 },
        '1215': { zaSniženje: 4,   donjiLimit: 55 },
        '1216': { zaSniženje: 3,   donjiLimit: 55 },
        '1218': { zaSniženje: 1.5, donjiLimit: 50 }
    };

    function izracunajSnizenje(poRezimu) {
        const rezultat = { snizenjeGodina: 0, donjiLimit: 55 };
        if (!poRezimu) return rezultat;

        // Sniženje = Σ FLOOR(PUNE beneficirane godine / N)
        // Pune godine = Math.floor(beneficiraniDani / 360) — bez decimala.
        Object.keys(REZIMI).forEach(tip => {
            const podaci = poRezimu[tip];
            if (!podaci || !podaci.beneficiraniDani) return;
            const beneficiraneGodine = Math.floor(podaci.beneficiraniDani / 360);
            const snizenje = Math.floor(beneficiraneGodine / REZIMI[tip].zaSniženje);
            rezultat.snizenjeGodina += snizenje;
        });

        // Donji limit: 50 za 12/18 ako 2/3 beneficiranog rada na 12/18
        const p1218 = poRezimu['1218'];
        const p1218Dani = p1218 ? (p1218.beneficiraniDani || 0) : 0;

        let ukupnoBeneficiraniDani = 0;
        Object.keys(poRezimu).forEach(tip => {
            ukupnoBeneficiraniDani += poRezimu[tip].beneficiraniDani || 0;
        });

        if (p1218Dani > 0 && ukupnoBeneficiraniDani > 0) {
            const odnos = p1218Dani / ukupnoBeneficiraniDani;
            if (odnos >= 2 / 3) {
                rezultat.donjiLimit = 50;
            }
        }

        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Snižena granica
    // ------------------------------------------------------------------------

    function snizenaGranica(pol, godinaPenzionisanja, poRezimu) {
        const opsta = opstaGranica(pol, godinaPenzionisanja);
        const { snizenjeGodina, donjiLimit } = izracunajSnizenje(poRezimu);
        return Math.max(opsta - snizenjeGodina, donjiLimit);
    }

    // ------------------------------------------------------------------------
    // Kompletna granica (za M10)
    // ------------------------------------------------------------------------

    function izracunajGranicu(pol, godinaPenzionisanja, poRezimu, uslov23) {
        const opsta = opstaGranica(pol, godinaPenzionisanja);

        if (!uslov23) {
            return {
                opstaGranica: opsta,
                snizenaGranica: opsta,
                snizenjeGodina: 0,
                donjiLimit: 55
            };
        }

        const { snizenjeGodina, donjiLimit } = izracunajSnizenje(poRezimu);
        const snizena = Math.max(opsta - snizenjeGodina, donjiLimit);

        return {
            opstaGranica: opsta,
            snizenaGranica: snizena,
            snizenjeGodina,
            donjiLimit
        };
    }

    return {
        opstaGranica,
        izracunajSnizenje,
        snizenaGranica,
        izracunajGranicu,
        ZENE_PRELAZ,
        REZIMI
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M08;
}