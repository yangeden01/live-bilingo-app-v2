package com.bilingo.radio.ads

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.bilingo.radio.BuildConfig
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback

/**
 * AdManager handles Google AdMob Interstitial and Rewarded Ads.
 * Designed for High-Yield Monetization (Option C: Feature Reward + Interstitial).
 *
 * 廣告單元選擇（避免開發者自己點到正式廣告）：
 * - debug 建置（BuildConfig.DEBUG = true）→ 一律使用 Google 官方測試廣告單元
 * - release 建置且 BuildConfig.USE_TEST_ADS = true（Gradle 參數 -PuseTestAds=true，
 *   給 CI 模擬器測試用）→ 使用 Google 官方測試廣告單元
 * - 其他 release 建置（上架 Play 的 AAB）→ 使用正式廣告單元
 *
 * 另外 MY_TEST_DEVICE_IDS 內的裝置，即使安裝正式版、載入正式廣告單元，
 * AdMob 也只會回傳測試廣告（廣告上有 "Test Ad" 標籤），不會計入正式曝光與點擊。
 *
 * 正式廣告單元：
 * - Interstitial: ca-app-pub-7732369001198376/1373559240
 * - Rewarded:     ca-app-pub-7732369001198376/1362695815
 * Google 官方測試廣告單元：
 * - Interstitial: ca-app-pub-3940256099942544/1033173712
 * - Rewarded:     ca-app-pub-3940256099942544/5224354917
 */
object AdManager {
    private const val TAG = "LiveBilingoAdManager"

    // 正式廣告單元（只給上架版 release 使用）
    private const val PROD_INTERSTITIAL_ID = "ca-app-pub-7732369001198376/1373559240"
    private const val PROD_REWARDED_ID = "ca-app-pub-7732369001198376/1362695815"

    // Google 官方測試廣告單元（debug 與 CI 模擬器使用）
    private const val TEST_INTERSTITIAL_ID = "ca-app-pub-3940256099942544/1033173712"
    private const val TEST_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917"

    /**
     * 測試裝置清單：清單中的裝置一律收到測試廣告，即使安裝的是上架正式版。
     *
     * 取得方式：在自己的平板／手機上開啟 App 一次，於 logcat 搜尋 "setTestDeviceIds"，
     * 會看到類似這行：
     *   Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("33BE2250B43518CCDA7DE426D04EE231"))
     * 把引號內的 hashed device ID 貼到下面清單（可放多台裝置）。
     * 模擬器會自動被視為測試裝置，不需要加入。
     */
    private val MY_TEST_DEVICE_IDS: List<String> = listOf(
        "9A3921A4E2DFD93008D68E373DF8BD9B", // 開發者手機（由 Play 版取得）
    )

    /** true = 使用 Google 測試廣告單元；false = 使用正式廣告單元 */
    private val useTestAdUnits: Boolean = BuildConfig.DEBUG || BuildConfig.USE_TEST_ADS

    private val interstitialAdUnitId: String =
        if (useTestAdUnits) TEST_INTERSTITIAL_ID else PROD_INTERSTITIAL_ID
    private val rewardedAdUnitId: String =
        if (useTestAdUnits) TEST_REWARDED_ID else PROD_REWARDED_ID

    // Frequency Capping: minimum 120 seconds (2 mins) between interstitials
    private const val MIN_INTERSTITIAL_INTERVAL_MS = 120_000L
    private var lastInterstitialTimeMs: Long = 0L

    private var interstitialAd: InterstitialAd? = null
    private var isInterstitialLoading: Boolean = false

    private var rewardedAd: RewardedAd? = null
    private var isRewardedLoading: Boolean = false

    private var isInitialized: Boolean = false

