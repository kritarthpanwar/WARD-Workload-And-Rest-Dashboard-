package ca.ward.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Paint
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// the same colours the website uses
internal val TealBright = Color(0xFF0E9485)
internal val Stress = Color(0xFFF2A93B)
internal val Sleep = Color(0xFF8B6FE8)
internal val Critical = Color(0xFFD2453C)
internal val Warning = Color(0xFFD18A12)
internal val Good = Color(0xFF1F9254)
internal val Muted = Color(0xFF5D7186)
internal val Rule = Color(0xFFE4EAF1)
internal val NoData = Color(0xFFB6C3CF)

private val BAND_COLOR = mapOf("green" to Good, "amber" to Warning, "red" to Critical, "insufficient" to NoData)
private val BAND_WORD = mapOf("green" to "Green", "amber" to "Amber", "red" to "Red", "insufficient" to "Not enough data")
private val SHIFT_WORD = mapOf(
    "green" to ("Green shift" to "Load and breaks were within the usual range."),
    "amber" to ("Amber shift" to "This shift was heavier than usual."),
    "red" to ("Red shift" to "This shift counts as overloaded."),
    "insufficient" to ("Not enough data" to "Too little was recorded to rate this shift. It is never counted as green."),
)

private val ZONE: ZoneId get() = ZoneId.systemDefault()
private fun at(iso: String, plusMin: Long = 0) = OffsetDateTime.parse(iso).plusMinutes(plusMin).atZoneSameInstant(ZONE)
private fun fmtTime(iso: String, plusMin: Long = 0): String = at(iso, plusMin).format(DateTimeFormatter.ofPattern("HH:mm"))
private fun fmtDay(iso: String): String = at(iso).format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.CANADA))
internal fun hm(min: Int): String = if (min >= 60) "${min / 60} h ${min % 60} min" else "$min min"
private fun JSONObject.intOrNull(key: String): Int? = if (isNull(key)) null else optDouble(key).roundToInt()
private fun JSONObject.numOrNull(key: String): Double? = if (isNull(key)) null else optDouble(key)

private class Win(val t: Int, val load: Double?, val stress: Boolean)
private class Line(val key: String, val text: String, val dot: Color, val from: Int, val to: Int, val tint: Color?)

@Composable
private fun Badge(mode: String) {
    val text = when (mode) {
        "replay" -> "REPLAY · SIMULATED"
        "recorded" -> "RECORDED"
        "synthetic" -> "SYNTHETIC"
        else -> "LIVE"
    }
    val color = if (mode == "recorded" || mode == "live") Good else Muted
    Text(
        text, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = color,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.12f)).padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

