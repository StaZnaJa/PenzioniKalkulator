package rs.penzija.kalkulator.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ZaradaDao {

    @Query("SELECT * FROM zarade WHERE korisnikId = :id ORDER BY godina ASC")
    suspend fun getByKorisnik(id: String): List<ZaradaEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(zarada: ZaradaEntity)

    @Query("DELETE FROM zarade WHERE korisnikId = :id")
    suspend fun deleteByKorisnik(id: String)
}