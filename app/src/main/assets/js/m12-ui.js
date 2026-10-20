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
            btnExportP.addEventListener('click', exportPDF);
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
    // Prikaz rezultata
    // ------------------------------------------------------------------------

    function osveziPrikazRezultata() {
        if (!aktivniKorisnikId) return;
        const k = korisnici[aktivniKorisnikId];
        if (!k) return;

        const rezultat = M10.evaluiraj(k, new Date());

        // Nađi prvu ispunjenu opciju, ili prvu buduću opciju
        let opcija = rezultat.opcije.find(o => o.ispunjeno);
        if (!opcija) {
            const buduca = pronadjiBuducuOpciju(k);
            if (buduca) {
                opcija = buduca.opcija;
            }
        }

        const elMesecno = document.getElementById('penzijaMesecnoDisplay');
        const elGodisnje = document.getElementById('penzijaGodisnjeDisplay');
        if (elMesecno) elMesecno.textContent = M01.formatCurrency(opcija ? opcija.iznos : 0);
        if (elGodisnje) elGodisnje.textContent = M01.formatCurrency((opcija ? opcija.iznos : 0) * 12) + ' godišnje';

        const elLicni = document.getElementById('licniKoefDisplay');
        if (elLicni) elLicni.textContent = rezultat.lk.toFixed(4);
        const elBol = document.getElementById('koefBolDisplay');
        if (elBol) elBol.textContent = rezultat.koefBolovanja.toFixed(4);
        const elPenzStaz = document.getElementById('penzijskiStazDisplay');
        if (elPenzStaz) elPenzStaz.textContent = M01.formatGodine(rezultat.staz.stazZaBodoveGodine);
        const elEfStaz = document.getElementById('efektivniStazDisplay');
        if (elEfStaz) elEfStaz.textContent = (rezultat.staz.efektivniDani / 360).toFixed(2) + ' godina';
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
        if (elUslovEf) elUslovEf.textContent = rezultat.uslovi.efektivniGodine.toFixed(2) + ' god';
        const elUslovBen = document.getElementById('uslovBenefPreDisplay');
        if (elUslovBen) elUslovBen.textContent = rezultat.uslovi.beneficiraniGodine.toFixed(2) + ' god';
        const elUslovMin = document.getElementById('uslovPotrebanDisplay');
        if (elUslovMin) elUslovMin.textContent = rezultat.uslovi.zahtevaniMinimumGodine.toFixed(2) + ' god';
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

        osveziTabeluBolovanja(rezultat.koefBolovanjaDetalji);
        osveziOpcijePenzionisanja(rezultat.opcije);
    }

    // ------------------------------------------------------------------------
    // Pomoćna: pronađi prvu buduću opciju (za prikaz rezultata)
    // ------------------------------------------------------------------------

    function pronadjiBuducuOpciju(k) {
        if (!k.datumRodjenja) return null;

        let pocetniDatum;
        if (k.datumPoslednjegStaza) {
            const dps = new Date(k.datumPoslednjegStaza);
            if (!isNaN(dps.getTime())) {
                pocetniDatum = new Date(dps);
                pocetniDatum.setDate(pocetniDatum.getDate() + 1);
            }
        }
        if (!pocetniDatum) {
            pocetniDatum = new Date();
            pocetniDatum.setHours(0, 0, 0, 0);
        }
        pocetniDatum.setHours(0, 0, 0, 0);

        const MAKSIMALNO_DANA = 40 * 365;
        for (let d = 0; d <= MAKSIMALNO_DANA; d++) {
            const buduciDatum = new Date(pocetniDatum);
            buduciDatum.setDate(buduciDatum.getDate() + d);

            const kSimuliran = Object.assign({}, k, {
                staz: simulirajStazZaBuduciDatum(k, buduciDatum)
            });

            const rez = M10.evaluiraj(kSimuliran, buduciDatum);
            const ispunjena = rez.opcije.find(o => o.ispunjeno);
            if (ispunjena) {
                return { opcija: ispunjena, datum: buduciDatum };
            }
        }
        return null;
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
    // Export
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
            if (window.AndroidDB && window.AndroidDB.shareExcel) {
                window.AndroidDB.shareExcel(base64, fileName);
            } else {
                const link = document.createElement('a');
                link.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64;
                link.download = fileName;
                link.click();
            }
            showNotification('Excel izveštaj generisan', 'success');
        } catch (e) {
            showNotification('Greška: ' + e.message, 'error');
        }
    }

    async function exportPDF() {
        if (!aktivniKorisnikId) {
            showNotification('Izaberite korisnika', 'error');
            return;
        }
        const k = korisnici[aktivniKorisnikId];
        const rezultat = M10.evaluiraj(k, new Date());
        showNotification('Generišem PDF...', 'info');
        try {
            const { base64, fileName } = await M11.generisiPDF(k, rezultat);
            if (window.AndroidDB && window.AndroidDB.sharePDF) {
                window.AndroidDB.sharePDF(base64, fileName);
            } else {
                const link = document.createElement('a');
                link.href = 'data:application/pdf;base64,' + base64;
                link.download = fileName;
                link.click();
            }
            showNotification('PDF generisan', 'success');
        } catch (e) {
            showNotification('Greška: ' + e.message, 'error');
        }
    }

    // ------------------------------------------------------------------------
    // Predviđanje datuma penzije
    // ------------------------------------------------------------------------

    function simulirajStazZaBuduciDatum(k, buduciDatum) {
        const staz = JSON.parse(JSON.stringify(k.staz || []));
        if (!staz.length) return staz;

        if (!k.datumPoslednjegStaza) return staz;

        const datumPoslednjeg = new Date(k.datumPoslednjegStaza);
        if (isNaN(datumPoslednjeg.getTime())) return staz;
        datumPoslednjeg.setHours(0, 0, 0, 0);

        const buduci = new Date(buduciDatum);
        buduci.setHours(0, 0, 0, 0);

        if (buduci <= datumPoslednjeg) return staz;

        const poslednjaGodina = Math.max(...staz.map(s => s.godina));
        const poslednjiUnos = staz.find(s => s.godina === poslednjaGodina);
        const tipBeneficije = poslednjiUnos ? poslednjiUnos.tipBeneficiranja : '1212';

        const godinaBuduce = buduci.getFullYear();
        const mesecBuduce = buduci.getMonth() + 1;

        for (let g = poslednjaGodina + 1; g <= godinaBuduce; g++) {
            let meseci;
            if (g === godinaBuduce) {
                meseci = mesecBuduce;
            } else {
                meseci = 12;
            }
            staz.push({
                godina: g,
                efektivniMeseci: meseci,
                efektivniDani: 0,
                beneficiraniMeseci: meseci,
                beneficiraniDani: 0,
                tipBeneficiranja: tipBeneficije
            });
        }

        return staz;
    }

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

        let pocetniDatum;
        if (k.datumPoslednjegStaza) {
            const dps = new Date(k.datumPoslednjegStaza);
            if (!isNaN(dps.getTime())) {
                pocetniDatum = new Date(dps);
                pocetniDatum.setDate(pocetniDatum.getDate() + 1);
            }
        }
        if (!pocetniDatum) {
            pocetniDatum = new Date();
            pocetniDatum.setHours(0, 0, 0, 0);
        }
        pocetniDatum.setHours(0, 0, 0, 0);

        const MAKSIMALNO_DANA = 40 * 365;
        let prviDatumBezPenala = null;
        let prvaOpcijaBezPenala = null;
        let prviDatumSaPenalima = null;
        let prvaOpcijaSaPenalima = null;
        const sveOpcije = [];

        for (let d = 0; d <= MAKSIMALNO_DANA; d++) {
            const buduciDatum = new Date(pocetniDatum);
            buduciDatum.setDate(buduciDatum.getDate() + d);

            const kSimuliran = Object.assign({}, k, {
                staz: simulirajStazZaBuduciDatum(k, buduciDatum)
            });

            const rez = M10.evaluiraj(kSimuliran, buduciDatum);

            for (const o of rez.opcije) {
                if (!o.ispunjeno) continue;

                const vecPronadjena = sveOpcije.find(x => x.id === o.id);
                if (vecPronadjena) continue;

                sveOpcije.push({
                    id: o.id,
                    naziv: o.naziv,
                    datum: new Date(buduciDatum),
                    iznos: o.iznos,
                    penal: o.detalji && o.detalji.penal ? o.detalji.penal : 0,
                    godineZivota: rez.godineZivota,
                    puneGodine: rez.puneGodine,
                    stazGodine: (rez.staz.efektivniDani / 360),
                    ukupnoStaz: (rez.staz.ukupnoOsiguranjeDani / 360)
                });

                const jeBezPenala = (o.id === 'OP-01' || o.id === 'OP-02' || o.id === 'OP-03' || o.id === 'OP-06');
                if (jeBezPenala) {
                    if (!prviDatumBezPenala) {
                        prviDatumBezPenala = new Date(buduciDatum);
                        prvaOpcijaBezPenala = o;
                    }
                } else {
                    if (!prviDatumSaPenalima) {
                        prviDatumSaPenalima = new Date(buduciDatum);
                        prvaOpcijaSaPenalima = o;
                    }
                }
            }

            if (sveOpcije.length >= 6) break;
            if (d > 0 && d % 365 === 0) {
                if (prviDatumBezPenala && prviDatumSaPenalima && d > 365 * 5) break;
            }
        }

        const elDatum = document.getElementById('predvidjanjePredvidjeniDatum');
        const elUslov = document.getElementById('predvidjanjePredvidjeniUslov');
        const elRez = document.getElementById('predvidjanjeRezultati');
        const elGrid = document.getElementById('predvidjanjeDetaljiGrid');

        // Glavni prikaz — prvi datum BEZ umanjenja
        if (prviDatumBezPenala) {
            if (elDatum) elDatum.textContent = M01.formatDate(prviDatumBezPenala);
            if (elUslov) elUslov.textContent = prvaOpcijaBezPenala.naziv + ' (bez umanjenja)';
            if (elRez) elRez.style.display = 'block';
        } else if (prviDatumSaPenalima) {
            if (elDatum) elDatum.textContent = M01.formatDate(prviDatumSaPenalima);
            if (elUslov) elUslov.textContent = prvaOpcijaSaPenalima.naziv + ' (sa umanjenjem)';
            if (elRez) elRez.style.display = 'block';
        } else {
            if (elDatum) elDatum.textContent = 'Nije moguće u narednih 40 godina';
            if (elUslov) elUslov.textContent = 'Nijedna opcija se ne stiče u razumnom periodu';
            if (elRez) elRez.style.display = 'block';
        }

        // Detalji
        if (elGrid) {
            elGrid.innerHTML = '';

            const rezultatPocetak = M10.evaluiraj(k, pocetniDatum);

            const d1 = el('div', 'detail-item');
            d1.appendChild(el('div', 'label', '🎂 Datum rođenja'));
            d1.appendChild(el('div', 'value', k.datumRodjenja));
            elGrid.appendChild(d1);

            const d2 = el('div', 'detail-item');
            d2.appendChild(el('div', 'label', '📅 Početak simulacije'));
            d2.appendChild(el('div', 'value', M01.formatDate(pocetniDatum)));
            elGrid.appendChild(d2);

            const d3 = el('div', 'detail-item');
            d3.appendChild(el('div', 'label', '📅 Pune godine (na početku)'));
            d3.appendChild(el('div', 'value', rezultatPocetak.puneGodine));
            elGrid.appendChild(d3);

            const d4 = el('div', 'detail-item');
            d4.appendChild(el('div', 'label', '📊 Efektivni staž (na početku)'));
            d4.appendChild(el('div', 'value', (rezultatPocetak.staz.efektivniDani / 360).toFixed(2) + ' god'));
            elGrid.appendChild(d4);

            const d5 = el('div', 'detail-item');
            d5.appendChild(el('div', 'label', '📋 Uslov 2/3'));
            d5.appendChild(el('div', 'value', rezultatPocetak.uslovi.status));
            elGrid.appendChild(d5);

            // Opcija sa umanjenjem — samo ako je RANIJI od datuma bez umanjenja
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
                if (prvaOpcijaSaPenalima.detalji && prvaOpcijaSaPenalima.detalji.penal) {
                    tekst += ' (umanjenje: ' + prvaOpcijaSaPenalima.detalji.penal.toFixed(2) + '%)';
                }
                opcijaDiv.appendChild(document.createTextNode(tekst));

                elGrid.appendChild(opcijaDiv);
            }
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

            // Prikaži greške iz M03 (ako ih ima)
            if (rezultat.greske.length > 0) {
                const prveGreske = rezultat.greske.slice(0, 3).join('; ');
                showNotification(
                    'Greške pri uvozu (' + rezultat.greske.length + '): ' + prveGreske,
                    'error'
                );
            }

            // Izračunaj penziju — koristi buduću opciju ako nijedna nije ispunjena
            const rez = M10.evaluiraj(k, new Date());
            let opcija = rez.opcije.find(o => o.ispunjeno);
            if (!opcija) {
                const buduca = pronadjiBuducuOpciju(k);
                if (buduca) opcija = buduca.opcija;
            }
            k.penzijaMesecno = opcija ? opcija.iznos : 0;
            k.penzijaGodisnja = k.penzijaMesecno * 12;
            M02.sacuvajKorisnika(k);

            osveziListuKorisnika();
            osveziPrikazRezultata();
            switchTab('calculation');

            if (rezultat.greske.length === 0) {
                showNotification('Penzija: ' + M01.formatCurrency(k.penzijaMesecno), 'success');
            } else {
                showNotification('Penzija izračunata sa upozorenjima: ' + M01.formatCurrency(k.penzijaMesecno), 'info');
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
        getKorisnici: () => korisnici
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M12;
}
