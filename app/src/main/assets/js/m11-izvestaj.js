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

        // --- List 1: Osnovno ---
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

        // --- List 2: Zarade ---
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

        // --- List 3: Staž ---
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

        // --- List 4: Opcije ---
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

        // --- Generisanje base64 ---
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const fileName = 'penzija-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '.xlsx';

        return { base64: wbout, fileName };
    }

    // ------------------------------------------------------------------------
    // PDF izveštaj (preko html2canvas + jsPDF)
    // ------------------------------------------------------------------------

    async function generisiPDF(korisnik, rezultat) {
        if (typeof jsPDF === 'undefined') {
            throw new Error('jsPDF biblioteka nije učitana');
        }
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas biblioteka nije učitana');
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = pageWidth - 20;

        // --- Strana 1: Rezultati + statistika ---
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
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Efektivni staž</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.efektivniDani / 360).toFixed(2) + ' god</td></tr>';
        html += '<tr><td style="padding:6px;border:1px solid #ddd;"><b>Ukupan staž osiguranja</b></td><td style="padding:6px;border:1px solid #ddd;">' + (rezultat.staz.ukupnoOsiguranjeDani / 360).toFixed(2) + ' god</td></tr>';
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

        // --- Generisanje base64 ---
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileName = 'penzija-' + (korisnik.ime || 'korisnik').replace(/\s+/g, '-') + '.pdf';

        return { base64: pdfBase64, fileName };
    }

    return {
        generisiExcel,
        generisiPDF
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = M11;
}