@Composable
private fun BandChip(band: String) {
    val color = BAND_COLOR[band] ?: NoData
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(Ground).padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Text(BAND_WORD[band] ?: band, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun Dot(color: Color) = Box(Modifier.size(10.dp).clip(CircleShape).background(color))

@Composable
private fun QuietButton(text: String, enabled: Boolean = true, on: Boolean = false, modifier: Modifier = Modifier.fillMaxWidth(), onClick: () -> Unit) {
    OutlinedButton(
        onClick, enabled = enabled, modifier = modifier.heightIn(min = 52.dp), shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = if (on) Ink else Color.Transparent, contentColor = if (on) Color.White else Ink),
    ) { Text(text, fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
}

// ------------------------------------------------------------------ my shift

/** The current shift: chart, what stood out, the numbers, and the finishing questions. */
@Composable
fun ShiftTab(prefs: Prefs, reload: Int, noShift: @Composable () -> Unit) {
    val scope = rememberCoroutineScope()
    var cur by remember { mutableStateOf<JSONObject?>(null) }
    var proposal by remember { mutableStateOf<JSONObject?>(null) }
    var card by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var tick by remember { mutableStateOf(0) }

    LaunchedEffect(reload, tick) {
        while (true) {
            try {
                cur = withContext(Dispatchers.IO) { Api(prefs).get("/me/shift/current") }
                error = null
            } catch (e: Exception) {
                error = if (e is ApiError) e.message else "Couldn't reach the server."
            }
            // a playing demo day moves on its own: keep following it
            if (cur?.optBoolean("replay_running") != true) break
            delay(2500)
        }
    }
    LaunchedEffect(reload) { if (reload > 0) card = null }

    val c = cur
    val shift = c?.optJSONObject("shift")
    when {
        card != null -> {
            ShiftCard(prefs, card!!)
            QuietButton("Done") { card = null }
        }
        c == null -> Text(error ?: "Loading…", fontSize = 16.sp)
        shift == null -> noShift()
        proposal != null -> EndFlow(prefs, shift.getString("shift_id"), proposal!!, cancel = { proposal = null }) {
            proposal = null
            card = it
            tick++
        }
        else -> {
            LiveShift(c, shift)
            error?.let { Text(it, color = Critical, fontWeight = FontWeight.Bold) }
            val running = c.optBoolean("replay_running")
            val recorded = shift.optString("data_mode") == "recorded"
            BigButton(if (running) "Playing the recorded day…" else if (recorded) "Review and finish" else "End shift", enabled = !running) {
                scope.launch {
                    try {
                        proposal = withContext(Dispatchers.IO) { Api(prefs).post("/shifts/${shift.getString("shift_id")}/propose", JSONObject()) }
                    } catch (e: Exception) {
                        error = e.message
                    }
                }
            }
        }
    }
}

@Composable
private fun LiveShift(c: JSONObject, shift: JSONObject) {
    val start = shift.getString("start_ts")
    val recorded = shift.optString("data_mode") == "recorded"
    val elapsed = c.optInt("elapsed_min")
    val since = c.optInt("since_break_min")
    val sleep = c.intOrNull("sleep_before_min")
    val m = c.getJSONObject("metrics")
    val windows = remember(c) {
        val a = c.getJSONArray("windows")
        List(a.length()) { i -> a.getJSONObject(i).let { Win(it.getInt("t"), it.numOrNull("pct_hrr"), it.optBoolean("unexplained")) } }
    }
    val breaks = remember(c) {
        val a = c.getJSONArray("suggested_breaks")
        List(a.length()) { i -> a.getJSONObject(i).let { it.getInt("start_min") to it.getInt("end_min") } }
    }
    val lines = remember(c) { highlightLines(windows, start, sleep, since, elapsed) }
    var picked by remember { mutableStateOf<String?>(null) }
    val active = lines.find { it.key == picked }
    val nowLoad = windows.lastOrNull { it.load != null }?.load

    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("My shift", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
        Badge(shift.optString("data_mode"))
    }
    Text(
        "${fmtDay(start)} · ${if (shift.optString("shift_type") == "day") "day" else "night"} shift from ${fmtTime(start)} · ${hm(elapsed)} ${if (recorded) "long" else "in"}",
        fontSize = 15.sp, color = Muted,
    )

    Sheet {
        Text(if (recorded) "Physical load at the end" else "Physical load right now", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Muted)
        Row(verticalAlignment = Alignment.Bottom) {
            Text(nowLoad?.let { "%.0f".format(it) } ?: "—", fontSize = 44.sp, fontWeight = FontWeight.ExtraBold)
            Text(" % effort", fontSize = 17.sp, color = Muted, modifier = Modifier.padding(bottom = 8.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            for ((color, name) in listOf(TealBright to "Load", Stress to "Stress", Sleep to "Break")) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Dot(color)
                    Text(name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        ShiftChart(windows, breaks, start, active)
    }

    for (l in lines) {
        val on = l.key == picked
        Card(
            Modifier.fillMaxWidth().clickable { picked = if (on) null else l.key },
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = if (on) Ink else Color.White),
        ) {
            Row(Modifier.padding(horizontal = 18.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Dot(l.dot)
                Text(l.text, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = if (on) Color.White else Ink)
            }
        }
    }

    Sheet {
        Text(if (recorded) "From your last break to the end" else "Since your last break", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Muted)
        val color = if (since >= 300) Critical else if (since >= 240) Warning else TealBright
        Ring(since / 300f, color, if (since >= 60) "${since / 60}h ${since % 60}m" else "${since}m")
        Text(
            if (since >= 300) "Over 5 hours without a break" else if (since >= 240) "A break is due soon" else "On track",
            fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = if (since >= 300) Critical else Ink,
            modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
        )
    }

    val load = m.numOrNull("mean_pct_hrr")
    val stress = m.optInt("unexplained_hr_min")
    val coverage = m.optDouble("coverage_pct", 0.0)
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Metric("Average load", load?.let { "%.0f".format(it) } ?: "—", "%", TealBright, ((load ?: 0.0) / 60).toFloat(), Modifier.weight(1f))
        Metric("Stress", "$stress", "min", Stress, stress / 60f, Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Metric("Sleep before", sleep?.let { "${it / 60}h ${it % 60}" } ?: "No data", if (sleep == null) "" else "min", Sleep, (sleep ?: 0) / 480f, Modifier.weight(1f))
        Metric("Recorded", "%.0f".format(coverage), "%", if (coverage < 70) Warning else Muted, (coverage / 100).toFloat(), Modifier.weight(1f))
    }
}

@Composable
private fun Metric(name: String, value: String, unit: String, color: Color, fraction: Float, modifier: Modifier) {
    Card(modifier, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Dot(color)
                Text(name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Muted)
            }
            Row(verticalAlignment = Alignment.Bottom) {
                Text(value, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                Text(" $unit", fontSize = 14.sp, color = Muted, modifier = Modifier.padding(bottom = 4.dp))
            }
            Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)).background(Rule)) {
                Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(6.dp).clip(RoundedCornerShape(50)).background(color))
            }
        }
    }
}

@Composable
private fun Ring(fraction: Float, color: Color, label: String) {
    val shown = remember { Animatable(0f) }
    LaunchedEffect(fraction) { shown.animateTo(fraction.coerceIn(0f, 1f), tween(900)) }
    Box(Modifier.fillMaxWidth().height(190.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(170.dp)) {
            val stroke = 14.dp.toPx()
            val inset = stroke / 2
            val arc = Size(size.width - stroke, size.height - stroke)
            drawArc(Rule, 0f, 360f, false, Offset(inset, inset), arc, style = Stroke(stroke))
            drawArc(color, -90f, 360f * shown.value, false, Offset(inset, inset), arc, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
            Text("of 5 hours", fontSize = 14.sp, color = Muted)
        }
    }
}

/** Physical load over the shift: the line draws itself in, stress shows as amber points, breaks as violet bands. */
@Composable
private fun ShiftChart(windows: List<Win>, breaks: List<Pair<Int, Int>>, startIso: String, focus: Line?) {
    val drawn = remember { Animatable(0f) }
    LaunchedEffect(Unit) { drawn.animateTo(1f, tween(1400)) }
    val labels = remember(startIso) { listOf(0, 240, 480, 720).associateWith { fmtTime(startIso, it.toLong()) } }
    Canvas(Modifier.fillMaxWidth().height(230.dp)) {
        val padT = 22.dp.toPx()
        val padB = 26.dp.toPx()
        val base = size.height - padB
        val span = max(720, (windows.lastOrNull()?.t ?: 0) + 5).toFloat()
        val yMax = max(60.0, windows.maxOfOrNull { it.load ?: 0.0 } ?: 0.0).toFloat()
        fun x(minute: Float) = minute / span * size.width
        fun y(v: Float) = base - v / yMax * (base - padT)
        val text = Paint().apply { color = Muted.toArgb(); textSize = 12.sp.toPx(); isAntiAlias = true; isFakeBoldText = true }

        for (v in listOf(0, 20, 40, 60)) {
            drawLine(Rule, Offset(0f, y(v.toFloat())), Offset(size.width, y(v.toFloat())), 1.dp.toPx())
            drawContext.canvas.nativeCanvas.drawText("$v%", 0f, y(v.toFloat()) - 5.dp.toPx(), text)
        }
        for ((minute, label) in labels) {
            if (minute > span) continue
            text.textAlign = when (minute) { 0 -> Paint.Align.LEFT; span.toInt() -> Paint.Align.RIGHT; else -> Paint.Align.CENTER }
            drawContext.canvas.nativeCanvas.drawText(label, x(minute.toFloat()), size.height - 4.dp.toPx(), text)
        }
        text.textAlign = Paint.Align.LEFT

        val top = padT - 6.dp.toPx()
        val round = CornerRadius(8.dp.toPx())
        for ((a, b) in breaks) drawRoundRect(Sleep.copy(alpha = 0.16f), Offset(x(a.toFloat()), top), Size(x(b.toFloat()) - x(a.toFloat()), base - top), round)

        // stretches with no data: a dashed box, never drawn as a break or as calm
        var gapFrom: Int? = null
        val dashed = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 5.dp.toPx())))
        for ((i, w) in windows.withIndex()) {
            if (w.load == null && gapFrom == null) gapFrom = w.t
            val closes = gapFrom != null && (w.load != null || i == windows.lastIndex)
            if (closes) {
                val to = if (w.load != null) w.t else w.t + 5
                drawRoundRect(NoData, Offset(x(gapFrom!!.toFloat()), top), Size(x(to.toFloat()) - x(gapFrom.toFloat()), base - top), round, style = dashed)
                gapFrom = null
            }
        }
        if (focus?.tint != null) {
            drawRoundRect(focus.tint, Offset(x(focus.from.toFloat()) - 5.dp.toPx(), top), Size(x(focus.to.toFloat()) - x(focus.from.toFloat()) + 10.dp.toPx(), base - top), round)
        }

        clipRect(right = size.width * drawn.value) {
            var run = ArrayList<Win>()
            fun flush() {
                if (run.size > 1) {
                    val line = Path()
                    val area = Path()
                    area.moveTo(x(run.first().t + 2.5f), base)
                    for ((i, w) in run.withIndex()) {
                        val px = x(w.t + 2.5f)
                        val py = y(w.load!!.toFloat())
                        if (i == 0) line.moveTo(px, py) else line.lineTo(px, py)
                        area.lineTo(px, py)
                    }
                    area.lineTo(x(run.last().t + 2.5f), base)
                    area.close()
                    drawPath(area, Brush.verticalGradient(listOf(TealBright.copy(alpha = 0.36f), TealBright.copy(alpha = 0f)), startY = padT, endY = base))
                    drawPath(line, TealBright, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                }
                run = ArrayList()
            }
            for (w in windows) if (w.load == null) flush() else run.add(w)
            flush()
            for (w in windows) if (w.stress && w.load != null) {
                drawCircle(Color.White, 7.dp.toPx(), Offset(x(w.t + 2.5f), y(w.load.toFloat())))
                drawCircle(Stress, 5.dp.toPx(), Offset(x(w.t + 2.5f), y(w.load.toFloat())))
            }
            windows.lastOrNull { it.load != null }?.let {
                val px = min(x(it.t + 2.5f), size.width - 6.dp.toPx())
                drawCircle(Color.White, 8.dp.toPx(), Offset(px, y(it.load!!.toFloat())))
                drawCircle(TealBright, 5.5.dp.toPx(), Offset(px, y(it.load.toFloat())))
            }
        }
    }
}

// One to four plain sentences about what stood out; tapping one lights up its stretch of the chart.
private fun highlightLines(windows: List<Win>, startIso: String, sleep: Int?, since: Int, elapsed: Int): List<Line> {
    fun longest(pred: (Win) -> Boolean): Pair<Int, Int>? {
        var best: Pair<Int, Int>? = null
        var run: Pair<Int, Int>? = null
        for (w in windows) {
            if (pred(w)) {
                run = (run?.first ?: w.t) to w.t + 5
                if (best == null || run.second - run.first > best.second - best.first) best = run
            } else run = null
        }
        return best
    }
    val lines = ArrayList<Line>()
    longest { (it.load ?: 0.0) >= 30 }?.let {
        if (it.second - it.first >= 10) lines.add(Line("load", "Heart working hard at ${fmtTime(startIso, it.first.toLong())}", TealBright, it.first, it.second, TealBright.copy(alpha = 0.16f)))
    }
    longest { it.stress }?.let {
        lines.add(Line("stress", "Stress was high at ${fmtTime(startIso, it.first.toLong())}", Stress, it.first, it.second, Stress.copy(alpha = 0.26f)))
    }
    if (sleep != null && sleep < 360) lines.add(Line("sleep", "You slept ${hm(sleep)} before this shift", Sleep, 0, 0, null))
    if (since >= 300) lines.add(Line("break", "No break for ${hm(since)}", Critical, elapsed - since, elapsed, Critical.copy(alpha = 0.16f)))
    return lines
}

// ------------------------------------------------------------- finishing a shift

// One question per screen.
@Composable
private fun EndFlow(prefs: Prefs, shiftId: String, proposal: JSONObject, cancel: () -> Unit, done: (JSONObject) -> Unit) {
    val scope = rememberCoroutineScope()
    val breaks = remember(proposal) {
        val a = proposal.getJSONArray("breaks")
        List(a.length()) { a.getJSONObject(it) }
    }
    var step by remember { mutableStateOf(0) }
    var answers by remember { mutableStateOf(breaks.associate { it.getString("id") to true }) }
    var ratio by remember { mutableStateOf("unknown") }
    var drained by remember { mutableStateOf<Int?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun submit(skipped: Boolean) {
        busy = true
        scope.launch {
            try {
                val list = JSONArray()
                if (!skipped) for ((id, yes) in answers) list.put(JSONObject().put("id", id).put("status", if (yes) "confirmed" else "rejected"))
                val body = JSONObject().put("breaks", list).put("skipped", skipped).put("ratio_status", ratio)
                    .put("drained_rating", drained ?: JSONObject.NULL)
                done(withContext(Dispatchers.IO) { Api(prefs).post("/shifts/$shiftId/end", body) })
            } catch (e: Exception) {
                error = e.message
                busy = false
            }
        }
    }

    Text("Finish your shift", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
    Sheet {
        Text("${step + 1} of 3 · ${listOf("Confirm breaks", "Ratio", "How you feel")[step]}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Muted)
        when (step) {
            0 -> {
                Text(if (breaks.isEmpty()) "We didn’t see any breaks" else "Were these your breaks?", fontSize = 21.sp, fontWeight = FontWeight.Bold)
                for (b in breaks) {
                    val id = b.getString("id")
                    Text("${fmtTime(b.getString("start_ts"))} – ${fmtTime(b.getString("end_ts"))}", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuietButton("Yes, I took a break", on = answers[id] == true, modifier = Modifier.weight(2f)) { answers = answers + (id to true) }
                        QuietButton("No", on = answers[id] == false, modifier = Modifier.weight(1f)) { answers = answers + (id to false) }
                    }
                }
                BigButton("Confirm breaks") { step = 1 }
                Row {
                    TextButton(onClick = cancel) { Text("Back to shift") }
                    Box(Modifier.weight(1f))
                    TextButton(onClick = { submit(true) }, enabled = !busy) { Text("Skip all questions") }
                }
            }
            1 -> {
                Text("Was the nurse-to-patient ratio met?", fontSize = 21.sp, fontWeight = FontWeight.Bold)
                for ((key, label) in listOf("met" to "Yes, it was met", "not_met" to "No, it was not met", "unknown" to "I don’t know")) {
                    QuietButton(label) { ratio = key; step = 2 }
                }
                TextButton(onClick = { step = 0 }) { Text("Back") }
            }
            else -> {
                Text("How drained do you feel?", fontSize = 21.sp, fontWeight = FontWeight.Bold)
                Text("1 = fine · 10 = completely drained", fontSize = 15.sp, color = Muted)
                for (row in listOf(1..5, 6..10)) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (n in row) QuietButton("$n", on = drained == n, modifier = Modifier.weight(1f)) { drained = if (drained == n) null else n }
                }
                BigButton(if (busy) "Finishing…" else "Finish shift", enabled = !busy) { submit(false) }
                TextButton(onClick = { step = 1 }) { Text("Back") }
            }
        }
        error?.let { Text(it, color = Critical, fontWeight = FontWeight.Bold) }
    }
}

// ------------------------------------------------------- a finished shift's report

@Composable
fun ShiftCard(prefs: Prefs, card: JSONObject) {
    val band = card.optString("band", "insufficient")
    val (title, text) = SHIFT_WORD[band] ?: SHIFT_WORD.getValue("insufficient")
    val noBreak = card.optInt("longest_no_break_min")
    val reasons = ArrayList<String>()
    if (card.optString("recovery_band") == "red") reasons.add("you went ${hm(noBreak)} without a break")
    if (card.optString("phys_band") == "red") reasons.add("physical load was very heavy")
    if (band == "amber" && card.optString("recovery_band") == "amber") reasons.add("your longest stretch without a break was ${hm(noBreak)}")
    if (band == "amber" && card.optString("phys_band") == "amber") reasons.add("physical load was heavy")

    Sheet {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.size(54.dp).clip(CircleShape).background(BAND_COLOR[band] ?: NoData))
            Column {
                Text(title, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                Text(if (reasons.isEmpty()) text else "Why: ${reasons.joinToString(" and ")}.", fontSize = 16.sp, color = Muted)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("${fmtDay(card.getString("start_ts"))} · ${fmtTime(card.getString("start_ts"))}–${fmtTime(card.getString("end_ts"))}", fontSize = 15.sp, color = Muted)
            Badge(card.optString("data_mode"))
        }
    }
    Sheet {
        Fact("Breaks", "Longest stretch without one: ${hm(noBreak)} · " +
            if (card.optBoolean("breaks_uncertain")) "not confirmed" else "${card.optInt("n_breaks_confirmed")} confirmed", card.optString("recovery_band"))
        Fact("Physical load", "Average effort " + (card.numOrNull("mean_pct_hrr")?.let { "$it%" } ?: "—"), card.optString("phys_band"))
        Fact("Stress", "${card.optInt("unexplained_hr_min")} min of high heart rate while still", null)
        card.intOrNull("sleep_before_min")?.let { Fact("Sleep", "${hm(it)} in the 24 hours before the shift", null) }
        Fact("Recorded", "${card.optDouble("coverage_pct")}% of the shift · longest gap ${card.optInt("max_gap_min")} min", null)
    }
    if (band == "red") ReportDraft(prefs, card.getString("shift_id"))
}

@Composable
private fun Fact(name: String, text: String, band: String?) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(Modifier.weight(1f)) {
            Text(name, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(text, fontSize = 15.sp, color = Muted)
        }
        if (band != null) BandChip(band)
    }
}

@Composable
private fun ReportDraft(prefs: Prefs, shiftId: String) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var text by remember(shiftId) { mutableStateOf<String?>(null) }
    var sent by remember(shiftId) { mutableStateOf(false) }
    var copied by remember(shiftId) { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(shiftId) {
        try {
            text = withContext(Dispatchers.IO) { Api(prefs).get("/me/reports/$shiftId/draft") }.getString("text")
        } catch (e: Exception) {
            error = e.message
        }
    }
    val report = text
    if (report == null) {
        error?.let { Text(it, color = Critical, fontWeight = FontWeight.Bold) }
        return
    }
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFFDEBE9))) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Workload report", fontSize = 21.sp, fontWeight = FontWeight.ExtraBold, color = Critical)
            Text("Attach this to a workload report. Nothing is sent for you.", fontSize = 15.sp, color = Muted)
            Text(
                report, fontSize = 13.sp, fontFamily = FontFamily.Monospace,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Ground).padding(14.dp),
            )
            QuietButton(if (copied) "Copied" else "Copy text") {
                (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("WARD workload report", report))
                copied = true
            }
            BigButton(if (sent) "Counted — thank you" else "I sent this report", enabled = !sent) {
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { Api(prefs).post("/me/reports/$shiftId/sent", JSONObject()) }
                        sent = true
                    } catch (e: Exception) {
                        error = e.message
                    }
                }
            }
            error?.let { Text(it, color = Critical, fontWeight = FontWeight.Bold) }
        }
    }
}

