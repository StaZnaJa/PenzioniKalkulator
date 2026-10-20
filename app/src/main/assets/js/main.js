// ============================================================================
// MAIN — BOOTSTRAP
// Odgovornost: Inicijalizacija svih modula i povezivanje sa UI-jem.
// ============================================================================

(function proveriModule() {
    var nedostaju = [];
    if (typeof M01 === 'undefined') nedostaju.push('M01');
    if (typeof M02 === 'undefined') nedostaju.push('M02');
    if (typeof M03 === 'undefined') nedostaju.push('M03');
    if (typeof M04 === 'undefined') nedostaju.push('M04');
    if (typeof M05 === 'undefined') nedostaju.push('M05');
    if (typeof M06 === 'undefined') nedostaju.push('M06');
    if (typeof M07 === 'undefined') nedostaju.push('M07');
    if (typeof M08 === 'undefined') nedostaju.push('M08');
    if (typeof M09 === 'undefined') nedostaju.push('M09');
    if (typeof M10 === 'undefined') nedostaju.push('M10');
    if (typeof M11 === 'undefined') nedostaju.push('M11');
    if (typeof M12 === 'undefined') nedostaju.push('M12');

    if (nedostaju.length > 0) {
        // Greška se prikazuje korisniku preko notifikacije ako je moguće
        if (typeof M12 !== 'undefined' && M12.showNotification) {
            M12.showNotification('Nedostaju moduli: ' + nedostaju.join(', '), 'error');
        }
    }
})();

document.addEventListener('DOMContentLoaded', function () {
    try {
        M12.inicijalizuj();
    } catch (e) {
        if (M12 && M12.showNotification) {
            M12.showNotification('Greška pri pokretanju: ' + e.message, 'error');
        }
    }
});