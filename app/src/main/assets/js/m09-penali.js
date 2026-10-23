// ============================================================================
// M09 — KALKULATOR PENALA
// Odgovornost: Trajno umanjenje za prevremenu penziju (Čl. 70a–70v, 70g).
// Pravni osnov:
//   - Čl. 70a–70v: 0,34% mesečno, max 20,4%.
//   - Čl. 70g: za beneficirane — referentna granica je SNIŽENA, ne 65.
// ============================================================================

const M09 = (function () {

    const PENAL_MESECNO = 0.34;
    const PENAL_MAX = 20.4;

    // ------------------------------------------------------------------------
    // Pomoćna: broj punih kalendarskih meseci između dva datuma
    // ------------------------------------------------------------------------

    function puniMeseciIzmedju(datumOd, datumDo) {
        if (!datumOd || !datumDo) return 0;
        const od = datumOd instanceof Date ? datumOd : new Date(datumOd);
        const doDat = datumDo instanceof Date ? datumDo : new Date(datumDo);
        if (isNaN(od.getTime()) || isNaN(doDat.getTime())) return 0;

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
        const rodj = datumRodjenja instanceof Date ? datumRodjenja : new Date(datumRodjenja);
        if (isNaN(rodj.getTime())) return null;
        const rezultat = new Date(rodj);
        rezultat.setFullYear(rodj.getFullYear() + godine);
        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Izračunavanje penala od datuma rođenja (precizno — kalendarski meseci)
    // ------------------------------------------------------------------------

    function izracunajPenalOdDatuma(datumRodjenja, referentnaGranica, datumProcene) {
        const rezultat = { meseciRanije: 0, procenatUmanjenja: 0 };

        if (!datumRodjenja || !referentnaGranica) return rezultat;

        const datumGranice = datumRodjendana(datumRodjenja, referentnaGranica);
        if (!datumGranice) return rezultat;

        const procena = datumProcene
            ? (datumProcene instanceof Date ? datumProcene : new Date(datumProcene))
            : new Date();
        if (isNaN(procena.getTime())) return rezultat;

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
        PENAL_MESECNO,
        PENAL_MAX
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M09;
}