    fun initialize(context: Context) {
        if (isInitialized) return
        Log.i(
            TAG,
            "Ad mode: ${if (useTestAdUnits) "TEST" else "PRODUCTION"} " +
                "(DEBUG=${BuildConfig.DEBUG}, USE_TEST_ADS=${BuildConfig.USE_TEST_ADS}, " +
                "interstitial=$interstitialAdUnitId, rewarded=$rewardedAdUnitId, " +
                "testDevices=${MY_TEST_DEVICE_IDS.size})"
        )
        try {
            // 必須在 MobileAds.initialize 之前設定，測試裝置才會一律收到測試廣告
            val requestConfiguration = RequestConfiguration.Builder()
                .setTestDeviceIds(MY_TEST_DEVICE_IDS)
                .build()
            MobileAds.setRequestConfiguration(requestConfiguration)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set test device IDs: ${e.message}", e)
        }
        try {
            MobileAds.initialize(context) { initializationStatus ->
                Log.i(TAG, "Google Mobile Ads initialized successfully: $initializationStatus")
                isInitialized = true
                preloadAds(context.applicationContext)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MobileAds: ${e.message}", e)
        }
    }

    fun preloadAds(context: Context) {
        val appContext = context.applicationContext
        loadInterstitialAd(appContext)
        loadRewardedAd(appContext)
    }

    /**
     * Preloads Interstitial Ad
     */
    fun loadInterstitialAd(context: Context) {
        if (interstitialAd != null || isInterstitialLoading) return
        isInterstitialLoading = true
        val appContext = context.applicationContext
        val adRequest = AdRequest.Builder().build()
        Log.i(TAG, "Requesting AdMob Interstitial Ad with unit ID: $interstitialAdUnitId")
        InterstitialAd.load(
            appContext,
            interstitialAdUnitId,
            adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    isInterstitialLoading = false
                    Log.i(TAG, "Interstitial ad loaded successfully and ready to display.")
                }

                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    interstitialAd = null
                    isInterstitialLoading = false
                    Log.w(TAG, "Interstitial ad failed to load: ${loadAdError.message} (code: ${loadAdError.code})")
                }
            }
        )
    }

    /**
     * Shows Interstitial Ad with frequency cap check.
     */
    fun showInterstitialAd(
        activity: Activity,
        isVipAdFree: Boolean = false,
        onAdClosed: () -> Unit = {}
    ) {
        if (isVipAdFree) {
            Log.i(TAG, "User has active VIP Ad-Free pass. Skipping interstitial.")
            onAdClosed()
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastInterstitialTimeMs < MIN_INTERSTITIAL_INTERVAL_MS) {
            val remainSeconds = (MIN_INTERSTITIAL_INTERVAL_MS - (now - lastInterstitialTimeMs)) / 1000
            Log.i(TAG, "Interstitial frequency cap active ($remainSeconds s left). Skipping.")
            onAdClosed()
            return
        }

        Handler(Looper.getMainLooper()).post {
            val ad = interstitialAd
            if (ad != null) {
                ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                    override fun onAdDismissedFullScreenContent() {
                        interstitialAd = null
                        lastInterstitialTimeMs = System.currentTimeMillis()
                        Log.i(TAG, "Interstitial ad dismissed by user.")
                        loadInterstitialAd(activity.applicationContext)
                        onAdClosed()
                    }

                    override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                        interstitialAd = null
                        Log.w(TAG, "Interstitial ad failed to show: ${adError.message}")
                        loadInterstitialAd(activity.applicationContext)
                        onAdClosed()
                    }

                    override fun onAdShowedFullScreenContent() {
                        Log.i(TAG, "Interstitial ad successfully showed full screen! Counted impression in AdMob.")
                    }
                }
                Log.i(TAG, "Calling ad.show(activity) for Interstitial Ad...")
                ad.show(activity)
            } else {
                Log.i(TAG, "Interstitial ad not ready, preloading now for next trigger.")
                loadInterstitialAd(activity.applicationContext)
                onAdClosed()
            }
        }
    }

    /**
     * Preloads Rewarded Ad
     */
    fun loadRewardedAd(context: Context) {
        if (rewardedAd != null || isRewardedLoading) return
        isRewardedLoading = true
        val appContext = context.applicationContext
        val adRequest = AdRequest.Builder().build()
        Log.i(TAG, "Requesting AdMob Rewarded Ad with unit ID: $rewardedAdUnitId")
        RewardedAd.load(
            appContext,
            rewardedAdUnitId,
            adRequest,
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    rewardedAd = ad
                    isRewardedLoading = false
                    Log.i(TAG, "Rewarded video ad loaded successfully and ready.")
                }

                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    rewardedAd = null
                    isRewardedLoading = false
                    Log.w(TAG, "Rewarded ad failed to load: ${loadAdError.message} (code: ${loadAdError.code})")
                }
            }
        )
    }

    /**
     * Shows Rewarded Ad for feature unlock (Option C).
     */
    fun showRewardedAd(
        activity: Activity,
        rewardType: String,
        onUserEarnedReward: (rewardType: String) -> Unit,
        onAdClosed: (earnedReward: Boolean) -> Unit
    ) {
        Handler(Looper.getMainLooper()).post {
            val ad = rewardedAd
            if (ad != null) {
                var userEarnedReward = false
                ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                    override fun onAdDismissedFullScreenContent() {
                        rewardedAd = null
                        Log.i(TAG, "Rewarded ad dismissed by user. Earned reward: $userEarnedReward")
                        loadRewardedAd(activity.applicationContext)
                        onAdClosed(userEarnedReward)
                    }

                    override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                        rewardedAd = null
                        Log.w(TAG, "Rewarded ad failed to show: ${adError.message}")
                        loadRewardedAd(activity.applicationContext)
                        onAdClosed(false)
                    }

                    override fun onAdShowedFullScreenContent() {
                        Log.i(TAG, "Rewarded ad showing full screen! Counted impression in AdMob.")
                    }
                }

                Log.i(TAG, "Calling ad.show(activity) for Rewarded Ad ($rewardType)...")
                ad.show(activity) { rewardItem ->
                    userEarnedReward = true
                    Log.i(TAG, "User earned reward: ${rewardItem.type} (${rewardItem.amount}) for $rewardType")
                    onUserEarnedReward(rewardType)
                }
            } else {
                Log.w(TAG, "Rewarded ad not ready yet. Preloading now...")
                loadRewardedAd(activity.applicationContext)
                onAdClosed(false)
            }
        }
    }

    fun isRewardedAdReady(): Boolean = rewardedAd != null
    fun isInterstitialAdReady(): Boolean = interstitialAd != null
}
