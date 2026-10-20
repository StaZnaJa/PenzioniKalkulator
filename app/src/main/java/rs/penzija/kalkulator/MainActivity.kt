package rs.penzija.kalkulator

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

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

            // Poveži JS sa AndroidDB
            addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidDB")

            // Učitaj index.html iz assets
            loadUrl("file:///android_asset/index.html")
        }

        setContentView(webView)
    }

    // Back dugme — vraća se kroz WebView history
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