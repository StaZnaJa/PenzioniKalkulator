package rs.penzija.kalkulator.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "staz")
data class StazEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val korisnikId: String,
    val godina: Int,
    val efektivniMeseci: Int,
    val efektivniDani: Int,
    val beneficiraniMeseci: Int,
    val beneficiraniDani: Int,
    val tipBeneficiranja: String        // '1212', '1214', '1215', '1216', '1218'
)