package ca.ward.app

import android.content.Context
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit

/**
 * Nothing is tracked live. Once a day (and whenever asked) the app reads what
 * the watch has written to Health Connect over the last three days and sends it.
 * Samsung Health writes late, so the same stretch is read again each time; the
 * server replaces what it had for that stretch.
 */
object Sync {
    val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )
    const val BACKGROUND = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
    private const val CHUNK = 5000
    private val LOOK_BACK: Duration = Duration.ofHours(72)

    fun available(context: Context) = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    suspend fun hasPermissions(context: Context): Boolean =
        HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions().containsAll(PERMISSIONS)

    /** Upload the last three days. Returns a one-line summary. */
    suspend fun upload(context: Context): String = withContext(Dispatchers.IO) {
        val prefs = Prefs(context)
        val client = HealthConnectClient.getOrCreate(context)
        val to = Instant.now().truncatedTo(ChronoUnit.MINUTES)
        val from = to.minus(LOOK_BACK)
        val range = TimeRangeFilter.between(from, to)
        val samples = ArrayList<JSONObject>()
        var heartRates = 0
        var stepMinutes = 0

        var pageToken: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range, pageToken = pageToken))
            for (record in page.records) for (s in record.samples) {
                if (s.time.isBefore(from) || !s.time.isBefore(to)) continue
                samples.add(JSONObject().put("ts", s.time.toString()).put("type", "hr").put("value", s.beatsPerMinute))
                heartRates++
            }
            pageToken = page.pageToken
        } while (pageToken != null)

        // steps: one total per minute; Health Connect removes double counting between sources
        for (b in client.aggregateGroupByDuration(AggregateGroupByDurationRequest(setOf(StepsRecord.COUNT_TOTAL), range, Duration.ofMinutes(1)))) {
            val count = b.result[StepsRecord.COUNT_TOTAL] ?: 0L
            if (count > 0) stepMinutes++
            if (count > 0) samples.add(JSONObject().put("ts", b.startTime.toString()).put("type", "steps").put("value", count))
        }

        client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, TimeRangeFilter.between(to.minus(Duration.ofDays(7)), to)))
            .records.maxByOrNull { it.time }?.let {
                samples.add(JSONObject().put("ts", it.time.toString()).put("type", "resting_hr").put("value", it.beatsPerMinute))
            }

        // sleep: session start and end only, never the stages
        val sleep = JSONArray()
        for (s in client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(to.minus(LOOK_BACK), to))).records) {
            sleep.put(JSONObject().put("start_ts", s.startTime.toString()).put("end_ts", s.endTime.toString()))
        }

        val api = Api(prefs)
        val device = "${Build.MANUFACTURER} ${Build.MODEL} via Health Connect"
        var first = true
        for (chunk in samples.chunked(CHUNK).ifEmpty { listOf(emptyList()) }) {
            val body = JSONObject().put("source_device", device).put("samples", JSONArray(chunk))
            if (first) {
                // the first part names the stretch being sent, so sending it twice never doubles anything
                body.put("window_start", from.toString()).put("window_end", to.toString()).put("sleep", sleep)
            }
            api.post("/ingest", body)
            first = false
        }
        val at = LocalTime.now().truncatedTo(ChronoUnit.MINUTES)
        val summary = if (heartRates == 0)
            "Checked at $at: Health Connect has no heart rate from the last 3 days ($stepMinutes minutes with steps, ${sleep.length()} sleep sessions). In Samsung Health, open Settings, Health Connect, and allow heart rate, then sync."
        else "Uploaded at $at: $heartRates heart-rate readings, ${sleep.length()} sleep sessions"
        prefs.lastUpload = summary
        summary
    }

    /** Clock-in and clock-out: make sure the data is on the server, then ask it to build the shift. */
    suspend fun saveShift(context: Context, start: Instant, end: Instant): String {
        upload(context)
        withContext(Dispatchers.IO) {
            Api(Prefs(context)).post("/shifts/clock", JSONObject().put("start_ts", start.toString()).put("end_ts", end.toString()))
        }
        return "Shift saved. Open WARD in a browser to review it."
    }

    /** Run the upload once a day at about the chosen hour. Android may shift it a little to save battery. */
    fun scheduleDaily(context: Context) {
        val hour = Prefs(context).uploadHour
        val now = LocalDateTime.now()
        var next = now.toLocalDate().atTime(hour, 0)
        if (!next.isAfter(now)) next = next.plusDays(1)
        val work = PeriodicWorkRequestBuilder<DailyUpload>(24, TimeUnit.HOURS)
            .setInitialDelay(Duration.between(now, next).toMinutes(), TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("ward-daily-upload", ExistingPeriodicWorkPolicy.UPDATE, work)
    }

    fun cancelDaily(context: Context) = WorkManager.getInstance(context).cancelUniqueWork("ward-daily-upload")
}

class DailyUpload(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        if (!Prefs(applicationContext).signedIn) return Result.success()
        return try {
            Sync.upload(applicationContext)
            Result.success()
        } catch (e: Exception) {
            Prefs(applicationContext).lastUpload = "The last automatic upload failed: ${e.message}"
            Result.retry()
        }
    }
}
