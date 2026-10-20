package rs.penzija.kalkulator

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import rs.penzija.kalkulator.db.AppDatabase
import rs.penzija.kalkulator.db.KorisnikEntity
import rs.penzija.kalkulator.db.ZaradaEntity
import rs.penzija.kalkulator.db.StazEntity
import rs.penzija.kalkulator.prefs.SettingsManager
import rs.penzija.kalkulator.share.ExcelShareHelper
import rs.penzija.kalkulator.share.PdfShareHelper
import kotlinx.coroutines.runBlocking

/**
 * Most između JavaScript-a (window.AndroidDB) i Android native sloja.
 * Sve metode su @JavascriptInterface i pozivaju se iz JS-a.
 *
 * NAPOMENA: Room operacije su sinhronizovane preko runBlocking jer se
 * pozivaju iz WebView-ovog JS thread-a. Za produkciju bi bilo bolje
 * koristiti poseban thread, ali za potrebe ove aplikacije (lokalna
 * baza, mali broj zapisa) ovo je prihvatljivo i jednostavnije.
 */
class WebAppInterface(private val context: Context) {

    private val db = AppDatabase.getInstance(context)
    private val prefs = SettingsManager(context)

    // ========================================================================
    // KORISNICI
    // ========================================================================

    @JavascriptInterface
    fun getSviKorisnici(): String = runBlocking {
        val korisnici = db.korisnikDao().getAll()
        val arr = JSONArray()
        korisnici.forEach { k ->
            val obj = JSONObject().apply {
                put("id", k.id)
                put("ime", k.ime)
                put("pol", k.pol)
                put("datumRodjenja", k.datumRodjenja)
                put("brojDece", k.brojDece)
                put("kategorija", k.kategorija)
                put("datumPoslednjegStaza", prefs.getString("datumPoslednjegStaza_${k.id}") ?: "")
                put("opstiBod", k.opstiBod)
                put("penzijaMesecno", k.penzijaMesecno)
                put("penzijaGodisnja", k.penzijaGodisnja)
            }
            arr.put(obj)
        }
        arr.toString()
    }

    @JavascriptInterface
    fun sacuvajKorisnika(
        id: String,
        ime: String,
        pol: String,
        datumRodjenja: String,
        brojDece: Int,
        kategorija: String,
        opstiBod: Double,
        penzijaMesecno: Double,
        penzijaGodisnja: Double
    ) = runBlocking {
        db.korisnikDao().upsert(
            KorisnikEntity(
                id = id,
                ime = ime,
                pol = pol,
                datumRodjenja = datumRodjenja,
                brojDece = brojDece,
                kategorija = kategorija,
                opstiBod = opstiBod,
                penzijaMesecno = penzijaMesecno,
                penzijaGodisnja = penzijaGodisnja
            )
        )
    }

    @JavascriptInterface
    fun obrisiKorisnika(id: String) = runBlocking {
        db.korisnikDao().deleteById(id)
        db.zaradaDao().deleteByKorisnik(id)
        db.stazDao().deleteByKorisnik(id)
    }

    // ========================================================================
    // ZARADE
    // ========================================================================

    @JavascriptInterface
    fun getZaradeKorisnika(id: String): String = runBlocking {
        val zarade = db.zaradaDao().getByKorisnik(id)
        val arr = JSONArray()
        zarade.forEach { z ->
            arr.put(JSONObject().apply {
                put("godina", z.godina)
                put("licnaZarada", z.licnaZarada)
                put("prosecnaPlata", z.prosecnaPlata)
                put("satiRada", z.satiRada)
                put("satiBolovanja", z.satiBolovanja)
            })
        }
        arr.toString()
    }

    @JavascriptInterface
    fun importZarade(id: String, json: String) = runBlocking {
        db.zaradaDao().deleteByKorisnik(id)
        val arr = JSONArray(json)
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            db.zaradaDao().insert(
                ZaradaEntity(
                    korisnikId = id,
                    godina = obj.getInt("godina"),
                    licnaZarada = obj.optDouble("licnaZarada", 0.0),
                    prosecnaPlata = obj.optDouble("prosecnaPlata", 0.0),
                    satiRada = obj.optInt("satiRada", 0),
                    satiBolovanja = obj.optInt("satiBolovanja", 0)
                )
            )
        }
    }

    // ========================================================================
    // STAŽ
    // ========================================================================

    @JavascriptInterface
    fun getStazKorisnika(id: String): String = runBlocking {
        val staz = db.stazDao().getByKorisnik(id)
        val arr = JSONArray()
        staz.forEach { s ->
            arr.put(JSONObject().apply {
                put("godina", s.godina)
                put("efektivniMeseci", s.efektivniMeseci)
                put("efektivniDani", s.efektivniDani)
                put("beneficiraniMeseci", s.beneficiraniMeseci)
                put("beneficiraniDani", s.beneficiraniDani)
                put("tipBeneficiranja", s.tipBeneficiranja)
            })
        }
        arr.toString()
    }

    @JavascriptInterface
    fun importStaz(id: String, json: String) = runBlocking {
        db.stazDao().deleteByKorisnik(id)
        val arr = JSONArray(json)
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            db.stazDao().insert(
                StazEntity(
                    korisnikId = id,
                    godina = obj.getInt("godina"),
                    efektivniMeseci = obj.optInt("efektivniMeseci", 0),
                    efektivniDani = obj.optInt("efektivniDani", 0),
                    beneficiraniMeseci = obj.optInt("beneficiraniMeseci", 0),
                    beneficiraniDani = obj.optInt("beneficiraniDani", 0),
                    tipBeneficiranja = obj.optString("tipBeneficiranja", "1212")
                )
            )
        }
    }

    // ========================================================================
    // PODEŠAVANJA
    // ========================================================================

    @JavascriptInterface
    fun getSetting(key: String): String? = prefs.getString(key)

    @JavascriptInterface
    fun setSetting(key: String, value: String) {
        prefs.putString(key, value)
    }

    // ========================================================================
    // DELJENJE
    // ========================================================================

    @JavascriptInterface
    fun sharePDF(base64: String, fileName: String): Boolean =
        PdfShareHelper.share(context, base64, fileName)

    @JavascriptInterface
    fun shareExcel(base64: String, fileName: String): Boolean =
        ExcelShareHelper.share(context, base64, fileName)
}