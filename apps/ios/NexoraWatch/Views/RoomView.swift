import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class RoomModel: ObservableObject {
    @Published var room: Room
    @Published var messages: [ChatMessage] = []
    let ident: Identity
    let socket: RoomSocket
    let sync = SyncEngine()
    let av = AVSyncPlayer()
    let yt = YouTubeSyncPlayer()
    private var loadedMedia: String?

    var isHost: Bool { room.host_id == ident.participantId }

    init(code: String, ident: Identity, room: Room) {
        self.room = room
        self.ident = ident
        socket = RoomSocket(code: code, ident: ident)
        socket.onRoomRefresh = { [weak self] in self?.apply(room: $0) }
        socket.onEvent = { [weak self] in self?.handle($0) }
        sync.publish = { [weak self] playing, position, seq in
            guard let self else { return }
            self.socket.send(["type": "playback", "playing": playing, "position": position, "seq": seq,
                              "media_id": self.room.playback.media_id ?? "", "sent_at": Date().timeIntervalSince1970 * 1000 + self.socket.offsetMs])
        }
        av.onUserPlayPause = { [weak self] p in self?.sync.hostChanged(playing: p) }
        yt.onUserPlayPause = { [weak self] p in self?.sync.hostChanged(playing: p) }
    }

    func start() {
        sync.isHost = isHost
        socket.start()
        sync.start()
        mountVideo()
        Task { messages = (try? await APIClient.shared.messages(room.code)) ?? [] }
    }

    func stop() { socket.stop(); sync.stop(); av.pause() }

    private func decode<T: Decodable>(_ v: Any?) -> T? {
        guard let v, let d = try? JSONSerialization.data(withJSONObject: v) else { return nil }
        return try? JSONDecoder().decode(T.self, from: d)
    }

    private func apply(room r: Room) {
        let keep = room.playback.revision > r.playback.revision
        var next = r
        if keep { next.playback = room.playback }
        room = next
        sync.update(playback: room.playback, offsetMs: socket.offsetMs)
        mountVideo()
    }

    private func handle(_ o: [String: Any]) {
        switch o["type"] as? String {
        case "hello", "room": if let r: Room = decode(o["room"]) { apply(room: r) }
        case "playback":
            if let pb: Playback = decode(o["playback"]), pb.revision > room.playback.revision {
                room.playback = pb
                sync.update(playback: pb, offsetMs: socket.offsetMs)
            }
        case "message":
            if let m: ChatMessage = decode(o["message"]), !messages.contains(where: { $0.id == m.id }) { messages.append(m) }
        case "presence":
            if let id = o["participant_id"] as? String, let on = o["online"] as? Bool, let i = room.participants.firstIndex(where: { $0.id == id }) {
                room.participants[i].online = on
            }
        default: break
        }
    }

    private func mountVideo() {
        guard let v = room.video, v.media_id != loadedMedia else { return }
        loadedMedia = v.media_id
        switch v.kind {
        case "youtube": sync.player = yt; yt.load(videoId: v.video_id ?? "", controls: isHost)
        case "upload":
            sync.player = av
            Task { if let id = v.media_id, let url = try? await APIClient.shared.mediaURL(id, ident) { av.load(url) } }
        case "direct", "hls":
            sync.player = av
            if let s = v.stream_url ?? Optional(v.url), let url = URL(string: s) { av.load(url) }
        default: sync.player = nil
        }
    }

    func sendChat(_ text: String) {
        if !socket.send(["type": "message", "text": text, "client_id": UUID().uuidString]) {
            Task { if let m: ChatMessage = try? await APIClient.shared.raw("POST", "/rooms/\(room.code)/messages", ident, ["text": text]) { messages.append(m) } }
        }
    }
}

struct RoomView: View {
    @EnvironmentObject var l10n: L10n
    @StateObject private var model: RoomModel
    @State private var text = ""
    @State private var url = ""
    @State private var picking = false
    @State private var uploadPct: Double?
    @Environment(\.horizontalSizeClass) private var hSize

    init(code: String, ident: Identity, initialRoom: Room) {
        _model = StateObject(wrappedValue: RoomModel(code: code, ident: ident, room: initialRoom))
    }

