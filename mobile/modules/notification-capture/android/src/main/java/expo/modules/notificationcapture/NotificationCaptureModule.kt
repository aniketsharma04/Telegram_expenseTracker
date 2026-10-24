package expo.modules.notificationcapture

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.lang.ref.WeakReference

/**
 * The JavaScript side of notification capture.
 *
 * Deliberately small: check permission, send the user to the settings screen
 * that grants it, and drain the queue the listener has been filling. The
 * decisions about what a message means all live in TypeScript and on the
 * server, where they can be tested.
 */
class NotificationCaptureModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is unavailable" }

  override fun definition() = ModuleDefinition {
    Name("NotificationCapture")

    Events("onCapture")

    OnCreate { instance = WeakReference(this@NotificationCaptureModule) }
    OnDestroy { instance = null }

    /** Has the user granted notification access to this app? */
    Function("hasPermission") {
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      ).orEmpty()
      enabled.split(":").any { it.contains(context.packageName) }
    }

    /**
     * Opens the system screen where access is granted. There is no API to
     * grant it programmatically, by design — the user has to do it.
     */
    Function("openSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /** How many captures are waiting to be uploaded. */
    Function("pendingCount") { CaptureStore.pendingCount(context) }

    /** Returns everything queued and clears the queue in one step. */
    Function("drain") {
      val queue: JSONArray = CaptureStore.drain(context)
      (0 until queue.length()).map { index ->
        val item = queue.getJSONObject(index)
        mapOf(
          "body" to item.optString("body"),
          "package" to item.optString("package"),
          "external_id" to item.optString("external_id"),
          "received_at" to item.optLong("received_at")
        )
      }
    }

    /** Apps whose notifications are read. Everything else is ignored. */
    Function("getWatchedPackages") { CaptureStore.watchedPackages(context) }

    Function("setWatchedPackages") { packages: List<String> ->
      CaptureStore.setWatchedPackages(context, packages)
    }

    /**
     * Lets the background uploader post as the signed-in user (v15). Called on
     * every app start with the current session, and with null on logout so a
     * signed-out phone uploads nothing.
     */
    Function("setUploadConfig") { apiBase: String, session: String? ->
      CaptureStore.setUploadConfig(context, apiBase, session)
      if (!session.isNullOrBlank() && CaptureStore.pendingCount(context) > 0) {
        CaptureUploadWorker.schedule(context)
      }
    }

    /**
     * Android sometimes leaves a granted listener unbound — notably after an
     * app update — and it then hears nothing. Asking for a rebind is cheap.
     */
    Function("ensureListening") {
      try {
        NotificationListenerService.requestRebind(
          ComponentName(context, BankNotificationListenerService::class.java)
        )
        true
      } catch (e: Exception) {
        false
      }
    }

    /** True when Android may stop the app in the background to save battery. */
    Function("isBatteryOptimized") {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      !power.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** The system list where the user can exempt this app (no special permission needed). */
    Function("openBatterySettings") {
      val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /** This app's own settings page — where Xiaomi, Oppo and Vivo put "Autostart". */
    Function("openAppSettings") {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  /**
   * `sendEvent` is protected on Module, so the emit goes through an instance
   * method rather than being called from the companion object directly.
   */
  private fun emitCaptured(pending: Int) {
    sendEvent("onCapture", mapOf("pending" to pending))
  }

  companion object {
    private var instance: WeakReference<NotificationCaptureModule>? = null

    /**
     * Nudges JS when a capture lands while the app happens to be open. It is
     * only a nudge — the queue is the source of truth, and the app drains it
     * on foreground regardless.
     */
    fun notifyCaptured(pending: Int) {
      val module = instance?.get() ?: return
      try {
        module.emitCaptured(pending)
      } catch (e: Exception) {
        // The app may be tearing down; the queue survives either way.
      }
    }
  }
}
