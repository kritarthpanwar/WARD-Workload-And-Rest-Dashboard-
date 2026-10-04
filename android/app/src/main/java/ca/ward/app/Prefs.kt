package ca.ward.app

import android.content.Context

/** Small settings store: where the server is, who is signed in, and what has been uploaded. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("ward", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("serverUrl", "") ?: ""
        set(v) = sp.edit().putString("serverUrl", v.trim().trimEnd('/')).apply()
    var email: String
        get() = sp.getString("email", "") ?: ""
        set(v) = sp.edit().putString("email", v).apply()
    var idToken: String
        get() = sp.getString("idToken", "") ?: ""
        set(v) = sp.edit().putString("idToken", v).apply()
    var refreshToken: String
        get() = sp.getString("refreshToken", "") ?: ""
        set(v) = sp.edit().putString("refreshToken", v).apply()
    var tokenExpiresAt: Long
        get() = sp.getLong("tokenExpiresAt", 0)
        set(v) = sp.edit().putLong("tokenExpiresAt", v).apply()

    /** Everything up to this moment (epoch ms) has been uploaded. */
    var uploadedUntil: Long
        get() = sp.getLong("uploadedUntil", 0)
        set(v) = sp.edit().putLong("uploadedUntil", v).apply()
    /** Hour of the day (0-23) for the automatic daily upload. */
    var uploadHour: Int
        get() = sp.getInt("uploadHour", 20)
        set(v) = sp.edit().putInt("uploadHour", v).apply()
    var lastUpload: String
        get() = sp.getString("lastUpload", "Nothing uploaded yet") ?: ""
        set(v) = sp.edit().putString("lastUpload", v).apply()

    val signedIn: Boolean get() = refreshToken.isNotEmpty()

    fun signOut() = sp.edit().remove("idToken").remove("refreshToken").remove("tokenExpiresAt").apply()
}
