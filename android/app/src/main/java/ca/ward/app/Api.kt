package ca.ward.app

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class ApiError(message: String) : Exception(message)

/** Talks to Firebase sign-in and to the WARD nurse API. Blocking calls: use from a background thread. */
class Api(private val prefs: Prefs) {
    companion object {
        // Public web key of the WARD Firebase project: it identifies the project and is not a secret.
        private const val FIREBASE_KEY = "AIzaSyAAPCP2_RA5JB1oli1AOyWASMVhLClOhlg"
        // the same demo nurse the website's demo login uses
        private const val DEMO_TOKEN = "dev:nurse:demo-nurse"
        const val DEMO_NAME = "Demo nurse"
    }

    private fun request(method: String, url: String, body: String?, contentType: String, token: String? = null): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 15000
            conn.readTimeout = 60000
            if (token != null) conn.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", contentType)
                conn.outputStream.use { it.write(body.toByteArray()) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            return code to (stream?.bufferedReader()?.readText() ?: "")
        } finally {
            conn.disconnect()
        }
    }

    fun signIn(email: String, password: String) {
        val body = JSONObject().put("email", email).put("password", password).put("returnSecureToken", true).toString()
        val (code, text) = request("POST", "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_KEY", body, "application/json")
        if (code != 200) throw ApiError("That email and password don't match an account.")
        val json = JSONObject(text)
        prefs.email = email
        store(json.getString("idToken"), json.getString("refreshToken"), json.getString("expiresIn").toLong())
        // tell the server who this is; it answers with the role
        val (sc, st) = request("POST", prefs.serverUrl + "/session", "", "application/json", prefs.idToken)
        if (sc != 200) { prefs.signOut(); throw ApiError(detail(st, "The WARD server refused the sign-in.")) }
        val role = JSONObject(st).optString("role", "")
        if (role != "nurse") { prefs.signOut(); throw ApiError("This account is not set up as a nurse yet. Ask an administrator.") }
    }

    /** Demo login: no password. Only works while the server has demo logins switched on. */
    fun signInDemo() {
        val (code, text) = request("GET", prefs.serverUrl + "/me", null, "", DEMO_TOKEN)
        if (code != 200) throw ApiError(detail(text, "Demo logins are switched off on this server."))
        prefs.signOut()
        prefs.email = DEMO_NAME
        prefs.demo = true
    }

    private fun store(idToken: String, refreshToken: String, expiresInSec: Long) {
        prefs.idToken = idToken
        prefs.refreshToken = refreshToken
        prefs.tokenExpiresAt = System.currentTimeMillis() + (expiresInSec - 120) * 1000
    }

    private fun token(): String {
        if (prefs.demo) return DEMO_TOKEN
        if (System.currentTimeMillis() < prefs.tokenExpiresAt) return prefs.idToken
        val form = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(prefs.refreshToken, "UTF-8")
        val (code, text) = request("POST", "https://securetoken.googleapis.com/v1/token?key=$FIREBASE_KEY", form, "application/x-www-form-urlencoded")
        if (code != 200) throw ApiError("Your sign-in expired. Please sign in again.")
        val json = JSONObject(text)
        store(json.getString("id_token"), json.getString("refresh_token"), json.getString("expires_in").toLong())
        return prefs.idToken
    }

    private fun detail(text: String, fallback: String): String =
        try { JSONObject(text).optString("detail", fallback) } catch (e: Exception) { fallback }

    fun post(path: String, body: JSONObject): JSONObject {
        val (code, text) = request("POST", prefs.serverUrl + path, body.toString(), "application/json", token())
        if (code !in 200..299) throw ApiError(detail(text, "The server answered $code."))
        return JSONObject(text)
    }

    fun get(path: String): JSONObject {
        val (code, text) = request("GET", prefs.serverUrl + path, null, "", token())
        if (code !in 200..299) throw ApiError(detail(text, "The server answered $code."))
        return JSONObject(text)
    }
}
