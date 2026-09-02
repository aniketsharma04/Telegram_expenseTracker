package expo.modules.notificationcapture

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Reads bank alerts as they arrive.
 *
 * Android only starts this service after the user grants notification access
 * by hand in system settings. Three filters run before anything is kept:
 *
 *   1. the notification must come from a watched app (see CaptureStore)
 *   2. its text must look like money moving
 *   3. ongoing and group-summary notifications are skipped
 *
 * Anything that survives is queued locally. The service never touches the
 * network — JavaScript drains the queue and uploads it with the user's own
 * session token.
 */
class BankNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val notification = sbn ?: return
    try {
      capture(notification)
    } catch (e: Exception) {
      // A malformed notification must never crash the listener; losing one
      // capture is survivable, losing the service is not.
      android.util.Log.w(TAG, "capture failed", e)
    }
  }

  private fun capture(sbn: StatusBarNotification) {
    val packageName = sbn.packageName ?: return
    if (!CaptureStore.watchedPackages(applicationContext).contains(packageName)) return

    val extras = sbn.notification?.extras ?: return
    val flags = sbn.notification?.flags ?: 0
    if (flags and Notification.FLAG_ONGOING_EVENT != 0) return
    if (flags and Notification.FLAG_GROUP_SUMMARY != 0) return

    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    // bigText carries the full SMS; text is often truncated with an ellipsis.
    val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))
      ?.toString()
      .orEmpty()

    val text = listOf(title, body).filter { it.isNotBlank() }.joinToString(". ").trim()
    if (text.length < 20) return
    if (!CaptureStore.looksFinancial(text)) return

    val item = JSONObject().apply {
      put("body", text)
      put("package", packageName)
      // Stable across re-posts of the same alert, so drains are idempotent.
      put("external_id", "${sbn.key ?: packageName}:${sbn.postTime}")
      put("received_at", sbn.postTime)
    }
    CaptureStore.enqueue(applicationContext, item)
    NotificationCaptureModule.notifyCaptured(CaptureStore.pendingCount(applicationContext))
  }

  companion object {
    private const val TAG = "BankNotifCapture"
  }
}
