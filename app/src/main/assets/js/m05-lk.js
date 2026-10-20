// ============================================================================
// M05 — KALKULATOR LIČNOG KOEFICIJENTA (LK)
// Odgovornost: GLK (max 5,0), ukupni LK (max 3,8), koeficijent bolovanja.
// Pravni osnov: Čl. 63 (GLK max 5,0), Čl. 78 (LK max 3,8), Čl. 65 (bolovanje).
// ============================================================================

const M05 = (function () {

    const GLK_MAX = 5.0;
    const LK_MAX = 3.8;
    const GRANICA_BOLOVANJE = 2002;

    // ------------------------------------------------------------------------
    // Godišnji lični koeficijent (GLK)
    // Bez donje granice 0,18 — zakon je ne propisuje.
    // Ako nema prosečne plate — vraća null (greška), ne 0.
    // ------------------------------------------------------------------------

    function izracunajGLK(zarada, prosecnaPlata) {
        if (!prosecnaPlata || prosecnaPlata <= 0) {
            // Nema prosečne plate — ne možemo izračunati GLK
            return null;
        }
        if (!zarada || zarada <= 0) return 0;
        return Math.min(zarada / prosecnaPlata, GLK_MAX);
    }

    // ------------------------------------------------------------------------
    // Ukupni lični koeficijent (LK)
    // LK = (Σ GLK + koefBolovanja) / efektivniStazGodine, max 3,8
    // ------------------------------------------------------------------------

    function izracunajUkupniLK(zarade, efektivniStazGodine, koefBolovanja) {
        const rezultat = {
            lk: 0,
            greske: [],
            brojGodinaSaPodacima: 0,
            sumaGLK: 0
        };

        if (!efektivniStazGodine || efektivniStazGodine <= 0) {
            rezultat.greske.push('Nema efektivnog staža — LK se ne može izračunati');
            return rezultat;
        }
        if (!zarade || !zarade.length) {
            rezultat.greske.push('Nema podataka o zaradama');
            return rezultat;
        }

        let suma = 0;
        let broj = 0;
        zarade.forEach(z => {
            const glk = izracunajGLK(z.licnaZarada, z.prosecnaPlata);
            if (glk === null) {
                rezultat.greske.push(
                    'Nedostaje prosečna plata za ' + z.godina +
                    ' — GLK ne može biti izračunat'
                );
                return;
            }
            suma += glk;
            broj++;
        });

        rezultat.sumaGLK = suma;
        rezultat.brojGodinaSaPodacima = broj;

        if (koefBolovanja && koefBolovanja > 0) suma += koefBolovanja;

        rezultat.lk = Math.min(suma / efektivniStazGodine, LK_MAX);
        return rezultat;
    }

    // ------------------------------------------------------------------------
    // Koeficijent bolovanja (period ≤ 2002)
    // Formula: (Σ satiBol / Σ satiRada) × Σ GLK
    // Uzimaju se samo godine sa satiRada > 0.
    // ------------------------------------------------------------------------

    function izracunajKoeficijentBolovanja(zarade) {
        const rezultat = {
            koeficijent: 0,
            detalji: [],
            greske: []
        };

        if (!zarade || !zarade.length) return rezultat;

        let zbirSatiRada = 0;
        let zbirSatiBol = 0;
        let zbirLK = 0;

        zarade.forEach(z => {
            if (z.godina <= GRANICA_BOLOVANJE) {
                const sr = z.satiRada || 0;
                const sb = z.satiBolovanje || 0;
                zbirSatiRada += sr;
                zbirSatiBol += sb;

                const glk = izracunajGLK(z.licnaZarada, z.prosecnaPlata);
                const lk = glk === null ? 0 : glk;
                if (glk === null) {
                    rezultat.greske.push(
                        'Nedostaje prosečna plata za ' + z.godina +
                        ' — koeficijent bolovanja ne može biti pouzdan'
                    );
                }
                if (sr > 0) zbirLK += lk;

                rezultat.detalji.push({
                    godina: z.godina,
                    satiRada: sr,
                    satiBolovanje: sb,
                    godisnjiLK: lk,
                    doprinos: sr > 0 ? (sb / sr) * lk : 0
                });
            }
        });

        rezultat.koeficijent = zbirSatiRada > 0
            ? (zbirSatiBol / zbirSatiRada) * zbirLK
            : 0;

        return rezultat;
    }

    return {
        izracunajGLK,
        izracunajUkupniLK,
        izracunajKoeficijentBolovanja,
        GLK_MAX,
        LK_MAX
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M05;
}