    var body: some View {
        Group {
            if case .roomGone(let c) = model.socket.state {
                VStack(spacing: 12) { Image(systemName: "door.left.hand.closed").font(.largeTitle); Text(l10n.t(c == "room_not_found" ? "notfound_title" : "closed_title")) }
            } else if hSize == .regular {
                HStack(alignment: .top, spacing: 14) { ScrollView { mainColumn }; ScrollView { sideColumn }.frame(width: 380) }.padding(14)
            } else {
                ScrollView { VStack(spacing: 10) { mainColumn; sideColumn }.padding(10) }
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationTitle(model.room.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) { header }
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: URL(string: "\(APIClient.shared.base.absoluteString)/room/\(model.room.code)")!) { Image(systemName: "square.and.arrow.up") }
            }
        }
        .onAppear { model.start() }
        .onDisappear { model.stop() }
        .fileImporter(isPresented: $picking, allowedContentTypes: [.movie, .mpeg4Movie, .quickTimeMovie]) { result in
            guard case .success(let file) = result else { return }
            Task {
                guard file.startAccessingSecurityScopedResource() else { return }
                defer { file.stopAccessingSecurityScopedResource() }
                try? await Uploader(code: model.room.code, ident: model.ident).upload(fileURL: file) { p in
                    Task { @MainActor in uploadPct = Double(p.sent) / Double(max(1, p.total)) }
                }
                uploadPct = nil
            }
        }
    }

    private var header: some View {
        VStack(spacing: 2) {
            Text(model.room.name).font(Theme.title(15))
            HStack(spacing: 6) {
                Text(model.room.code).font(.caption.bold()).foregroundStyle(Theme.purple)
                Circle().fill(statusColor).frame(width: 7, height: 7)
                Text(statusText).font(.caption2).foregroundStyle(Theme.muted)
            }
        }.accessibilityElement(children: .combine)
    }

    private var statusColor: Color {
        switch model.socket.state { case .connected: return Theme.success; case .reconnecting, .connecting: return Theme.warning; default: return Theme.error }
    }
    private var statusText: String {
        switch model.socket.state {
        case .connected: return l10n.t("st_connected")
        case .connecting: return l10n.t("st_connecting")
        case .reconnecting(let n): return l10n.t("st_reconnecting", ["n": "\(n)"])
        case .failed: return l10n.t("st_failed")
        default: return l10n.t("st_offline")
        }
    }

    @ViewBuilder private var mainColumn: some View {
        VStack(spacing: 10) {
            if model.socket.state == .failed {
                HStack { Text(l10n.t("st_failed")).font(.footnote); Spacer(); Button(l10n.t("retry")) { model.socket.retryNow() } }
                    .padding(10).background(Theme.error.opacity(0.15)).clipShape(RoundedRectangle(cornerRadius: 12))
            }
            stage.aspectRatio(16 / 9, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 16))
            if model.isHost { hostPanel }
        }
    }

    @ViewBuilder private var stage: some View {
        ZStack {
            Color.black
            switch model.room.video?.kind {
            case "youtube": YouTubeView(webView: model.yt.webView).allowsHitTesting(model.isHost)
            case "direct", "hls", "upload": NativePlayerView(player: model.av.player, showsControls: model.isHost)
            case "drive_embed": Text(l10n.t("no_sync")).foregroundStyle(Theme.warning)
            default: VStack { Image(systemName: "film"); Text(l10n.t("waiting_title")).bold(); Text(l10n.t("waiting_sub")).font(.caption) }.foregroundStyle(Theme.muted)
            }
            if model.av.buffering { Label(l10n.t("buffering"), systemImage: "hourglass").padding(6).background(.ultraThinMaterial, in: Capsule()) }
        }
    }

    private var hostPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(l10n.t("source")).font(Theme.title(13))
            HStack {
                TextField(l10n.t("url_ph"), text: $url).padding(11).background(Theme.input).clipShape(RoundedRectangle(cornerRadius: 12))
                Button(l10n.t("set")) {
                    Task { if let r = try? await APIClient.shared.setVideo(model.room.code, model.ident, url: url) { model.room = r; url = "" } }
                }.buttonStyle(.borderedProminent)
            }
            Button { picking = true } label: { Label(l10n.t("upload_video"), systemImage: "icloud.and.arrow.up") }
            if let p = uploadPct { ProgressView(value: p) { Text("\(l10n.t("uploading")) \(Int(p * 100))%") } }
        }.padding(12).background(Theme.card).clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder private var sideColumn: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(l10n.t("participants")).font(Theme.title(13))
            ForEach(model.room.participants) { p in
                HStack { Circle().fill(p.online ? Theme.success : Theme.muted).frame(width: 7, height: 7); Text(p.nickname); if p.is_host { Text("HOST").font(.caption2.bold()).foregroundStyle(Theme.purple) } }
            }
        }.frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Theme.card).clipShape(RoundedRectangle(cornerRadius: 16))
        VStack(alignment: .leading, spacing: 6) {
            Text(l10n.t("chat")).font(Theme.title(13))
            ForEach(model.messages) { m in
                if m.kind == "system" { Text(m.text).font(.caption).foregroundStyle(Theme.muted).frame(maxWidth: .infinity) }
                else { (Text(m.nickname + " ").bold().foregroundColor(Theme.cyan) + Text(m.text)).font(Theme.body(14)) }
            }
            HStack {
                TextField(l10n.t("msg_ph"), text: $text).padding(11).background(Theme.input).clipShape(RoundedRectangle(cornerRadius: 12)).submitLabel(.send)
                    .onSubmit(send)
                Button(action: send) { Image(systemName: "paperplane.fill") }.accessibilityLabel(l10n.t("chat"))
            }
        }.padding(12).background(Theme.card).clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func send() {
        let v = text.trimmingCharacters(in: .whitespaces)
        guard !v.isEmpty else { return }
        model.sendChat(v)
        text = ""
    }
}
