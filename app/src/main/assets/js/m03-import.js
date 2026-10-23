// ============================================================================
// M03 — IMPORT (M4/M8)
// Odgovornost: Parsiranje Excel M4/M8 obrazaca.
// Pravni osnov: Član 54. st. 3 — kumulativno sabiranje beneficiranih perioda.
// Pravila:
//   - M8 zamenjuje M4 za istu godinu (M8 = ispravka, M4 = unos).
//   - Ako nema M8, svi M4 unosi za godinu se sabiraju.
//   - Ako zbir M4 pređe 360 dana (12 meseci) → upozorenje.
//   - Prazne godine (0m 0d) se preskaču u stažu, ali kalendarski se računaju.
//   - datumPoslednjegStaza = poslednji dan poslednje godine SA STAŽOM.
//     Pravilo (B/C): meseci = puni meseci rada, dani = dodatni dani u tekućem
//     mesecu. 5m 12d → 12.06.; 5m 0d → 31.05.; 12m 0d → 31.12.; 0m 5d → 05.01.
// ============================================================================

const M03 = (function () {

    // ------------------------------------------------------------------------
    // Pomoćne funkcije
    // ------------------------------------------------------------------------

    function jeValidnaGodina(g) {
        return g && (
            typeof g === 'number' ||
            (typeof g === 'string' && g.trim() !== '' && !isNaN(parseInt(g)))
        );
    }

    function konvertujGodinu(g) {
        if (typeof g === 'number') {
            if (g < 100) return g <= 50 ? 2000 + g : 1900 + g;
            return g;
        }
        if (typeof g === 'string') {
            const b = parseInt(g);
            if (isNaN(b)) return null;
            if (g.length <= 2) return b <= 50 ? 2000 + b : 1900 + b;
            return b;
        }
        return null;
    }

    // ------------------------------------------------------------------------
    // Parser broja — strogi, baca grešku za dvosmislene formate
    // ------------------------------------------------------------------------

    function parsirajBroj(c, kontekst, opts) {
        const ctx = kontekst || '';
        const options = opts || {};
        if (c === null || c === undefined || c === '') return 0;
        if (typeof c === 'number') {
            if (c < 0 && !options.dozvoliNegativno) {
                const greska = 'Negativna vrednost: "' + c + '"';
                console.warn('[M03] ' + greska + (ctx ? ' (' + ctx + ')' : ''));
                throw new Error(greska);
            }
            return c;
        }
        if (typeof c !== 'string') return 0;

        const original = c;
        let cleaned = c.trim();
        if (cleaned === '') return 0;

        cleaned = cleaned.replace(/[^\d,\.\-]/g, '');

        const brojZapeta = (cleaned.match(/,/g) || []).length;
        const brojTacaka = (cleaned.match(/\./g) || []).length;

        const jeNegativan = cleaned.startsWith('-');
        if (jeNegativan && !options.dozvoliNegativno) {
            const greska = 'Negativna vrednost: "' + original + '"';
            console.warn('[M03] ' + greska + (ctx ? ' (' + ctx + ')' : ''));
            throw new Error(greska);
        }

        if (brojZapeta === 0 && brojTacaka === 0) {
            const v = parseFloat(cleaned);
            return isNaN(v) ? 0 : v;
        }

        if (brojZapeta === 0 && brojTacaka > 0) {
            if (brojTacaka === 1) {
                const v = parseFloat(cleaned);
                return isNaN(v) ? 0 : v;
            }
            const bezTacaka = cleaned.replace(/\./g, '');
            const v = parseFloat(bezTacaka);
            return isNaN(v) ? 0 : v;
        }

        if (brojZapeta > 0 && brojTacaka === 0) {
            if (brojZapeta === 1) {
                const v = parseFloat(cleaned.replace(',', '.'));
                return isNaN(v) ? 0 : v;
            }
            const greska = 'Neispravan format broja: "' + original + '"';
            console.warn('[M03] ' + greska + (ctx ? ' (' + ctx + ')' : ''));
            throw new Error(greska);
        }

        if (brojZapeta > 0 && brojTacaka > 0) {
            const poslednjaZapeta = cleaned.lastIndexOf(',');
            const poslednjaTacka = cleaned.lastIndexOf('.');

            if (poslednjaZapeta > poslednjaTacka) {
                const intPart = cleaned.substring(0, poslednjaZapeta).replace(/\./g, '');
                const decPart = cleaned.substring(poslednjaZapeta + 1);
                const v = parseFloat(intPart + '.' + decPart);
                return isNaN(v) ? 0 : v;
            } else {
                const greska = 'Neispravan format broja (američki): "' + original + '"';
                console.warn('[M03] ' + greska + (ctx ? ' (' + ctx + ')' : ''));
                throw new Error(greska);
            }
        }

        return 0;
    }

    // ------------------------------------------------------------------------
    // Mapiranje šifre beneficije u tip
    // ------------------------------------------------------------------------

    function mapirajTipBeneficijeDetaljno(sifra) {
        const original = sifra;

        if (sifra === null || sifra === undefined) {
            return { tip: '1212', prepoznato: true, original };
        }

        const s = String(sifra).trim().toLowerCase();

        if (s === '' || s === '0') {
            return { tip: '1212', prepoznato: true, original };
        }

        if (s === '1212' || s === '12') return { tip: '1212', prepoznato: true, original };
        if (s === '1214' || s === '14') return { tip: '1214', prepoznato: true, original };
        if (s === '1215' || s === '15') return { tip: '1215', prepoznato: true, original };
        if (s === '1216' || s === '16') return { tip: '1216', prepoznato: true, original };
        if (s === '1218' || s === '18') return { tip: '1218', prepoznato: true, original };

        if (s.includes('1214')) return { tip: '1214', prepoznato: true, original };
        if (s.includes('1215')) return { tip: '1215', prepoznato: true, original };
        if (s.includes('1216')) return { tip: '1216', prepoznato: true, original };
        if (s.includes('1218')) return { tip: '1218', prepoznato: true, original };
        if (s.includes('1212')) return { tip: '1212', prepoznato: true, original };

        return { tip: '1212', prepoznato: false, original };
    }

    function mapirajTipBeneficije(sifra) {
        return mapirajTipBeneficijeDetaljno(sifra).tip;
    }

    // ------------------------------------------------------------------------
    // Pomoćna: poslednji dan meseca
    // ------------------------------------------------------------------------

    function poslednjiDanUMesecu(godina, mesec) {
        // mesec je 1-indeksiran (1-12)
        return new Date(godina, mesec, 0).getDate();
    }

    // ------------------------------------------------------------------------
    // Pomoćna: pretvori (meseci, dani) u tačan datum po pravilu (B/C)
    // ------------------------------------------------------------------------
    //   meseci = puni meseci rada u godini (0-12)
    //   dani   = dodatni dani u tekućem mesecu (0-30)
    // Vraća { godina, mesec, dan } ili null ako je (0, 0).
    // ------------------------------------------------------------------------

    function meseciDaniUDatum(godina, meseci, dani) {
        const m = Math.round(meseci) || 0;
        const d = Math.round(dani) || 0;

        if (m === 0 && d === 0) return null;

        if (d > 0) {
            // meseci punih + dani u (meseci+1). mesecu
            const mesec = m + 1;
            // Ako je m = 12 i d > 0 — to je nemoguće (13. mesec), tretiraj kao 31.12.
            if (mesec > 12) {
                return { godina, mesec: 12, dan: 31 };
            }
            // Ograniči dan na broj dana u mesecu
            const maxDan = poslednjiDanUMesecu(godina, mesec);
            const dan = Math.min(d, maxDan);
            return { godina, mesec, dan };
        }

        // d = 0, m > 0 → poslednji dan m. meseca
        if (m > 12) {
            return { godina, mesec: 12, dan: 31 };
        }
        const dan = poslednjiDanUMesecu(godina, m);
        return { godina, mesec: m, dan };
    }

    // ------------------------------------------------------------------------
    // Pomoćna: format datum u YYYY-MM-DD
    // ------------------------------------------------------------------------

    function formatYYYYMMDD(d) {
        if (!d) return null;
        return d.godina + '-' +
            String(d.mesec).padStart(2, '0') + '-' +
            String(d.dan).padStart(2, '0');
    }

    // ------------------------------------------------------------------------
    // Pomoćna: izračunaj efektivni staž za jednu godinu (M8 zamenjuje M4)
    // ------------------------------------------------------------------------
    // Vraća { meseci, dani, tip, imaM8, imaM4, brojM4, greske[] }
    // ------------------------------------------------------------------------

    function izracunajGodinu(godina, redovi) {
        const rezultat = {
            meseci: 0,
            dani: 0,
            tip: '1212',
            imaM8: false,
            imaM4: false,
            brojM4: 0,
            greske: []
        };

        // Nađi M8 (poslednji po redu, ako ih ima više)
        let m8Red = null;
        redovi.forEach(r => {
            if (r.obrazac === 'M8') m8Red = r;
        });

        if (m8Red) {
            // M8 zamenjuje sve M4 unose
            rezultat.imaM8 = true;
            rezultat.meseci = m8Red.meseci || 0;
            rezultat.dani = m8Red.dani || 0;
            rezultat.tip = m8Red.tip || '1212';
            return rezultat;
        }

        // Nema M8 — saberi sve M4
        let ukupnoMeseci = 0;
        let ukupnoDani = 0;
        let tip = '1212';
        let brojM4 = 0;

        redovi.forEach(r => {
            if (r.obrazac !== 'M4') return;
            brojM4++;
            ukupnoMeseci += r.meseci || 0;
            ukupnoDani += r.dani || 0;
            if (r.tip && r.tip !== '1212') tip = r.tip;
        });

        rezultat.imaM4 = brojM4 > 0;
        rezultat.brojM4 = brojM4;
        rezultat.meseci = ukupnoMeseci;
        rezultat.dani = ukupnoDani;
        rezultat.tip = tip;

        // Provera limita: 12 meseci = 360 dana
        const ukupnoDana = ukupnoMeseci * 30 + ukupnoDani;
        if (ukupnoDana > 360) {
            rezultat.greske.push(
                'Godina ' + godina + ': zbir M4 unosa prelazi 360 dana (' +
                ukupnoDana + ' dana) — moguća greška u Excel-u'
            );
        }

        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Predlaganje datuma poslednjeg staža
    // ------------------------------------------------------------------------
    // Vraća 'YYYY-MM-DD' ili null.
    // Poslednji dan poslednje godine SA STAŽOM (ne poslednje godine u Excel-u).
    // ------------------------------------------------------------------------

    function predloziDatumPoslednjegStaza(rawData) {
        if (!rawData || !rawData.length) return null;

        // Nađi header red
        let start = -1;
        for (let i = 0; i < rawData.length; i++) {
            if (rawData[i] && rawData[i][0] === 'Godina') {
                start = i + 1;
                break;
            }
        }
        if (start === -1) return null;

        // Grupisanje redova po godini
        const poGodini = {};
        let poslednjaGodina = null;

        for (let i = start; i < rawData.length; i++) {
            const red = rawData[i];
            if (!red || red.length < 11) continue;
            const godCell = red[0], obrazac = red[1];
            if (!obrazac || (obrazac !== 'M4' && obrazac !== 'M8')) continue;

            let god = null;
            if (jeValidnaGodina(godCell)) {
                god = konvertujGodinu(godCell);
                poslednjaGodina = god;
            } else if (poslednjaGodina) {
                god = poslednjaGodina;
            } else {
                continue;
            }
            if (!god) continue;

            if (!poGodini[god]) poGodini[god] = [];

            poGodini[god].push({
                obrazac: obrazac,
                meseci: parseFloat(red[4]) || 0,
                dani: parseFloat(red[5]) || 0,
                tip: mapirajTipBeneficije(red[14])
            });
        }

        // Nađi poslednju godinu SA STAŽOM (meseci > 0 ili dani > 0)
        const godineSaStazom = Object.keys(poGodini)
            .map(Number)
            .filter(g => {
                const r = izracunajGodinu(g, poGodini[g]);
                return (r.meseci > 0 || r.dani > 0);
            })
            .sort((a, b) => a - b);

        if (!godineSaStazom.length) return null;

        const poslednjaSaStazom = godineSaStazom[godineSaStazom.length - 1];
        const r = izracunajGodinu(poslednjaSaStazom, poGodini[poslednjaSaStazom]);

        const datum = meseciDaniUDatum(poslednjaSaStazom, r.meseci, r.dani);
        return formatYYYYMMDD(datum);
    }

    // ------------------------------------------------------------------------
    // Čitanje Excel fajla
    // ------------------------------------------------------------------------

    function parsirajM4M8(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('Nije izabran fajl'));
            if (typeof XLSX === 'undefined') {
                return reject(new Error('XLSX biblioteka nije učitana'));
            }

            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    resolve(raw);
                } catch (err) {
                    reject(new Error('Greška pri parsiranju Excel-a: ' + err.message));
                }
            };
            reader.onerror = function () {
                reject(new Error('Greška pri čitanju fajla'));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // ------------------------------------------------------------------------
    // Obrada sirovih redova → Zarade[] i Staž[]
    // ------------------------------------------------------------------------

    function obradiPodatke(rawData, opcije) {
        const opts = opcije || {};
        const granicaGodina = opts.granicaGodina;
        const prosecnePlate = opts.prosecnePlate || {};

        const zarade = [];
        const staz = [];
        const greske = [];
        const upozorenja = [];

        if (!rawData || !rawData.length) {
            greske.push('Nema podataka za obradu');
            return { zarade, staz, greske, upozorenja };
        }
        if (!granicaGodina) {
            greske.push('Nije postavljena granična godina (Datum poslednjeg staža)');
            return { zarade, staz, greske, upozorenja };
        }

        let start = -1;
        for (let i = 0; i < rawData.length; i++) {
            if (rawData[i] && rawData[i][0] === 'Godina') {
                start = i + 1;
                break;
            }
        }
        if (start === -1) {
            greske.push('Nije pronađen header red (Godina, Obrazac)');
            return { zarade, staz, greske, upozorenja };
        }

        // Grupisanje redova po godini
        const poGodini = {};
        let poslednjaGodina = null;

        for (let i = start; i < rawData.length; i++) {
            const red = rawData[i];
            if (!red || red.length < 11) continue;
            const godCell = red[0], obrazac = red[1];
            if (!obrazac || (obrazac !== 'M4' && obrazac !== 'M8')) continue;

            let god = null;
            if (jeValidnaGodina(godCell)) {
                god = konvertujGodinu(godCell);
                poslednjaGodina = god;
            } else if (poslednjaGodina) {
                god = poslednjaGodina;
            } else {
                greske.push('Red ' + (i + 1) + ': nevalidna godina i nema prethodne');
                continue;
            }
            if (god > granicaGodina) continue;

            if (!poGodini[god]) poGodini[god] = [];

            // Parser sa kontekstom — ako pukne, prijavljujemo grešku
            let hVred = 0, kVred = 0;
            try {
                hVred = parsirajBroj(red[7], 'red ' + (i + 1) + ', kolona H (zarada)');
                kVred = parsirajBroj(red[10], 'red ' + (i + 1) + ', kolona K (naknade)');
            } catch (err) {
                greske.push(err.message);
                continue;
            }

            const sifraRaw = red[14];
            const mapa = mapirajTipBeneficijeDetaljno(sifraRaw);

            const benMeseci = parseFloat(red[12]) || 0;
            const benDani = parseFloat(red[13]) || 0;

            if (!mapa.prepoznato && (benMeseci > 0 || benDani > 0 || (mapa.original && mapa.original !== ''))) {
                upozorenja.push(
                    'Red ' + (i + 1) + ': nepoznata šifra beneficije "' +
                    String(mapa.original) + '" — svodi se na 1212 (bez beneficije)'
                );
            }

            poGodini[god].push({
                obrazac: obrazac,
                meseci: parseFloat(red[4]) || 0,
                dani: parseFloat(red[5]) || 0,
                benMeseci: benMeseci,
                benDani: benDani,
                tip: mapa.tip,
                hVred: hVred,
                kVred: kVred,
                satiRada: parseInt(red[6]) || 0,
                satiBol: parseInt(red[9]) || 0
            });
        }

        // Obrada po godinama
        Object.keys(poGodini).map(Number).sort((a, b) => a - b).forEach(god => {
            const redovi = poGodini[god];

            // Nađi M8 (ako postoji — zamenjuje sve M4 za zaradu i staž)
            let m8Red = null;
            redovi.forEach(r => {
                if (r.obrazac === 'M8') m8Red = r;
            });

            // --- Zarada ---
            let ukupnaZarada = 0;
            let satiRada = 0;
            let satiBol = 0;
            let satiRadaM8 = 0;
            let satiBolM8 = 0;

            if (m8Red) {
                ukupnaZarada = (m8Red.hVred || 0) + (m8Red.kVred || 0);
                satiRadaM8 = m8Red.satiRada || 0;
                satiBolM8 = m8Red.satiBol || 0;
                satiRada = satiRadaM8;
                satiBol = satiBolM8;
            } else {
                redovi.forEach(r => {
                    if (r.obrazac !== 'M4') return;
                    ukupnaZarada += (r.hVred || 0) + (r.kVred || 0);
                    satiRada += r.satiRada || 0;
                    satiBol += r.satiBol || 0;
                });
            }

            const prosecna = prosecnePlate[god] || 0;

            if ((ukupnaZarada > 0 || satiRada > 0) && prosecna === 0) {
                greske.push(
                    'Nedostaje prosečna plata za ' + god +
                    ' godinu — GLK ne može biti pouzdano izračunat'
                );
            }

            if (ukupnaZarada > 0 || satiRada > 0) {
                zarade.push({
                    godina: god,
                    licnaZarada: ukupnaZarada,
                    prosecnaPlata: prosecna,
                    satiRada: satiRada || 0,
                    satiBolovanje: satiBol || 0
                });
            }

            // --- Staž ---
            const stazGod = izracunajGodinu(god, redovi);

            // Prenesi greške iz izracunajGodinu
            stazGod.greske.forEach(g => upozorenja.push(g));

            // Beneficirani staž — M8 zamenjuje M4
            let benMeseci = 0;
            let benDani = 0;
            let tipZaStaz = stazGod.tip;

            if (m8Red) {
                benMeseci = m8Red.benMeseci || 0;
                benDani = m8Red.benDani || 0;
                if (m8Red.tip && m8Red.tip !== '1212') tipZaStaz = m8Red.tip;
            } else {
                redovi.forEach(r => {
                    if (r.obrazac !== 'M4') return;
                    benMeseci += r.benMeseci || 0;
                    benDani += r.benDani || 0;
                });
                if (benMeseci > 0 || benDani > 0) {
                    // Tip je već određen u izracunajGodinu (prvi ne-1212)
                    tipZaStaz = stazGod.tip;
                }
            }

            if (stazGod.meseci > 0 || stazGod.dani > 0 || benMeseci > 0 || benDani > 0) {
                staz.push({
                    godina: god,
                    efektivniMeseci: stazGod.meseci || 0,
                    efektivniDani: stazGod.dani || 0,
                    beneficiraniMeseci: benMeseci || 0,
                    beneficiraniDani: benDani || 0,
                    tipBeneficiranja: tipZaStaz
                });
            }
        });

        zarade.sort((a, b) => a.godina - b.godina);
        staz.sort((a, b) => a.godina - b.godina);

        return { zarade, staz, greske, upozorenja };
    }

    return {
        parsirajM4M8,
        obradiPodatke,
        predloziDatumPoslednjegStaza,
        jeValidnaGodina,
        konvertujGodinu,
        parsirajBroj,
        mapirajTipBeneficije,
        mapirajTipBeneficijeDetaljno,
        meseciDaniUDatum,
        poslednjiDanUMesecu
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M03;
}

if (typeof window !== 'undefined') {
    window.M03 = M03;
}
