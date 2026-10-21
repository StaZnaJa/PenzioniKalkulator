// ============================================================================
// M11 — GENERATOR IZVEŠTAJA (PDF i Excel)
// Odgovornost: Generisanje PDF i Excel izveštaja na osnovu rezultata M10.
//   - generisiPDF(korisnik, rezultat)          → skraćeni PDF (1 strana, html2canvas)
//   - generisiPDFKompletni(korisnik, rezultat) → kompletan PDF (6 strana, jspdf-autotable)
//   - generisiExcel(korisnik, rezultat)        → Excel sa 4 lista
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
        // Fallback
        const g = Math.floor(dani / 360);
        const m = Math.floor((dani % 360) / 30);
        const d = Math.round((dani % 360) % 30);
        return g + ' god ' + m + ' mes ' + d + ' dana';
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
    // SKRAĆENI PDF (1 strana, html2canvas)
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
        const pageWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = pageWidth - 20;

        const strana1 = document.createElement('div');
        strana1.style.width = '750px';
        strana1.style.padding = '20px';
        strana1.style.background = 'white';
        strana1.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";

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
        html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Lični koeficijent</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.lk.toFixed(4) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Efektivni staž</b></td><td style="padding:6px;border:1px solid #ddd;">' + formatDaniGMD(rezultat.staz.efektivniDani) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Ukupan staž osiguranja</b></td><td style="padding:6px;border:1px solid #ddd;">' + formatDaniGMD(rezultat.staz.ukupnoOsiguranjeDani) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Staž za obračun bodova</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.staz.stazZaBodoveGodine.toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Uslov 2/3</b></td><td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(rezultat.uslovi.status) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Opšta granica</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.granice.opstaGranica.toFixed(2) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Snižena granica</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.granice.snizenaGranica.toFixed(2) + '</td></tr>';
        html += '</table>';

        html += '<h2 style="color:#2c3e50;">Opcije penzionisanja</h2>';
        html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
        html += '<tr style="background:#f0f0f0;">';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:left;">Opcija</th>';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:left;">Status</th>';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Iznos</th>';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Penal</th>';
        html += '</tr>';
        rezultat.opcije.forEach(o => {
            const penalStr = (o.detalji && o.detalji.penal > 0)
                ? o.detalji.penal.toFixed(2) + '%'
                : '—';
            const iznosStr = o.ispunjeno ? M01.formatCurrency(o.iznos) : '—';
            html += '<tr>';
            html += '<td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(o.naziv) + '</td>';
            html += '<td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(o.status) + '</td>';
            html += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + iznosStr + '</td>';
            html += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + penalStr + '</td>';
            html += '</tr>';
        });
        html += '</table>';

        html += '<p style="font-size:0.8rem;color:#888;margin-top:16px;">Napomena: Rezultati su informativnog karaktera i ne mogu zameniti stručnu službu PIO.</p>';

        strana1.innerHTML = html;
        document.body.appendChild(strana1);

        const canvas1 = await html2canvas(strana1, { scale: 2, backgroundColor: '#ffffff', logging: false });
        document.body.removeChild(strana1);
        const imgData1 = canvas1.toDataURL('image/png');
        const imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;
        pdf.addImage(imgData1, 'PNG', 10, 10, imgWidth, imgHeight1);

        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = 'penzija-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '-skraceni.pdf';

        return { base64: pdfBase64, fileName };
    }

    // ------------------------------------------------------------------------
    // KOMPLETAN PDF (6 strana, jspdf-autotable)
    // ------------------------------------------------------------------------

    async function generisiPDFKompletni(korisnik, rezultat) {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            throw new Error('jsPDF biblioteka nije učitana');
        }
        if (typeof window.jspdf.jsPDF.API === 'undefined' || typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
            // provera autotable plugina
            if (typeof window.jspdf.jsPDF.prototype.autoTable === 'undefined') {
                throw new Error('jspdf-autotable plugin nije učitan');
            }
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - 2 * margin;

        let trenutnaStrana = 1;

        // Pomoćna: zaglavlje strane
        function dodajZaglavlje(naslov) {
            pdf.setFontSize(14);
            pdf.setTextColor(44, 62, 80);
            pdf.text(naslov, margin, margin + 5);
            pdf.setFontSize(8);
            pdf.setTextColor(120, 120, 120);
            pdf.text('Penzioni izveštaj — ' + (korisnik.ime || ''), margin, margin + 10);
            pdf.setDrawColor(200, 200, 200);
            pdf.line(margin, margin + 12, pageWidth - margin, margin + 12);
        }

        // Pomoćna: podnožje strane
        function dodajPodnozje() {
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text('Strana ' + trenutnaStrana, pageWidth - margin - 15, pageHeight - 5);
            pdf.text('Rezultati su informativnog karaktera.', margin, pageHeight - 5);
        }

        // Pomoćna: nova strana
        function novaStrana(naslov) {
            if (trenutnaStrana > 1) {
                pdf.addPage();
                trenutnaStrana++;
            }
            dodajZaglavlje(naslov);
            dodajPodnozje();
            return margin + 16;
        }

        // Pomoćna: tekst u redovima (ključ: vrednost)
        function dodajKljucVrednost(parovi, startY) {
            let y = startY;
            pdf.setFontSize(9);
            parovi.forEach(p => {
                pdf.setTextColor(80, 80, 80);
                pdf.text(p[0], margin, y);
                pdf.setTextColor(20, 20, 20);
                pdf.text(String(p[1]), margin + 55, y);
                y += 5;
            });
            return y;
        }

        // ---------------------------------------------------------------------
        // STRANA 1 — Osnovni podaci + Rezultati obračuna
        // ---------------------------------------------------------------------
        let y = novaStrana('Osnovni podaci i rezultati obračuna');

        // Osnovni podaci o korisniku
        pdf.setFontSize(10);
        pdf.setTextColor(44, 62, 80);
        pdf.text('Korisnik', margin, y);
        y += 5;
        y = dodajKljucVrednost([
            ['Ime i prezime:', korisnik.ime || '—'],
            ['Pol:', korisnik.pol === 'Ž' ? 'Ženski' : 'Muški'],
            ['Datum rođenja:', korisnik.datumRodjenja || '—'],
            ['Broj dece:', korisnik.pol === 'Ž' ? (korisnik.brojDece || 0) : 0],
            ['Kategorija:', korisnik.kategorija || 'NE'],
            ['Datum poslednjeg staža:', korisnik.datumPoslednjegStaza || '—']
        ], y);

        y += 4;
        pdf.setFontSize(10);
        pdf.setTextColor(44, 62, 80);
        pdf.text('Rezultati obračuna', margin, y);
        y += 5;
        y = dodajKljucVrednost([
            ['Lični koeficijent (LK):', rezultat.lk.toFixed(4)],
            ['Koeficijent bolovanja:', rezultat.koefBolovanja.toFixed(4)],
            ['Efektivni staž:', formatDaniGMD(rezultat.staz.efektivniDani)],
            ['Beneficirani staž:', formatDaniGMD(rezultat.staz.beneficiraniDani)],
            ['Uvećani staž (beneficija):', formatDaniGMD(rezultat.staz.uvecaniDani)],
            ['Ukupan staž osiguranja:', formatDaniGMD(rezultat.staz.ukupnoOsiguranjeDani)],
            ['Staž za obračun bodova:', rezultat.staz.stazZaBodoveGodine.toFixed(2) + ' god'],
            ['Dodatak za decu:', rezultat.staz.decaDodatakGodine.toFixed(2) + ' god']
        ], y);

        y += 4;
        pdf.setFontSize(10);
        pdf.setTextColor(44, 62, 80);
        pdf.text('Uslov 2/3 i starosne granice', margin, y);
        y += 5;
        y = dodajKljucVrednost([
            ['Uslov 2/3:', rezultat.uslovi.status],
            ['Procenat 2/3:', rezultat.uslovi.procenat23.toFixed(2) + '%'],
            ['Priznaje se beneficija:', rezultat.uslovi.priznajeSeBeneficija ? 'DA' : 'NE'],
            ['Opšta granica:', rezultat.granice.opstaGranica.toFixed(2) + ' god'],
            ['Snižena granica:', rezultat.granice.snizenaGranica.toFixed(2) + ' god'],
            ['Sniženje:', rezultat.granice.snizenjeGodina + ' god'],
            ['Donji limit:', rezultat.granice.donjiLimit + ' god']
        ], y);

        // ---------------------------------------------------------------------
        // STRANA 2 — Opcije penzionisanja (detaljno)
        // ---------------------------------------------------------------------
        y = novaStrana('Opcije penzionisanja');

        const opcijeRedovi = rezultat.opcije.map(o => [
            o.id,
            o.naziv,
            o.status,
            o.ispunjeno ? M01.formatCurrency(o.iznos) : '—',
            (o.detalji && o.detalji.penal) ? o.detalji.penal.toFixed(2) + '%' : '—',
            (o.detalji && o.detalji.meseciRanije) ? String(o.detalji.meseciRanije) : '—',
            (o.detalji && o.detalji.referentnaGranica) ? o.detalji.referentnaGranica.toFixed(2) : '—',
            (o.detalji && o.detalji.napomena) ? o.detalji.napomena : '—'
        ]);

        pdf.autoTable({
            head: [['ID', 'Naziv', 'Status', 'Iznos', 'Penal', 'Mes. ranije', 'Ref. gran.', 'Napomena']],
            body: opcijeRedovi,
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 42 },
                2: { cellWidth: 22 },
                3: { cellWidth: 22, halign: 'right' },
                4: { cellWidth: 14, halign: 'right' },
                5: { cellWidth: 16, halign: 'right' },
                6: { cellWidth: 16, halign: 'right' },
                7: { cellWidth: 'auto' }
            },
            didDrawPage: () => { dodajPodnozje(); }
        });

        // ---------------------------------------------------------------------
        // STRANA 3 — Tabela zarada
        // ---------------------------------------------------------------------
        y = novaStrana('Zarade po godinama');

        if (korisnik.zarade && korisnik.zarade.length) {
            const zaradeRedovi = korisnik.zarade.map(z => {
                const glk = z.prosecnaPlata > 0 ? z.licnaZarada / z.prosecnaPlata : 0;
                return [
                    z.godina,
                    M01.formatCurrency(z.licnaZarada, false),
                    M01.formatCurrency(z.prosecnaPlata, false),
                    glk.toFixed(4),
                    z.satiRada || 0,
                    z.satiBolovanje || 0
                ];
            });

            pdf.autoTable({
                head: [['Godina', 'Lična zarada', 'Prosečna plata', 'GLK', 'Sati rada', 'Sati bolovanja']],
                body: zaradeRedovi,
                startY: y,
                margin: { left: margin, right: margin },
                styles: { fontSize: 8, cellPadding: 1.5 },
                headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { halign: 'right' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' },
                    5: { halign: 'right' }
                },
                didDrawPage: () => { dodajPodnozje(); }
            });
        } else {
            pdf.setFontSize(9);
            pdf.text('Nema podataka o zaradama.', margin, y + 5);
        }

        // ---------------------------------------------------------------------
        // STRANA 4 — Tabela staža po godinama
        // ---------------------------------------------------------------------
        y = novaStrana('Staž po godinama');

        if (korisnik.staz && korisnik.staz.length) {
            const stazRedovi = korisnik.staz.map(s => [
                s.godina,
                s.efektivniMeseci || 0,
                s.efektivniDani || 0,
                s.beneficiraniMeseci || 0,
                s.beneficiraniDani || 0,
                s.tipBeneficiranja || '1212'
            ]);

            // Sabiranje na kraju
            const ukupnoEfM = korisnik.staz.reduce((a, s) => a + (s.efektivniMeseci || 0), 0);
            const ukupnoEfD = korisnik.staz.reduce((a, s) => a + (s.efektivniDani || 0), 0);
            const ukupnoBenM = korisnik.staz.reduce((a, s) => a + (s.beneficiraniMeseci || 0), 0);
            const ukupnoBenD = korisnik.staz.reduce((a, s) => a + (s.beneficiraniDani || 0), 0);

            stazRedovi.push([
                'UKUPNO',
                ukupnoEfM,
                ukupnoEfD,
                ukupnoBenM,
                ukupnoBenD,
                ''
            ]);

            pdf.autoTable({
                head: [['Godina', 'Ef. meseci', 'Ef. dani', 'Benef. meseci', 'Benef. dani', 'Tip beneficije']],
                body: stazRedovi,
                startY: y,
                margin: { left: margin, right: margin },
                styles: { fontSize: 8, cellPadding: 1.5 },
                headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { halign: 'right' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' },
                    5: { halign: 'center' }
                },
                didParseCell: (data) => {
                    if (data.row.index === stazRedovi.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [230, 230, 230];
                    }
                },
                didDrawPage: () => { dodajPodnozje(); }
            });
        } else {
            pdf.setFontSize(9);
            pdf.text('Nema podataka o stažu.', margin, y + 5);
        }

        // ---------------------------------------------------------------------
        // STRANA 5 — Tabela bolovanja (period do 2002)
        // ---------------------------------------------------------------------
        y = novaStrana('Bolovanje (period do 2002)');

        if (rezultat.koefBolovanjaDetalji && rezultat.koefBolovanjaDetalji.length) {
            const bolRedovi = rezultat.koefBolovanjaDetalji.map(d => [
                d.godina,
                d.satiRada,
                d.satiBolovanje,
                d.godisnjiLK.toFixed(4),
                d.doprinos.toFixed(4)
            ]);

            pdf.autoTable({
                head: [['Godina', 'Sati rada', 'Sati bolovanja', 'Godišnji LK', 'Doprinos']],
                body: bolRedovi,
                startY: y,
                margin: { left: margin, right: margin },
                styles: { fontSize: 8, cellPadding: 1.5 },
                headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { halign: 'right' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' }
                },
                didDrawPage: () => { dodajPodnozje(); }
            });
        } else {
            pdf.setFontSize(9);
            pdf.text('Nema podataka o bolovanju za period do 2002.', margin, y + 5);
        }

        // ---------------------------------------------------------------------
        // STRANA 6 — Pravni osnov i napomena
        // ---------------------------------------------------------------------
        y = novaStrana('Pravni osnov i napomena');

        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);

        const pravniOsnov = [
            'Član 19 — Redovna starosna penzija: 65 godina života (muškarci) ili prelazni režim (žene), uz minimalno 15 godina staža.',
            'Član 19b — Prevremena starosna penzija: 60 godina života i 40 godina staža, uz trajno umanjenje po mesecu ranijeg odlaska.',
            'Član 20 — Uslov 2/3: beneficirani staž mora biti najmanje 2/3 efektivnog staža da bi se beneficija priznala.',
            'Član 43 — Posebne kategorije (MUP, Vojska, BIA) imaju povoljnije uslove.',
            'Član 54 — Beneficirani staž: min. 10 godina efektivnog rada u beneficiranim uslovima.',
            'Član 68 — Ograničenje staža za obračun bodova: maksimalno 45 godina.',
            'Član 69 — Žene: +6% na staž za obračun visine penzije.',
            'Član 70g — Penali za beneficirane se računaju od snižene granice, ne od 65 godina.'
        ];

        pravniOsnov.forEach(tekst => {
            const lines = pdf.splitTextToSize('• ' + tekst, contentWidth);
            lines.forEach(linija => {
                if (y > pageHeight - 20) {
                    pdf.addPage();
                    trenutnaStrana++;
                    dodajZaglavlje('Pravni osnov i napomena');
                    dodajPodnozje();
                    y = margin + 16;
                }
                pdf.text(linija, margin, y);
                y += 4.5;
            });
            y += 1;
        });

        y += 6;
        pdf.setFontSize(10);
        pdf.setTextColor(200, 100, 0);
        pdf.text('Napomena:', margin, y);
        y += 5;
        pdf.setFontSize(9);
        pdf.setTextColor(80, 80, 80);

        const napomene = [
            'Rezultati su informativnog karaktera i ne mogu zameniti stručnu službu PIO fonda.',
            'Obračun se zasniva na podacima iz Excel fajla (M4/M8 obrasci) i predstavlja procenu.',
            'Stvarni iznos penzije može se razlikovati zbog zakonskih izmena i specifičnosti slučaja.',
            'Datumi u obračunu su zasnovani na 360-dnevnoj obračunskoj godini (PIO konvencija).'
        ];

        napomene.forEach(tekst => {
            const lines = pdf.splitTextToSize('• ' + tekst, contentWidth);
            lines.forEach(linija => {
                if (y > pageHeight - 15) {
                    pdf.addPage();
                    trenutnaStrana++;
                    dodajZaglavlje('Pravni osnov i napomena');
                    dodajPodnozje();
                    y = margin + 16;
                }
                pdf.text(linija, margin, y);
                y += 4.5;
            });
        });

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
        generisiPDFKompletni
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M11;
}
