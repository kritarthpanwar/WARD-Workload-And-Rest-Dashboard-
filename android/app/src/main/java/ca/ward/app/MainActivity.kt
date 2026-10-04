package ca.ward.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.health.connect.client.PermissionController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

private val Teal = Color(0xFF0B7F73)
private val Ink = Color(0xFF0F2233)
private val Ground = Color(0xFFF3F6FB)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Teal, background = Ground, surface = Color.White, onSurface = Ink, onBackground = Ink)) {
                Surface(Modifier.fillMaxSize(), color = Ground) { App() }
            }
        }
    }
}

@Composable
private fun App() {
    val context = LocalContext.current
    val prefs = remember { Prefs(context) }
    var signedIn by remember { mutableStateOf(prefs.signedIn) }
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("WARD", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
        if (signedIn) Home(prefs) { signedIn = false } else SignIn(prefs) { signedIn = true }
        Text("Workload documentation tool — not a medical device.", fontSize = 13.sp, color = Color(0xFF5D7186))
    }
}

@Composable
private fun Sheet(content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
}

@Composable
private fun BigButton(text: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick, enabled = enabled, modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Teal)) {
        Text(text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SignIn(prefs: Prefs, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var server by remember { mutableStateOf(prefs.serverUrl.ifEmpty { "http://" }) }
    var email by remember { mutableStateOf(prefs.email) }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Sheet {
        Text("Sign in", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        OutlinedTextField(server, { server = it }, label = { Text("WARD server address") }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
        OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true, modifier = Modifier.fillMaxWidth(), visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
        error?.let { Text(it, color = Color(0xFFD2453C), fontWeight = FontWeight.Bold) }
        BigButton(if (busy) "Signing in…" else "Sign in", enabled = !busy && email.isNotBlank() && password.isNotBlank() && server.length > 8) {
            busy = true
            error = null
            scope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        prefs.serverUrl = server
                        Api(prefs).signIn(email.trim(), password)
                    }
                    done()
                } catch (e: Exception) {
                    error = if (e is ApiError) e.message else "Couldn't reach the server. Check the address and that the phone is on the same Wi-Fi."
                } finally {
                    busy = false
                }
            }
        }
    }
}

@Composable
private fun Choice(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEachIndexed { i, label ->
            val on = i == selected
            OutlinedButton(
                onClick = { onSelect(i) },
                modifier = Modifier.weight(1f).heightIn(min = 50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = if (on) Ink else Color.Transparent, contentColor = if (on) Color.White else Ink),
            ) { Text(label, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun Home(prefs: Prefs, signedOut: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var allowed by remember { mutableStateOf(false) }
    var uploadStatus by remember { mutableStateOf(prefs.lastUpload) }
    var shiftStatus by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var hour by remember { mutableStateOf(prefs.uploadHour) }
    var day by remember { mutableStateOf(0) }       // 0 = today, 1 = yesterday
    var clockIn by remember { mutableStateOf("07:00") }
    var clockOut by remember { mutableStateOf("19:00") }
    val available = remember { Sync.available(context) }

    val askHealth = rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
        allowed = granted.containsAll(Sync.PERMISSIONS)
        if (allowed) Sync.scheduleDaily(context)
    }
    LaunchedEffect(Unit) {
        if (available) allowed = Sync.hasPermissions(context)
        if (allowed) Sync.scheduleDaily(context)
    }

    fun run(setStatus: (String) -> Unit, working: String, block: suspend () -> String) {
        busy = true
        setStatus(working)
        scope.launch {
            try {
                setStatus(block())
                uploadStatus = prefs.lastUpload
            } catch (e: Exception) {
                setStatus(e.message ?: "Something went wrong.")
            }
            busy = false
        }
    }

    Sheet {
        Text("Daily upload", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        when {
            !available -> Text("Health Connect isn't available on this phone. Install or update it from the Play Store.", fontSize = 16.sp)
            !allowed -> {
                Text("WARD needs to read heart rate, steps, resting heart rate and sleep from Health Connect.", fontSize = 16.sp)
                BigButton("Allow access") { askHealth.launch(Sync.PERMISSIONS + Sync.BACKGROUND) }
            }
            else -> {
                Text(uploadStatus, fontSize = 16.sp)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Every day at", fontSize = 17.sp, modifier = Modifier.weight(1f))
                    OutlinedButton(onClick = { hour = (hour + 23) % 24; prefs.uploadHour = hour; Sync.scheduleDaily(context) }, shape = RoundedCornerShape(14.dp)) { Text("−", fontSize = 20.sp) }
                    Text("%02d:00".format(hour), fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    OutlinedButton(onClick = { hour = (hour + 1) % 24; prefs.uploadHour = hour; Sync.scheduleDaily(context) }, shape = RoundedCornerShape(14.dp)) { Text("+", fontSize = 20.sp) }
                }
                BigButton(if (busy) "Working…" else "Upload now", enabled = !busy) {
                    run({ uploadStatus = it }, "Reading the watch data…") { Sync.upload(context) }
                }
            }
        }
    }

    if (available && allowed) Sheet {
        Text("Add a shift", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Choice(listOf("Today", "Yesterday"), day) { day = it }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(clockIn, { clockIn = it }, label = { Text("Clock in") }, singleLine = true, modifier = Modifier.weight(1f))
            OutlinedTextField(clockOut, { clockOut = it }, label = { Text("Clock out") }, singleLine = true, modifier = Modifier.weight(1f))
        }
        BigButton(if (busy) "Working…" else "Save this shift", enabled = !busy) {
            run({ shiftStatus = it }, "Saving…") {
                val tIn = try { LocalTime.parse(clockIn.trim()) } catch (e: Exception) { throw ApiError("Write the times like 07:00 and 19:30.") }
                val tOut = try { LocalTime.parse(clockOut.trim()) } catch (e: Exception) { throw ApiError("Write the times like 07:00 and 19:30.") }
                val date = LocalDate.now().minusDays(day.toLong())
                val zone = ZoneId.systemDefault()
                val start = date.atTime(tIn).atZone(zone).toInstant()
                // a clock-out earlier than the clock-in means the shift ran past midnight
                val endDate = if (tOut.isAfter(tIn)) date else date.plusDays(1)
                Sync.saveShift(context, start, endDate.atTime(tOut).atZone(zone).toInstant())
            }
        }
        if (shiftStatus.isNotEmpty()) Text(shiftStatus, fontSize = 16.sp)
    }

    TextButton(onClick = {
        Sync.cancelDaily(context)
        prefs.signOut()
        signedOut()
    }) { Text("Sign out (${prefs.email})") }
}
