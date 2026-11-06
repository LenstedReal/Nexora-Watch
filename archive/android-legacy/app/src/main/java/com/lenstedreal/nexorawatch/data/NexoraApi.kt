package com.lenstedreal.nexorawatch.data

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path

interface NexoraApi {

    @POST("/api/rooms")
    suspend fun createRoom(
        @Body body: CreateRoomRequest
    ): Response<JoinResponse>

    @POST("/api/rooms/{code}/join")
    suspend fun joinRoom(
        @Path("code") code: String,
        @Body body: JoinRoomRequest
    ): Response<JoinResponse>

    @GET("/api/rooms/{code}")
    suspend fun getRoom(
        @Path("code") code: String
    ): Response<Room>

    @GET("/api/rooms/{code}/messages")
    suspend fun getMessages(
        @Path("code") code: String
    ): Response<List<Message>>

    @POST("/api/rooms/{code}/messages")
    suspend fun sendMessage(
        @Path("code") code: String,
        @Body body: SendMessageRequest
    ): Response<Message>

    @PUT("/api/rooms/{code}/video")
    suspend fun setVideo(
        @Path("code") code: String,
        @Body body: SetVideoRequest
    ): Response<Room>

    @PUT("/api/rooms/{code}/playback")
    suspend fun setPlayback(
        @Path("code") code: String,
        @Body body: SetPlaybackRequest
    ): Response<Playback>

    @PUT("/api/rooms/{code}/web")
    suspend fun setWeb(
        @Path("code") code: String,
        @Body body: SetWebRequest
    ): Response<Room>

    @POST("/api/rooms/{code}/leave")
    suspend fun leaveRoom(
        @Path("code") code: String,
        @Body body: LeaveRoomRequest
    ): Response<LeaveResponse>

    @Multipart
    @POST("/api/upload")
    suspend fun uploadVideo(
        @Part("code") code: RequestBody,
        @Part("participant_id") participantId: RequestBody,
        @Part file: MultipartBody.Part
    ): Response<UploadResponse>
}
