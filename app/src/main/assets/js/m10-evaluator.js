// ============================================================================
// M10 — EVALUATOR OPCIJA PENZIONISANJA
// ============================================================================

const M10 = (function () {

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
        if (mesecP < mesecR || (mesecP === mesecR && danP < danR)) godine--;
        return godine;
    }

    // DODATO: provera decimalne granice (64.1667 → 64g 2m).
    function jeNavrsioGodine(datumRodjenja, granicaDecimalna, datumProcene) {
        const rodj = M01.parseDate(datumRodjenja);
        if (!rodj) return false;
        const proc = datumProcene instanceof Date ? new Date(datumProcene) : new Date(datumProcene);
        if (isNaN(proc.getTime())) return false;
        const puneGodine = Math.floor(granicaDecimalna);
        const meseci = Math.round((granicaDecimalna - puneGodine) * 12);
        const granicaDatum = new Date(rodj);
        granicaDatum.setFullYear(rodj.getFullYear() + puneGodine);
        granicaDatum.setMonth(rodj.getMonth() + meseci);
        return proc >= granicaDatum;
    }

    function napraviOpciju(id, naziv, ispunjeno, iznos, detalji) {
        return {
            id, naziv, ispunjeno,
            status: ispunjeno ? '✅ ISPUNJENO' : '⏳ NA ČEKANJU',
            iznos: Math.round(iznos || 0),
            detalji: detalji || {}
        };
    }

    function evaluiraj(korisnik, datumProcene) {
        if (!korisnik) return null;

        const datum = datumProcene || new Date();
        const pol = korisnik.pol || 'M';
        const godine = godineZivota(korisnik.datumRodjenja, datum);
        const godinaPenzionisanja = datum.getFullYear
            ? datum.getFullYear()
            : new Date(datum).getFullYear();

        const uslovi = M07.proveri(korisnik.staz);
        const staz = M06.izracunajStaz(korisnik.staz, pol, korisnik.brojDece,
            uslovi.priznajeSeBeneficija);

        const koefBol = M05.izracunajKoeficijentBolovanja(korisnik.zarade);
        const efektivniStazGodine = staz.efektivniDani / 360;
        const lkRezultat = M05.izracunajUkupniLK(
            korisnik.zarade, efektivniStazGodine, koefBol.koeficijent);
        const lk = lkRezultat.lk;
        const lkGreske = lkRezultat.greske || [];

        const granice = M08.izracunajGranicu(
            pol, godinaPenzionisanja, staz.poRezimu, uslovi.uslov23Ispunjen);

        const opstiBod = korisnik.opstiBod || 1674.67;
        const osnovniIznos = lk * staz.stazZaBodoveGodine * opstiBod;

        const opcije = [];

        // ISPRAVLJENO: jeNavrsioGodine + ukupnoOsiguranjeDani (ne efektivniDani)
        {
            const starosniUslov = jeNavrsioGodine(
                korisnik.datumRodjenja, granice.opstaGranica, datum);
            const ispunjeno = starosniUslov && staz.ukupnoOsiguranjeDani >= 15 * 360;
            opcije.push(napraviOpciju(
                'OP-01', 'Redovna starosna penzija', ispunjeno,
                ispunjeno ? osnovniIznos : 0,
                { granica: granice.opstaGranica, potrebanStaz: 15, puneGodine: godine }
            ));
        }

        {
            const ukupnoGodine = staz.ukupnoOsiguranjeDani / 360;
            const ispunjeno = ukupnoGodine >= 45;
            opcije.push(napraviOpciju(
                'OP-02', 'Redovna penzija po osnovu staža (45 god.)', ispunjeno,
                ispunjeno ? osnovniIznos : 0, { ukupnoGodine }
            ));
        }

        // ISPRAVLJENO: jeNavrsioGodine + ukupnoOsiguranjeDani
        {
            const starosniUslov = jeNavrsioGodine(
                korisnik.datumRodjenja, granice.snizenaGranica, datum);
            const ispunjeno = uslovi.uslov23Ispunjen
                && starosniUslov
                && staz.ukupnoOsiguranjeDani >= 15 * 360;
            opcije.push(napraviOpciju(
                'OP-03', 'Redovna sa sniženom granicom (beneficija)', ispunjeno,
                ispunjeno ? osnovniIznos : 0,
                { snizenaGranica: granice.snizenaGranica, puneGodine: godine }
            ));
        }

        {
            const ispunjeno = godine >= 60 && staz.ukupnoOsiguranjeDani >= 40 * 360;
            const penal = ispunjeno
                ? M09.izracunajPenalOdDatuma(korisnik.datumRodjenja, granice.opstaGranica, datum)
                : { procenatUmanjenja: 0, meseciRanije: 0 };
            const iznos = ispunjeno
                ? M09.primeniPenal(osnovniIznos, penal.procenatUmanjenja) : 0;
            opcije.push(napraviOpciju(
                'OP-04', 'Prevremena starosna penzija', ispunjeno, iznos,
                {
                    penal: penal.procenatUmanjenja, meseciRanije: penal.meseciRanije,
                    referentnaGranica: granice.opstaGranica, puneGodine: godine
                }
            ));
        }

        {
            const min60 = godine >= 60;
            const min40staz = staz.ukupnoOsiguranjeDani >= 40 * 360;
            const snizenaGranaVecaOd60 = granice.snizenaGranica > 60;
            const uslov23 = uslovi.uslov23Ispunjen;
            const ispunjeno = uslov23 && min60 && min40staz
                && snizenaGranaVecaOd60 && godine < granice.snizenaGranica;
            const penal = ispunjeno
                ? M09.izracunajPenalOdDatuma(korisnik.datumRodjenja, granice.snizenaGranica, datum)
                : { procenatUmanjenja: 0, meseciRanije: 0 };
            const iznos = ispunjeno
                ? M09.primeniPenal(osnovniIznos, penal.procenatUmanjenja) : 0;
            opcije.push(napraviOpciju(
                'OP-05', 'Prevremena sa beneficijom (Čl. 70g)', ispunjeno, iznos,
                {
                    penal: penal.procenatUmanjenja, meseciRanije: penal.meseciRanije,
                    referentnaGranica: granice.snizenaGranica, puneGodine: godine,
                    napomena: ispunjeno ? null
                        : (granice.snizenaGranica <= 60
                            ? 'Snižena granica je ≤ 60 — redovna penzija je povoljnija'
                            : (godine < 60 ? 'Potrebno je min. 60 godina života' : 'Nedostaje staž'))
                }
            ));
        }

        return {
            lk, lkGreske,
            koefBolovanja: koefBol.koeficijent,
            koefBolovanjaDetalji: koefBol.detalji,
            koefBolovanjaGreske: koefBol.greske || [],
            staz, uslovi, granice,
            godineZivota: godine, puneGodine: godine, godinaPenzionisanja,
            opstiBod, osnovniIznos, opcije
        };
    }

    return { evaluiraj, godineZivota, jeNavrsioGodine };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M10;
}
