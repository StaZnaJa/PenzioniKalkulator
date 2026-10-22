// ============================================================================
// M09 — KALKULATOR PENALA
// Odgovornost: Trajno umanjenje za prevremenu penziju (Čl. 70a–70v, 70g).
// Pravni osnov:
//   - Čl. 70a–70v: 0,34% mesečno, max 20,4%.
//   - Čl. 70g: za beneficirane — referentna granica je SNIŽENA, ne 65.
// Napomena:
//   - Datum rođenja može biti Date ili string u formatu DD.MM.YYYY.
//   - Ako datum ne može da se parsira, vraća se eksplicitna greška
//     umesto tihog 0 (sprečava bag u obračunu penala).
// ============================================================================

const M09 = (function () {

    const PENAL_MESECNO = 0.34;
    const PENAL_MAX = 20.4;

    // ------------------------------------------------------------------------
    // Pomoćna: parsiranje datuma (Date | 'DD.MM.YYYY' | ISO string) → Date | null
    // ------------------------------------------------------------------------

    function parseDatum(vrednost) {
        if (!vrednost) return null;

        // Već je Date
        if (vrednost instanceof Date) {
            return isNaN(vrednost.getTime()) ? null : vrednost;
        }

        if (typeof vrednost !== 'string') return null;

        const trimmed = vrednost.trim();
        if (trimmed === '') return null;

        // Format DD.MM.YYYY (srpski) — koristi M01 ako je dostupan
        if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
            if (typeof M01 !== 'undefined' && M01.parseDate) {
                return M01.parseDate(trimmed);
            }
            // Fallback ako M01 nije dostupan
            const delovi = trimmed.split('.');
            const d = parseInt(delovi[0], 10);
            const m = parseInt(delovi[1], 10) - 1;
            const y = parseInt(delovi[2], 10);
            if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
            const dt = new Date(y, m, d);
            return isNaN(dt.getTime()) ? null : dt;
        }

        // ISO ili neki drugi format koji Date ume da parsira
        const dt = new Date(trimmed);
        return isNaN(dt.getTime()) ? null : dt;
    }

    // ------------------------------------------------------------------------
    // Pomoćna: broj punih kalendarskih meseci između dva datuma
    // ------------------------------------------------------------------------

    function puniMeseciIzmedju(datumOd, datumDo) {
        const od = parseDatum(datumOd);
        const doDat = parseDatum(datumDo);
        if (!od || !doDat) return 0;

        let meseci = (doDat.getFullYear() - od.getFullYear()) * 12
                   + (doDat.getMonth() - od.getMonth());

        if (doDat.getDate() < od.getDate()) {
            meseci--;
        }
        return Math.max(0, meseci);
    }

    // ------------------------------------------------------------------------
    // Pomoćna: datum kada osoba navršava određene godine
    // ------------------------------------------------------------------------

    function datumRodjendana(datumRodjenja, godine) {
        const rodj = parseDatum(datumRodjenja);
        if (!rodj) return null;

        const rezultat = new Date(rodj);
        rezultat.setFullYear(rodj.getFullYear() + godine);
        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Izračunavanje penala od datuma rođenja (precizno — kalendarski meseci)
    // ------------------------------------------------------------------------

    function izracunajPenalOdDatuma(datumRodjenja, referentnaGranica, datumProcene) {
        const rezultat = {
            meseciRanije: 0,
            procenatUmanjenja: 0,
            greska: null
        };

        if (!datumRodjenja) {
            rezultat.greska = 'Datum rođenja nije unet';
            return rezultat;
        }
        if (!referentnaGranica && referentnaGranica !== 0) {
            rezultat.greska = 'Referentna granica nije definisana';
            return rezultat;
        }

        const datumGranice = datumRodjendana(datumRodjenja, referentnaGranica);
        if (!datumGranice) {
            rezultat.greska = 'Datum rođenja nije validan (očekivan DD.MM.YYYY)';
            return rezultat;
        }

        const procena = datumProcene
            ? parseDatum(datumProcene)
            : new Date();
        if (!procena) {
            rezultat.greska = 'Datum procene nije validan';
            return rezultat;
        }

        if (procena >= datumGranice) return rezultat;

        const meseci = puniMeseciIzmedju(procena, datumGranice);
        rezultat.meseciRanije = meseci;
        rezultat.procenatUmanjenja = Math.min(meseci * PENAL_MESECNO, PENAL_MAX);

        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Stara funkcija (zadržana za kompatibilnost)
    // ------------------------------------------------------------------------

    function izracunajPenal(godineZivota, referentnaGranica) {
        const rezultat = { meseciRanije: 0, procenatUmanjenja: 0 };

        if (!referentnaGranica || godineZivota === undefined) return rezultat;

        const razlika = referentnaGranica - godineZivota;
        if (razlika <= 0) return rezultat;

        rezultat.meseciRanije = Math.round(razlika * 12);
        rezultat.procenatUmanjenja = Math.min(
            rezultat.meseciRanije * PENAL_MESECNO,
            PENAL_MAX
        );

        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Primena penala na iznos
    // ------------------------------------------------------------------------

    function primeniPenal(iznos, procenatUmanjenja) {
        if (!iznos || iznos <= 0) return 0;
        if (!procenatUmanjenja || procenatUmanjenja <= 0) return iznos;
        return iznos * (1 - procenatUmanjenja / 100);
    }

    return {
        izracunajPenal,
        izracunajPenalOdDatuma,
        primeniPenal,
        puniMeseciIzmedju,
        datumRodjendana,
        parseDatum,
        PENAL_MESECNO,
        PENAL_MAX
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M09;
}
