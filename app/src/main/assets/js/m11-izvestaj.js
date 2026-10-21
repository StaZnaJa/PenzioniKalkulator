// ============================================================================
// M11 — GENERATOR IZVEŠTAJA (PDF i Excel)
// Odgovornost: Generisanje PDF i Excel izveštaja na osnovu rezultata M10.
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
    // Pomoćna: relevantne opcije (ispunjene + prva buduća + eventualno ranija sa penalom)
    // ------------------------------------------------------------------------

    function nadjiRelevantneOpcije(rezultat) {
        const ispunjene = rezultat.opcije.filter(o => o.ispunjeno);
        const relevantne = [];

        // Dodaj sve ispunjene
        ispunjene.forEach(o => relevantne.push(o));

        // Ako nijedna nije ispunjena, dodaj prvu buduću (ako je ima)
        if (relevantne.length === 0 && typeof M12 !== 'undefined' && M12.getAktivniKorisnikId) {
            // Ne možemo da pozovemo M12 odavde (cirkularna zavisnost)
            // Umesto toga, koristimo ono što M10 vraća
            // Ako nema ispunjenih, uzimamo prvu opciju koja nije ispunjena ali je najbliža
            const neispunjene = rezultat.opcije.filter(o => !o.ispunjeno);
            if (neispunjene.length > 0) {
                // Uzmi prvu neispunjenu (OP-01 je obično prva)
                relevantne.push(neispunjene[0]);
            }
        }

        return relevantne;
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
            ['Efektivni staž:', (rezultat.staz.efektivniDani / 360).toFixed(2) + ' god'],
            ['Beneficirani staž:', (rezultat.staz.beneficiraniDani / 360).toFixed(2) + ' god'],
            ['Uvećani staž:', (rezultat.staz.uvecaniDani / 360).toFixed(2) + ' god'],
            ['Ukupan staž osiguranja:', (rezultat.staz.ukupnoOsiguranjeDani / 360).toFixed(2) + ' god'],
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
    // PDF: SKRAĆENI (1 strana — samo najbitnije)
    // ------------------------------------------------------------------------

    async function generisiSkraceniPDF(korisnik, rezultat) {
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

        // Nađi relevantnu opciju
        const ispunjene = rezultat.opcije.filter(o => o.ispunjeno);
        const opcija = ispunjene.length > 0 ? ispunjene[0] : null;

        const strana = document.createElement('div');
        strana.style.width = '750px';
        strana.style.padding = '20px';
        strana.style.background = 'white';
        strana.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";

        let html = '<h1 style="color:#2c3e50;margin-bottom:16px;font-size:1.6rem;">Penzioni izveštaj — skraćeni</h1>';

        // Podaci o korisniku
        html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Korisnik</b></td><td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(korisnik.ime || '') + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Pol</b></td><td style="padding:6px;border:1px solid #ddd;">' + (korisnik.pol === 'Ž' ? 'Ženski' : 'Muški') + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Datum rođenja</b></td><td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(korisnik.datumRodjenja || 'nije unet') + '</td></tr>';
        html += '</table>';

        // Glavni rezultat
        html += '<div style="background:linear-gradient(135deg,#3498db,#2c3e50);color:white;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">';
        html += '<div style="font-size:0.9rem;opacity:0.9;">Mesečna penzija</div>';
        html += '<div style="font-size:2.2rem;font-weight:bold;margin:8px 0;">' + M01.formatCurrency(opcija ? opcija.iznos : 0) + '</div>';
        if (opcija) {
            html += '<div style="font-size:0.9rem;opacity:0.9;">' + escapeHtml(opcija.naziv) + '</div>';
            if (opcija.detalji && opcija.detalji.penal > 0) {
                html += '<div style="font-size:0.85rem;opacity:0.9;">Umanjenje: ' + opcija.detalji.penal.toFixed(2) + '%</div>';
            }
        }
        html += '</div>';

        // Ključni parametri
        html += '<h2 style="color:#2c3e50;font-size:1.1rem;">Ključni parametri</h2>';
        html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Lični koeficijent</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.lk.toFixed(4) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Efektivni staž</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.efektivniDani / 360).toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Ukupan staž osiguranja</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.ukupnoOsiguranjeDani / 360).toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Staž za obračun bodova</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.staz.stazZaBodoveGodine.toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Uslov 2/3</b></td><td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(rezultat.uslovi.status) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Snižena granica</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.granice.snizenaGranica.toFixed(2) + '</td></tr>';
        html += '</table>';

        html += '<p style="font-size:0.8rem;color:#888;margin-top:16px;">Napomena: Rezultati su informativnog karaktera i ne mogu zameniti stručnu službu PIO.</p>';

        strana.innerHTML = html;
        document.body.appendChild(strana);

        const canvas = await html2canvas(strana, { scale: 2, backgroundColor: '#ffffff', logging: false });
        document.body.removeChild(strana);
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);

        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = 'penzija-skraceni-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '.pdf';

        return { base64: pdfBase64, fileName };
    }

    // ------------------------------------------------------------------------
    // PDF: DETALJNI (više strana — svi podaci, ali samo relevantne opcije)
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

        // Relevantne opcije — samo ispunjene ili prva buduća
        const ispunjene = rezultat.opcije.filter(o => o.ispunjeno);
        let relevantneOpcije = ispunjene;
        if (relevantneOpcije.length === 0) {
            // Uzmi prvu neispunjenu (najbližu)
            const neispunjene = rezultat.opcije.filter(o => !o.ispunjeno);
            if (neispunjene.length > 0) relevantneOpcije = [neispunjene[0]];
        }

        // ===== STRANA 1: Rezultati + opcije =====
        const strana1 = document.createElement('div');
        strana1.style.width = '750px';
        strana1.style.padding = '20px';
        strana1.style.background = 'white';
        strana1.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";

        let html = '<h1 style="color:#2c3e50;margin-bottom:16px;">Penzioni izveštaj — detaljni</h1>';
        html += '<p><b>Korisnik:</b> ' + escapeHtml(korisnik.ime || '') + '</p>';
        html += '<p><b>Pol:</b> ' + (korisnik.pol === 'Ž' ? 'Ženski' : 'Muški') + '</p>';
        html += '<p><b>Datum rođenja:</b> ' + escapeHtml(korisnik.datumRodjenja || 'nije unet') + '</p>';
        if (korisnik.pol === 'Ž' && korisnik.brojDece > 0) {
            html += '<p><b>Broj dece:</b> ' + korisnik.brojDece + '</p>';
        }
        html += '<hr style="margin:16px 0;">';

        html += '<h2 style="color:#2c3e50;">Rezultati obračuna</h2>';
        html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Lični koeficijent</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.lk.toFixed(4) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Koeficijent bolovanja</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.koefBolovanja.toFixed(4) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Efektivni staž</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.efektivniDani / 360).toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Beneficirani staž</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.beneficiraniDani / 360).toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Uvećani staž</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.uvecaniDani / 360).toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Ukupan staž osiguranja</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.ukupnoOsiguranjeDani / 360).toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Staž za obračun bodova</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.staz.stazZaBodoveGodine.toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Uslov 2/3</b></td><td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(rezultat.uslovi.status) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Opšta granica</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.granice.opstaGranica.toFixed(2) + '</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Snižena granica</b></td><td style="padding:6px;border:1px solid #ddd;">' + rezultat.granice.snizenaGranica.toFixed(2) + '</td></tr>';
        html += '</table>';

        html += '<h2 style="color:#2c3e50;">Relevantne opcije penzionisanja</h2>';
        html += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
        html += '<tr style="background:#f0f0f0;">';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:left;">Opcija</th>';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:left;">Status</th>';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Iznos</th>';
        html += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Penal</th>';
        html += '</tr>';
        relevantneOpcije.forEach(o => {
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

        // ===== STRANA 2: Tabela zarada =====
        if (korisnik.zarade && korisnik.zarade.length > 0) {
            pdf.addPage();
            const strana2 = document.createElement('div');
            strana2.style.width = '750px';
            strana2.style.padding = '20px';
            strana2.style.background = 'white';
            strana2.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";

            let html2 = '<h2 style="color:#2c3e50;margin-bottom:16px;">Zarade po godinama</h2>';
            html2 += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
            html2 += '<tr style="background:#f0f0f0;">';
            html2 += '<th style="padding:6px;border:1px solid #ddd;text-align:left;">Godina</th>';
            html2 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Lična zarada</th>';
            html2 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Prosečna plata</th>';
            html2 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">GLK</th>';
            html2 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Sati rada</th>';
            html2 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Sati bolovanja</th>';
            html2 += '</tr>';
            korisnik.zarade.forEach(z => {
                const glk = z.prosecnaPlata > 0 ? z.licnaZarada / z.prosecnaPlata : 0;
                html2 += '<tr>';
                html2 += '<td style="padding:6px;border:1px solid #ddd;">' + z.godina + '</td>';
                html2 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + M01.formatCurrency(z.licnaZarada, false) + '</td>';
                html2 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + M01.formatCurrency(z.prosecnaPlata, false) + '</td>';
                html2 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + glk.toFixed(4) + '</td>';
                html2 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + (z.satiRada || 0) + '</td>';
                html2 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + (z.satiBolovanje || 0) + '</td>';
                html2 += '</tr>';
            });
            html2 += '</table>';

            strana2.innerHTML = html2;
            document.body.appendChild(strana2);

            const canvas2 = await html2canvas(strana2, { scale: 2, backgroundColor: '#ffffff', logging: false });
            document.body.removeChild(strana2);
            const imgData2 = canvas2.toDataURL('image/png');
            const imgHeight2 = (canvas2.height * imgWidth) / canvas2.width;
            pdf.addImage(imgData2, 'PNG', 10, 10, imgWidth, imgHeight2);
        }

        // ===== STRANA 3: Tabela staža =====
        if (korisnik.staz && korisnik.staz.length > 0) {
            pdf.addPage();
            const strana3 = document.createElement('div');
            strana3.style.width = '750px';
            strana3.style.padding = '20px';
            strana3.style.background = 'white';
            strana3.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";

            let html3 = '<h2 style="color:#2c3e50;margin-bottom:16px;">Staž po godinama</h2>';
            html3 += '<table style="width:100%;border-collapse:collapse;margin:12px 0;">';
            html3 += '<tr style="background:#f0f0f0;">';
            html3 += '<th style="padding:6px;border:1px solid #ddd;text-align:left;">Godina</th>';
            html3 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Ef. meseci</th>';
            html3 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Ef. dani</th>';
            html3 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Benef. meseci</th>';
            html3 += '<th style="padding:6px;border:1px solid #ddd;text-align:right;">Benef. dani</th>';
            html3 += '<th style="padding:6px;border:1px solid #ddd;text-align:left;">Tip</th>';
            html3 += '</tr>';
            korisnik.staz.forEach(s => {
                html3 += '<tr>';
                html3 += '<td style="padding:6px;border:1px solid #ddd;">' + s.godina + '</td>';
                html3 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + (s.efektivniMeseci || 0) + '</td>';
                html3 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + (s.efektivniDani || 0) + '</td>';
                html3 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + (s.beneficiraniMeseci || 0) + '</td>';
                html3 += '<td style="padding:6px;border:1px solid #ddd;text-align:right;">' + (s.beneficiraniDani || 0) + '</td>';
                html3 += '<td style="padding:6px;border:1px solid #ddd;">' + (s.tipBeneficiranja || '1212') + '</td>';
                html3 += '</tr>';
            });
            html3 += '</table>';

            strana3.innerHTML = html3;
            document.body.appendChild(strana3);

            const canvas3 = await html2canvas(strana3, { scale: 2, backgroundColor: '#ffffff', logging: false });
            document.body.removeChild(strana3);
            const imgData3 = canvas3.toDataURL('image/png');
            const imgHeight3 = (canvas3.height * imgWidth) / canvas3.width;
            pdf.addImage(imgData3, 'PNG', 10, 10, imgWidth, imgHeight3);
        }

        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = 'penzija-detaljni-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '.pdf';

        return { base64: pdfBase64, fileName };
    }

    return {
        generisiExcel,
        generisiPDF,
        generisiSkraceniPDF
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M11;
}
