plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "rs.penzija.kalkulator"
    compileSdk = 34

    defaultConfig {
        applicationId = "rs.penzija.kalkulator"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // Ako budete koristili View Binding
    buildFeatures {
        viewBinding = true
    }

    // Assets — ne kompresuj .xlsx, .pdf, .mht
    androidResources {
        noCompress += listOf("xlsx", "pdf", "mht", "mhtml")
    }
}

dependencies {
    // AndroidX osnove
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // WebView
    implementation("androidx.webkit:webkit:1.10.0")

    // Room (SQLite baza)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Coroutines (za Room operacije van glavnog thread-a)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")

    // FileProvider (za deljenje fajlova)
    implementation("androidx.core:core-ktx:1.12.0")

    // Opciono: JSON (Android ima org.json ugrađen, ali ako želite Gson)
    // implementation("com.google.code.gson:gson:2.10.1")
}