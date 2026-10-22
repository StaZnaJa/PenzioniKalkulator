// ============================================================================
// M03 — IMPORT (M4/M8)
// Odgovornost: Parsiranje Excel M4/M8 obrazaca.
// Pravni osnov: Član 54. st. 3 — kumulativno sabiranje beneficiranih perioda.
// Napomena:
//   - Nepoznate šifre beneficije se prijavljuju u greske[] (ne tiho svode).
//   - Negativne zarade se prijavljuju kao greška (skoro sigurno greška u unosu).
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
    // Prihvata:
    //   "1234"          → 1234
    //   "1234.56"       → 1234.56
    //   "1.234,56"      → 1234.56 (srpski format)
    //   "1234,56"       → 1234.56
    //   broj            → broj
    // Odbija:
    //   "1401,414,90"   → greška (više zapeta)
    //   "1,234,567.89"  → greška (američki format sa više zapeta)
    //   ""              → 0
    //   null/undefined  → 0
    //   negativan broj  → greška (osim ako je opts.dozvoliNegativno)
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

        // Uklonimo sve osim cifara, tačke, zapete i minusa
        cleaned = cleaned.replace(/[^\d,\.\-]/g, '');

        // Provera: koliko ima zapeta i tačaka?
        const brojZapeta = (cleaned.match(/,/g) || []).length;
        const brojTacaka = (cleaned.match(/\./g) || []).length;

        // Provera negativnog
        const jeNegativan = cleaned.startsWith('-');
        if (jeNegativan && !options.dozvoliNegativno) {
            const greska = 'Negativna vrednost: "' + original + '"';
            console.warn('[M03] ' + greska + (ctx ? ' (' + ctx + ')' : ''));
            throw new Error(greska);
        }

        // SLUČAJ 1: Nema ni zapeta ni tačaka → ceo broj
        if (brojZapeta === 0 && brojTacaka === 0) {
            const v = parseFloat(cleaned);
            return isNaN(v) ? 0 : v;
        }

        // SLUČAJ 2: Samo tačke
        if (brojZapeta === 0 && brojTacaka > 0) {
            // Može biti "1234.56" (decimala) ili "1.234.567" (hiljade)
            if (brojTacaka === 1) {
                const v = parseFloat(cleaned);
                return isNaN(v) ? 0 : v;
            }
            // Više tačaka — pretpostavljamo hiljade: "1.234.567"
            const bezTacaka = cleaned.replace(/\./g, '');
            const v = parseFloat(bezTacaka);
            return isNaN(v) ? 0 : v;
        }

        // SLUČAJ 3: Samo zapete
        if (brojZapeta > 0 && brojTacaka === 0) {
            if (brojZapeta === 1) {
                // "1234,56" — srpski decimalni zapis
                const v = parseFloat(cleaned.replace(',', '.'));
                return isNaN(v) ? 0 : v;
            }
            // Više zapeta — dvosmisleno!
            const greska = 'Neispravan format broja: "' + original + '"';
            console.warn('[M03] ' + greska + (ctx ? ' (' + ctx + ')' : ''));
            throw new Error(greska);
        }

        // SLUČAJ 4: I zapete i tačke
        if (brojZapeta > 0 && brojTacaka > 0) {
            const poslednjaZapeta = cleaned.lastIndexOf(',');
            const poslednjaTacka = cleaned.lastIndexOf('.');

            if (poslednjaZapeta > poslednjaTacka) {
                // "1.234.567,89" — tačke su hiljade, zapeta je decimalna
                const intPart = cleaned.substring(0, poslednjaZapeta).replace(/\./g, '');
                const decPart = cleaned.substring(poslednjaZapeta + 1);
                const v = parseFloat(intPart + '.' + decPart);
                return isNaN(v) ? 0 : v;
            } else {
                // "1,234,567.89" — američki format
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
    // Vraća { tip, prepoznato, original }.
    //   prepoznato = false → šifra nije poznata; tip je '1212' (default)
    //   prepoznato = true  → šifra je poznata (uključujući prazno/0/1212)
    // ------------------------------------------------------------------------

    function mapirajTipBeneficijeDetaljno(sifra) {
        const original = sifra;

        if (sifra === null || sifra === undefined) {
            return { tip: '1212', prepoznato: true, original };
        }

        const s = String(sifra).trim().toLowerCase();

        // Prazno ili 0 → nema beneficije
        if (s === '' || s === '0') {
            return { tip: '1212', prepoznato: true, original };
        }

        // Eksplicitne šifre
        if (s === '1212' || s === '12') return { tip: '1212', prepoznato: true, original };
        if (s === '1214' || s === '14') return { tip: '1214', prepoznato: true, original };
        if (s === '1215' || s === '15') return { tip: '1215', prepoznato: true, original };
        if (s === '1216' || s === '16') return { tip: '1216', prepoznato: true, original };
        if (s === '1218' || s === '18') return { tip: '1218', prepoznato: true, original };

        // Sadrži poznatu šifru (npr. "1214 - ...")
        if (s.includes('1214')) return { tip: '1214', prepoznato: true, original };
        if (s.includes('1215')) return { tip: '1215', prepoznato: true, original };
        if (s.includes('1216')) return { tip: '1216', prepoznato: true, original };
        if (s.includes('1218')) return { tip: '1218', prepoznato: true, original };
        if (s.includes('1212')) return { tip: '1212', prepoznato: true, original };

        // Nepoznata šifra
        return { tip: '1212', prepoznato: false, original };
    }

    // Stara funkcija — vraća samo tip (kompatibilnost)
    function mapirajTipBeneficije(sifra) {
        return mapirajTipBeneficijeDetaljno(sifra).tip;
    }

    // ------------------------------------------------------------------------
    // Predlaganje datuma poslednjeg staža
    // ------------------------------------------------------------------------

    function predloziDatumPoslednjegStaza(rawData) {
        if (!rawData || !rawData.length) return null;

        let start = -1;
        for (let i = 0; i < rawData.length; i++) {
            if (rawData[i] && rawData[i][0] === 'Godina') {
                start = i + 1;
                break;
            }
        }
        if (start === -1) return null;

        const tempPoGodini = {};
        for (let i = start; i < rawData.length; i++) {
            const red = rawData[i];
            if (!red || red.length < 11) continue;
            const godCell = red[0], obrazac = red[1];
            if (!obrazac || (obrazac !== 'M4' && obrazac !== 'M8')) continue;
            const god = konvertujGodinu(godCell);
            if (!god) continue;

            const meseciStaz = parseFloat(red[4]) || 0;
            const daniStaz = parseFloat(red[5]) || 0;

            if (!tempPoGodini[god]) tempPoGodini[god] = { meseci: 0, dani: 0 };

            if (obrazac === 'M4') {
                tempPoGodini[god].meseci += meseciStaz;
                tempPoGodini[god].dani += daniStaz;
            } else if (obrazac === 'M8') {
                tempPoGodini[god].meseci = meseciStaz;
                tempPoGodini[god].dani = daniStaz;
            }
        }

        const godine = Object.keys(tempPoGodini).map(Number).sort((a, b) => a - b);
        if (!godine.length) return null;

        const poslednjaGodina = godine[godine.length - 1];
        const podaci = tempPoGodini[poslednjaGodina];

        let mesec = Math.round(podaci.meseci) || 12;
        let dan = Math.round(podaci.dani) || 31;

        // Ako su meseci 0 ali ima dana — ostavi mesece na 12 i dan na broj dana
        if (mesec === 0) { mesec = 12; dan = dan || 31; }
        // Ako dan prelazi broj dana u mesecu — skrati na poslednji dan meseca
        if (dan === 0) {
            if (mesec === 2) dan = 28;
            else if ([4, 6, 9, 11].includes(mesec)) dan = 30;
            else dan = 31;
        } else {
            const maxDan = danUMesecu(mesec, poslednjaGodina);
            if (dan > maxDan) dan = maxDan;
        }

        return poslednjaGodina + '-' +
               String(mesec).padStart(2, '0') + '-' +
               String(dan).padStart(2, '0');
    }

    function danUMesecu(mesec, godina) {
        if (mesec === 2) {
            // Provera prestupne godine
            return (godina % 4 === 0 && (godina % 100 !== 0 || godina % 400 === 0)) ? 29 : 28;
        }
        if ([4, 6, 9, 11].includes(mesec)) return 30;
        return 31;
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

        const rezPoGodini = {};
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

            if (!rezPoGodini[god]) {
                rezPoGodini[god] = {
                    m4Zarada: { h: 0, k: 0 },
                    m8Zarada: { h: 0, k: 0 },
                    satiRada: 0,
                    satiBolovanje: 0,
                    staz: { meseci: 0, dani: 0, beneficiraniMeseci: 0, beneficiraniDani: 0, tipBeneficiranja: '1212' }
                };
            }
            const p = rezPoGodini[god];

            const satiRada = parseInt(red[6]) || 0;
            const satiBol = parseInt(red[9]) || 0;
            const meseciStaz = parseFloat(red[4]) || 0;
            const daniStaz = parseFloat(red[5]) || 0;
            const benMeseci = parseFloat(red[12]) || 0;
            const benDani = parseFloat(red[13]) || 0;

            // Parser sa kontekstom — ako pukne, prijavljujemo grešku
            let hVred = 0, kVred = 0;
            try {
                hVred = parsirajBroj(red[7], 'red ' + (i + 1) + ', kolona H (zarada)');
                kVred = parsirajBroj(red[10], 'red ' + (i + 1) + ', kolona K (naknade)');
            } catch (err) {
                greske.push(err.message);
                continue; // preskačemo ovaj red
            }

            // Šifra beneficije — kolona O (indeks 14)
            const sifraRaw = red[14];
            const mapa = mapirajTipBeneficijeDetaljno(sifraRaw);
            const tipBeneficije = mapa.tip;

            // Ako šifra nije prepoznata — upozorenje (ne greška)
            if (!mapa.prepoznato && (benMeseci > 0 || benDani > 0 || mapa.original !== null && mapa.original !== undefined && mapa.original !== '')) {
                upozorenja.push(
                    'Red ' + (i + 1) + ': nepoznata šifra beneficije "' +
                    String(mapa.original) + '" — svodi se na 1212 (bez beneficije)'
                );
            }

            if (obrazac === 'M4') {
                p.m4Zarada.h += hVred;
                p.m4Zarada.k += kVred;
                p.satiRada += satiRada;
                p.satiBolovanje += satiBol;
                p.staz.meseci += meseciStaz;
                p.staz.dani += daniStaz;
                p.staz.beneficiraniMeseci += benMeseci;
                p.staz.beneficiraniDani += benDani;

                if (benMeseci > 0 || benDani > 0) {
                    if (p.staz.tipBeneficiranja === '1212' || tipBeneficije !== '1212') {
                        p.staz.tipBeneficiranja = tipBeneficije;
                    }
                }
            } else if (obrazac === 'M8') {
                p.m8Zarada.h = hVred;
                p.m8Zarada.k = kVred;
                p.satiRada = satiRada;
                p.satiBolovanje = satiBol;
                p.m8Staz = {
                    meseci: meseciStaz,
                    dani: daniStaz,
                    beneficiraniMeseci: benMeseci,
                    beneficiraniDani: benDani,
                    tipBeneficiranja: tipBeneficije
                };
            }
        }

        Object.keys(rezPoGodini).forEach(godStr => {
            const god = parseInt(godStr);
            const p = rezPoGodini[god];

            let ukupnaZarada = p.m4Zarada.h + p.m4Zarada.k;
            if (p.m8Zarada.h || p.m8Zarada.k) {
                ukupnaZarada = p.m8Zarada.h + p.m8Zarada.k;
            }
            const prosecna = prosecnePlate[god] || 0;

            // Ako nema prosečne plate — prijavljujemo grešku, ne tretiramo kao nulu
            if ((ukupnaZarada > 0 || p.satiRada > 0) && prosecna === 0) {
                greske.push(
                    'Nedostaje prosečna plata za ' + god +
                    ' godinu — GLK ne može biti pouzdano izračunat'
                );
            }

            if (ukupnaZarada > 0 || p.satiRada > 0) {
                zarade.push({
                    godina: god,
                    licnaZarada: ukupnaZarada,
                    prosecnaPlata: prosecna,
                    satiRada: p.satiRada || 0,
                    satiBolovanje: p.satiBolovanje || 0
                });
            }

            let efektivniMeseci = p.staz.meseci;
            let efektivniDani = p.staz.dani;
            let benMeseci = p.staz.beneficiraniMeseci;
            let benDani = p.staz.beneficiraniDani;
            let tip = p.staz.tipBeneficiranja || '1212';

            if (p.m8Staz) {
                efektivniMeseci = p.m8Staz.meseci;
                efektivniDani = p.m8Staz.dani;
                benMeseci = p.m8Staz.beneficiraniMeseci;
                benDani = p.m8Staz.beneficiraniDani;
                tip = p.m8Staz.tipBeneficiranja || tip;
            }

            if (efektivniMeseci || efektivniDani || benMeseci || benDani) {
                staz.push({
                    godina: god,
                    efektivniMeseci: efektivniMeseci || 0,
                    efektivniDani: efektivniDani || 0,
                    beneficiraniMeseci: benMeseci || 0,
                    beneficiraniDani: benDani || 0,
                    tipBeneficiranja: tip
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
        danUMesecu
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M03;
}
