// ============================================================================
// M12 — UI / PRESENTER
// ============================================================================

const M12 = (function () {

    let aktivniKorisnikId = null;
    let korisnici = {};

    // ------------------------------------------------------------------------
    // Pomoćna: bezbedno kreiranje elementa sa tekstom
    // ------------------------------------------------------------------------

    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined && text !== null) e.textContent = String(text);
        return e;
    }

    // ------------------------------------------------------------------------
    // Notifikacije
    // ------------------------------------------------------------------------

    function showNotification(msg, type) {
        type = type || 'info';
        const c = document.getElementById('notificationContainer');
        if (!c) return;
        const n = document.createElement('div');
        n.className = 'notification notification-' + type;

        const ikona = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ️';
        const content = document.createElement('div');
        content.className = 'notification-content';
        content.textContent = ikona + ' ' + msg;
        n.appendChild(content);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', function () { n.remove(); });
        n.appendChild(closeBtn);

        c.appendChild(n);
        setTimeout(() => n.classList.add('show'), 10);
        setTimeout(() => {
            if (n.parentElement) {
                n.classList.remove('show');
                setTimeout(() => n.remove(), 300);
            }
        }, 5000);
    }

    // ------------------------------------------------------------------------
    // Navigacija
    // ------------------------------------------------------------------------

    function switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const tab = document.querySelector('.tab[data-tab="' + tabId + '"]');
        const content = document.getElementById(tabId);
        if (tab) tab.classList.add('active');
        if (content) content.classList.add('active');

        if (tabId === 'calculation' && aktivniKorisnikId) {
            osveziPrikazRezultata();
        }
        if (tabId === 'config') {
            osveziTabeluPlata();
        }
    }

    // ------------------------------------------------------------------------
    // Lista korisnika
    // ------------------------------------------------------------------------

    function osveziListuKorisnika() {
        const container = document.getElementById('listaKorisnika');
        if (!container) return;
        container.innerHTML = '';
        const count = Object.keys(korisnici).length;
        const userCount = document.getElementById('userCount');
        if (userCount) userCount.textContent = count > 0 ? '(' + count + ')' : '';

        // --- BACKUP / RESTORE DUGMAD ---
        const backupDiv = el('div', 'action-buttons');
        backupDiv.style.marginBottom = '15px';
        backupDiv.style.display = 'flex';
        backupDiv.style.gap = '10px';

        const btnBackup = el('button', 'btn btn-success', '💾 Backup svih');
        btnBackup.style.flex = '1';
        btnBackup.style.fontSize = '0.85rem';
        btnBackup.addEventListener('click', exportBackup);

        const btnRestore = el('button', 'btn', '📂 Restore');
        btnRestore.style.flex = '1';
        btnRestore.style.fontSize = '0.85rem';
        btnRestore.style.background = '#e67e22';
        btnRestore.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => importBackup(e.target.files[0]);
            input.click();
        });

        backupDiv.appendChild(btnBackup);
        backupDiv.appendChild(btnRestore);
        container.appendChild(backupDiv);

        if (count === 0) {
            const empty = el('div', 'empty-state');
            empty.appendChild(el('div', null, '👤'));
            empty.appendChild(el('p', null, 'Nema korisnika'));
            container.appendChild(empty);
            return;
        }

        Object.keys(korisnici).forEach(id => {
            const k = korisnici[id];
            const div = document.createElement('div');
            div.className = 'user-item' + (id === aktivniKorisnikId ? ' active' : '');

            const ikona = k.pol === 'Ž' ? '👩' : '👨';
            const nameDiv = el('div', 'user-name', ikona + ' ' + k.ime);
            div.appendChild(nameDiv);

            const infoDiv = el('div', 'user-info');
            infoDiv.appendChild(document.createTextNode('Pol: ' + (k.pol === 'Ž' ? 'Ženski' : 'Muški')));
            if (k.pol === 'Ž' && k.brojDece > 0) {
                infoDiv.appendChild(document.createElement('br'));
                infoDiv.appendChild(document.createTextNode('Deca: ' + k.brojDece));
            }
            infoDiv.appendChild(document.createElement('br'));
            infoDiv.appendChild(document.createTextNode('Rođen: ' + (k.datumRodjenja || 'nepoznat')));
            infoDiv.appendChild(document.createElement('br'));
            infoDiv.appendChild(document.createTextNode('Penzija: ' + (k.penzijaMesecno ? M01.formatCurrency(k.penzijaMesecno) : 'nije izračunato')));
            div.appendChild(infoDiv);

            const actions = el('div', 'action-buttons');
            actions.style.marginTop = '8px';
            const btnEdit = el('button', 'btn-small', '✏️');
            btnEdit.addEventListener('click', function (ev) {
                ev.stopPropagation();
                izmeniKorisnika(id);
            });
            const btnDel = el('button', 'btn-small btn-danger', '🗑️');
            btnDel.addEventListener('click', function (ev) {
                ev.stopPropagation();
                obrisiKorisnika(id);
            });
            actions.appendChild(btnEdit);
            actions.appendChild(btnDel);
            div.appendChild(actions);

            div.addEventListener('click', function () {
                setAktivniKorisnik(id);
            });
            container.appendChild(div);
        });
    }

    // ------------------------------------------------------------------------
    // Aktivni korisnik
    // ------------------------------------------------------------------------

    function setAktivniKorisnik(id) {
        aktivniKorisnikId = id;
        M02.setSetting('aktivniKorisnikId', id || '');
        const k = korisnici[id];
        if (!k) return;

        osveziListuKorisnika();

        const excelNaslov = document.getElementById('excelNaslov');
        if (excelNaslov) excelNaslov.textContent = '📥 Uvoz podataka za ' + k.ime;

        const datumStaza = document.getElementById('datumPoslednjegStaza');
        if (datumStaza) datumStaza.value = k.datumPoslednjegStaza || '';

        const opstiBod = document.getElementById('opstiBodValue');
        if (opstiBod) opstiBod.value = k.opstiBod;

        const detalji = document.getElementById('korisnikDetalji');
        if (detalji) {
            detalji.innerHTML = '';
            detalji.appendChild(el('h3', null, k.ime));

            const grid = el('div', 'details-grid');

            const polItem = el('div', 'detail-item');
            polItem.appendChild(el('div', 'label', '👤 Pol'));
            polItem.appendChild(el('div', 'value', k.pol === 'Ž' ? 'Ženski (+6% na staž)' : 'Muški'));
            grid.appendChild(polItem);

            if (k.pol === 'Ž' && k.brojDece > 0) {
                const decaItem = el('div', 'detail-item');
                decaItem.appendChild(el('div', 'label', '👶 Broj dece'));
                decaItem.appendChild(el('div', 'value', k.brojDece));
                grid.appendChild(decaItem);
            }

            const datumItem = el('div', 'detail-item');
            datumItem.appendChild(el('div', 'label', '🎂 Datum rođenja'));
            datumItem.appendChild(el('div', 'value', k.datumRodjenja || 'nije unet'));
            grid.appendChild(datumItem);

            const stazItem = el('div', 'detail-item');
            stazItem.appendChild(el('div', 'label', '📅 Datum poslednjeg staža'));
            stazItem.appendChild(el('div', 'value', k.datumPoslednjegStaza ? M01.formatDateFromInput(k.datumPoslednjegStaza) : 'nije unet'));
            grid.appendChild(stazItem);

            const godItem = el('div', 'detail-item');
            godItem.appendChild(el('div', 'label', '📊 Broj godina podataka'));
            godItem.appendChild(el('div', 'value', k.zarade ? k.zarade.length : 0));
            grid.appendChild(godItem);

            detalji.appendChild(grid);

            const actions = el('div', 'action-buttons');
            const btnExcel = el('button', 'btn', '📊 Excel import');
            btnExcel.addEventListener('click', function () { switchTab('excel'); });
            const btnCalc = el('button', 'btn', '🧮 Obračun');
            btnCalc.addEventListener('click', function () { switchTab('calculation'); });
            const btnExportX = el('button', 'btn btn-success', '📥 Export u Excel');
            btnExportX.addEventListener('click', exportExcel);
            const btnExportP = el('button', 'btn btn-success', '📄 Kompletan PDF');
            btnExportP.addEventListener('click', exportPDFKompletni);
            actions.appendChild(btnExcel);
            actions.appendChild(btnCalc);
            actions.appendChild(btnExportX);
            actions.appendChild(btnExportP);
            detalji.appendChild(actions);
        }

        osveziPrikazRezultata();
    }

    // ------------------------------------------------------------------------
    // Dodavanje korisnika
    // ------------------------------------------------------------------------

    function dodajKorisnika() {
        const ime = document.getElementById('noviKorisnikIme').value.trim();
        const datum = document.getElementById('noviKorisnikDatum').value;
        const pol = document.getElementById('noviKorisnikPol').value;
        const brojDece = parseInt(document.getElementById('noviKorisnikDeca').value) || 0;
        const kategorija = document.getElementById('noviKorisnikKategorija')
            ? document.getElementById('noviKorisnikKategorija').value
            : 'NE';

        if (!ime) {
            showNotification('Unesite ime', 'error');
            return;
        }

        const k = M01.kreirajKorisnika({
            ime: ime,
            pol: pol,
            brojDece: pol === 'Ž' ? brojDece : 0,
            kategorija: kategorija,
            datumRodjenja: datum ? M01.formatDateFromInput(datum) : ''
        });

        korisnici[k.id] = k;
        M02.sacuvajKorisnika(k);
        osveziListuKorisnika();

        document.getElementById('noviKorisnikIme').value = '';
        document.getElementById('noviKorisnikDatum').value = '';
        if (document.getElementById('noviKorisnikDeca')) {
            document.getElementById('noviKorisnikDeca').value = '0';
        }

        setAktivniKorisnik(k.id);
        showNotification('Korisnik "' + ime + '" dodat.', 'success');
    }

    // ------------------------------------------------------------------------
    // Izmena / brisanje korisnika
    // ------------------------------------------------------------------------

    function izmeniKorisnika(id) {
        const k = korisnici[id];
        if (!k) return;
        const novoIme = prompt('Novo ime:', k.ime);
        if (!novoIme || !novoIme.trim()) return;
        const noviDatum = prompt('Datum rođenja (DD.MM.GGGG):', k.datumRodjenja || '');
        const noviPol = prompt('Pol (M/Ž):', k.pol || 'M');
        let noviBrojDece = null;
        if (noviPol && noviPol.trim().toUpperCase() === 'Ž') {
            noviBrojDece = prompt('Broj dece:', k.brojDece || 0);
        }

        k.ime = novoIme.trim();
        if (noviDatum !== null) k.datumRodjenja = noviDatum.trim();
        if (noviPol !== null) k.pol = noviPol.trim().toUpperCase() === 'Ž' ? 'Ž' : 'M';
        if (k.pol === 'Ž' && noviBrojDece !== null) {
            k.brojDece = parseInt(noviBrojDece) || 0;
        }
        if (k.pol !== 'Ž') k.brojDece = 0;
        k.datumAzuriranja = new Date().toISOString();

        M02.sacuvajKorisnika(k);
        osveziListuKorisnika();
        if (aktivniKorisnikId === id) setAktivniKorisnik(id);
        showNotification('Podaci korisnika izmenjeni', 'success');
    }

    function obrisiKorisnika(id) {
        if (!confirm('Obriši "' + korisnici[id].ime + '"?')) return;
        M02.obrisiKorisnika(id);
        delete korisnici[id];
        if (aktivniKorisnikId === id) {
            const preostali = Object.keys(korisnici);
            aktivniKorisnikId = preostali.length > 0 ? preostali[0] : null;
            if (aktivniKorisnikId) {
                setAktivniKorisnik(aktivniKorisnikId);
            } else {
                const detalji = document.getElementById('korisnikDetalji');
                if (detalji) {
                    detalji.innerHTML = '';
                    const empty = el('div', 'empty-state');
                    empty.appendChild(el('div', null, '👤'));
                    empty.appendChild(el('p', null, 'Nema aktivnog korisnika'));
                    detalji.appendChild(empty);
                }
            }
        }
        osveziListuKorisnika();
        showNotification('Korisnik obrisan', 'success');
    }

    // ------------------------------------------------------------------------
    // BACKUP / RESTORE
    // ------------------------------------------------------------------------

    function exportBackup() {
        if (Object.keys(korisnici).length === 0) {
            showNotification('Nema korisnika za backup', 'error');
            return;
        }

        try {
            const backupPodaci = {
                verzija: "1.0",
                datum: new Date().toISOString(),
                korisnici: korisnici,
                podesavanja: M02.ucitajPodesavanja(),
                plate: M04.getSvePlate()
            };

            const jsonString = JSON.stringify(backupPodaci, null, 2);
            const base64 = btoa(unescape(encodeURIComponent(jsonString)));
            
            // Napomena: Za razliku od PDF-a, JSON je mali (nekoliko KB) i sigurno prolazi.
            const fileName = 'pio-backup-' + new Date().toISOString().slice(0,10) + '.json';
            
            const link = document.createElement('a');
            link.href = 'data:application/json;base64,' + base64;
            link.download = fileName;
            
            try {
                if (window.AndroidDB && window.AndroidDB.shareExcel) {
                    // Koristimo shareExcel jer prima base64 i fajl ime, a Android ga tretira kao običan fajl
                    window.AndroidDB.shareExcel(base64, fileName);
                } else {
                    link.click();
                }
            } catch (err) {
                console.warn('Share pao, preuzimam direktno:', err);
                link.click();
            }
            
            showNotification('Backup uspešno kreiran', 'success');
        } catch (e) {
            showNotification('Greška pri backup-u: ' + e.message, 'error');
        }
    }

    function importBackup(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonString = decodeURIComponent(escape(atob(e.target.result.split(',')[1] || e.target.result)));
                // Ako fajl nije base64, nego čist tekst:
                const rawText = e.target.result.startsWith('data:') ? jsonString : e.target.result;
                
                const podaci = JSON.parse(rawText);

                if (!podaci.korisnici) {
                    throw new Error('Fajl nije validan PIO backup.');
                }

                if (!confirm('Ovo će zameniti sve postojeće korisnike sa podacima iz backup-a. Nastaviti?')) {
                    return;
                }

                // 1. Obriši postojeće
                Object.keys(korisnici).forEach(id => {
                    M02.obrisiKorisnika(id);
                });
                korisnici = {};

                // 2. Upiši nove
                const noviKorisnici = podaci.korisnici;
                Object.keys(noviKorisnici).forEach(id => {
                    korisnici[id] = noviKorisnici[id];
                    M02.sacuvajKorisnika(noviKorisnici[id]);
                });

                // 3. Podešavanja
                if (podaci.podesavanja) {
                    M02.sacuvajPodesavanja(podaci.podesavanja);
                    if (podaci.podesavanja.aktivniKorisnikId && korisnici[podaci.podesavanja.aktivniKorisnikId]) {
                        aktivniKorisnikId = podaci.podesavanja.aktivniKorisnikId;
                    }
                }

                // 4. Plate
                if (podaci.plate) {
                    Object.keys(podaci.plate).forEach(god => {
                        M04.setProsecnaPlata(god, podaci.plate[god]);
                    });
                }

                osveziListuKorisnika();
                osveziTabeluPlata();
                
                if (aktivniKorisnikId) {
                    setAktivniKorisnik(aktivniKorisnikId);
                } else {
                    const prviId = Object.keys(korisnici)[0];
                    if (prviId) setAktivniKorisnik(prviId);
                }

                showNotification('Backup uspešno vraćen!', 'success');

            } catch (err) {
                console.error(err);
                showNotification('Greška pri restore-u: ' + err.message, 'error');
            }
        };
        
        // Čitamo kao tekst jer je JSON
        reader.readAsText(file);
    }

    // ------------------------------------------------------------------------
    // Prikaz rezultata
    // ------------------------------------------------------------------------

    function osveziPrikazRezultata() {
        if (!aktivniKorisnikId) return;
        const k = korisnici[aktivniKorisnikId];
        if (!k) return;

        const rezultat = M10.evaluiraj(k, new Date());

        // 1. Izračunaj rezultat sa stažom do danas (isti izvor za penziju i opcije)
        let rezultatZaOpcije = rezultat;
        if (k.datumPoslednjegStaza) {
            const danas = new Date();
            danas.setHours(0, 0, 0, 0);
            const dps = new Date(k.datumPoslednjegStaza);
            dps.setHours(0, 0, 0, 0);
            if (danas > dps) {
                const stazDoDanas = simulirajStazZaBuduciDatum(k, danas);
                const kZaOpcije = Object.assign({}, k, { staz: stazDoDanas });
                rezultatZaOpcije = M10.evaluiraj(kZaOpcije, danas);
            }
        }

        // 2. "Vaša mesečna penzija" — iz istog izvora kao opcije
        let opcijaZaPrikaz = rezultatZaOpcije.opcije.find(o =>
            o.ispunjeno && ['OP-01','OP-02','OP-03'].includes(o.id)
        );
        if (!opcijaZaPrikaz) {
            opcijaZaPrikaz = rezultatZaOpcije.opcije.find(o => o.ispunjeno);
        }

        const elMesecno = document.getElementById('penzijaMesecnoDisplay');
        const elGodisnje = document.getElementById('penzijaGodisnjeDisplay');
        if (elMesecno) {
            elMesecno.textContent = opcijaZaPrikaz ? M01.formatCurrency(opcijaZaPrikaz.iznos) : '—';
        }
        if (elGodisnje) {
            elGodisnje.textContent = opcijaZaPrikaz
                ? M01.formatCurrency(opcijaZaPrikaz.iznos * 12) + ' godišnje'
                : 'Nema ispunjene opcije';
        }

        const elLicni = document.getElementById('licniKoefDisplay');
        if (elLicni) elLicni.textContent = rezultat.lk.toFixed(4);
        const elBol = document.getElementById('koefBolDisplay');
        if (elBol) elBol.textContent = rezultat.koefBolovanja.toFixed(4);

        // Staž polja — do datumPoslednjegStaza (Excel unos)
        const elPenzStaz = document.getElementById('penzijskiStazDisplay');
        if (elPenzStaz) elPenzStaz.textContent = M01.formatDaniUGMD(rezultat.staz.ukupnoOsiguranjeDani);

        const elEfStaz = document.getElementById('efektivniStazDisplay');
        if (elEfStaz) elEfStaz.textContent = M01.formatDaniUGMD(rezultat.staz.efektivniDani);

        const elStazBen = document.getElementById('stazPodBeneficijomDisplay');
        if (elStazBen) elStazBen.textContent = M01.formatDaniUGMD(rezultat.staz.beneficiraniDani);

        const elBeneficija = document.getElementById('beneficijaDisplay');
        if (elBeneficija) elBeneficija.textContent = M01.formatDaniUGMD(rezultat.staz.uvecaniDani);

        const elOpstiBod = document.getElementById('opstiBodDisplay');
        if (elOpstiBod) elOpstiBod.textContent = M01.formatCurrency(rezultat.opstiBod, false) + ' din';
        const elBrojGod = document.getElementById('brojGodinaDisplay');
        if (elBrojGod) elBrojGod.textContent = (k.zarade ? k.zarade.length : 0);
        const elDeca = document.getElementById('decaStazDisplay');
        if (elDeca) elDeca.textContent = rezultat.staz.decaDodatakGodine > 0 ? rezultat.staz.decaDodatakGodine + ' god' : '0';

        const elUslovStatus = document.getElementById('uslovStatusDisplay');
        if (elUslovStatus) {
            elUslovStatus.className = 'uslov-check ' + (rezultat.uslovi.uslov23Ispunjen ? 'uslov-ispunjen' : 'uslov-neispunjen');
            elUslovStatus.textContent = rezultat.uslovi.status;
        }
        const elUslovEf = document.getElementById('uslovEfektivniDisplay');
        if (elUslovEf) elUslovEf.textContent = M01.formatGodine(rezultat.uslovi.efektivniGodine);
        const elUslovBen = document.getElementById('uslovBenefPreDisplay');
        if (elUslovBen) elUslovBen.textContent = M01.formatGodine(rezultat.uslovi.beneficiraniGodine);
        const elUslovMin = document.getElementById('uslovPotrebanDisplay');
        if (elUslovMin) elUslovMin.textContent = M01.formatGodine(rezultat.uslovi.zahtevaniMinimumGodine);
        const elUslovProc = document.getElementById('uslovProcenatDisplay');
        if (elUslovProc) elUslovProc.textContent = rezultat.uslovi.procenat23.toFixed(2) + '%';

        const sliderFill = document.getElementById('uslovSliderFill');
        const sliderValue = document.getElementById('uslovSliderValue');
        const sliderStatus = document.getElementById('uslovSliderStatus');
        if (sliderFill && sliderValue && sliderStatus) {
            const proc = Math.min(Math.max(rezultat.uslovi.procenat23, 0), 100);
            sliderFill.style.width = proc + '%';
            sliderValue.textContent = proc.toFixed(1) + '%';
            if (proc >= 66.67) {
                sliderFill.className = 'slider-fill above';
                sliderStatus.className = 'slider-value ispunjeno';
                sliderStatus.textContent = '✅ Uslov je ispunjen (' + proc.toFixed(1) + '%)';
            } else {
                sliderFill.className = 'slider-fill below';
                sliderStatus.className = 'slider-value neispunjeno';
                sliderStatus.textContent = '🔴 Uslov nije ispunjen (' + proc.toFixed(1) + '%)';
            }
        }

        osveziStatistikuStaza(k);

        // Opcije penzionisanja — iz ISTOG izvora kao penzija
        osveziOpcijePenzionisanja(rezultatZaOpcije.opcije);

        osveziTabeluBolovanja(rezultat.koefBolovanjaDetalji);
    }

    // ------------------------------------------------------------------------
    // Statistika staža na dan uslova
    // ------------------------------------------------------------------------

    function osveziStatistikuStaza(k) {
        const elUkupno = document.getElementById('statUkupnoDisplay');
        const elEfektivni = document.getElementById('statEfektivniDisplay');
        const elBenefPre = document.getElementById('statBenefPreDisplay');
        const elBenefPosle = document.getElementById('statBenefPosleDisplay');

        if (!elUkupno && !elEfektivni && !elBenefPre && !elBenefPosle) return;

        const buduca = pronadjiBuducuOpciju(k);
        if (!buduca || !buduca.datum) {
            if (elUkupno) elUkupno.textContent = '-';
            if (elEfektivni) elEfektivni.textContent = '-';
            if (elBenefPre) elBenefPre.textContent = '-';
            if (elBenefPosle) elBenefPosle.textContent = '-';
            return;
        }

        const stazSim = simulirajStazZaBuduciDatum(k, buduca.datum);
        const stazRez = M06.izracunajStaz(
            stazSim,
            k.pol,
            k.brojDece,
            buduca.opcija && buduca.opcija.detalji && buduca.opcija.detalji.uslov23Ispunjen
                ? true
                : false
        );

        if (elUkupno) elUkupno.textContent = M01.formatDaniUGMD(stazRez.ukupnoOsiguranjeDani);
        if (elEfektivni) elEfektivni.textContent = M01.formatDaniUGMD(stazRez.efektivniDani);
        if (elBenefPre) elBenefPre.textContent = M01.formatDaniUGMD(stazRez.beneficiraniDani);
        if (elBenefPosle) elBenefPosle.textContent = M01.formatDaniUGMD(stazRez.uvecaniDani);
    }

    // ------------------------------------------------------------------------
    // Pronađi prvu buduću opciju BEZ trajnog umanjenja (OP-01/02/03)
    // ------------------------------------------------------------------------

    function pronadjiBuducuOpciju(k) {
        if (!k.datumRodjenja) return null;
        if (!k.datumPoslednjegStaza) return null;

        const dps = new Date(k.datumPoslednjegStaza);
        if (isNaN(dps.getTime())) return null;
        dps.setHours(0, 0, 0, 0);

        const MAKSIMALNO_DANA = 50 * 360;

        for (let D_f = 0; D_f <= MAKSIMALNO_DANA; D_f++) {
            const kalendarskiDani = Math.round(D_f * (365.25 / 360));
            const trenutniDatum = new Date(dps);
            trenutniDatum.setDate(trenutniDatum.getDate() + kalendarskiDani);

            const stazSim = dodajDaneStaza(k.staz, D_f);
            const provera = proveriUslovePenzije(k, stazSim, trenutniDatum);
            if (provera && provera.ispunjenoBezUmanjenja) {
                return {
                    opcija: {
                        id: provera.opcijaBezUmanjenja,
                        naziv: nazivOpcije(provera.opcijaBezUmanjenja),
                        ispunjeno: true,
                        iznos: 0,
                        detalji: { uslov23Ispunjen: provera.uslov23Ispunjen }
                    },
                    datum: trenutniDatum
                };
            }
        }
        return null;
    }

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
    // Dodavanje D_f obračunskih dana na niz staža
    // ------------------------------------------------------------------------

    function dodajDaneStaza(stazOriginal, D_f) {
        const staz = JSON.parse(JSON.stringify(stazOriginal || []));
        if (!staz.length || D_f <= 0) return staz;

        const poslednjaGodina = Math.max(...staz.map(s => s.godina));
        const poslednjiUnos = staz.find(s => s.godina === poslednjaGodina);
        const tipBeneficije = poslednjiUnos ? poslednjiUnos.tipBeneficiranja : '1212';
        const imaBeneficiju = tipBeneficije !== '1212';

        const poGodini = {};
        staz.forEach(s => {
            poGodini[s.godina] = {
                efektivniMeseci: s.efektivniMeseci || 0,
                efektivniDani: s.efektivniDani || 0,
                beneficiraniMeseci: s.beneficiraniMeseci || 0,
                beneficiraniDani: s.beneficiraniDani || 0,
                tipBeneficiranja: s.tipBeneficiranja || '1212'
            };
        });

        let preostaloDana = D_f;
        let tekucaGodina = poslednjaGodina;

        while (preostaloDana > 0) {
            if (!poGodini[tekucaGodina]) {
                poGodini[tekucaGodina] = {
                    efektivniMeseci: 0, efektivniDani: 0,
                    beneficiraniMeseci: 0, beneficiraniDani: 0,
                    tipBeneficiranja: tipBeneficije
                };
            }
            const p = poGodini[tekucaGodina];

            const trenutnoDana = (p.efektivniMeseci * 30) + p.efektivniDani;
            if (trenutnoDana >= 360) {
                tekucaGodina++;
                continue;
            }

            const slobodnoDana = 360 - trenutnoDana;
            const dodaj = Math.min(preostaloDana, slobodnoDana);

            p.efektivniDani += dodaj;
            if (imaBeneficiju) {
                p.beneficiraniDani += dodaj;
            }
            preostaloDana -= dodaj;

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
    // Brza provera uslova penzije
    // ------------------------------------------------------------------------

    function proveriUslovePenzije(k, stazSim, trenutniDatum) {
        const kSim = Object.assign({}, k, { staz: stazSim });
        const rez = M10.evaluiraj(kSim, trenutniDatum);

        const bezUmanjenja = rez.opcije.find(o =>
            o.ispunjeno && ['OP-01', 'OP-02', 'OP-03'].includes(o.id));
        const saUmanjenjem = rez.opcije.find(o =>
            o.ispunjeno && ['OP-04', 'OP-05'].includes(o.id));

        if (!bezUmanjenja && !saUmanjenjem) return null;

        return {
            ispunjenoBezUmanjenja: !!bezUmanjenja,
            ispunjenoSaUmanjenjem: !!saUmanjenjem,
            opcijaBezUmanjenja: bezUmanjenja ? bezUmanjenja.id : null,
            uslov23Ispunjen: rez.uslovi.uslov23Ispunjen
        };
    }

    // ------------------------------------------------------------------------
    // Wrapper: simuliraj staž za budući datum (model A)
    // ------------------------------------------------------------------------

    function simulirajStazZaBuduciDatum(k, buduciDatum) {
        if (!k.staz || !k.staz.length) return k.staz || [];
        if (!k.datumPoslednjegStaza) return k.staz || [];

        const dps = new Date(k.datumPoslednjegStaza);
        if (isNaN(dps.getTime())) return k.staz || [];

        const buduci = new Date(buduciDatum);
        if (isNaN(buduci.getTime())) return k.staz || [];

        const razlikaDana = Math.floor((buduci - dps) / (24 * 60 * 60 * 1000));
        if (razlikaDana <= 0) return JSON.parse(JSON.stringify(k.staz));

        const D_f = Math.round(razlikaDana * (360 / 365.25));

        return dodajDaneStaza(k.staz, D_f);
    }

    // ------------------------------------------------------------------------
    // Predviđanje datuma penzije (model A)
    // ------------------------------------------------------------------------

    function predvidiDatumPenzije() {
        if (!aktivniKorisnikId) {
            showNotification('Izaberite korisnika', 'error');
            return;
        }
        const k = korisnici[aktivniKorisnikId];
        if (!k.datumRodjenja) {
            showNotification('Korisnik nema datum rođenja', 'error');
            return;
        }

        const datumRodjenja = M01.parseDate(k.datumRodjenja);
        if (!datumRodjenja) {
            showNotification('Datum rođenja nije validan (DD.MM.GGGG)', 'error');
            return;
        }
        if (!k.datumPoslednjegStaza) {
            showNotification('Korisnik nema datum poslednjeg staža', 'error');
            return;
        }

        const dps = new Date(k.datumPoslednjegStaza);
        if (isNaN(dps.getTime())) {
            showNotification('Datum poslednjeg staža nije validan', 'error');
            return;
        }
        dps.setHours(0, 0, 0, 0);

        const MAKSIMALNO_DANA = 50 * 360;
        let prviDatumBezPenala = null;
        let prvaOpcijaBezPenala = null;
        let prviDatumSaPenalima = null;
        let prvaOpcijaSaPenalima = null;

        for (let D_f = 0; D_f <= MAKSIMALNO_DANA; D_f++) {
            const kalendarskiDani = Math.round(D_f * (365.25 / 360));
            const trenutniDatum = new Date(dps);
            trenutniDatum.setDate(trenutniDatum.getDate() + kalendarskiDani);

            const stazSim = dodajDaneStaza(k.staz, D_f);
            const provera = proveriUslovePenzije(k, stazSim, trenutniDatum);

            if (!provera) {
                if (D_f > 0 && D_f % 360 === 0) {
                    if (prviDatumBezPenala && prviDatumSaPenalima) break;
                }
                continue;
            }

            if (provera.ispunjenoBezUmanjenja && !prviDatumBezPenala) {
                prviDatumBezPenala = new Date(trenutniDatum);
                prvaOpcijaBezPenala = {
                    id: provera.opcijaBezUmanjenja,
                    naziv: nazivOpcije(provera.opcijaBezUmanjenja)
                };
            }
            if (provera.ispunjenoSaUmanjenjem && !prviDatumSaPenalima) {
                prviDatumSaPenalima = new Date(trenutniDatum);
                prvaOpcijaSaPenalima = {
                    id: 'OP-04/05',
                    naziv: 'Prevremena sa umanjenjem'
                };
            }

            if (prviDatumBezPenala && prviDatumSaPenalima) break;
        }

        let prvaOpcijaBezPenalaPuna = null;
        if (prviDatumBezPenala) {
            const D_fFinal = Math.round(
                ((prviDatumBezPenala - dps) / (24 * 60 * 60 * 1000)) * (360 / 365.25)
            );
            const stazNaDatum = dodajDaneStaza(k.staz, D_fFinal);
            const kSimuliran = Object.assign({}, k, { staz: stazNaDatum });
            const rez = M10.evaluiraj(kSimuliran, prviDatumBezPenala);
            const ispunjena = rez.opcije.find(o => o.ispunjeno && !['OP-04','OP-05'].includes(o.id));
            if (ispunjena) prvaOpcijaBezPenalaPuna = ispunjena;
        }

        const elDatum = document.getElementById('predvidjanjePredvidjeniDatum');
        const elUslov = document.getElementById('predvidjanjePredvidjeniUslov');
        const elRez = document.getElementById('predvidjanjeRezultati');
        const elGrid = document.getElementById('predvidjanjeDetaljiGrid');

        if (prviDatumBezPenala) {
            if (elDatum) elDatum.textContent = M01.formatDate(prviDatumBezPenala);
            if (elUslov) elUslov.textContent = (prvaOpcijaBezPenalaPuna || prvaOpcijaBezPenala).naziv + ' (bez umanjenja)';
            if (elRez) elRez.style.display = 'block';
        } else if (prviDatumSaPenalima) {
            if (elDatum) elDatum.textContent = M01.formatDate(prviDatumSaPenalima);
            if (elUslov) elUslov.textContent = prvaOpcijaSaPenalima.naziv + ' (sa umanjenjem)';
            if (elRez) elRez.style.display = 'block';
        } else {
            if (elDatum) elDatum.textContent = 'Nije moguće u narednih 50 godina';
            if (elUslov) elUslov.textContent = 'Nijedna opcija se ne stiče u razumnom periodu';
            if (elRez) elRez.style.display = 'block';
        }

        if (elGrid) {
            elGrid.innerHTML = '';

            const rezultatPocetak = M10.evaluiraj(k, dps);

            const d1 = el('div', 'detail-item');
            d1.appendChild(el('div', 'label', '🎂 Datum rođenja'));
            d1.appendChild(el('div', 'value', k.datumRodjenja));
            elGrid.appendChild(d1);

            const d2 = el('div', 'detail-item');
            d2.appendChild(el('div', 'label', '📅 Početak simulacije'));
            d2.appendChild(el('div', 'value', M01.formatDate(dps)));
            elGrid.appendChild(d2);

            const d3 = el('div', 'detail-item');
            d3.appendChild(el('div', 'label', '📅 Pune godine (na početku)'));
            d3.appendChild(el('div', 'value', rezultatPocetak.puneGodine));
            elGrid.appendChild(d3);

            const d4 = el('div', 'detail-item');
            d4.appendChild(el('div', 'label', '📊 Efektivni staž (na početku)'));
            d4.appendChild(el('div', 'value', M01.formatDaniUGMD(rezultatPocetak.staz.efektivniDani)));
            elGrid.appendChild(d4);

            const d5 = el('div', 'detail-item');
            d5.appendChild(el('div', 'label', '📋 Uslov 2/3'));
            d5.appendChild(el('div', 'value', rezultatPocetak.uslovi.status));
            elGrid.appendChild(d5);

            if (prviDatumSaPenalima && prviDatumBezPenala && prviDatumSaPenalima < prviDatumBezPenala) {
                const opcijaDiv = el('div');
                opcijaDiv.style.gridColumn = '1/-1';
                opcijaDiv.style.padding = '10px';
                opcijaDiv.style.marginTop = '12px';
                opcijaDiv.style.background = '#fff3cd';
                opcijaDiv.style.borderLeft = '3px solid #f39c12';
                opcijaDiv.style.borderRadius = '4px';

                const naslov = el('strong', null, '⏳ Prevremena penzija sa umanjenjem:');
                opcijaDiv.appendChild(naslov);
                opcijaDiv.appendChild(document.createElement('br'));

                let tekst = M01.formatDate(prviDatumSaPenalima) + ' — ' + prvaOpcijaSaPenalima.naziv;
                opcijaDiv.appendChild(document.createTextNode(tekst));

                elGrid.appendChild(opcijaDiv);
            }
        }
    }

    function osveziOpcijePenzionisanja(opcije) {
        const container = document.getElementById('opcijePenzionisanja');
        if (!container) return;
        container.innerHTML = '';
        if (!opcije || !opcije.length) {
            const empty = el('div', 'empty-state', 'Nema opcija');
            container.appendChild(empty);
            return;
        }
        opcije.forEach(o => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.style.marginBottom = '8px';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'flex-start';

            const boja = o.ispunjeno ? '#27ae60' : '#e74c3c';
            const iznosStr = o.ispunjeno ? M01.formatCurrency(o.iznos) : '—';

            const header = el('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.width = '100%';
            const nazivEl = el('strong', null, o.id + ' — ' + o.naziv);
            nazivEl.style.color = boja;
            const iznosEl = el('span', null, iznosStr);
            iznosEl.style.fontWeight = '700';
            header.appendChild(nazivEl);
            header.appendChild(iznosEl);
            div.appendChild(header);

            let detaljiStr = o.status;
            if (o.detalji) {
                if (o.detalji.penal && o.detalji.penal > 0) {
                    detaljiStr += ' Penal: ' + o.detalji.penal.toFixed(2) + '%';
                }
                if (o.detalji.referentnaGranica) {
                    detaljiStr += ' Ref. granica: ' + o.detalji.referentnaGranica.toFixed(2);
                }
                if (o.detalji.napomena) {
                    detaljiStr += ' — ' + o.detalji.napomena;
                }
            }
            const detaljiEl = el('div', null, detaljiStr);
            detaljiEl.style.fontSize = '0.8rem';
            detaljiEl.style.color = '#888';
            detaljiEl.style.marginTop = '4px';
            div.appendChild(detaljiEl);

            container.appendChild(div);
        });
    }

    function osveziTabeluBolovanja(detalji) {
        const tbody = document.getElementById('tabelaBolovanjeBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!detalji || !detalji.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.textContent = 'Nema podataka';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        detalji.forEach(d => {
            const tr = document.createElement('tr');
            tr.appendChild(el('td', null, d.godina));
            const td1 = el('td', null, d.satiRada); td1.style.textAlign = 'right'; tr.appendChild(td1);
            const td2 = el('td', null, d.satiBolovanje); td2.style.textAlign = 'right'; tr.appendChild(td2);
            const td3 = el('td', null, d.godisnjiLK.toFixed(4)); td3.style.textAlign = 'right'; tr.appendChild(td3);
            const td4 = el('td', null, d.doprinos.toFixed(4)); td4.style.textAlign = 'right'; tr.appendChild(td4);
            tbody.appendChild(tr);
        });
    }

    // ------------------------------------------------------------------------
    // Export — Excel
    // ------------------------------------------------------------------------

    async function exportExcel() {
        if (!aktivniKorisnikId) {
            showNotification('Izaberite korisnika', 'error');
            return;
        }
        const k = korisnici[aktivniKorisnikId];
        const rezultat = M10.evaluiraj(k, new Date());
        try {
            const { base64, fileName } = M11.generisiExcel(k, rezultat);
            const link = document.createElement('a');
            link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64;
            link.download = fileName;
            
            try {
                if (window.AndroidDB && window.AndroidDB.shareExcel) {
                    window.AndroidDB.shareExcel(base64, fileName);
                } else {
                    link.click();
                }
            } catch (err) {
                console.warn('Share pao, preuzimam direktno:', err);
                link.click();
            }
            
            showNotification('Excel izveštaj generisan', 'success');
        } catch (e) {
            showNotification('Greška: ' + e.message, 'error');
        }
    }

    // ------------------------------------------------------------------------
    // Export — Skraćeni PDF
    // ------------------------------------------------------------------------

    async function exportPDF() {
        if (!aktivniKorisnikId) {
            showNotification('Izaberite korisnika', 'error');
            return;
        }
        const k = korisnici[aktivniKorisnikId];
        const rezultat = M10.evaluiraj(k, new Date());
        showNotification('Generišem skraćeni PDF...', 'info');
        try {
            const { base64, fileName } = await M11.generisiPDF(k, rezultat);
            const link = document.createElement('a');
            link.href = 'data:application/pdf;base64,' + base64;
            link.download = fileName;
            
            try {
                if (window.AndroidDB && window.AndroidDB.sharePDF) {
                    window.AndroidDB.sharePDF(base64, fileName);
                } else {
                    link.click();
                }
            } catch (err) {
                console.warn('Share pao, preuzimam direktno:', err);
                link.click();
            }
            
            showNotification('Skraćeni PDF generisan', 'success');
        } catch (e) {
            showNotification('Greška: ' + e.message, 'error');
        }
    }

    // ------------------------------------------------------------------------
    // Export — Kompletni PDF
    // ------------------------------------------------------------------------

    async function exportPDFKompletni() {
        if (!aktivniKorisnikId) {
            showNotification('Izaberite korisnika', 'error');
            return;
        }
        const k = korisnici[aktivniKorisnikId];
        const rezultat = M10.evaluiraj(k, new Date());
        showNotification('Generišem kompletan PDF...', 'info');
        try {
            const { base64, fileName } = await M11.generisiPDFKompletni(k, rezultat);
            const link = document.createElement('a');
            link.href = 'data:application/pdf;base64,' + base64;
            link.download = fileName;
            
            try {
                if (window.AndroidDB && window.AndroidDB.sharePDF) {
                    window.AndroidDB.sharePDF(base64, fileName);
                } else {
                    link.click();
                }
            } catch (err) {
                console.warn('Share pao, preuzimam direktno:', err);
                link.click();
            }
            
            showNotification('Kompletni PDF generisan', 'success');
        } catch (e) {
            showNotification('Greška: ' + e.message, 'error');
        }
    }

    // ------------------------------------------------------------------------
    // Tabela plata
    // ------------------------------------------------------------------------

    function osveziTabeluPlata() {
        const tbody = document.getElementById('tabelaPlateBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const plate = M04.getSvePlate();
        Object.keys(plate).sort((a, b) => b - a).forEach(y => {
            const p = plate[y];
            const tr = document.createElement('tr');
            tr.appendChild(el('td', null, y));
            tr.appendChild(el('td', 'money', M01.formatCurrency(p, false)));
            tr.appendChild(el('td', 'money', M01.formatCurrency(p / 12, false)));

            const tdAkcije = document.createElement('td');
            const btnEdit = el('button', 'btn-small', '✏️');
            btnEdit.addEventListener('click', function () { izmeniPlatu(y); });
            const btnDel = el('button', 'btn-small btn-danger', '🗑️');
            btnDel.addEventListener('click', function () { obrisiPlatu(y); });
            tdAkcije.appendChild(btnEdit);
            tdAkcije.appendChild(document.createTextNode(' '));
            tdAkcije.appendChild(btnDel);
            tr.appendChild(tdAkcije);

            tbody.appendChild(tr);
        });
    }

    function izmeniPlatu(g) {
        const nova = prompt('Nova prosečna godišnja plata za ' + g + ':', M04.getProsecnaPlata(g));
        if (nova !== null) {
            if (M04.setProsecnaPlata(g, nova)) {
                osveziTabeluPlata();
                showNotification('Plata izmenjena', 'success');
            } else {
                showNotification('Nevalidna vrednost', 'error');
            }
        }
    }

    function obrisiPlatu(g) {
        if (confirm('Obriši platu za ' + g + '?')) {
            M04.setProsecnaPlata(g, 0);
            osveziTabeluPlata();
            showNotification('Obrisano', 'success');
        }
    }

    // ------------------------------------------------------------------------
    // Excel uvoz
    // ------------------------------------------------------------------------

    async function handleExcelUpload(e) {
        const file = e.target.files[0];
        const statusDiv = document.getElementById('uploadStatus');
        if (!statusDiv) return;

        if (!file) {
            statusDiv.style.display = 'block';
            statusDiv.className = 'status error';
            statusDiv.textContent = '❌ Nije izabran fajl';
            return;
        }

        statusDiv.style.display = 'block';
        statusDiv.className = 'status info';
        statusDiv.textContent = 'Učitavanje...';

        try {
            const rawData = await M03.parsirajM4M8(file);
            window._rawExcelData = rawData;

            statusDiv.className = 'status success';
            statusDiv.textContent = '✅ Učitano ' + rawData.length + ' redova';
            showNotification('Excel učitan', 'success');

            const predlog = M03.predloziDatumPoslednjegStaza(rawData);
            if (predlog && aktivniKorisnikId) {
                const datumInput = document.getElementById('datumPoslednjegStaza');
                if (datumInput) datumInput.value = predlog;
                korisnici[aktivniKorisnikId].datumPoslednjegStaza = predlog;
                M02.sacuvajKorisnika(korisnici[aktivniKorisnikId]);
            }

            const btnObradi = document.getElementById('obradiExcel');
            if (btnObradi) btnObradi.disabled = false;
        } catch (err) {
            statusDiv.className = 'status error';
            statusDiv.textContent = '❌ Greška: ' + err.message;
            showNotification('Greška pri učitavanju: ' + err.message, 'error');
        }
    }

    async function processAndCalculate() {
        if (!aktivniKorisnikId) {
            showNotification('Izaberite korisnika', 'error');
            return;
        }

        const k = korisnici[aktivniKorisnikId];
        const rawData = window._rawExcelData;

        if (!rawData || !rawData.length) {
            showNotification('Nije učitan Excel fajl', 'error');
            return;
        }

        if (!k.datumPoslednjegStaza) {
            showNotification('Unesite datum poslednjeg staža', 'error');
            return;
        }

        const btn = document.getElementById('obradiExcel');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Obrada...';
        }

        try {
            const granicaGodina = new Date(k.datumPoslednjegStaza).getFullYear();
            const plate = M04.getSvePlate();

            const rezultat = M03.obradiPodatke(rawData, {
                granicaGodina: granicaGodina,
                prosecnePlate: plate
            });

            k.zarade = rezultat.zarade;
            k.staz = rezultat.staz;
            M02.sacuvajKorisnika(k);

            if (rezultat.greske.length > 0) {
                const prveGreske = rezultat.greske.slice(0, 3).join('; ');
                showNotification(
                    'Greške pri uvozu (' + rezultat.greske.length + '): ' + prveGreske,
                    'error'
                );
            }

            // Izračunaj penziju iz istog izvora kao opcije (staž do danas)
            let rezultatZaOpcije = M10.evaluiraj(k, new Date());
            if (k.datumPoslednjegStaza) {
                const danas = new Date();
                danas.setHours(0, 0, 0, 0);
                const dps = new Date(k.datumPoslednjegStaza);
                dps.setHours(0, 0, 0, 0);
                if (danas > dps) {
                    const stazDoDanas = simulirajStazZaBuduciDatum(k, danas);
                    const kZaOpcije = Object.assign({}, k, { staz: stazDoDanas });
                    rezultatZaOpcije = M10.evaluiraj(kZaOpcije, danas);
                }
            }

            let opcijaZaPrikaz = rezultatZaOpcije.opcije.find(o =>
                o.ispunjeno && ['OP-01','OP-02','OP-03'].includes(o.id)
            );
            if (!opcijaZaPrikaz) {
                opcijaZaPrikaz = rezultatZaOpcije.opcije.find(o => o.ispunjeno);
            }
            k.penzijaMesecno = opcijaZaPrikaz ? opcijaZaPrikaz.iznos : 0;
            k.penzijaGodisnja = k.penzijaMesecno * 12;
            M02.sacuvajKorisnika(k);

            osveziListuKorisnika();
            osveziPrikazRezultata();
            switchTab('calculation');

            if (rezultat.greske.length === 0) {
                showNotification('Penzija: ' + (k.penzijaMesecno ? M01.formatCurrency(k.penzijaMesecno) : '—'), 'success');
            } else {
                showNotification('Penzija izračunata sa upozorenjima: ' + (k.penzijaMesecno ? M01.formatCurrency(k.penzijaMesecno) : '—'), 'info');
            }
        } catch (err) {
            showNotification('Greška: ' + err.message, 'error');
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = '🚀 Obradi podatke i izračunaj penziju';
        }
    }

    function preuzmiTemplate() {
        if (typeof XLSX === 'undefined') {
            showNotification('XLSX biblioteka nije učitana', 'error');
            return;
        }
        const wb = XLSX.utils.book_new();
        const header = [
            ['Kolona', 'Oznaka', 'Naziv', 'Napomena'],
            ['A', 'Godina', 'Godina', 'Obavezno'],
            ['B', 'Obrazac', 'Obrazac', 'M4 ili M8'],
            ['C', 'RBOUD/PIB', 'RBOUD/PIB', 'Bez unosa'],
            ['D', '(prazno)', '', 'Bez unosa'],
            ['E', 'Mesec', 'Mesec staža', ''],
            ['F', 'Dana', 'Dana staža', ''],
            ['G', 'Časova', 'Časovi rada', ''],
            ['H', 'Zarada/Doprinos', 'Zarada', ''],
            ['I', '(prazno)', '', 'Bez unosa'],
            ['J', 'Bolovanje časova', 'Sati bolovanja', ''],
            ['K', 'Bolovanje Naknade/Doprinos', 'Naknade', ''],
            ['L', '(prazno)', '', 'Bez unosa'],
            ['M', 'Beneficirani staž Mesec', 'Beneficirani meseci', ''],
            ['N', 'Beneficirani Dana', 'Beneficirani dani', ''],
            ['O', 'Beneficirani Šifra', 'Šifra beneficije', ''],
            ['P', 'Beneficirani Doprinos', 'Doprinos', '']
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(header), 'Uputstvo');
        const primer = [
            ['Godina', 'Obrazac', 'RBOUD/PIB', '', 'Mesec', 'Dana', 'Časova', 'Zarada/Doprinos', '', 'Bolovanje časova', 'Bolovanje Naknade/Doprinos', '', 'Beneficirani staž Mesec', 'Beneficirani Dana', 'Beneficirani Šifra', 'Beneficirani Doprinos'],
            [2020, 'M4', '', '', 12, 0, 160, 600000, '', 0, 0, '', 0, 0, '', ''],
            [2021, 'M4', '', '', 12, 0, 168, 650000, '', 0, 0, '', 0, 0, '', ''],
            [2022, 'M4', '', '', 12, 0, 168, 700000, '', 0, 0, '', 0, 0, '', ''],
            [2023, 'M8', '', '', 12, 0, 160, 750000, '', 0, 0, '', 4, 0, '1216', '']
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(primer), 'Podaci');
        XLSX.writeFile(wb, 'PIO_template.xlsx');
        showNotification('Template preuzet', 'success');
    }

    function dodajPlatu() {
        const g = parseInt(document.getElementById('novaGodina').value);
        const p = parseFloat(document.getElementById('novaPlata').value);
        if (g && p > 0) {
            M04.setProsecnaPlata(g, p);
            osveziTabeluPlata();
            document.getElementById('novaGodina').value = '';
            document.getElementById('novaPlata').value = '';
            showNotification('Plata sačuvana', 'success');
        } else {
            showNotification('Unesite godinu i platu', 'error');
        }
    }

    function resetujPlate() {
        M04.resetujBazu();
        osveziTabeluPlata();
        showNotification('Plate resetovane', 'success');
    }

    // ------------------------------------------------------------------------
    // Bootstrap
    // ------------------------------------------------------------------------

    function inicijalizuj() {
        korisnici = M02.ucitajSveKorisnike();

        const aktivniId = M02.getSetting('aktivniKorisnikId');
        if (aktivniId && korisnici[aktivniId]) {
            setAktivniKorisnik(aktivniId);
        }

        osveziListuKorisnika();
        osveziTabeluPlata();

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function () {
                switchTab(this.getAttribute('data-tab'));
            });
        });

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', function () {
                const isDark = document.body.getAttribute('data-theme') === 'dark';
                if (isDark) document.body.removeAttribute('data-theme');
                else document.body.setAttribute('data-theme', 'dark');
            });
        }

        const polSelect = document.getElementById('noviKorisnikPol');
        const decaGroup = document.getElementById('decaGroup');
        if (polSelect && decaGroup) {
            polSelect.addEventListener('change', function () {
                decaGroup.style.display = this.value === 'Ž' ? 'block' : 'none';
            });
        }

        const btnDodaj = document.getElementById('dodajKorisnika');
        if (btnDodaj) btnDodaj.addEventListener('click', dodajKorisnika);

        const btnExcel = document.getElementById('exportExcelBtn');
        if (btnExcel) btnExcel.addEventListener('click', exportExcel);
        const btnPDF = document.getElementById('exportPdfBtn');
        if (btnPDF) btnPDF.addEventListener('click', exportPDF);
        const btnPDFKompletni = document.getElementById('exportPdfKompletniBtn');
        if (btnPDFKompletni) btnPDFKompletni.addEventListener('click', exportPDFKompletni);

        const excelFile = document.getElementById('excelFile');
        if (excelFile) excelFile.addEventListener('change', handleExcelUpload);

        const btnObradi = document.getElementById('obradiExcel');
        if (btnObradi) btnObradi.addEventListener('click', processAndCalculate);

        const btnTemplate = document.getElementById('preuzmiTemplate');
        if (btnTemplate) btnTemplate.addEventListener('click', preuzmiTemplate);

        const btnDodajPlatu = document.getElementById('dodajPlatu');
        if (btnDodajPlatu) btnDodajPlatu.addEventListener('click', dodajPlatu);

        const btnResetujPlate = document.getElementById('resetujPlate');
        if (btnResetujPlate) btnResetujPlate.addEventListener('click', resetujPlate);

        const btnPredvidi = document.getElementById('predvidjanjeIzracunajBtn');
        if (btnPredvidi) btnPredvidi.addEventListener('click', predvidiDatumPenzije);
    }

    // ------------------------------------------------------------------------
    // Javni interfejs
    // ------------------------------------------------------------------------

    return {
        inicijalizuj,
        showNotification,
        switchTab,
        setAktivniKorisnik,
        izmeniKorisnika,
        obrisiKorisnika,
        dodajKorisnika,
        exportExcel,
        exportPDF,
        exportPDFKompletni,
        izmeniPlatu,
        obrisiPlatu,
        osveziPrikazRezultata,
        handleExcelUpload,
        processAndCalculate,
        preuzmiTemplate,
        dodajPlatu,
        resetujPlate,
        predvidiDatumPenzije,
        getAktivniKorisnikId: () => aktivniKorisnikId,
        getKorisnici: () => korisnici,
        dodajDaneStaza,
        proveriUslovePenzije,
        simulirajStazZaBuduciDatum,
        exportBackup,
        importBackup
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M12;
}
