package expo.modules.nexoraads

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import com.inmobi.ads.AdMetaInfo
import com.inmobi.ads.InMobiAdRequestStatus
import com.inmobi.ads.InMobiBanner
import com.inmobi.ads.InMobiInterstitial
import com.inmobi.ads.listeners.BannerAdEventListener
import com.inmobi.ads.listeners.InterstitialAdEventListener
import com.inmobi.sdk.InMobiSdk
import com.inmobi.sdk.SdkInitializationListener
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

/**
 * InMobi banner + interstitial for the WebView shell. The rules (when to show what) live in
 * src/core/ads.ts; this module only executes. Every entry point is wrapped so an SDK problem never
 * crashes the app: ads simply do not appear.
 */
class NexoraAdsModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var initStarted = false
  private var ready = false
  private var pendingBanner: Pair<Long, Int>? = null
  private var pendingInterstitial: Long? = null

  private var bannerHolder: FrameLayout? = null
  private var banner: InMobiBanner? = null
  private var bannerWanted = false

  private var interstitial: InMobiInterstitial? = null
  private var interstitialLoaded = false
  private var interstitialShowing = false

  private val activity: Activity? get() = appContext.currentActivity

  private fun ui(block: () -> Unit) {
    main.post {
      try {
        block()
      } catch (t: Throwable) {
        Log.w(TAG, "ad call failed", t)
      }
    }
  }

  private fun dp(v: Int): Int {
    val a = activity ?: return v
    return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), a.resources.displayMetrics).toInt()
  }

  private fun emitBanner(visible: Boolean) {
    try {
      sendEvent("onBanner", mapOf("visible" to visible, "height" to if (visible) BANNER_H else 0))
    } catch (t: Throwable) {
      Log.w(TAG, "event failed", t)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NexoraAds")
    Events("onBanner")

    Function("init") { accountId: String, consentJson: String, ageRestricted: Boolean ->
      ui {
        if (initStarted || accountId.isBlank()) return@ui
        val a = activity ?: return@ui
        initStarted = true
        val consent = try { JSONObject(consentJson) } catch (t: Throwable) { JSONObject() }
        // No consent tool yet: no device identifiers are sent (see docs/ADS.md).
        InMobiSdk.setIsAgeRestricted(ageRestricted)
        InMobiSdk.init(a, accountId, consent, object : SdkInitializationListener {
          override fun onInitializationComplete(error: Error?) {
            ui {
              if (error != null) {
                Log.w(TAG, "InMobi init failed: ${error.message}")
                return@ui
              }
              ready = true
              pendingBanner?.let { (id, inset) -> if (bannerWanted) createBanner(id, inset) }
              pendingBanner = null
              pendingInterstitial?.let { createInterstitial(it) }
              pendingInterstitial = null
            }
          }
        })
      }
    }

    Function("showBanner") { placementId: String, bottomInsetDp: Int ->
      ui {
        val id = placementId.toLongOrNull() ?: return@ui
        bannerWanted = true
        if (!ready) {
          pendingBanner = id to bottomInsetDp
          return@ui
        }
        val holder = bannerHolder
        if (holder != null && banner != null) {
          (holder.layoutParams as? FrameLayout.LayoutParams)?.let {
            it.bottomMargin = dp(bottomInsetDp)
            holder.layoutParams = it
          }
          holder.visibility = android.view.View.VISIBLE
          emitBanner(true)
          return@ui
        }
        createBanner(id, bottomInsetDp)
      }
    }

    Function("hideBanner") {
      ui {
        bannerWanted = false
        pendingBanner = null
        destroyBanner()
      }
    }

    Function("loadInterstitial") { placementId: String ->
      ui {
        val id = placementId.toLongOrNull() ?: return@ui
        if (!ready) {
          pendingInterstitial = id
          return@ui
        }
        if (interstitial == null || !interstitialLoaded) createInterstitial(id)
      }
    }

    Function("showInterstitial") { placementId: String ->
      ui {
        val ad = interstitial
        if (ready && ad != null && interstitialLoaded && !interstitialShowing && ad.isReady()) {
          interstitialShowing = true
          ad.show()
        } else {
          // Not ready: skip this time (never wait and show later), prepare the next one.
          placementId.toLongOrNull()?.let { if (ready && !interstitialLoaded) createInterstitial(it) }
        }
      }
    }

    OnActivityDestroys {
      try {
        destroyBanner()
      } catch (_: Throwable) {}
    }
  }

  private fun createBanner(placementId: Long, bottomInsetDp: Int) {
    val a = activity ?: return
    destroyBanner()
    val root = a.findViewById<ViewGroup>(android.R.id.content) ?: return
    val holder = FrameLayout(a)
    val lp = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(BANNER_H), Gravity.BOTTOM)
    lp.bottomMargin = dp(bottomInsetDp)
    root.addView(holder, lp)
    val b = InMobiBanner(a, placementId)
    b.setAnimationType(InMobiBanner.AnimationType.ANIMATION_OFF)
    b.setListener(object : BannerAdEventListener() {
      override fun onAdLoadSucceeded(ad: InMobiBanner, info: AdMetaInfo) {
        ui { if (bannerWanted && banner === ad) emitBanner(true) }
      }

      override fun onAdLoadFailed(ad: InMobiBanner, status: InMobiAdRequestStatus) {
        Log.i(TAG, "banner load failed: ${status.message}")
        ui { if (banner === ad && bannerWanted) emitBanner(false) }
      }
    })
    // Pixel size first, then load (WRAP_CONTENT is rejected by the SDK).
    holder.addView(b, FrameLayout.LayoutParams(dp(320), dp(BANNER_H), Gravity.CENTER_HORIZONTAL))
    bannerHolder = holder
    banner = b
    b.load()
  }

  private fun destroyBanner() {
    val hadBanner = banner != null
    banner?.let {
      try { it.destroy() } catch (_: Throwable) {}
    }
    banner = null
    bannerHolder?.let { (it.parent as? ViewGroup)?.removeView(it) }
    bannerHolder = null
    if (hadBanner) emitBanner(false)
  }

  private fun createInterstitial(placementId: Long) {
    val a = activity ?: return
    interstitialLoaded = false
    val ad = InMobiInterstitial(a, placementId, object : InterstitialAdEventListener() {
      override fun onAdLoadSucceeded(ad: InMobiInterstitial, info: AdMetaInfo) {
        ui { if (interstitial === ad) interstitialLoaded = true }
      }

      override fun onAdLoadFailed(ad: InMobiInterstitial, status: InMobiAdRequestStatus) {
        Log.i(TAG, "interstitial load failed: ${status.message}")
        ui { if (interstitial === ad) interstitialLoaded = false }
      }

      override fun onAdDisplayFailed(ad: InMobiInterstitial) {
        ui { done(ad) }
      }

      override fun onAdDismissed(ad: InMobiInterstitial) {
        ui { done(ad) }
      }
    })
    interstitial = ad
    ad.load()
  }

  private fun done(ad: InMobiInterstitial) {
    if (interstitial === ad) {
      interstitial = null
      interstitialLoaded = false
    }
    interstitialShowing = false
  }

  companion object {
    private const val TAG = "NexoraAds"
    private const val BANNER_H = 50
  }
}
