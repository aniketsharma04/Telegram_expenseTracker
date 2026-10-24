package expo.modules.notificationcapture

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Uploads captured bank alerts without waiting for the app to be opened (v15).
 *
 * Before this, captures sat in the queue until the user next opened the app,
 * so "coffee −₹200, ₹1,467 left today" arrived whenever they happened to look
 * — which defeats a live daily budget. WorkManager runs this as soon as
 * there's a network, retries with backoff when there isn't, and survives the
 * app process being killed.
 *
 * Same endpoint and token the app itself uses; the JS drain on app open stays
 * as a second path. Overlap is harmless: the server dedupes on external_id.
 */
class CaptureUploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    val config = CaptureStore.uploadConfig(applicationContext) ?: return Result.success()
    // The server takes at most 50 per call; a long offline spell drains in a few rounds.
    repeat(MAX_ROUNDS) {
      val batch = CaptureStore.snapshot(applicationContext, BATCH)
      if (batch.length() == 0) return Result.success()
      when (post(config.first, config.second, batch)) {
        Outcome.Done, Outcome.Rejected -> CaptureStore.remove(applicationContext, idsOf(batch))
        Outcome.SignedOut -> return Result.success() // the app re-auths and drains on next open
        Outcome.TryLater -> return Result.retry()
      }
    }
    return Result.success()
  }

  private enum class Outcome { Done, Rejected, SignedOut, TryLater }

  private fun post(apiBase: String, token: String, batch: JSONArray): Outcome {
    var connection: HttpURLConnection? = null
    return try {
      connection = (URL("${apiBase.trimEnd('/')}/api/ingest").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 30_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }
      val body = JSONObject().apply {
        put("source", "notification")
        put("messages", batch)
      }
      connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
      when (val code = connection.responseCode) {
        in 200..299 -> Outcome.Done
        401, 403 -> Outcome.SignedOut
        // Any other 4xx means this batch's shape is wrong; retrying would wedge
        // the queue forever — the same rule the JS uploader follows.
        in 400..499 -> Outcome.Rejected.also { android.util.Log.w(TAG, "ingest rejected batch: $code") }
        else -> Outcome.TryLater
      }
    } catch (e: Exception) {
      Outcome.TryLater // offline, DNS, timeout
    } finally {
      connection?.disconnect()
    }
  }

  private fun idsOf(batch: JSONArray): Set<String> =
    (0 until batch.length()).map { batch.getJSONObject(it).optString("external_id") }.toSet()

  companion object {
    private const val TAG = "BankNotifCapture"
    private const val WORK_NAME = "capture-upload"
    private const val BATCH = 50
    private const val MAX_ROUNDS = 4

    /** Upload soon. Captures that land mid-run are picked up by the appended run. */
    fun schedule(context: Context) {
      val request = OneTimeWorkRequest.Builder(CaptureUploadWorker::class.java)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()
      WorkManager.getInstance(context)
        .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }
  }
}
