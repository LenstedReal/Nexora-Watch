import Foundation

struct APIError: Error, LocalizedError {
    let status: Int
    let code: String
    let detail: String
    var errorDescription: String? { detail }
}

struct Participant: Codable, Identifiable, Equatable {
    let id: String
    let nickname: String
    let is_host: Bool
    var online: Bool
}

struct Playback: Codable, Equatable {
    let playing: Bool
    let position: Double
    let updated_at: Double
    let revision: Int
    let media_id: String?
}

struct Capabilities: Codable, Equatable {
    let seek: Bool?
    let rate_correction: Bool?
    let sync: Bool?
}

struct VideoSource: Codable, Equatable {
    let url: String
    let kind: String          // youtube | direct | hls | upload | drive_embed
    let video_id: String?
    let embed_url: String?
    let stream_url: String?
    let title: String?
    let media_id: String?
    let capabilities: Capabilities?
    let warning: String?
}

struct Room: Codable, Equatable {
    let code: String
    let name: String
    let host_id: String
    let status: String
    let version: Int
    let expires_at: String
    var participants: [Participant]
    let video: VideoSource?
    var playback: Playback
    let server_time: Double
}

struct ChatMessage: Codable, Identifiable, Equatable {
    let id: String
    let participant_id: String?
    let nickname: String
    let text: String
    let kind: String
    let created_at: String
}

struct JoinResponse: Codable {
    let room: Room
    let participant: Participant
    let token: String
}

struct Identity: Codable, Equatable {
    let participantId: String
    let token: String
    let nickname: String
}

enum IdentityStore {
    // Tokens are per-room secrets; stored in Keychain in production builds (UserDefaults here for brevity).
    static func get(_ code: String) -> Identity? {
        guard let d = UserDefaults.standard.data(forKey: "nx.ident.\(code)") else { return nil }
        return try? JSONDecoder().decode(Identity.self, from: d)
    }
    static func save(_ code: String, _ i: Identity) {
        UserDefaults.standard.set(try? JSONEncoder().encode(i), forKey: "nx.ident.\(code)")
    }
}

final class APIClient {
    static let shared = APIClient()
    let base: URL = {
        let s = Bundle.main.object(forInfoDictionaryKey: "NEXORA_API_BASE_URL") as? String ?? ""
        return URL(string: s)!
    }()
    var wsBase: URL {
        var c = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        c.scheme = c.scheme == "https" ? "wss" : "ws"
        c.path = "/api/ws"
        return c.url!
    }

    private func request<T: Decodable>(_ method: String, _ path: String, body: [String: Any]? = nil) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent("api" + path))
        req.httpMethod = method
        req.timeoutInterval = 20
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data, resp: URLResponse
        do { (data, resp) = try await URLSession.shared.data(for: req) } catch {
            throw APIError(status: 0, code: "network", detail: "Sunucuya ulaşılamıyor")
        }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw APIError(status: status, code: obj?["code"] as? String ?? "http_\(status)", detail: obj?["detail"] as? String ?? "HTTP \(status)")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func cred(_ i: Identity) -> [String: Any] { ["participant_id": i.participantId, "token": i.token] }

    func createRoom(nickname: String, name: String) async throws -> JoinResponse { try await request("POST", "/rooms", body: ["nickname": nickname, "name": name]) }
    func join(code: String, nickname: String, ident: Identity?) async throws -> JoinResponse {
        var b: [String: Any] = ["nickname": nickname]
        if let ident { b.merge(cred(ident)) { $1 } }
        return try await request("POST", "/rooms/\(code)/join", body: b)
    }
    func room(_ code: String) async throws -> Room { try await request("GET", "/rooms/\(code)") }
    func messages(_ code: String) async throws -> [ChatMessage] { try await request("GET", "/rooms/\(code)/messages") }
    func setVideo(_ code: String, _ i: Identity, url: String) async throws -> Room { try await request("PUT", "/rooms/\(code)/video", body: cred(i).merging(["url": url]) { $1 }) }
    func mediaURL(_ id: String, _ i: Identity) async throws -> URL {
        struct R: Decodable { let url: String }
        let q = "participant_id=\(i.participantId)&token=\(i.token.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "")"
        let r: R = try await request("GET", "/media/\(id)/url?\(q)")
        return r.url.hasPrefix("http") ? URL(string: r.url)! : URL(string: base.absoluteString + r.url)!
    }
    func raw<T: Decodable>(_ method: String, _ path: String, _ i: Identity, _ extra: [String: Any] = [:]) async throws -> T {
        try await request(method, path, body: cred(i).merging(extra) { $1 })
    }
}
