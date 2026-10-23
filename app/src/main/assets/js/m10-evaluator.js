// ============================================================================
// M10 — EVALUATOR OPCIJA PENZIONISANJA
// Odgovornost: Orkestrator — poziva M05–M09 i vraća sve opcije penzionisanja
//              sa statusima i iznosima.
// Pravni osnov:
//   - Čl. 19: redovna starosna.
//   - Čl. 19b: prevremena starosna (min. 60 godina + 40 staža).
//   - Čl. 20: snižena granica (beneficija).
//   - Čl. 70g: referentna granica za beneficirane (samo za prevremenu,
//              kada je snižena granica > 60).
// ============================================================================

const M10 = (function () {

    // ------------------------------------------------------------------------
    // Pomoćna: kalendarske godine života na datum procene
    // ------------------------------------------------------------------------

    function godineZivota(datumRodjenja, datumProcene) {
        const rodj = M01.parseDate(datumRodjenja);
        if (!rodj) return 0;
        const proc = datumProcene instanceof Date ? new Date(datumProcene) : new Date(datumProcene);
        if (isNaN(proc.getTime())) return 0;

        let godine = proc.getFullYear() - rodj.getFullYear();
        const mesecR = rodj.getMonth();
        const danR = rodj.getDate();
        const mesecP = proc.getMonth();
        const danP = proc.getDate();

        if (mesecP < mesecR || (mesecP === mesecR && danP < danR)) {
            godine--;
        }
        return godine;
    }

    // ------------------------------------------------------------------------
    // Pomoćna: kreiranje opcije
    // ------------------------------------------------------------------------

    function napraviOpciju(id, naziv, ispunjeno, iznos, detalji) {
        return {
            id,
            naziv,
            ispunjeno,
            status: ispunjeno ? '✅ ISPUNJENO' : '⏳ NA ČEKANJU',
            iznos: Math.round(iznos || 0),
            detalji: detalji || {}
        };
    }

    // ------------------------------------------------------------------------
    // Glavna evaluacija
    // ------------------------------------------------------------------------

    function evaluiraj(korisnik, datumProcene) {
        if (!korisnik) return null;

        const datum = datumProcene || new Date();
        const pol = korisnik.pol || 'M';
        const godine = godineZivota(korisnik.datumRodjenja, datum);
        const godinaPenzionisanja = datum.getFullYear
            ? datum.getFullYear()
            : new Date(datum).getFullYear();

        // 1. Provera uslova 2/3 i Čl. 54
        const uslovi = M07.proveri(korisnik.staz);

        // 2. Staž (M06)
        const staz = M06.izracunajStaz(
            korisnik.staz,
            pol,
            korisnik.brojDece,
            uslovi.priznajeSeBeneficija
        );

        // 3. LK (M05) — vraća objekat { lk, greske, ... }
        const koefBol = M05.izracunajKoeficijentBolovanja(korisnik.zarade);
        const efektivniStazGodine = staz.efektivniDani / 360;
        const lkRezultat = M05.izracunajUkupniLK(
            korisnik.zarade,
            efektivniStazGodine,
            koefBol.koeficijent
        );
        const lk = lkRezultat.lk;
        const lkGreske = lkRezultat.greske || [];

        // 4. Granice (M08)
        const granice = M08.izracunajGranicu(
            pol,
            godinaPenzionisanja,
            staz.poRezimu,
            uslovi.uslov23Ispunjen
        );

        // 5. Osnovni iznos (bez penala)
        const opstiBod = korisnik.opstiBod || 1674.67;
        const osnovniIznos = lk * staz.stazZaBodoveGodine * opstiBod;

        // 6. Opcije penzionisanja
        const opcije = [];

        // ---- OP-01: Redovna starosna (opšti uslov) ----
        {
            const ispunjeno = godine >= granice.opstaGranica
                && staz.efektivniDani >= 15 * 360;
            opcije.push(napraviOpciju(
                'OP-01',
                'Redovna starosna penzija',
                ispunjeno,
                ispunjeno ? osnovniIznos : 0,
                { granica: granice.opstaGranica, potrebanStaz: 15, puneGodine: godine }
            ));
        }

        // ---- OP-02: Redovna po osnovu staža ----
        {
            const ukupnoGodine = staz.ukupnoOsiguranjeDani / 360;
            const ispunjeno = ukupnoGodine >= 45;
            opcije.push(napraviOpciju(
                'OP-02',
                'Redovna penzija po osnovu staža (45 god.)',
                ispunjeno,
                ispunjeno ? osnovniIznos : 0,
                { ukupnoGodine }
            ));
        }

        // ---- OP-03: Redovna sa sniženom granicom (beneficija) ----
        {
            const ispunjeno = uslovi.uslov23Ispunjen
                && godine >= granice.snizenaGranica
                && staz.efektivniDani >= 15 * 360;
            opcije.push(napraviOpciju(
                'OP-03',
                'Redovna sa sniženom granicom (beneficija)',
                ispunjeno,
                ispunjeno ? osnovniIznos : 0,
                { snizenaGranica: granice.snizenaGranica, puneGodine: godine }
            ));
        }

        // ---- OP-04: Prevremena opšta ----
        // Opšti uslov: 60 godina + 40 staža. Dostupno SVIMA, bez obzira na beneficiju.
        {
            const ispunjeno = godine >= 60
                && staz.ukupnoOsiguranjeDani >= 40 * 360;
            const penal = ispunjeno
                ? M09.izracunajPenalOdDatuma(korisnik.datumRodjenja, granice.opstaGranica, datum)
                : { procenatUmanjenja: 0, meseciRanije: 0 };
            const iznos = ispunjeno
                ? M09.primeniPenal(osnovniIznos, penal.procenatUmanjenja)
                : 0;
            opcije.push(napraviOpciju(
                'OP-04',
                'Prevremena starosna penzija',
                ispunjeno,
                iznos,
                {
                    penal: penal.procenatUmanjenja,
                    meseciRanije: penal.meseciRanije,
                    referentnaGranica: granice.opstaGranica,
                    puneGodine: godine
                }
            ));
        }

        // ---- OP-05: Prevremena sa beneficijom ----
        {
            const min60 = godine >= 60;
            const min40staz = staz.ukupnoOsiguranjeDani >= 40 * 360;
            const snizenaGranaVecaOd60 = granice.snizenaGranica > 60;
            const uslov23 = uslovi.uslov23Ispunjen;

            const ispunjeno = uslov23
                && min60
                && min40staz
                && snizenaGranaVecaOd60
                && godine < granice.snizenaGranica;

            const penal = ispunjeno
                ? M09.izracunajPenalOdDatuma(korisnik.datumRodjenja, granice.snizenaGranica, datum)
                : { procenatUmanjenja: 0, meseciRanije: 0 };

            const iznos = ispunjeno
                ? M09.primeniPenal(osnovniIznos, penal.procenatUmanjenja)
                : 0;
            opcije.push(napraviOpciju(
                'OP-05',
                'Prevremena sa beneficijom (Čl. 70g)',
                ispunjeno,
                iznos,
                {
                    penal: penal.procenatUmanjenja,
                    meseciRanije: penal.meseciRanije,
                    referentnaGranica: granice.snizenaGranica,
                    puneGodine: godine,
                    napomena: ispunjeno
                        ? null
                        : (granice.snizenaGranica <= 60
                            ? 'Snižena granica je ≤ 60 — redovna penzija je povoljnija'
                            : (godine < 60 ? 'Potrebno je min. 60 godina života' : 'Nedostaje staž'))
                }
            ));
        }

        // 7. Rezultat
        return {
            lk,
            lkGreske,
            koefBolovanja: koefBol.koeficijent,
            koefBolovanjaDetalji: koefBol.detalji,
            koefBolovanjaGreske: koefBol.greske || [],
            staz,
            uslovi,
            granice,
            godineZivota: godine,
            puneGodine: godine,
            godinaPenzionisanja,
            opstiBod,
            osnovniIznos,
            opcije
        };
    }

    return {
        evaluiraj,
        godineZivota
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M10;
}
