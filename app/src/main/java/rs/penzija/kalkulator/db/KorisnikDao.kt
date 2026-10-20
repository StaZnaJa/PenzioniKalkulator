package rs.penzija.kalkulator.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface KorisnikDao {

    @Query("SELECT * FROM korisnici ORDER BY ime ASC")
    suspend fun getAll(): List<KorisnikEntity>

    @Query("SELECT * FROM korisnici WHERE id = :id")
    suspend fun getById(id: String): KorisnikEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(korisnik: KorisnikEntity)

    @Query("DELETE FROM korisnici WHERE id = :id")
    suspend fun deleteById(id: String)
}