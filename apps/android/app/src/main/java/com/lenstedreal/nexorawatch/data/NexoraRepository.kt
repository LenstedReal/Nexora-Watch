package com.lenstedreal.nexorawatch.data

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.lenstedreal.nexorawatch.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import okio.BufferedSink
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.CoroutineContext

class NexoraException(val statusCode: Int, message: String) : Exception(message)

class ContentUriRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val mimeType: String,
    private val coroutineContext: CoroutineContext,
    private val onProgress: (Int) -> Unit
) : RequestBody() {

    private val cachedLength: Long by lazy {
        try {
            contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (sizeIndex != -1 && cursor.moveToFirst() && !cursor.isNull(sizeIndex)) {
                    return@lazy cursor.getLong(sizeIndex)
                }
            }
            contentResolver.openAssetFileDescriptor(uri, "r")?.use { afd ->
                return@lazy afd.length
            }
        } catch (_: Exception) {}
        -1L
    }

    override fun contentType(): MediaType? = mimeType.toMediaTypeOrNull()

    override fun contentLength(): Long = cachedLength

    override fun writeTo(sink: BufferedSink) {
        val totalBytes = contentLength()
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var uploadedBytes = 0L
        var lastReportedPct = -1

        val inputStream = contentResolver.openInputStream(uri)
            ?: throw IOException("Video dosyası açılamadı.")

        inputStream.use { input ->
            var read: Int
            while (input.read(buffer).also { read = it } != -1) {
                coroutineContext.ensureActive()
                sink.write(buffer, 0, read)
                uploadedBytes += read
                if (totalBytes > 0) {
                    val pct = ((uploadedBytes * 100L) / totalBytes).toInt().coerceIn(0, 100)
                    if (pct != lastReportedPct) {
                        lastReportedPct = pct
                        onProgress(pct)
                    }
                }
            }
        }
    }

    companion object {
        private const val DEFAULT_BUFFER_SIZE = 64 * 1024
    }
}

class NexoraRepository(
    baseUrl: String = DEFAULT_BASE_URL,
    client: OkHttpClient? = null,
    /** Returns the participant secret for a room code (SessionStore::getRoomToken). */
    private val tokenProvider: (String) -> String = { "" }
) {
    companion object {
        const val DEFAULT_BASE_URL = "https://nexorawatch-beta.vercel.app/"
        const val DEFAULT_WS_URL = "wss://nexorawatch-beta.vercel.app/api/ws"
    }

    private val gson = Gson()

    // Section 21 Final Release Hardening:
    // Debug logging: BASIC if needed. Release logging: NONE. BODY logging: NEVER.
    val okHttpClient: OkHttpClient = client ?: OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val req = chain.request()
            val code = Regex("/api/rooms/([A-Za-z0-9]{6})").find(req.url.encodedPath)?.groupValues?.get(1)
            val token = code?.let(tokenProvider).orEmpty()
            chain.proceed(if (token.isBlank()) req else req.newBuilder().header("X-Participant-Token", token).build())
        }
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        })
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    private val api: NexoraApi = retrofit.create(NexoraApi::class.java)

    private fun <T> handleResponse(response: Response<T>): T {
        if (response.isSuccessful && response.body() != null) {
            return response.body()!!
        }

        val code = response.code()
        var errorDetail = when (code) {
            410 -> "Bu odanın süresi dolmuş (24 saat sınırı)."
            404 -> "Oda bulunamadı veya süresi dolmuş olabilir."
            403 -> "Bu işlem yalnızca oda sahibi (HOST) tarafından yapılabilir."
            else -> "İstek başarısız oldu ($code)"
        }
        try {
            val errorBody = response.errorBody()?.string()
            if (!errorBody.isNullOrBlank()) {
                val json = gson.fromJson(errorBody, JsonObject::class.java)
                if (json.has("detail") && !json.get("detail").isJsonNull) {
                    errorDetail = json.get("detail").asString
                } else if (json.has("error") && !json.get("error").isJsonNull) {
                    errorDetail = json.get("error").asString
                }
            }
        } catch (_: Exception) {}

        throw NexoraException(code, errorDetail)
    }

    suspend fun createRoom(nickname: String, name: String): JoinResponse = withContext(Dispatchers.IO) {
        val nick = nickname.trim()
        val roomName = name.trim().ifEmpty { "${nick}'in odası" }
        val response = api.createRoom(CreateRoomRequest(nick, roomName))
        handleResponse(response)
    }

    suspend fun joinRoom(code: String, nickname: String, participantId: String? = null): JoinResponse = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val nick = nickname.trim()
        val response = api.joinRoom(cleanCode, JoinRoomRequest(nick, participantId))
        handleResponse(response)
    }

    suspend fun getRoom(code: String): Room = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val response = api.getRoom(cleanCode)
        handleResponse(response)
    }

    suspend fun getMessages(code: String): List<Message> = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val response = api.getMessages(cleanCode)
        handleResponse(response)
    }

    suspend fun sendMessage(code: String, participantId: String, text: String): Message = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val response = api.sendMessage(cleanCode, SendMessageRequest(participantId, text.trim()))
        handleResponse(response)
    }

    suspend fun setVideo(code: String, participantId: String, url: String): Room = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val response = api.setVideo(cleanCode, SetVideoRequest(participantId, url.trim()))
        handleResponse(response)
    }

    suspend fun setPlayback(code: String, participantId: String, playing: Boolean, position: Double): Playback = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val response = api.setPlayback(cleanCode, SetPlaybackRequest(participantId, playing, position))
        handleResponse(response)
    }

    suspend fun setWeb(code: String, participantId: String, open: Boolean, url: String?): Room = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val response = api.setWeb(cleanCode, SetWebRequest(participantId, open, url))
        handleResponse(response)
    }

    suspend fun leaveRoom(code: String, participantId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val cleanCode = code.trim().uppercase()
            val response = api.leaveRoom(cleanCode, LeaveRoomRequest(participantId))
            handleResponse(response).ok
        } catch (_: Exception) {
            false
        }
    }

    suspend fun uploadVideoStream(
        code: String,
        participantId: String,
        contentResolver: ContentResolver,
        uri: Uri,
        fileName: String,
        mimeType: String,
        onProgress: (Int) -> Unit
    ): UploadResponse = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val codePart = cleanCode.toRequestBody("text/plain".toMediaTypeOrNull())
        val participantPart = participantId.toRequestBody("text/plain".toMediaTypeOrNull())
        val streamBody = ContentUriRequestBody(
            contentResolver = contentResolver,
            uri = uri,
            mimeType = mimeType,
            coroutineContext = currentCoroutineContext(),
            onProgress = onProgress
        )
        val filePart = MultipartBody.Part.createFormData("file", fileName, streamBody)

        val response = api.uploadVideo(codePart, participantPart, filePart)
        handleResponse(response)
    }

    suspend fun uploadVideo(
        code: String,
        participantId: String,
        fileBytes: ByteArray,
        fileName: String,
        mimeType: String
    ): UploadResponse = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().uppercase()
        val codePart = cleanCode.toRequestBody("text/plain".toMediaTypeOrNull())
        val participantPart = participantId.toRequestBody("text/plain".toMediaTypeOrNull())
        val fileReqBody = fileBytes.toRequestBody(mimeType.toMediaTypeOrNull())
        val filePart = MultipartBody.Part.createFormData("file", fileName, fileReqBody)

        val response = api.uploadVideo(codePart, participantPart, filePart)
        handleResponse(response)
    }
}
