// ============================================================================
// M11 — GENERATOR IZVEŠTAJA (PDF i Excel)
// Odgovornost: Generisanje PDF i Excel izveštaja na osnovu rezultata M10.
//   - generisiPDF(korisnik, rezultat)          → skraćeni PDF (1 strana)
//   - generisiPDFKompletni(korisnik, rezultat) → kompletan PDF (7 strana)
//   - generisiExcel(korisnik, rezultat)        → Excel sa 4 lista
// Napomena:
//   - M11 NE zavisi od M12 (UI). Koristi M10.sticanjeSvihOpcija i
//     M06.simulirajStazZaBuduciDatum direktno.
// ============================================================================

const M11 = (function () {

    // ------------------------------------------------------------------------
    // Pomoćna: escape HTML karaktera
    // ------------------------------------------------------------------------

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ------------------------------------------------------------------------
    // Pomoćna: GMD format iz broja dana
    // ------------------------------------------------------------------------

    function formatDaniGMD(dani) {
        if (typeof M01 !== 'undefined' && M01.formatDaniUGMD) {
            return M01.formatDaniUGMD(dani);
        }
        const g = Math.floor(dani / 360);
        const m = Math.floor((dani % 360) / 30);
        const d = Math.round((dani % 360) % 30);
        return g + ' god ' + m + ' mes ' + d + ' dana';
    }

    // ------------------------------------------------------------------------
    // Pomoćna: stilovi
    // ------------------------------------------------------------------------

    function stilStrane() {
        return 'width:750px;padding:20px;background:white;font-family:\'Segoe UI\',Tahoma,sans-serif;color:#333;';
    }

    function stilTabele() {
        return 'width:100%;border-collapse:collapse;margin:12px 0;font-size:11px;';
    }

    function stilTh() {
        return 'padding:6px;border:1px solid #ccc;background:#e8eef5;text-align:left;font-weight:600;color:#2c3e50;';
    }

    function stilTd() {
        return 'padding:5px;border:1px solid #ddd;';
    }

    function stilTdDesno() {
        return 'padding:5px;border:1px solid #ddd;text-align:right;';
    }

    function stilNaslov() {
        return 'color:#2c3e50;margin:0 0 12px 0;font-size:16px;border-bottom:2px solid #3498db;padding-bottom:6px;';
    }

    function stilPodnaslov() {
        return 'color:#2c3e50;margin:14px 0 8px 0;font-size:13px;';
    }

    function stilKljucVrednost() {
        return 'width:100%;border-collapse:collapse;margin:8px 0;font-size:11px;';
    }

    // ------------------------------------------------------------------------
    // Naziv opcije
    // ------------------------------------------------------------------------

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
    // Nezavisno pronalaženje relevantnih opcija
    // ------------------------------------------------------------------------
    // Vraća { prvaBezUmanjenja, prvaSaUmanjenjem } — svaka sa { id, naziv, datum }
    // ili null. Nezavisno po opciji, preko M10.sticanjeSvihOpcija.
    // ------------------------------------------------------------------------

    function pronadjiRelevantneOpcije(k, rezultat) {
        if (!k.datumRodjenja || !k.datumPoslednjegStaza) {
            return { prvaBezUmanjenja: null, prvaSaUmanjenjem: null };
        }

        const sticanje = M10.sticanjeSvihOpcija(k, null, { maxDana: 50 * 366 });

        // Najraniji datum BEZ umanjenja (OP-01/02/03)
        let prvaBez = null;
        ['OP-01', 'OP-02', 'OP-03'].forEach(id => {
            const s = sticanje[id];
            if (s && s.datum && s.opcija) {
                if (!prvaBez || s.datum < prvaBez.datum) {
                    prvaBez = {
                        id: id,
                        naziv: nazivOpcije(id),
                        datum: s.datum,
                        opcija: s.opcija
                    };
                }
            }
        });

        // Najraniji datum SA umanjenjem (OP-04/05)
        let prvaSa = null;
        ['OP-04', 'OP-05'].forEach(id => {
            const s = sticanje[id];
            if (s && s.datum && s.opcija) {
                if (!prvaSa || s.datum < prvaSa.datum) {
                    prvaSa = {
                        id: id,
                        naziv: nazivOpcije(id),
                        datum: s.datum,
                        opcija: s.opcija
                    };
                }
            }
        });

        return { prvaBezUmanjenja: prvaBez, prvaSaUmanjenjem: prvaSa };
    }

    // ------------------------------------------------------------------------
    // Sastavljanje liste relevantnih opcija za prikaz
    // ------------------------------------------------------------------------
    // Vraća niz opcija (najviše 2): prva bez umanjenja + prva sa umanjenjem
    // (ako je ranija od prve bez). Ako nijedna nije ispunjena danas, koristi
    // buduće datume iz sticanja.
    // ------------------------------------------------------------------------

    function sastaviRelevantneOpcijeZaPrikaz(k, rezultat) {
        const relevantne = pronadjiRelevantneOpcije(k, rezultat);
        const lista = [];

        // Trenutno ispunjene opcije (na današnji datum)
        const prvaBezDanas = rezultat.opcije.find(o =>
            o.ispunjeno && ['OP-01', 'OP-02', 'OP-03'].includes(o.id)
        );
        const prvaSaDanas = rezultat.opcije.find(o =>
            o.ispunjeno && ['OP-04', 'OP-05'].includes(o.id)
        );

        if (prvaBezDanas) {
            lista.push(prvaBezDanas);
        } else if (relevantne.prvaBezUmanjenja) {
            lista.push({
                id: relevantne.prvaBezUmanjenja.id,
                naziv: relevantne.prvaBezUmanjenja.naziv,
                ispunjeno: false,
                status: '⏳ NA ČEKANJU',
                iznos: 0,
                detalji: {
                    napomena: 'Prvi datum: ' + M01.formatDate(relevantne.prvaBezUmanjenja.datum)
                }
            });
        }

        // Dodaj prvu sa umanjenjem ako je ranija od prve bez (ili ako nema bez)
        if (prvaSaDanas) {
            const ranijeOdBez = !relevantne.prvaBezUmanjenja
                || relevantne.prvaSaUmanjenjem.datum < relevantne.prvaBezUmanjenja.datum;
            if (ranijeOdBez) {
                lista.push(prvaSaDanas);
            }
        } else if (relevantne.prvaSaUmanjenjem) {
            const ranijeOdBez = !relevantne.prvaBezUmanjenja
                || relevantne.prvaSaUmanjenjem.datum < relevantne.prvaBezUmanjenja.datum;
            if (ranijeOdBez && lista.length === 0) {
                lista.push({
                    id: relevantne.prvaSaUmanjenjem.id,
                    naziv: relevantne.prvaSaUmanjenjem.naziv,
                    ispunjeno: false,
                    status: '⏳ NA ČEKANJU',
                    iznos: 0,
                    detalji: {
                        napomena: 'Prvi datum: ' + M01.formatDate(relevantne.prvaSaUmanjenjem.datum)
                    }
                });
            }
        }

        return lista;
    }

    // ------------------------------------------------------------------------
    // Excel izveštaj
    // ------------------------------------------------------------------------

    function generisiExcel(korisnik, rezultat) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX biblioteka nije učitana');
        }
        if (!korisnik || !rezultat) {
            throw new Error('Nedostaju podaci za izveštaj');
        }

        const wb = XLSX.utils.book_new();

        const osn = [
            ['KOMPLETAN IZVEŠTAJ O PENZIJI'],
            [],
            ['Korisnik:', korisnik.ime],
            ['Pol:', korisnik.pol === 'Ž' ? 'Ženski' : 'Muški'],
            ['Datum rođenja:', korisnik.datumRodjenja || 'nije unet'],
            ['Broj dece:', korisnik.brojDece || 0],
            ['Kategorija:', korisnik.kategorija || 'NE'],
            ['Datum poslednjeg staža:', korisnik.datumPoslednjegStaza || 'nije unet'],
            [],
            ['REZULTATI OBRAČUNA'],
            ['Lični koeficijent (LK):', rezultat.lk.toFixed(4)],
            ['Koeficijent bolovanja:', rezultat.koefBolovanja.toFixed(4)],
            ['Efektivni staž:', formatDaniGMD(rezultat.staz.efektivniDani)],
            ['Beneficirani staž:', formatDaniGMD(rezultat.staz.beneficiraniDani)],
            ['Uvećani staž:', formatDaniGMD(rezultat.staz.uvecaniDani)],
            ['Ukupan staž osiguranja:', formatDaniGMD(rezultat.staz.ukupnoOsiguranjeDani)],
            ['Staž za obračun bodova:', rezultat.staz.stazZaBodoveGodine.toFixed(2) + ' god'],
            ['Dodatak za decu:', rezultat.staz.decaDodatakGodine.toFixed(2) + ' god'],
            [],
            ['USLOV 2/3'],
            ['Status:', rezultat.uslovi.status],
            ['Procenat 2/3:', rezultat.uslovi.procenat23.toFixed(2) + '%'],
            ['Priznaje se beneficija:', rezultat.uslovi.priznajeSeBeneficija ? 'DA' : 'NE'],
            [],
            ['STAROSNE GRANICE'],
            ['Opšta granica:', rezultat.granice.opstaGranica.toFixed(2)],
            ['Snižena granica:', rezultat.granice.snizenaGranica.toFixed(2)],
            ['Sniženje (god):', rezultat.granice.snizenjeGodina],
            ['Donji limit:', rezultat.granice.donjiLimit],
            [],
            ['OPCIJE PENZIONISANJA'],
            ['ID', 'Naziv', 'Status', 'Iznos (RSD)', 'Penal (%)', 'Meseca ranije']
        ];

        rezultat.opcije.forEach(o => {
            osn.push([
                o.id,
                o.naziv,
                o.status,
                o.iznos,
                (o.detalji && o.detalji.penal) ? o.detalji.penal : 0,
                (o.detalji && o.detalji.meseciRanije) ? o.detalji.meseciRanije : 0
            ]);
        });

        // Nezavisno sticanje po opciji
        osn.push([]);
        osn.push(['NEZAVISNO STICANJE PO OPCIJI']);
        osn.push(['ID', 'Naziv', 'Prvi datum sticanja']);
        const sticanje = M10.sticanjeSvihOpcija(korisnik, null, { maxDana: 50 * 366 });
        ['OP-01', 'OP-02', 'OP-03', 'OP-04', 'OP-05'].forEach(id => {
            const s = sticanje[id];
            osn.push([
                id,
                nazivOpcije(id),
                (s && s.datum) ? M01.formatDate(s.datum) : '—'
            ]);
        });

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(osn), 'Osnovno');

        if (korisnik.zarade && korisnik.zarade.length) {
            const zarade = [['Godina', 'Lična zarada', 'Prosečna plata', 'GLK', 'Sati rada', 'Sati bolovanja']];
            korisnik.zarade.forEach(z => {
                const glk = z.prosecnaPlata > 0 ? z.licnaZarada / z.prosecnaPlata : 0;
                zarade.push([
                    z.godina,
                    z.licnaZarada,
                    z.prosecnaPlata,
                    glk.toFixed(4),
                    z.satiRada || 0,
                    z.satiBolovanje || 0
                ]);
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zarade), 'Zarade');
        }

        if (korisnik.staz && korisnik.staz.length) {
            const stazPodaci = [['Godina', 'Ef. meseci', 'Ef. dani', 'Benef. meseci', 'Benef. dani', 'Tip']];
            korisnik.staz.forEach(s => {
                stazPodaci.push([
                    s.godina,
                    s.efektivniMeseci || 0,
                    s.efektivniDani || 0,
                    s.beneficiraniMeseci || 0,
                    s.beneficiraniDani || 0,
                    s.tipBeneficiranja || '1212'
                ]);
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stazPodaci), 'Staž');
        }

        const opcijeList = [['ID', 'Naziv', 'Ispunjeno', 'Iznos (RSD)', 'Penal (%)', 'Meseca ranije', 'Detalji']];
        rezultat.opcije.forEach(o => {
            opcijeList.push([
                o.id,
                o.naziv,
                o.ispunjeno ? 'DA' : 'NE',
                o.iznos,
                (o.detalji && o.detalji.penal) ? o.detalji.penal : 0,
                (o.detalji && o.detalji.meseciRanije) ? o.detalji.meseciRanije : 0,
                JSON.stringify(o.detalji)
            ]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(opcijeList), 'Opcije');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const fileName = 'penzija-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '.xlsx';

        return { base64: wbout, fileName };
    }

    // ------------------------------------------------------------------------
    // Pomoćna: HTML strana → PDF strana (html2canvas)
    // ------------------------------------------------------------------------

    async function htmlStranaUcanvas(html, pdf, jePrva) {
        const div = document.createElement('div');
        div.style.cssText = stilStrane();
        div.innerHTML = html;
        document.body.appendChild(div);

        try {
            const canvas = await html2canvas(div, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });
            const imgData = canvas.toDataURL('image/png');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth - 20;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            if (!jePrva) {
                pdf.addPage();
            }

            let finalImgWidth = imgWidth;
            let finalImgHeight = imgHeight;
            if (imgHeight > pageHeight - 20) {
                const scale = (pageHeight - 20) / imgHeight;
                finalImgWidth = imgWidth * scale;
                finalImgHeight = pageHeight - 20;
            }

            const x = (pageWidth - finalImgWidth) / 2;
            pdf.addImage(imgData, 'PNG', x, 10, finalImgWidth, finalImgHeight);
        } finally {
            document.body.removeChild(div);
        }
    }

    // ------------------------------------------------------------------------
    // SKRAĆENI PDF (1 strana)
    // ------------------------------------------------------------------------

    async function generisiPDF(korisnik, rezultat) {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            throw new Error('jsPDF biblioteka nije učitana');
        }
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas biblioteka nije učitana');
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        let html = '<h1 style="color:#2c3e50;margin-bottom:16px;">Penzioni izveštaj</h1>';
        html += '<p><b>Korisnik:</b> ' + escapeHtml(korisnik.ime || '') + '</p>';
        html += '<p><b>Pol:</b> ' + (korisnik.pol === 'Ž' ? 'Ženski' : 'Muški') + '</p>';
        html += '<p><b>Datum rođenja:</b> ' + escapeHtml(korisnik.datumRodjenja || 'nije unet') + '</p>';
        if (korisnik.pol === 'Ž' && korisnik.brojDece > 0) {
            html += '<p><b>Broj dece:</b> ' + korisnik.brojDece + '</p>';
        }
        if (korisnik.kategorija && korisnik.kategorija !== 'NE') {
            html += '<p><b>Kategorija:</b> ' + escapeHtml(korisnik.kategorija) + '</p>';
        }
        html += '<hr style="margin:16px 0;">';

        html += '<h2 style="color:#2c3e50;">Rezultati obračuna</h2>';
        html += '<table style="' + stilKljucVrednost() + '">';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Lični koeficijent</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.lk.toFixed(4) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Efektivni staž</b></td><td style="padding:6px;border:1px solid #ddd;">' + formatDaniGMD(rezultat.staz.efektivniDani) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Ukupan staž osiguranja</b></td><td style="padding:6px;border:1px solid #ddd;">' + formatDaniGMD(rezultat.staz.ukupnoOsiguranjeDani) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Staž za obračun bodova</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.staz.stazZaBodoveGodine.toFixed(2) + ' god</td></tr>';

        const uslov23Boja = rezultat.uslovi.uslov23Ispunjen ? '#27ae60' : '#e74c3c';
        const uslov23Status = rezultat.uslovi.uslov23Ispunjen ? '✅ ISPUNJEN' : '🔴 NIJE ISPUNJEN';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Uslov 2/3</b></td><td style="padding:6px;border:1px solid #ddd;color:' + uslov23Boja + ';font-weight:bold;">' + uslov23Status + ' (' + rezultat.uslovi.procenat23.toFixed(2) + '%)</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Opšta granica</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.granice.opstaGranica.toFixed(2) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Snižena granica</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.granice.snizenaGranica.toFixed(2) + '</td></tr>';
        html += '</table>';

        // Relevantne opcije
        html += '<h2 style="color:#2c3e50;">Relevantne opcije penzionisanja</h2>';
        const relevantneOpcije = sastaviRelevantneOpcijeZaPrikaz(korisnik, rezultat);

        if (relevantneOpcije.length > 0) {
            html += '<table style="' + stilTabele() + '">';
            html += '<tr>';
            html += '<th style="' + stilTh() + '">Opcija</th>';
            html += '<th style="' + stilTh() + '">Status</th>';
            html += '<th style="' + stilTh() + 'text-align:right;">Iznos</th>';
            html += '<th style="' + stilTh() + 'text-align:right;">Penal</th>';
            html += '</tr>';
            relevantneOpcije.forEach(o => {
                const penalStr = (o.detalji && o.detalji.penal > 0)
                    ? o.detalji.penal.toFixed(2) + '%'
                    : '—';
                const iznosStr = o.ispunjeno ? M01.formatCurrency(o.iznos) : '—';
                const napomena = (o.detalji && o.detalji.napomena) ? o.detalji.napomena : '';
                html += '<tr>';
                html += '<td style="' + stilTd() + '">' + escapeHtml(o.naziv) + (napomena ? '<br><small style="color:#888;">' + escapeHtml(napomena) + '</small>' : '') + '</td>';
                html += '<td style="' + stilTd() + '">' + escapeHtml(o.status) + '</td>';
                html += '<td style="' + stilTdDesno() + '">' + iznosStr + '</td>';
                html += '<td style="' + stilTdDesno() + '">' + penalStr + '</td>';
                html += '</tr>';
            });
            html += '</table>';
        } else {
            html += '<p style="font-size:11px;color:#666;">Nema relevantnih opcija.</p>';
        }

        html += '<p style="font-size:0.8rem;color:#888;margin-top:16px;">Napomena: Rezultati su informativnog karaktera i ne mogu zameniti stručnu službu PIO.</p>';

        await htmlStranaUcanvas(html, pdf, true);

        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = 'penzija-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '-skraceni.pdf';

        return { base64: pdfBase64, fileName };
    }

    // ------------------------------------------------------------------------
    // KOMPLETAN PDF (7 strana)
    // ------------------------------------------------------------------------

    async function generisiPDFKompletni(korisnik, rezultat) {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            throw new Error('jsPDF biblioteka nije učitana');
        }
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas biblioteka nije učitana');
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        // =====================================================================
        // STRANA 1 — Osnovni podaci + Rezultati obračuna + Uslov 2/3
        // =====================================================================
        let html1 = '<h1 style="' + stilNaslov() + '">Penzioni izveštaj — Osnovni podaci</h1>';

        html1 += '<h3 style="' + stilPodnaslov() + '">Korisnik</h3>';
        html1 += '<table style="' + stilKljucVrednost() + '">';
        html1 += '<tr><td style="' + stilTd() + ';width:40%;"><b>Ime i prezime</b></td><td style="' + stilTd() + '">' + escapeHtml(korisnik.ime || '—') + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Pol</b></td><td style="' + stilTd() + '">' + (korisnik.pol === 'Ž' ? 'Ženski' : 'Muški') + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Datum rođenja</b></td><td style="' + stilTd() + '">' + escapeHtml(korisnik.datumRodjenja || '—') + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Broj dece</b></td><td style="' + stilTd() + '">' + (korisnik.pol === 'Ž' ? (korisnik.brojDece || 0) : 0) + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Kategorija</b></td><td style="' + stilTd() + '">' + escapeHtml(korisnik.kategorija || 'NE') + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Datum poslednjeg staža</b></td><td style="' + stilTd() + '">' + escapeHtml(korisnik.datumPoslednjegStaza || '—') + '</td></tr>';
        html1 += '</table>';

        html1 += '<h3 style="' + stilPodnaslov() + '">Rezultati obračuna</h3>';
        html1 += '<table style="' + stilKljucVrednost() + '">';
        html1 += '<tr><td style="' + stilTd() + ';width:40%;"><b>Lični koeficijent (LK)</b></td><td style="' + stilTd() + '">' + rezultat.lk.toFixed(4) + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Koeficijent bolovanja</b></td><td style="' + stilTd() + '">' + rezultat.koefBolovanja.toFixed(4) + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Efektivni staž</b></td><td style="' + stilTd() + '">' + formatDaniGMD(rezultat.staz.efektivniDani) + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Beneficirani staž</b></td><td style="' + stilTd() + '">' + formatDaniGMD(rezultat.staz.beneficiraniDani) + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Uvećani staž (beneficija)</b></td><td style="' + stilTd() + '">' + formatDaniGMD(rezultat.staz.uvecaniDani) + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Ukupan staž osiguranja</b></td><td style="' + stilTd() + '">' + formatDaniGMD(rezultat.staz.ukupnoOsiguranjeDani) + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Staž za obračun bodova</b></td><td style="' + stilTd() + '">' + rezultat.staz.stazZaBodoveGodine.toFixed(2) + ' god</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Dodatak za decu</b></td><td style="' + stilTd() + '">' + rezultat.staz.decaDodatakGodine.toFixed(2) + ' god</td></tr>';
        html1 += '</table>';

        html1 += '<h3 style="' + stilPodnaslov() + '">Uslov 2/3 i starosne granice</h3>';
        html1 += '<table style="' + stilKljucVrednost() + '">';
        const uslov23Boja = rezultat.uslovi.uslov23Ispunjen ? '#27ae60' : '#e74c3c';
        const uslov23Status = rezultat.uslovi.uslov23Ispunjen ? '✅ ISPUNJEN' : '🔴 NIJE ISPUNJEN';
        html1 += '<tr><td style="' + stilTd() + ';width:40%;"><b>Uslov 2/3</b></td><td style="' + stilTd() + 'color:' + uslov23Boja + ';font-weight:bold;">' + uslov23Status + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Procenat 2/3</b></td><td style="' + stilTd() + '">' + rezultat.uslovi.procenat23.toFixed(2) + '%</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Priznaje se beneficija</b></td><td style="' + stilTd() + '">' + (rezultat.uslovi.priznajeSeBeneficija ? 'DA' : 'NE') + '</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Opšta granica</b></td><td style="' + stilTd() + '">' + rezultat.granice.opstaGranica.toFixed(2) + ' god</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Snižena granica</b></td><td style="' + stilTd() + '">' + rezultat.granice.snizenaGranica.toFixed(2) + ' god</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Sniženje</b></td><td style="' + stilTd() + '">' + rezultat.granice.snizenjeGodina + ' god</td></tr>';
        html1 += '<tr><td style="' + stilTd() + '"><b>Donji limit</b></td><td style="' + stilTd() + '">' + rezultat.granice.donjiLimit + ' god</td></tr>';
        html1 += '</table>';

        await htmlStranaUcanvas(html1, pdf, true);

        // =====================================================================
        // STRANA 2 — Nezavisno sticanje po opciji
        // =====================================================================
        let html2 = '<h1 style="' + stilNaslov() + '">Penzioni izveštaj — Nezavisno sticanje po opciji</h1>';

        const sticanje = M10.sticanjeSvihOpcija(korisnik, null, { maxDana: 50 * 366 });

        // Primarni datum
        let najranijiBez = null;
        ['OP-01', 'OP-02', 'OP-03'].forEach(id => {
            const s = sticanje[id];
            if (s && s.datum && s.opcija) {
                if (!najranijiBez || s.datum < najranijiBez.datum) {
                    najranijiBez = { id, datum: s.datum, opcija: s.opcija };
                }
            }
        });
        let najranijiSa = null;
        ['OP-04', 'OP-05'].forEach(id => {
            const s = sticanje[id];
            if (s && s.datum && s.opcija) {
                if (!najranijiSa || s.datum < najranijiSa.datum) {
                    najranijiSa = { id, datum: s.datum, opcija: s.opcija };
                }
            }
        });

        if (najranijiBez) {
            const jeProslo = najranijiBez.datum <= new Date();
            html2 += '<div style="padding:16px;background:#e8f5e9;border-left:4px solid #27ae60;border-radius:6px;margin:16px 0;">';
            html2 += '<h3 style="margin:0 0 8px 0;color:#27ae60;font-size:14px;">' + (jeProslo ? '✅ Uslov je već ispunjen' : '📅 Prvi datum bez umanjenja') + '</h3>';
            html2 += '<div style="font-size:24px;font-weight:bold;color:#2c3e50;margin:8px 0;">' + M01.formatDate(najranijiBez.datum) + '</div>';
            html2 += '<div style="font-size:13px;color:#555;">' + escapeHtml(najranijiBez.opcija.naziv) + ' (bez umanjenja)</div>';
            html2 += '</div>';
        } else if (najranijiSa) {
            html2 += '<div style="padding:16px;background:#fff3cd;border-left:4px solid #f39c12;border-radius:6px;margin:16px 0;">';
            html2 += '<h3 style="margin:0 0 8px 0;color:#f39c12;font-size:14px;">📅 Prvi datum sa umanjenjem</h3>';
            html2 += '<div style="font-size:24px;font-weight:bold;color:#2c3e50;margin:8px 0;">' + M01.formatDate(najranijiSa.datum) + '</div>';
            html2 += '<div style="font-size:13px;color:#555;">' + escapeHtml(najranijiSa.opcija.naziv) + '</div>';
            html2 += '</div>';
        } else {
            html2 += '<div style="padding:16px;background:#f8d7da;border-left:4px solid #e74c3c;border-radius:6px;margin:16px 0;">';
            html2 += '<h3 style="margin:0;color:#e74c3c;font-size:14px;">Nijedna opcija se ne stiče u narednih 50 godina</h3>';
            html2 += '</div>';
        }

        // Tabela nezavisnog sticanja
        html2 += '<h3 style="' + stilPodnaslov() + '">Nezavisno sticanje po opciji</h3>';
        html2 += '<table style="' + stilTabele() + '">';
        html2 += '<tr>';
        html2 += '<th style="' + stilTh() + '">Opcija</th>';
        html2 += '<th style="' + stilTh() + '">Prvi datum sticanja</th>';
        html2 += '<th style="' + stilTh() + '">Status</th>';
        html2 += '</tr>';
        ['OP-01', 'OP-02', 'OP-03', 'OP-04', 'OP-05'].forEach(id => {
            const s = sticanje[id];
            html2 += '<tr>';
            html2 += '<td style="' + stilTd() + '">' + id + ' — ' + escapeHtml(nazivOpcije(id)) + '</td>';
            html2 += '<td style="' + stilTd() + '">' + ((s && s.datum) ? M01.formatDate(s.datum) : '—') + '</td>';
            html2 += '<td style="' + stilTd() + '">' + ((s && s.datum) ? '✅' : '⏳') + '</td>';
            html2 += '</tr>';
        });
        html2 += '</table>';

        await htmlStranaUcanvas(html2, pdf, false);

        // =====================================================================
        // STRANA 3 — Relevantne opcije penzionisanja
        // =====================================================================
        let html3 = '<h1 style="' + stilNaslov() + '">Penzioni izveštaj — Relevantne opcije penzionisanja</h1>';

        const opcijeRelevantne = sastaviRelevantneOpcijeZaPrikaz(korisnik, rezultat);

        if (opcijeRelevantne.length > 0) {
            html3 += '<table style="' + stilTabele() + '">';
            html3 += '<tr>';
            html3 += '<th style="' + stilTh() + '">ID</th>';
            html3 += '<th style="' + stilTh() + '">Naziv</th>';
            html3 += '<th style="' + stilTh() + '">Status</th>';
            html3 += '<th style="' + stilTh() + 'text-align:right;">Iznos</th>';
            html3 += '<th style="' + stilTh() + 'text-align:right;">Penal</th>';
            html3 += '<th style="' + stilTh() + '">Napomena</th>';
            html3 += '</tr>';
            opcijeRelevantne.forEach(o => {
                const iznosStr = o.ispunjeno ? M01.formatCurrency(o.iznos) : '—';
                const penalStr = (o.detalji && o.detalji.penal) ? o.detalji.penal.toFixed(2) + '%' : '—';
                const napStr = (o.detalji && o.detalji.napomena) ? o.detalji.napomena : '—';
                html3 += '<tr>';
                html3 += '<td style="' + stilTd() + '">' + escapeHtml(o.id) + '</td>';
                html3 += '<td style="' + stilTd() + '">' + escapeHtml(o.naziv) + '</td>';
                html3 += '<td style="' + stilTd() + '">' + escapeHtml(o.status) + '</td>';
                html3 += '<td style="' + stilTdDesno() + '">' + iznosStr + '</td>';
                html3 += '<td style="' + stilTdDesno() + '">' + penalStr + '</td>';
                html3 += '<td style="' + stilTd() + '">' + escapeHtml(napStr) + '</td>';
                html3 += '</tr>';
            });
            html3 += '</table>';
        } else {
            html3 += '<p style="font-size:11px;color:#666;">Nema relevantnih opcija.</p>';
        }

        html3 += '<p style="font-size:10px;color:#888;margin-top:16px;font-style:italic;">Napomena: Prikazane su samo relevantne opcije — prva koja se stiče bez trajnog umanjenja i, ako je ranija, prva sa trajnim umanjenjem.</p>';

        await htmlStranaUcanvas(html3, pdf, false);

        // =====================================================================
        // STRANA 4 — Zarade po godinama
        // =====================================================================
        let html4 = '<h1 style="' + stilNaslov() + '">Penzioni izveštaj — Zarade po godinama</h1>';
        if (korisnik.zarade && korisnik.zarade.length) {
            html4 += '<table style="' + stilTabele() + '">';
            html4 += '<tr>';
            html4 += '<th style="' + stilTh() + '">Godina</th>';
            html4 += '<th style="' + stilTh() + 'text-align:right;">Lična zarada</th>';
            html4 += '<th style="' + stilTh() + 'text-align:right;">Prosečna plata</th>';
            html4 += '<th style="' + stilTh() + 'text-align:right;">GLK</th>';
            html4 += '<th style="' + stilTh() + 'text-align:right;">Sati rada</th>';
            html4 += '<th style="' + stilTh() + 'text-align:right;">Sati bolovanja</th>';
            html4 += '</tr>';
            korisnik.zarade.forEach(z => {
                const glk = z.prosecnaPlata > 0 ? z.licnaZarada / z.prosecnaPlata : 0;
                html4 += '<tr>';
                html4 += '<td style="' + stilTd() + '">' + z.godina + '</td>';
                html4 += '<td style="' + stilTdDesno() + '">' + M01.formatCurrency(z.licnaZarada, false) + '</td>';
                html4 += '<td style="' + stilTdDesno() + '">' + M01.formatCurrency(z.prosecnaPlata, false) + '</td>';
                html4 += '<td style="' + stilTdDesno() + '">' + glk.toFixed(4) + '</td>';
                html4 += '<td style="' + stilTdDesno() + '">' + (z.satiRada || 0) + '</td>';
                html4 += '<td style="' + stilTdDesno() + '">' + (z.satiBolovanje || 0) + '</td>';
                html4 += '</tr>';
            });
            html4 += '</table>';
        } else {
            html4 += '<p style="font-size:11px;color:#666;">Nema podataka o zaradama.</p>';
        }

        await htmlStranaUcanvas(html4, pdf, false);

        // =====================================================================
        // STRANA 5 — Staž po godinama
        // =====================================================================
        let html5 = '<h1 style="' + stilNaslov() + '">Penzioni izveštaj — Staž po godinama</h1>';
        if (korisnik.staz && korisnik.staz.length) {
            let ukupnoEfM = 0, ukupnoEfD = 0, ukupnoBenM = 0, ukupnoBenD = 0;
            html5 += '<table style="' + stilTabele() + '">';
            html5 += '<tr>';
            html5 += '<th style="' + stilTh() + '">Godina</th>';
            html5 += '<th style="' + stilTh() + 'text-align:right;">Ef. meseci</th>';
            html5 += '<th style="' + stilTh() + 'text-align:right;">Ef. dani</th>';
            html5 += '<th style="' + stilTh() + 'text-align:right;">Benef. meseci</th>';
            html5 += '<th style="' + stilTh() + 'text-align:right;">Benef. dani</th>';
            html5 += '<th style="' + stilTh() + '">Tip beneficije</th>';
            html5 += '</tr>';
            korisnik.staz.forEach(s => {
                ukupnoEfM += s.efektivniMeseci || 0;
                ukupnoEfD += s.efektivniDani || 0;
                ukupnoBenM += s.beneficiraniMeseci || 0;
                ukupnoBenD += s.beneficiraniDani || 0;
                html5 += '<tr>';
                html5 += '<td style="' + stilTd() + '">' + s.godina + '</td>';
                html5 += '<td style="' + stilTdDesno() + '">' + (s.efektivniMeseci || 0) + '</td>';
                html5 += '<td style="' + stilTdDesno() + '">' + (s.efektivniDani || 0) + '</td>';
                html5 += '<td style="' + stilTdDesno() + '">' + (s.beneficiraniMeseci || 0) + '</td>';
                html5 += '<td style="' + stilTdDesno() + '">' + (s.beneficiraniDani || 0) + '</td>';
                html5 += '<td style="' + stilTd() + '">' + escapeHtml(s.tipBeneficiranja || '1212') + '</td>';
                html5 += '</tr>';
            });
            html5 += '<tr style="background:#e8eef5;font-weight:bold;">';
            html5 += '<td style="' + stilTd() + '">UKUPNO</td>';
            html5 += '<td style="' + stilTdDesno() + '">' + ukupnoEfM + '</td>';
            html5 += '<td style="' + stilTdDesno() + '">' + ukupnoEfD + '</td>';
            html5 += '<td style="' + stilTdDesno() + '">' + ukupnoBenM + '</td>';
            html5 += '<td style="' + stilTdDesno() + '">' + ukupnoBenD + '</td>';
            html5 += '<td style="' + stilTd() + '"></td>';
            html5 += '</tr>';
            html5 += '</table>';
        } else {
            html5 += '<p style="font-size:11px;color:#666;">Nema podataka o stažu.</p>';
        }

        await htmlStranaUcanvas(html5, pdf, false);

        // =====================================================================
        // STRANA 6 — Bolovanje (period do 2002)
        // =====================================================================
        let html6 = '<h1 style="' + stilNaslov() + '">Penzioni izveštaj — Bolovanje (period do 2002)</h1>';
        if (rezultat.koefBolovanjaDetalji && rezultat.koefBolovanjaDetalji.length) {
            html6 += '<table style="' + stilTabele() + '">';
            html6 += '<tr>';
            html6 += '<th style="' + stilTh() + '">Godina</th>';
            html6 += '<th style="' + stilTh() + 'text-align:right;">Sati rada</th>';
            html6 += '<th style="' + stilTh() + 'text-align:right;">Sati bolovanja</th>';
            html6 += '<th style="' + stilTh() + 'text-align:right;">Godišnji LK</th>';
            html6 += '<th style="' + stilTh() + 'text-align:right;">Doprinos</th>';
            html6 += '</tr>';
            rezultat.koefBolovanjaDetalji.forEach(d => {
                html6 += '<tr>';
                html6 += '<td style="' + stilTd() + '">' + d.godina + '</td>';
                html6 += '<td style="' + stilTdDesno() + '">' + d.satiRada + '</td>';
                html6 += '<td style="' + stilTdDesno() + '">' + d.satiBolovanje + '</td>';
                html6 += '<td style="' + stilTdDesno() + '">' + d.godisnjiLK.toFixed(4) + '</td>';
                html6 += '<td style="' + stilTdDesno() + '">' + d.doprinos.toFixed(4) + '</td>';
                html6 += '</tr>';
            });
            html6 += '</table>';
        } else {
            html6 += '<p style="font-size:11px;color:#666;">Nema podataka o bolovanju za period do 2002.</p>';
        }

        await htmlStranaUcanvas(html6, pdf, false);

        // =====================================================================
        // STRANA 7 — Pravni osnov i napomena
        // =====================================================================
        let html7 = '<h1 style="' + stilNaslov() + '">Penzioni izveštaj — Pravni osnov i napomena</h1>';
        html7 += '<h3 style="' + stilPodnaslov() + '">Pravni osnov</h3>';
        html7 += '<ul style="font-size:11px;line-height:1.5;padding-left:20px;margin:0;">';
        html7 += '<li><b>Član 19</b> — Redovna starosna penzija: 65 godina života (muškarci) ili prelazni režim (žene), uz minimalno 15 godina staža.</li>';
        html7 += '<li><b>Član 19b</b> — Prevremena starosna penzija: 60 godina života i 40 godina staža, uz trajno umanjenje po mesecu ranijeg odlaska.</li>';
        html7 += '<li><b>Član 20</b> — Uslov 2/3: beneficirani staž mora biti najmanje 2/3 efektivnog staža da bi se beneficija priznala.</li>';
        html7 += '<li><b>Član 43</b> — Posebne kategorije (MUP, Vojska, BIA) imaju povoljnije uslove.</li>';
        html7 += '<li><b>Član 54</b> — Beneficirani staž: min. 10 godina efektivnog rada u beneficiranim uslovima.</li>';
        html7 += '<li><b>Član 68</b> — Ograničenje staža za obračun bodova: maksimalno 45 godina.</li>';
        html7 += '<li><b>Član 69</b> — Žene: +6% na staž za obračun visine penzije.</li>';
        html7 += '<li><b>Član 70g</b> — Penali za beneficirane se računaju od snižene granice, ne od 65 godina.</li>';
        html7 += '</ul>';

        html7 += '<h3 style="' + stilPodnaslov() + ';color:#c0392b;">Napomena</h3>';
        html7 += '<ul style="font-size:11px;line-height:1.5;padding-left:20px;margin:0;">';
        html7 += '<li>Rezultati su informativnog karaktera i ne mogu zameniti stručnu službu PIO fonda.</li>';
        html7 += '<li>Obračun se zasniva na podacima iz Excel fajla (M4/M8 obrasci) i predstavlja procenu.</li>';
        html7 += '<li>Stvarni iznos penzije može se razlikovati zbog zakonskih izmena i specifičnosti slučaja.</li>';
        html7 += '<li>Datumi u obračunu su zasnovani na 360-dnevnoj obračunskoj godini (PIO konvencija).</li>';
        html7 += '<li>Simulacija staža pretpostavlja neprekidno osiguranje od poslednjeg unetog dana staža.</li>';
        html7 += '</ul>';

        await htmlStranaUcanvas(html7, pdf, false);

        // ---------------------------------------------------------------------
        // Finalizacija
        // ---------------------------------------------------------------------
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = 'penzija-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '-kompletni.pdf';

        return { base64: pdfBase64, fileName };
    }

    return {
        generisiExcel,
        generisiPDF,
        generisiPDFKompletni,
        pronadjiRelevantneOpcije,
        sastaviRelevantneOpcijeZaPrikaz,
        nazivOpcije
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M11;
}
