package expo.modules.notificationcapture

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * The queue between the notification listener and the uploaders.
 *
 * The listener runs whether or not the app is open — often it is not — so
 * captures are written to SharedPreferences first. CaptureUploadWorker sends
 * them to the app's own API in the background (v15), and the app drains
 * whatever is left when it comes to the foreground. Both use the user's own
 * session token and nothing else; no capture goes anywhere but that API.
 */
object CaptureStore {
  private const val PREFS = "notification_capture"
  private const val KEY_QUEUE = "queue"
  private const val KEY_PACKAGES = "packages"
  private const val KEY_API_BASE = "api_base"
  private const val KEY_SESSION = "session"
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
    "com.truecaller",                 // many Indians' default SMS app
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
    "com.dreamplug.androidapp",     // CRED
    "in.org.npci.upiapp",           // BHIM
    "com.mobikwik_new",             // MobiKwik
    "money.jupiter",                // Jupiter
    "com.epifi.paisa",              // Fi
    "indwin.c3.shareapp"            // slice
  )

  /** A capture must look like money moving, or it is dropped unread. */
  private val MONEY = Regex("""(?:rs\.?|inr|₹)\s*[\d,]+""", RegexOption.IGNORE_CASE)
  private val MOVEMENT = Regex(
    """\b(debited|credited|spent|paid|sent|received|withdrawn|deposited|purchase)\b""",
    RegexOption.IGNORE_CASE
  )

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Defaults plus anything the user added — so apps added in an update are watched too. */
  fun watchedPackages(context: Context): List<String> {
    val stored = prefs(context).getString(KEY_PACKAGES, null) ?: return DEFAULT_PACKAGES
    return try {
      val array = JSONArray(stored)
      (DEFAULT_PACKAGES + (0 until array.length()).map { array.getString(it) }).distinct()
    } catch (e: Exception) {
      DEFAULT_PACKAGES
    }
  }

  /** Where and as whom the background uploader posts. Null token = signed out. */
  fun setUploadConfig(context: Context, apiBase: String, session: String?) {
    val edit = prefs(context).edit().putString(KEY_API_BASE, apiBase)
    if (session.isNullOrBlank()) edit.remove(KEY_SESSION) else edit.putString(KEY_SESSION, session)
    edit.apply()
  }

  fun uploadConfig(context: Context): Pair<String, String>? {
    val p = prefs(context)
    val base = p.getString(KEY_API_BASE, null) ?: return null
    val session = p.getString(KEY_SESSION, null) ?: return null
    return base to session
  }

  /** The oldest `limit` captures, left in place until an upload succeeds. */
  @Synchronized
  fun snapshot(context: Context, limit: Int): JSONArray {
    val queue = readQueue(context)
    val out = JSONArray()
    for (i in 0 until minOf(limit, queue.length())) out.put(queue.getJSONObject(i))
    return out
  }

  /** Drop the captures that were uploaded; anything queued meanwhile stays. */
  @Synchronized
  fun remove(context: Context, externalIds: Set<String>) {
    val queue = readQueue(context)
    val kept = JSONArray()
    for (i in 0 until queue.length()) {
      val item = queue.getJSONObject(i)
      if (item.optString("external_id") !in externalIds) kept.put(item)
    }
    prefs(context).edit().putString(KEY_QUEUE, kept.toString()).apply()
  }

  fun setWatchedPackages(context: Context, packages: List<String>) {
    prefs(context).edit().putString(KEY_PACKAGES, JSONArray(packages).toString()).apply()
  }

  private val CODE_WORD = Regex(
    """\b(?:otp|one[- ]time password|verification code|passcode)\b""",
    RegexOption.IGNORE_CASE
  )
  private val NOT_CODES = listOf(
    Regex("""(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d+)?""", RegexOption.IGNORE_CASE), // amounts
    Regex("""\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b"""),                       // dates
    Regex("""(?:a/c|acct|account|ac|card)\s*(?:no\.?)?\s*[xX*•]*\d{3,6}\b""", RegexOption.IGNORE_CASE),
    Regex("""\b\d{9,}\b""")                                                  // refs, phone numbers
  )
  private val CODE = Regex("""\b\d{4,8}\b""")

  /**
   * An OTP message rather than a payment: a code word *and* an actual code.
   * Many real debit alerts end "never share your OTP", so the word alone must
   * not drop them. Same rule as carriesCode() in the server's bank-message.ts.
   */
  fun carriesCode(text: String): Boolean {
    if (!CODE_WORD.containsMatchIn(text)) return false
    var rest = text
    for (pattern in NOT_CODES) rest = pattern.replace(rest, " ")
    return CODE.containsMatchIn(rest)
  }

  /** True when the text is worth queueing at all. Codes never leave the phone. */
  fun looksFinancial(text: String): Boolean =
    !carriesCode(text) && MONEY.containsMatchIn(text) && MOVEMENT.containsMatchIn(text)

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
