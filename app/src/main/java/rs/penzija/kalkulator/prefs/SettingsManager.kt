package rs.penzija.kalkulator.prefs

import android.content.Context

/**
 * SharedPreferences wrapper za čuvanje podešavanja i dodatnih polja
 * (datumPoslednjegStaza po korisniku, aktivniKorisnikId, tema).
 */
class SettingsManager(context: Context) {

    private val prefs = context.getSharedPreferences("pio_settings", Context.MODE_PRIVATE)

    fun getString(key: String): String? = prefs.getString(key, null)

    fun putString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }
}