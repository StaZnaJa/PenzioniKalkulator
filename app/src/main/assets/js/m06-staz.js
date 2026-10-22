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
// Napomena o simulaciji:
//   - Pretpostavka: osiguranje traje neprekidno od poslednjeg unetog dana
//     staža do ciljnog datuma (bez prekida).
//   - Novi dani se dodaju kao obračunski dani (1 god = 360 dana, 1 mes = 30).
//   - Kalendarski dani se konvertuju u obračunske preko 360/365.25.
//   - Tip beneficije za nove dane je eksplicitan parametar; ako nije zadat,
//     koristi se tip poslednjeg unosa u stažu.
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
    // Jedina tačka gde se vrši konverzija. Koristi se za simulaciju staža.
    // ------------------------------------------------------------------------

    function kalendarskiDaniUObracunske(kalendarskiDani) {
        if (!kalendarskiDani || kalendarskiDani <= 0) return 0;
        return Math.round(kalendarskiDani * (360 / 365.25));
    }

    // ------------------------------------------------------------------------
    // Dodavanje obračunskih dana na niz staža
    // ------------------------------------------------------------------------
    // Čista funkcija — ne dira original. Vraća novi niz.
    //   staz              — originalni niz
    //   brojDana          — broj obračunskih dana koji se dodaju
    //   tipBeneficije     — '1212' | '1214' | ... | null (uzmi poslednji unos)
    //   nastavakBeneficije— da li se novi dani računaju kao beneficirani
    // ------------------------------------------------------------------------

    function dodajDaneStaza(staz, brojDana, tipBeneficije, nastavakBeneficije) {
        const original = JSON.parse(JSON.stringify(staz || []));

        if (!brojDana || brojDana <= 0) return original;
        if (!original.length) return original;

        // Odredi tip beneficije ako nije eksplicitno zadat
        let tip = tipBeneficije;
        if (!tip) {
            const poslednjaGodina = Math.max(...original.map(s => s.godina));
            const poslednjiUnos = original.find(s => s.godina === poslednjaGodina);
            tip = poslednjiUnos ? (poslednjiUnos.tipBeneficiranja || '1212') : '1212';
        }

        // Ako je nastavak beneficije eksplicitno false — tretiraj kao 1212
        let racunajBeneficiju = nastavakBeneficije;
        if (racunajBeneficiju === undefined || racunajBeneficiju === null) {
            racunajBeneficiju = tip !== '1212';
        }
        const efektivniTip = racunajBeneficiju ? tip : '1212';

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

        let preostaloDana = brojDana;
        let tekucaGodina = Math.max(...original.map(s => s.godina));

        while (preostaloDana > 0) {
            if (!poGodini[tekucaGodina]) {
                poGodini[tekucaGodina] = {
                    efektivniMeseci: 0, efektivniDani: 0,
                    beneficiraniMeseci: 0, beneficiraniDani: 0,
                    tipBeneficiranja: efektivniTip
                };
            }
            const p = poGodini[tekucaGodina];

            // Ako je godina već puna (360 dana efektivnog), pređi na sledeću
            const trenutnoDana = (p.efektivniMeseci * 30) + p.efektivniDani;
            if (trenutnoDana >= 360) {
                tekucaGodina++;
                continue;
            }

            const slobodnoDana = 360 - trenutnoDana;
            const dodaj = Math.min(preostaloDana, slobodnoDana);

            p.efektivniDani += dodaj;
            if (racunajBeneficiju) {
                p.beneficiraniDani += dodaj;
                // Tip beneficije za nove dane
                if (p.tipBeneficiranja === '1212') {
                    p.tipBeneficiranja = efektivniTip;
                }
            }
            preostaloDana -= dodaj;

            // Normalizacija meseci/dana
            if (p.efektivniDani >= 30) {
                p.efektivniMeseci += Math.floor(p.efektivniDani / 30);
                p.efektivniDani = p.efektivniDani % 30;
            }
            if (p.beneficiraniDani >= 30) {
                p.beneficiraniMeseci += Math.floor(p.beneficiraniDani / 30);
                p.beneficiraniDani = p.beneficiraniDani % 30;
            }
        }

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
    // Simulacija staža za budući datum (po stvarnim kalendarskim datumima)
    // ------------------------------------------------------------------------
    //   staz          — originalni niz staža
    //   odDatuma      — datum poslednjeg staža (Date ili 'YYYY-MM-DD' ili 'DD.MM.YYYY')
    //   doDatuma      — ciljni datum (Date ili string)
    //   opcije        — { tipBeneficije, nastavakBeneficije }
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
            opts.tipBeneficije,
            opts.nastavakBeneficije
        );
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

    // ------------------------------------------------------------------------
    // Komfor wrapper: obračun staža na budući datum
    // ------------------------------------------------------------------------
    //   korisnik  — { staz, pol, brojDece, datumPoslednjegStaza }
    //   datum     — ciljni datum
    //   opcije    — { tipBeneficije, nastavakBeneficije, priznajeSeBeneficija }
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
            {
                tipBeneficije: opts.tipBeneficije,
                nastavakBeneficije: opts.nastavakBeneficije
            }
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
        parseDatum: parsirajDatum,
        MAX_STAZ_BODOVI,
        DECA_STAZ
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M06;
}
