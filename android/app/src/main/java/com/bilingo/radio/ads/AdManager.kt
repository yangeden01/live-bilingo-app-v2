package com.bilingo.radio.ads

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback

/**
 * AdManager handles Google AdMob Interstitial and Rewarded Ads.
 * Designed for High-Yield Monetization (Option C: Feature Reward + Interstitial).
 *
 * Ad Units:
 * - Official Google Test Interstitial: ca-app-pub-3940256099942544/1033173712
 * - Official Google Test Rewarded: ca-app-pub-3940256099942544/5224354917
 */
object AdManager {
    private const val TAG = "LiveBilingoAdManager"

    // Official Production Ad Unit IDs
    private const val TEST_INTERSTITIAL_ID = "ca-app-pub-7732369001198376/1373559240"
    private const val TEST_REWARDED_ID = "ca-app-pub-7732369001198376/1362695815"

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
        Log.i(TAG, "Requesting AdMob Interstitial Ad with unit ID: $TEST_INTERSTITIAL_ID")
        InterstitialAd.load(
            appContext,
            TEST_INTERSTITIAL_ID,
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
        Log.i(TAG, "Requesting AdMob Rewarded Ad with unit ID: $TEST_REWARDED_ID")
        RewardedAd.load(
            appContext,
            TEST_REWARDED_ID,
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
