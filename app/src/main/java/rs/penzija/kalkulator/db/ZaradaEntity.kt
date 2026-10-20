package rs.penzija.kalkulator.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "zarade")
data class ZaradaEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val korisnikId: String,
    val godina: Int,
    val licnaZarada: Double,
    val prosecnaPlata: Double,
    val satiRada: Int,
    val satiBolovanja: Int
)