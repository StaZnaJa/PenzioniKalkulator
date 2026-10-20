package rs.penzija.kalkulator.share

import android.content.Context
import android.content.Intent
import android.util.Base64
import androidx.core.content.FileProvider
import java.io.File

/**
 * Pomoćna klasa za deljenje PDF fajlova preko Intent.ACTION_SEND.
 * Prima base64 string, dekodira ga, upisuje u cache i deli preko FileProvider-a.
 */
object PdfShareHelper {

    fun share(context: Context, base64: String, fileName: String): Boolean {
        return try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val file = File(context.cacheDir, fileName)
            file.writeBytes(bytes)

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            context.startActivity(
                Intent.createChooser(intent, "Podeli PDF")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}