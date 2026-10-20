package rs.penzija.kalkulator.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface StazDao {

    @Query("SELECT * FROM staz WHERE korisnikId = :id ORDER BY godina ASC")
    suspend fun getByKorisnik(id: String): List<StazEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(staz: StazEntity)

    @Query("DELETE FROM staz WHERE korisnikId = :id")
    suspend fun deleteByKorisnik(id: String)
}