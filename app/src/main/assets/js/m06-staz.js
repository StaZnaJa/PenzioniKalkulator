// ============================================================================
// M06 — KALKULATOR PENZIJSKOG STAŽA
// Odgovornost: Efektivni staž, beneficirani staž, uvećani staž, ukupan staž
//              osiguranja, staž za obračun bodova; simulacija staža za budući
//              datum po stvarnim kalendarskim datumima.
// Pravni osnov:
//   - Član 54 (kvalifikacija beneficije, min. 10 god.) — provera u M07.
//   - Član 60 (poseban staž za decu).
//   - Član 68 (max 45 godina za obračun bodova).
//   - Član 69 (žene +6% na staž za obračun visine penzije).
// Pravila simulacije:
//   - Pretpostavka: osiguranje traje neprekidno od poslednjeg unetog dana
//     staža do ciljnog datuma (bez prekida).
//   - Novi dani se dodaju kao obračunski dani (1 god = 360 dana, 1 mes = 30).
//   - Kalendarski dani se konvertuju u obračunske preko 360/365.25.
//   - Tip beneficije za nove dane:
//       * '1212' → samo efektivni (beneficirani ostaje 0)
//       * '1214'+ → i efektivni i beneficirani sa tim tipom
//   - datumPreseka = poslednji uključeni dan. Novi dani idu u godinu preseka
//     (ako ima mesta do 360), pa u sledeće godine.
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
    // Konverzija kalendarskih dana u obračunske (360-dnevna godina)
    // ------------------------------------------------------------------------

    function kalendarskiDaniUObracunske(kalendarskiDani) {
        if (!kalendarskiDani || kalendarskiDani <= 0) return 0;
        return Math.round(kalendarskiDani * (360 / 365.25));
    }

    // ------------------------------------------------------------------------
    // Pomoćna: poslednji unos sa stažom (najveća godina)
    // ------------------------------------------------------------------------

    function poslednjiUnosSaStazom(staz) {
        if (!staz || !staz.length) return null;
        let poslednji = null;
        staz.forEach(s => {
            if (!poslednji || s.godina > poslednji.godina) {
                poslednji = s;
            }
        });
        return poslednji;
    }

    // ------------------------------------------------------------------------
    // Pomoćna: parsiranje datuma u Date
    // ------------------------------------------------------------------------

    function parsirajDatum(vrednost) {
        if (!vrednost) return null;
        if (vrednost instanceof Date) {
            return isNaN(vrednost.getTime()) ? null : vrednost;
        }
        if (typeof vrednost === 'string') {
            const t = vrednost.trim();
            if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(t)) {
                if (typeof M01 !== 'undefined' && M01.parseDate) {
                    return M01.parseDate(t);
                }
                const d = t.split('.');
                const dt = new Date(parseInt(d[2], 10), parseInt(d[1], 10) - 1, parseInt(d[0], 10));
                return isNaN(dt.getTime()) ? null : dt;
            }
            const dt = new Date(t);
            return isNaN(dt.getTime()) ? null : dt;
        }
        return null;
    }

    // ------------------------------------------------------------------------
    // Dodavanje obračunskih dana na niz staža
    // ------------------------------------------------------------------------
    //   staz                        — originalni niz
    //   brojDana                    — broj obračunskih dana koji se dodaju
    //   datumPreseka                — poslednji uključeni dan (određuje u koju
    //                                 godinu idu novi dani i slobodno mesto)
    //   tipBeneficijeZaBuducnost    — '1212' | '1214' | ... | null (uzmi poslednji)
    // Vraća novi niz staža. Ne dira original.
    // ------------------------------------------------------------------------

    function dodajDaneStaza(staz, brojDana, datumPreseka, tipBeneficijeZaBuducnost) {
        const original = JSON.parse(JSON.stringify(staz || []));

        if (!brojDana || brojDana <= 0) return original;
        if (!original.length) return original;

        // Odredi tip beneficije za budućnost
        let tip = tipBeneficijeZaBuducnost;
        if (!tip) {
            const poslednji = poslednjiUnosSaStazom(original);
            tip = poslednji ? (poslednji.tipBeneficiranja || '1212') : '1212';
        }
        const jeBeneficiran = tip !== '1212';

        // Odredi godinu preseka
        let godinaPreseka;
        if (datumPreseka) {
            const dp = parsirajDatum(datumPreseka);
            if (dp) {
                godinaPreseka = dp.getFullYear();
            }
        }
        if (!godinaPreseka) {
            godinaPreseka = Math.max(...original.map(s => s.godina));
        }

        // Grupisanje po godinama
        const poGodini = {};
        original.forEach(s => {
            poGodini[s.godina] = {
                efektivniMeseci: s.efektivniMeseci || 0,
                efektivniDani: s.efektivniDani || 0,
                beneficiraniMeseci: s.beneficiraniMeseci || 0,
                beneficiraniDani: s.beneficiraniDani || 0,
                tipBeneficiranja: s.tipBeneficiranja || '1212'
            };
        });

        // Koliko je već "potrošeno" u godini preseka?
        const postojeci = poGodini[godinaPreseka] || {
            efektivniMeseci: 0, efektivniDani: 0,
            beneficiraniMeseci: 0, beneficiraniDani: 0,
            tipBeneficiranja: tip
        };
        const vecPotroseno = (postojeci.efektivniMeseci * 30) + postojeci.efektivniDani;
        const slobodnoUPrvojGodini = Math.max(0, 360 - vecPotroseno);

        let preostaloDana = brojDana;
        let tekucaGodina = godinaPreseka;

        // Prvo popuni godinu preseka (ako ima mesta)
        if (slobodnoUPrvojGodini > 0) {
            const dodaj = Math.min(preostaloDana, slobodnoUPrvojGodini);
            if (!poGodini[tekucaGodina]) {
                poGodini[tekucaGodina] = {
                    efektivniMeseci: 0, efektivniDani: 0,
                    beneficiraniMeseci: 0, beneficiraniDani: 0,
                    tipBeneficiranja: tip
                };
            }
            const p = poGodini[tekucaGodina];
            p.efektivniDani += dodaj;
            if (jeBeneficiran) {
                p.beneficiraniDani += dodaj;
                p.tipBeneficiranja = tip;
            }
            preostaloDana -= dodaj;
        }

        // Ostatak po punim godinama
        tekucaGodina++;
        while (preostaloDana > 0) {
            const dodaj = Math.min(preostaloDana, 360);
            if (!poGodini[tekucaGodina]) {
                poGodini[tekucaGodina] = {
                    efektivniMeseci: 0, efektivniDani: 0,
                    beneficiraniMeseci: 0, beneficiraniDani: 0,
                    tipBeneficiranja: tip
                };
            }
            const p = poGodini[tekucaGodina];
            p.efektivniDani += dodaj;
            if (jeBeneficiran) {
                p.beneficiraniDani += dodaj;
                p.tipBeneficiranja = tip;
            }
            preostaloDana -= dodaj;
            tekucaGodina++;
        }

        // Normalizacija meseci/dana
        Object.keys(poGodini).forEach(g => {
            const p = poGodini[g];
            p.efektivniMeseci += Math.floor(p.efektivniDani / 30);
            p.efektivniDani = p.efektivniDani % 30;
            p.beneficiraniMeseci += Math.floor(p.beneficiraniDani / 30);
            p.beneficiraniDani = p.beneficiraniDani % 30;
        });

        return Object.keys(poGodini)
            .map(Number)
            .sort((a, b) => a - b)
            .map(g => ({
                godina: g,
                efektivniMeseci: poGodini[g].efektivniMeseci,
                efektivniDani: poGodini[g].efektivniDani,
                beneficiraniMeseci: poGodini[g].beneficiraniMeseci,
                beneficiraniDani: poGodini[g].beneficiraniDani,
                tipBeneficiranja: poGodini[g].tipBeneficiranja
            }));
    }

    // ------------------------------------------------------------------------
    // Simulacija staža za budući datum
    // ------------------------------------------------------------------------
    //   staz          — originalni niz staža
    //   odDatuma      — datum poslednjeg staža (poslednji uključeni dan)
    //   doDatuma      — ciljni datum
    //   opcije        — { tipBeneficije }
    // Vraća novi niz staža sa dodatim danima.
    // ------------------------------------------------------------------------

    function simulirajStazZaBuduciDatum(staz, odDatuma, doDatuma, opcije) {
        const opts = opcije || {};

        const od = parsirajDatum(odDatuma);
        const doDat = parsirajDatum(doDatuma);

        if (!od || !doDat) return JSON.parse(JSON.stringify(staz || []));
        if (doDat <= od) return JSON.parse(JSON.stringify(staz || []));

        const kalendarskiDani = Math.floor((doDat - od) / (24 * 60 * 60 * 1000));
        if (kalendarskiDani <= 0) return JSON.parse(JSON.stringify(staz || []));

        const obracunskiDani = kalendarskiDaniUObracunske(kalendarskiDani);

        return dodajDaneStaza(
            staz,
            obracunskiDani,
            od,
            opts.tipBeneficije
        );
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

            // Grupisanje po režimu — samo beneficirani dani
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

        // 3. Ukupan staž osiguranja = efektivni + uvećani
        rezultat.ukupnoOsiguranjeDani = rezultat.efektivniDani + rezultat.uvecaniDani;

        // 4. Staž za obračun bodova
        const ukupnoGodine = rezultat.ukupnoOsiguranjeDani / 360;
        const dodatakDece = (pol === 'Ž') ? decaDodatak(brojDece) : 0;
        rezultat.decaDodatakGodine = dodatakDece;

        let stazBodovi;
        if (pol === 'Ž') {
            stazBodovi = ukupnoGodine * 1.06 + dodatakDece;
        } else {
            stazBodovi = ukupnoGodine;
        }
        rezultat.stazZaBodoveGodine = Math.min(stazBodovi, MAX_STAZ_BODOVI);

        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Komfor wrapper: obračun staža na budući datum
    // ------------------------------------------------------------------------
    //   korisnik  — { staz, pol, brojDece, datumPoslednjegStaza }
    //   datum     — ciljni datum
    //   opcije    — { tipBeneficije, priznajeSeBeneficija }
    // Vraća { staz: [...], rezultat: {...} }.
    // ------------------------------------------------------------------------

    function izracunajStazNaDatum(korisnik, datum, opcije) {
        const opts = opcije || {};
        if (!korisnik) {
            return { staz: [], rezultat: izracunajStaz([], 'M', 0, false) };
        }

        const stazSim = simulirajStazZaBuduciDatum(
            korisnik.staz,
            korisnik.datumPoslednjegStaza,
            datum,
            { tipBeneficije: opts.tipBeneficije }
        );

        const rezultat = izracunajStaz(
            stazSim,
            korisnik.pol || 'M',
            korisnik.brojDece || 0,
            opts.priznajeSeBeneficija || false
        );

        return { staz: stazSim, rezultat };
    }

    return {
        izracunajStaz,
        izracunajStazNaDatum,
        koefRezima,
        decaDodatak,
        dodajDaneStaza,
        simulirajStazZaBuduciDatum,
        kalendarskiDaniUObracunske,
        poslednjiUnosSaStazom,
        parseDatum: parsirajDatum,
        MAX_STAZ_BODOVI,
        DECA_STAZ
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M06;
}

if (typeof window !== 'undefined') {
    window.M06 = M06;
}
