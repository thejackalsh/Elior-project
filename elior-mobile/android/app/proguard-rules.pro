# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-vision-camera — Frame/Orientation diakses via JNI/JSI (reflection),
# R8 strip/rename bikin NoSuchMethodError getOrientation() di release build
-keep class com.mrousavy.camera.** { *; }

# Nitro modules (fast-tflite, dll) — HybridObject diakses via JNI
-keep class com.margelo.nitro.** { *; }

# react-native-worklets-core — worklet runtime diakses via JNI
-keep class com.worklets.** { *; }

# Add any project specific keep options here:
