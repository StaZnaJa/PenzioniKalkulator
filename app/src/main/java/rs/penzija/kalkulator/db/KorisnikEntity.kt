package rs.penzija.kalkulator.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "korisnici")
data class KorisnikEntity(
    @PrimaryKey val id: String,
    val ime: String,
    val pol: String,                    // 'M' ili 'Ž'
    val datumRodjenja: String,          // 'DD.MM.YYYY'
    val brojDece: Int,
    val kategorija: String,             // 'NE', 'MUP', 'VOJSKA', 'BIA', 'SPECIJALNE'
    val opstiBod: Double,
    val penzijaMesecno: Double,
    val penzijaGodisnja: Double
)