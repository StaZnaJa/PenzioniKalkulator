// ============================================================================
// M02 — PERZISTENCIJA
// Odgovornost: Čuvanje i učitavanje korisnika, zarada, staža, podešavanja.
// Backend: window.AndroidDB (SharedPreferences + Room) ili localStorage (web).
// Napomena:
//   - AndroidDB se koristi samo ako su SVE potrebne metode prisutne.
//     Ako bilo koja nedostaje, ide se na localStorage fallback.
//   - Normalizacija korisnika uvek vraća objekat { id: korisnik }.
// ============================================================================

const M02 = (function () {

    // ------------------------------------------------------------------------
    // Detekcija backend-a
    // ------------------------------------------------------------------------

    const ANDROID_METODE = [
        'getSviKorisnici',
        'sacuvajKorisnika',
        'obrisiKorisnika',
        'getZaradeKorisnika',
        'getStazKorisnika',
        'importZarade',
        'importStaz',
        'setSetting',
        'getSetting'
    ];

    function imaAndroidDB() {
        if (typeof window === 'undefined') return false;
        const db = window.AndroidDB;
        if (!db || typeof db !== 'object') return false;
        for (let i = 0; i < ANDROID_METODE.length; i++) {
            if (typeof db[ANDROID_METODE[i]] !== 'function') return false;
        }
        return true;
    }

    function imaLocalStorage() {
        try {
            return typeof window !== 'undefined' &&
                   typeof window.localStorage !== 'undefined';
        } catch (e) {
            return false;
        }
    }

    function proveriBackend() {
        const android = imaAndroidDB();
        const ls = imaLocalStorage();
        let backend = 'none';
        if (android) backend = 'android';
        else if (ls) backend = 'localStorage';
        return { android, localStorage: ls, backend };
    }

    // ------------------------------------------------------------------------
    // Fallback preko localStorage (za web razvoj)
    // ------------------------------------------------------------------------

    const LS_KORISNICI = 'pio_korisnici';
    const LS_PODESAVANJA = 'pio_podesavanja';

    function lsUcitajSve() {
        if (!imaLocalStorage()) return {};
        try {
            return JSON.parse(localStorage.getItem(LS_KORISNICI) || '{}');
        } catch (e) {
            return {};
        }
    }

    function lsSacuvajSve(korisnici) {
        if (!imaLocalStorage()) return;
        try {
            localStorage.setItem(LS_KORISNICI, JSON.stringify(korisnici));
        } catch (e) {
            // Kvota ili privatni režim — ignorišemo
        }
    }

    // ------------------------------------------------------------------------
    // Normalizacija korisnika u objekat { id: korisnik }
    // ------------------------------------------------------------------------
    // Android vraća niz [ {...}, {...} ], localStorage vraća objekat { id: {...} }.
    // Ova funkcija garantuje da uvek vraća objekat sa id kao ključem.

    function normalizujKorisnike(podaci) {
        if (!podaci) return {};
        if (Array.isArray(podaci)) {
            const rezultat = {};
            podaci.forEach(k => {
                if (k && k.id) rezultat[k.id] = k;
            });
            return rezultat;
        }
        if (typeof podaci === 'object') {
            const rezultat = {};
            Object.keys(podaci).forEach(kljuc => {
                const k = podaci[kljuc];
                if (k && k.id) {
                    rezultat[k.id] = k;
                } else {
                    rezultat[kljuc] = k;
                }
            });
            return rezultat;
        }
        return {};
    }

    // ------------------------------------------------------------------------
    // Korisnici
    // ------------------------------------------------------------------------

    function sacuvajKorisnika(k) {
        if (!k || !k.id) return;

        if (imaAndroidDB()) {
            try {
                window.AndroidDB.sacuvajKorisnika(
                    k.id,
                    k.ime,
                    k.pol || 'M',
                    k.datumRodjenja || '',
                    k.brojDece || 0,
                    k.kategorija || 'NE',
                    k.opstiBod || 1674.67,
                    k.penzijaMesecno || 0,
                    k.penzijaGodisnja || 0
                );
                if (k.zarade) {
                    window.AndroidDB.importZarade(k.id, JSON.stringify(k.zarade));
                }
                if (k.staz) {
                    window.AndroidDB.importStaz(k.id, JSON.stringify(k.staz));
                }
                if (k.datumPoslednjegStaza) {
                    window.AndroidDB.setSetting('datumPoslednjegStaza_' + k.id, k.datumPoslednjegStaza);
                }
                return;
            } catch (e) {
                // Fallback na localStorage
            }
        }

        const svi = lsUcitajSve();
        svi[k.id] = k;
        lsSacuvajSve(svi);
    }

    function ucitajSveKorisnike() {
        if (imaAndroidDB()) {
            try {
                const json = window.AndroidDB.getSviKorisnici();
                let parsirano;
                try {
                    parsirano = JSON.parse(json || '[]');
                } catch (e) {
                    parsirano = [];
                }

                // Normalizuj u objekat { id: korisnik }
                const korisnici = normalizujKorisnike(parsirano);

                // Učitaj zarade i staž po stvarnom ID-ju
                Object.keys(korisnici).forEach(id => {
                    try {
                        korisnici[id].zarade = JSON.parse(
                            window.AndroidDB.getZaradeKorisnika(id) || '[]'
                        );
                        korisnici[id].staz = JSON.parse(
                            window.AndroidDB.getStazKorisnika(id) || '[]'
                        );
                        const datumStaza = window.AndroidDB.getSetting('datumPoslednjegStaza_' + id);
                        korisnici[id].datumPoslednjegStaza = datumStaza || '';
                    } catch (e) {
                        korisnici[id].zarade = korisnici[id].zarade || [];
                        korisnici[id].staz = korisnici[id].staz || [];
                        korisnici[id].datumPoslednjegStaza = '';
                    }
                });
                return korisnici;
            } catch (e) {
                // Fallback na localStorage
            }
        }
        return lsUcitajSve();
    }

    function ucitajKorisnika(id) {
        const svi = ucitajSveKorisnike();
        return svi[id] || null;
    }

    function obrisiKorisnika(id) {
        if (imaAndroidDB()) {
            try {
                window.AndroidDB.obrisiKorisnika(id);
                // Počisti i podešavanje sa datumom staža
                try {
                    window.AndroidDB.setSetting('datumPoslednjegStaza_' + id, '');
                } catch (e) {
                    // Ignorišemo
                }
                return;
            } catch (e) {
                // Fallback na localStorage
            }
        }
        const svi = lsUcitajSve();
        delete svi[id];
        lsSacuvajSve(svi);
    }

    // ------------------------------------------------------------------------
    // Podešavanja
    // ------------------------------------------------------------------------

    function sacuvajPodesavanja(p) {
        if (!p || typeof p !== 'object') return;

        if (imaAndroidDB()) {
            try {
                Object.keys(p).forEach(key => {
                    window.AndroidDB.setSetting(key, String(p[key]));
                });
                return;
            } catch (e) {
                // Fallback na localStorage
            }
        }
        if (imaLocalStorage()) {
            try {
                localStorage.setItem(LS_PODESAVANJA, JSON.stringify(p));
            } catch (e) {
                // Ignorišemo
            }
        }
    }

    function ucitajPodesavanja() {
        if (imaAndroidDB()) {
            try {
                const kljucevi = ['aktivniKorisnikId', 'tema', 'opstiBod'];
                const p = {};
                kljucevi.forEach(k => {
                    const v = window.AndroidDB.getSetting(k);
                    if (v !== null && v !== undefined) p[k] = v;
                });
                return p;
            } catch (e) {
                // Fallback na localStorage
            }
        }
        if (imaLocalStorage()) {
            try {
                return JSON.parse(localStorage.getItem(LS_PODESAVANJA) || '{}');
            } catch (e) {
                return {};
            }
        }
        return {};
    }

    function getSetting(key) {
        if (imaAndroidDB()) {
            try {
                return window.AndroidDB.getSetting(key);
            } catch (e) {
                // Fallback na localStorage
            }
        }
        if (imaLocalStorage()) {
            return localStorage.getItem('pio_' + key);
        }
        return null;
    }

    function setSetting(key, value) {
        if (imaAndroidDB()) {
            try {
                window.AndroidDB.setSetting(key, String(value));
                return;
            } catch (e) {
                // Fallback na localStorage
            }
        }
        if (imaLocalStorage()) {
            try {
                localStorage.setItem('pio_' + key, String(value));
            } catch (e) {
                // Ignorišemo
            }
        }
    }

    // ------------------------------------------------------------------------
    // Javni interfejs
    // ------------------------------------------------------------------------

    return {
        sacuvajKorisnika,
        ucitajKorisnika,
        ucitajSveKorisnike,
        obrisiKorisnika,
        sacuvajPodesavanja,
        ucitajPodesavanja,
        getSetting,
        setSetting,
        normalizujKorisnike,
        proveriBackend,
        _imaAndroidDB: imaAndroidDB,
        _imaLocalStorage: imaLocalStorage
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M02;
}
