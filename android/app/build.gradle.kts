plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.bilingo.radio"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.bilingo.radio"
        minSdk = 24
        targetSdk = 36
        versionCode = 232
        versionName = "2.3.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val ksFile = project.file("release.keystore")
            val storePass = System.getenv("RELEASE_STORE_PASSWORD")?.ifEmpty { null }
                ?: System.getenv("KEYSTORE_PASSWORD")?.ifEmpty { null }
                ?: "bilingo123456"
            val keyPass = System.getenv("RELEASE_KEY_PASSWORD")?.ifEmpty { null }
                ?: System.getenv("KEY_PASSWORD")?.ifEmpty { null }
                ?: storePass
            val alias = System.getenv("RELEASE_KEY_ALIAS")?.ifEmpty { null }
                ?: System.getenv("KEY_ALIAS")?.ifEmpty { null }
                ?: "bilingokey"

            storeFile = ksFile
            storePassword = storePass
            keyAlias = alias
            keyPassword = keyPass
            enableV1Signing = true
            enableV2Signing = true
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = false
        resValues = false
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/DEPENDENCIES"
        }
    }
}

configurations.all {
    resolutionStrategy {
        force("androidx.fragment:fragment:1.8.6")
        force("androidx.fragment:fragment-ktx:1.8.6")
    }
}

dependencies {
    // AndroidX & Lifecycle
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.2")
    implementation("androidx.activity:activity-compose:1.9.0")
    // Explicitly update androidx.fragment to latest stable version to eliminate Google Play Console 1.1.0 warning
    implementation("androidx.fragment:fragment-ktx:1.8.6")

    // Jetpack Compose & Material 3
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    debugImplementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.compose.material:material-icons-extended")

    // AndroidX WebKit for WebViewAssetLoader
    implementation("androidx.webkit:webkit:1.11.0")

    // AndroidX Media3 (ExoPlayer & MediaSession)
    implementation("androidx.media3:media3-exoplayer:1.3.1")
    implementation("androidx.media3:media3-session:1.3.1")
    implementation("androidx.media:media:1.7.0")

    // Networking (OkHttp for WebSockets & Gemini REST API)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okio:okio:3.9.0")

    // Google Play In-App Update API
    implementation("com.google.android.play:app-update:2.1.0")
    implementation("com.google.android.play:app-update-ktx:2.1.0")

    // Coroutines & JSON Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
}
