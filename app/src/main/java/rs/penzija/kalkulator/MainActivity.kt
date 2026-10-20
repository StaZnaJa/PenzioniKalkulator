package rs.penzija.kalkulator

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 1001

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

            webViewClient = WebViewClient()

            // KLJUČNO: WebChromeClient koji obrađuje fajlove, prompt i confirm
            webChromeClient = object : WebChromeClient() {

                // 1. Otvaranje dijaloga za izbor fajla
                override fun onShowFileChooser(
                    webView: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    params: FileChooserParams?
                ): Boolean {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback

                    // Koristimo SAF (ACTION_OPEN_DOCUMENT) za Android 13+
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }

                    return try {
                        startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)
                        true
                    } catch (e: Exception) {
                        filePathCallback = null
                        false
                    }
                }

                // 2. prompt() dijalog (za izmenu korisnika)
                override fun onJsPrompt(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    defaultValue: String?,
                    result: JsPromptResult?
                ): Boolean {
                    val input = EditText(this@MainActivity)
                    input.setText(defaultValue)
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("Unos")
                        .setMessage(message)
                        .setView(input)
                        .setPositiveButton("OK") { _, _ -> result?.confirm(input.text.toString()) }
                        .setNegativeButton("Otkaži") { _, _ -> result?.cancel() }
                        .setOnCancelListener { result?.cancel() }
                        .show()
                    return true
                }

                // 3. confirm() dijalog (za brisanje korisnika)
                override fun onJsConfirm(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    result: JsResult?
                ): Boolean {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("Potvrda")
                        .setMessage(message)
                        .setPositiveButton("Da") { _, _ -> result?.confirm() }
                        .setNegativeButton("Ne") { _, _ -> result?.cancel() }
                        .setOnCancelListener { result?.cancel() }
                        .show()
                    return true
                }
            }

            addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidDB")
            loadUrl("file:///android_asset/index.html")
        }

        setContentView(webView)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) return
            val results = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
