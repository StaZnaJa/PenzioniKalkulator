# Room
-keep class rs.penzija.kalkulator.db.** { *; }

# WebView JavaScriptInterface
-keepclassmembers class rs.penzija.kalkulator.WebAppInterface {
    public *;
}
-keepattributes JavascriptInterface

# JSON
-keep class org.json.** { *; }