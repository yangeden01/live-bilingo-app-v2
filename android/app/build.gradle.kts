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
        versionCode = 277
        versionName = "2.7.7"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // AdMob：-PuseTestAds=true 時 release 也強制改用 Google 測試廣告（CI 模擬器測試用）。
        // 預設 false，上架用的 bundleRelease 不帶此參數，維持正式廣告。
        val useTestAds = (project.findProperty("useTestAds") as String?)
            ?.trim()?.equals("true", ignoreCase = true) ?: false
        buildConfigField("boolean", "USE_TEST_ADS", useTestAds.toString())
    }

    signingConfigs {
        create("release") {
            // 上傳金鑰只從環境變數讀取：CI 由 android/app/ensure_keystore.py 從 GitHub Secrets 解碼到
            // repo 外的暫存目錄。repo 內不放金鑰、不寫死密碼；沒有設定時 release 不簽署，Play 會拒收。
            val ksPath = System.getenv("RELEASE_KEYSTORE_PATH")?.ifEmpty { null }
            if (ksPath != null && file(ksPath).exists()) {
                storeFile = file(ksPath)
                storePassword = System.getenv("RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
            }
            enableV1Signing = true
            enableV2Signing = true
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            // R8 code shrinking & obfuscation (Play Console DEX optimization requirement)
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            // debug 版用 Android 預設的 debug 金鑰，不用上傳金鑰簽署
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
        // AdManager 需要 BuildConfig.DEBUG / BuildConfig.USE_TEST_ADS
        buildConfig = true
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

    // Google Play In-App Review API (Native 5-star rating without leaving app)
    implementation("com.google.android.play:review:2.0.1")
    implementation("com.google.android.play:review-ktx:2.0.1")

    // Google Mobile Ads (AdMob - Option C High Monetization: Rewarded & Interstitial Ads)
    implementation("com.google.android.gms:play-services-ads:23.0.0")

    // Coroutines & JSON Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
}