// ------------------------------------------------------------------ my shifts

@Composable
fun HistoryTab(prefs: Prefs) {
    var shifts by remember { mutableStateOf<List<JSONObject>?>(null) }
    var redOnly by remember { mutableStateOf(0) }
    var open by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try {
            val a = withContext(Dispatchers.IO) { Api(prefs).getArray("/me/shifts") }
            shifts = List(a.length()) { a.getJSONObject(it) }
        } catch (e: Exception) {
            error = if (e is ApiError) e.message else "Couldn't reach the server."
        }
    }
    val all = shifts
    val card = open
    when {
        all == null -> Text(error ?: "Loading…", fontSize = 16.sp)
        card != null -> {
            TextButton(onClick = { open = null }) { Text("← My shifts", fontSize = 16.sp, fontWeight = FontWeight.Bold) }
            ShiftCard(prefs, card)
        }
        else -> {
            Text("My shifts", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
            val red = all.filter { it.optString("band") == "red" }
            Choice(listOf("All (${all.size})", "Red (${red.size})"), redOnly) { redOnly = it }
            val shown = if (redOnly == 1) red else all
            if (shown.isEmpty()) Sheet {
                Text("No shifts yet", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text("Finished shifts appear here with their colour.", fontSize = 16.sp, color = Muted)
            }
            for (s in shown) {
                Card(Modifier.fillMaxWidth().clickable { open = s }, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text(fmtDay(s.getString("start_ts")), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            Text(if (s.optString("shift_type") == "day") "Day shift" else "Night shift", fontSize = 15.sp, color = Muted)
                        }
                        BandChip(s.optString("band"))
                        Text("›", fontSize = 22.sp, color = Muted)
                    }
                }
            }
        }
    }
}
