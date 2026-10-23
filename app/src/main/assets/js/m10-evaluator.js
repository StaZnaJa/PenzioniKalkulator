// ============================================================================
// M10 — EVALUATOR OPCIJA PENZIONISANJA
// Odgovornost: Orkestrator — poziva M05–M09 i vraća sve opcije penzionisanja
//              sa statusima i iznosima; nezavisno pronalazi prvi datum
//              sticanja za svaku opciju.
// Pravni osnov:
//   - Čl. 19: redovna starosna.
//   - Čl. 19b: prevremena starosna (min. 60 godina + 40 staža).
//   - Čl. 20: snižena granica (beneficija).
//   - Čl. 70g: referentna granica za beneficirane (samo za prevremenu,
//              kada je snižena granica > 60).
// Napomena:
//   - Opcije su NEZAVISNE: OP-02 može biti ispunjen pre OP-01; OP-04 pre
//     OP-05; itd. Svaka opcija se proverava pojedinačno.
//   - Ako je OP-03 (redovna sa sniženom) ispunjen, OP-04 i OP-05 se ne
//     prikazuju kao ispunjeni (nema svrhe ići na prevremenu sa penalom).
//   - tipBeneficije u opcije (override) utiče na simulaciju staža do datuma.
//     Ako nije zadat, M06 koristi tip iz poslednjeg unosa.
// ============================================================================

