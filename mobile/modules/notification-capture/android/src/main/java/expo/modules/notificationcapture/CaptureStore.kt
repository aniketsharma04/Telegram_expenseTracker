package expo.modules.notificationcapture

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * The queue between the notification listener and JavaScript.
 *
 * The listener runs whether or not the app is open — often it is not — so
 * captures are written to SharedPreferences and drained the next time the
 * app comes to the foreground. Nothing is sent anywhere from native code:
 * the upload happens in JS, with the user's session token, to the app's own
 * API and nowhere else.
 */
object CaptureStore {
  private const val PREFS = "notification_capture"
  private const val KEY_QUEUE = "queue"
  private const val KEY_PACKAGES = "packages"
  private const val MAX_QUEUED = 200

  /**
   * Only notifications from these apps are ever looked at. Keeping this list
   * narrow is the privacy guarantee: chats, email and everything else are
   * never read, let alone stored.
   */
  val DEFAULT_PACKAGES = listOf(
    // SMS apps — where bank alerts actually arrive for most people
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.android.mms",
    "com.android.messaging",
    // Banks
    "com.snapwork.hdfc",            // HDFC
    "com.csam.icici.bank.imobile",  // ICICI
    "com.sbi.lotusintouch",         // SBI YONO
    "com.sbi.SBIFreedomPlus",       // SBI Anywhere
    "com.axis.mobile",              // Axis
    "com.msf.kbank.mobile",         // Kotak
    "com.bankofbaroda.mconnect",
    "com.infrasofttech.indianbankmobile",
    "com.fss.pnbpsp",               // PNB
    "com.YesBank",
    "com.idbibank.gomobile",
    "com.canarabank.mobility",
    // UPI / wallets
    "com.google.android.apps.nbu.paisa.user", // GPay
    "net.one97.paytm",
    "com.phonepe.app",
    "in.amazon.mShop.android.shopping",
    "com.dreamplug.androidapp"      // CRED
  )

  /** A capture must look like money moving, or it is dropped unread. */
  private val MONEY = Regex("""(?:rs\.?|inr|₹)\s*[\d,]+""", RegexOption.IGNORE_CASE)
  private val MOVEMENT = Regex(
    """\b(debited|credited|spent|paid|sent|received|withdrawn|deposited|purchase)\b""",
    RegexOption.IGNORE_CASE
  )

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun watchedPackages(context: Context): List<String> {
    val stored = prefs(context).getString(KEY_PACKAGES, null) ?: return DEFAULT_PACKAGES
    return try {
      val array = JSONArray(stored)
      (0 until array.length()).map { array.getString(it) }
    } catch (e: Exception) {
      DEFAULT_PACKAGES
    }
  }

  fun setWatchedPackages(context: Context, packages: List<String>) {
    prefs(context).edit().putString(KEY_PACKAGES, JSONArray(packages).toString()).apply()
  }

  /** True when the text is worth queueing at all. */
  fun looksFinancial(text: String): Boolean =
    MONEY.containsMatchIn(text) && MOVEMENT.containsMatchIn(text)

  @Synchronized
  fun enqueue(context: Context, item: JSONObject) {
    val queue = readQueue(context)
    // A re-posted notification carries the same key; don't queue it twice.
    val key = item.optString("external_id")
    if (key.isNotEmpty()) {
      for (i in 0 until queue.length()) {
        if (queue.getJSONObject(i).optString("external_id") == key) return
      }
    }
    queue.put(item)
    // Oldest out first if the app hasn't been opened in a very long time.
    while (queue.length() > MAX_QUEUED) queue.remove(0)
    prefs(context).edit().putString(KEY_QUEUE, queue.toString()).apply()
  }

  @Synchronized
  fun drain(context: Context): JSONArray {
    val queue = readQueue(context)
    prefs(context).edit().remove(KEY_QUEUE).apply()
    return queue
  }

  fun pendingCount(context: Context): Int = readQueue(context).length()

  private fun readQueue(context: Context): JSONArray {
    val raw = prefs(context).getString(KEY_QUEUE, null) ?: return JSONArray()
    return try {
      JSONArray(raw)
    } catch (e: Exception) {
      JSONArray()
    }
  }
}
