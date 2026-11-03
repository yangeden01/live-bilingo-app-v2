# Live Bilingo R8 rules
# Third-party libraries (AdMob, Play Review/Update, OkHttp, Media3, Compose, Coroutines)
# ship their own consumer rules; only app-specific rules belong here.

# WebView checks @JavascriptInterface at runtime, so annotations must survive.
# Keep line numbers for readable crash stacks (Play deobfuscates with mapping.txt).
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# JS bridge: the React frontend calls these by name via window.AndroidBridge / window.Android.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.bilingo.radio.ui.screens.WebAppInterface { *; }