const M10 = (function () {

    // ------------------------------------------------------------------------
    // Pomoćna: kalendarske godine života na datum procene
    // ------------------------------------------------------------------------

    function godineZivota(datumRodjenja, datumProcene) {
        const rodj = M01.parseDate(datumRodjenja);
        if (!rodj) return 0;
        const proc = datumProcene instanceof Date
            ? new Date(datumProcene)
            : new Date(datumProcene);
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
            ispunjeno: !!ispunjeno,
            status: ispunjeno ? '✅ ISPUNJENO' : '⏳ NA ČEKANJU',
            iznos: Math.round(iznos || 0),
            detalji: detalji || {}
        };
    }

    // ------------------------------------------------------------------------
    // Naziv opcije
    // ------------------------------------------------------------------------

    function nazivOpcije(id) {
        switch (id) {
            case 'OP-01': return 'Redovna starosna penzija';
            case 'OP-02': return 'Redovna penzija po osnovu staža (45 god.)';
            case 'OP-03': return 'Redovna sa sniženom granicom (beneficija)';
            case 'OP-04': return 'Prevremena starosna penzija';
            case 'OP-05': return 'Prevremena sa beneficijom (Čl. 70g)';
            default: return id;
        }
    }

    // ------------------------------------------------------------------------
    // Pomoćna: pripremi kontekst (staž, LK, granice) za zadati datum
    // ------------------------------------------------------------------------
    // Vraća sve što je potrebno za proveru bilo koje opcije na tom datumu.
    // ------------------------------------------------------------------------

    function pripremiKontekst(korisnik, datum, opcije) {
        const opts = opcije || {};
        const pol = korisnik.pol || 'M';

        // 1. Pripremi staž do zadatog datuma (simulacija)
        //    datumPoslednjegStaza = poslednji uključeni dan.
        //    Novi dani idu od sledećeg dana.
        let stazNiz = korisnik.staz || [];
        if (korisnik.datumPoslednjegStaza && opts.simulirajDoDatuma !== false) {
            stazNiz = M06.simulirajStazZaBuduciDatum(
                stazNiz,
                korisnik.datumPoslednjegStaza,
                datum,
                { tipBeneficije: opts.tipBeneficije }
            );
        }

        // 2. Provera uslova 2/3 i Čl. 54 na simuliranom stažu
        const uslovi = M07.proveri(stazNiz);

        // 3. Staž (M06) — sa priznatom beneficijom
        const staz = M06.izracunajStaz(
            stazNiz,
            pol,
            korisnik.brojDece || 0,
            uslovi.priznajeSeBeneficija
        );

        // 4. LK (M05) — vraća objekat { lk, greske, ... }
        const koefBol = M05.izracunajKoeficijentBolovanja(korisnik.zarade);
        const efektivniStazGodine = staz.efektivniDani / 360;
        const lkRezultat = M05.izracunajUkupniLK(
            korisnik.zarade,
            efektivniStazGodine,
            koefBol.koeficijent
        );

        // 5. Granice (M08)
        const godinaPenzionisanja = datum instanceof Date
            ? datum.getFullYear()
            : new Date(datum).getFullYear();
        const granice = M08.izracunajGranicu(
            pol,
            godinaPenzionisanja,
            staz.poRezimu,
            uslovi.uslov23Ispunjen
        );

        // 6. Osnovni iznos (bez penala)
        const opstiBod = korisnik.opstiBod || 1674.67;
        const osnovniIznos = lkRezultat.lk * staz.stazZaBodoveGodine * opstiBod;

        return {
            datum,
            godine: godineZivota(korisnik.datumRodjenja, datum),
            godinaPenzionisanja,
            uslovi,
            staz,
            stazNiz,
            koefBol,
            lkRezultat,
            granice,
            opstiBod,
            osnovniIznos,
            tipBeneficije: opts.tipBeneficije || null
        };
    }

    // ------------------------------------------------------------------------
    // Provera JEDNE opcije na JEDAN datum
    // ------------------------------------------------------------------------

    function proveriOpciju(korisnik, opcijaId, datum, kontekst, opcije) {
        const ctx = kontekst || pripremiKontekst(korisnik, datum, opcije);
        const godine = ctx.godine;
        const g = ctx.granice;
        const staz = ctx.staz;
        const uslovi = ctx.uslovi;

        const greske = [];

        // ---- OP-01: Redovna starosna (opšti uslov) ----
        if (opcijaId === 'OP-01') {
            const ispunjeno = godine >= g.opstaGranica
                && staz.efektivniDani >= 15 * 360;
            return {
                ispunjeno,
                iznos: ispunjeno ? ctx.osnovniIznos : 0,
                detalji: {
                    granica: g.opstaGranica,
                    potrebanStaz: 15,
                    puneGodine: godine
                },
                greske
            };
        }

        // ---- OP-02: Redovna po osnovu staža (45 god.) ----
        if (opcijaId === 'OP-02') {
            const ukupnoGodine = staz.ukupnoOsiguranjeDani / 360;
            const ispunjeno = ukupnoGodine >= 45;
            return {
                ispunjeno,
                iznos: ispunjeno ? ctx.osnovniIznos : 0,
                detalji: { ukupnoGodine },
                greske
            };
        }

        // ---- OP-03: Redovna sa sniženom granicom (beneficija) ----
        if (opcijaId === 'OP-03') {
            const ispunjeno = uslovi.uslov23Ispunjen
                && godine >= g.snizenaGranica
                && staz.efektivniDani >= 15 * 360;
            return {
                ispunjeno,
                iznos: ispunjeno ? ctx.osnovniIznos : 0,
                detalji: {
                    snizenaGranica: g.snizenaGranica,
                    puneGodine: godine
                },
                greske
            };
        }

        // ---- OP-04: Prevremena opšta (60 god + 40 staža) ----
        if (opcijaId === 'OP-04') {
            const osnovniUslov = godine >= 60
                && staz.ukupnoOsiguranjeDani >= 40 * 360;

            // Ako je OP-03 ispunjen, OP-04 nije relevantan
            const op03Ispunjen = uslovi.uslov23Ispunjen
                && godine >= g.snizenaGranica
                && staz.efektivniDani >= 15 * 360;

            const ispunjeno = osnovniUslov && !op03Ispunjen;

            let penal = { procenatUmanjenja: 0, meseciRanije: 0, greska: null };
            if (ispunjeno) {
                penal = M09.izracunajPenalOdDatuma(
                    korisnik.datumRodjenja,
                    g.opstaGranica,
                    datum
                );
                if (penal.greska) greske.push('OP-04: ' + penal.greska);
            }

            const iznos = ispunjeno
                ? M09.primeniPenal(ctx.osnovniIznos, penal.procenatUmanjenja)
                : 0;

            let napomena = null;
            if (op03Ispunjen && osnovniUslov) {
                napomena = 'OP-03 (redovna sa sniženom) je povoljnija — bez penala';
            } else if (osnovniUslov && !ispunjeno) {
                napomena = 'Uslovi prevremene ispunjeni, ali redovna je povoljnija';
            }

            return {
                ispunjeno,
                iznos,
                detalji: {
                    penal: penal.procenatUmanjenja,
                    meseciRanije: penal.meseciRanije,
                    referentnaGranica: g.opstaGranica,
                    puneGodine: godine,
                    napomena
                },
                greske
            };
        }

        // ---- OP-05: Prevremena sa beneficijom (Čl. 70g) ----
        if (opcijaId === 'OP-05') {
            const min60 = godine >= 60;
            const min40staz = staz.ukupnoOsiguranjeDani >= 40 * 360;
            const snizenaGranaVecaOd60 = g.snizenaGranica > 60;
            const uslov23 = uslovi.uslov23Ispunjen;

            const ispunjeno = uslov23
                && min60
                && min40staz
                && snizenaGranaVecaOd60
                && godine < g.snizenaGranica;

            let penal = { procenatUmanjenja: 0, meseciRanije: 0, greska: null };
            if (ispunjeno) {
                penal = M09.izracunajPenalOdDatuma(
                    korisnik.datumRodjenja,
                    g.snizenaGranica,
                    datum
                );
                if (penal.greska) greske.push('OP-05: ' + penal.greska);
            }

            const iznos = ispunjeno
                ? M09.primeniPenal(ctx.osnovniIznos, penal.procenatUmanjenja)
                : 0;

            let napomena = null;
            if (!ispunjeno) {
                if (!uslov23) napomena = 'Uslov 2/3 nije ispunjen';
                else if (g.snizenaGranica <= 60) napomena = 'Snižena granica je ≤ 60 — redovna penzija je povoljnija';
                else if (!min60) napomena = 'Potrebno je min. 60 godina života';
                else if (!min40staz) napomena = 'Nedostaje staž (min. 40 godina)';
                else if (godine >= g.snizenaGranica) napomena = 'Snižena granica dostignuta — redovna je povoljnija';
            }

            return {
                ispunjeno,
                iznos,
                detalji: {
                    penal: penal.procenatUmanjenja,
                    meseciRanije: penal.meseciRanije,
                    referentnaGranica: g.snizenaGranica,
                    puneGodine: godine,
                    napomena
                },
                greske
            };
        }

        return {
            ispunjeno: false,
            iznos: 0,
            detalji: {},
            greske: ['Nepoznata opcija: ' + opcijaId]
        };
    }

    // ------------------------------------------------------------------------
    // Glavna evaluacija (sve opcije na jedan datum)
    // ------------------------------------------------------------------------

    function evaluiraj(korisnik, datumProcene, opcije) {
        if (!korisnik) return null;

        const opts = opcije || {};
        const datum = datumProcene instanceof Date
            ? datumProcene
            : (datumProcene ? new Date(datumProcene) : new Date());
        if (isNaN(datum.getTime())) return null;

        const ctx = pripremiKontekst(korisnik, datum, opts);

        const opcijeRez = ['OP-01', 'OP-02', 'OP-03', 'OP-04', 'OP-05'].map(id => {
            const provera = proveriOpciju(korisnik, id, datum, ctx, opts);
            const o = napraviOpciju(id, nazivOpcije(id), provera.ispunjeno, provera.iznos, provera.detalji);
            if (provera.greske && provera.greske.length) {
                o.greske = provera.greske;
            }
            return o;
        });

        return {
            lk: ctx.lkRezultat.lk,
            lkGreske: ctx.lkRezultat.greske || [],
            koefBolovanja: ctx.koefBol.koeficijent,
            koefBolovanjaDetalji: ctx.koefBol.detalji,
            koefBolovanjaGreske: ctx.koefBol.greske || [],
            staz: ctx.staz,
            uslovi: ctx.uslovi,
            granice: ctx.granice,
            godineZivota: ctx.godine,
            puneGodine: ctx.godine,
            godinaPenzionisanja: ctx.godinaPenzionisanja,
            opstiBod: ctx.opstiBod,
            osnovniIznos: ctx.osnovniIznos,
            opcije: opcijeRez,
            tipBeneficije: ctx.tipBeneficije
        };
    }

    // ------------------------------------------------------------------------
    // Nezavisno sticanje po opciji
    // ------------------------------------------------------------------------

    function sticanjePoOpciji(korisnik, opcijaId, datumProcene, opcije) {
        const opts = opcije || {};
        if (!korisnik) return { datum: null, opcija: null, pretraga: null };

        let pocetak;
        if (datumProcene) {
            pocetak = datumProcene instanceof Date ? datumProcene : new Date(datumProcene);
        } else if (korisnik.datumPoslednjegStaza) {
            pocetak = M06.parseDatum(korisnik.datumPoslednjegStaza);
        } else {
            pocetak = new Date();
        }
        if (!pocetak || isNaN(pocetak.getTime())) {
            return { datum: null, opcija: null, pretraga: null };
        }
        pocetak = new Date(pocetak);
        pocetak.setHours(0, 0, 0, 0);

        // Ako je već ispunjeno na početni datum — vrati taj datum
        const ctxPocetak = pripremiKontekst(korisnik, pocetak, opts);
        const proveraPocetak = proveriOpciju(korisnik, opcijaId, pocetak, ctxPocetak, opts);
        if (proveraPocetak.ispunjeno) {
            return {
                datum: pocetak,
                opcija: napraviOpciju(opcijaId, nazivOpcije(opcijaId), true, proveraPocetak.iznos, proveraPocetak.detalji),
                pretraga: { dana: 0, nacin: 'odmah' }
            };
        }

        const maxDana = opts.maxDana || (50 * 366);

        // Brza provera da li je uopšte ispunjivo u maxDana
        const datumMax = dodajDane(pocetak, maxDana);
        const ctxMax = pripremiKontekst(korisnik, datumMax, opts);
        const proveraMax = proveriOpciju(korisnik, opcijaId, datumMax, ctxMax, opts);
        if (!proveraMax.ispunjeno) {
            return {
                datum: null,
                opcija: null,
                pretraga: { dana: maxDana, nacin: 'nije ispunjivo' }
            };
        }

        // Binarna pretraga po danima
        let lo = 0;
        let hi = maxDana;
        let najbolji = null;

        while (lo <= hi) {
            const mid = Math.floor((lo + hi) / 2);
            const dan = dodajDane(pocetak, mid);
            const ctx = pripremiKontekst(korisnik, dan, opts);
            const provera = proveriOpciju(korisnik, opcijaId, dan, ctx, opts);

            if (provera.ispunjeno) {
                najbolji = { dan, provera };
                hi = mid - 1;
            } else {
                lo = mid + 1;
            }
        }

        if (!najbolji) {
            return {
                datum: null,
                opcija: null,
                pretraga: { dana: maxDana, nacin: 'nije pronađeno' }
            };
        }

        return {
            datum: najbolji.dan,
            opcija: napraviOpciju(
                opcijaId,
                nazivOpcije(opcijaId),
                true,
                najbolji.provera.iznos,
                najbolji.provera.detalji
            ),
            pretraga: { dana: maxDana, nacin: 'binarna pretraga' }
        };
    }

    // ------------------------------------------------------------------------
    // Nezavisno sticanje za SVE opcije
    // ------------------------------------------------------------------------

    function sticanjeSvihOpcija(korisnik, datumProcene, opcije) {
        const rezultat = {};
        ['OP-01', 'OP-02', 'OP-03', 'OP-04', 'OP-05'].forEach(id => {
            rezultat[id] = sticanjePoOpciji(korisnik, id, datumProcene, opcije);
        });
        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Pomoćna: dodaj dane na datum
    // ------------------------------------------------------------------------

    function dodajDane(datum, dana) {
        const d = new Date(datum);
        d.setDate(d.getDate() + dana);
        return d;
    }

    return {
        evaluiraj,
        godineZivota,
        pripremiKontekst,
        proveriOpciju,
        sticanjePoOpciji,
        sticanjeSvihOpcija,
        nazivOpcije
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M10;
}

if (typeof window !== 'undefined') {
    window.M10 = M10;
}
