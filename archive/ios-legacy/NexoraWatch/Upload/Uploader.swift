import Foundation

/// Multipart upload streamed from disk with FileHandle (one part in memory at a time), resumable via server fingerprint.
final class Uploader {
    struct Progress { let sent: Int64; let total: Int64 }
    private let ident: Identity
    private let code: String
    private var cancelled = false
    private var mediaId: String?

    init(code: String, ident: Identity) { self.code = code; self.ident = ident }

    func cancel() {
        cancelled = true
        if let mediaId { Task { let _: [String: String]? = try? await APIClient.shared.raw("POST", "/uploads/\(mediaId)/abort", ident) } }
    }

    func upload(fileURL: URL, progress: @escaping (Progress) -> Void) async throws {
        struct Init: Decodable { let media_id: String; let status: String; let part_size: Int64?; let part_count: Int?; let parts_done: [Int]? }
        struct Urls: Decodable { let urls: [String: String] }
        struct Done: Decodable { let status: String }
        let attrs = try FileManager.default.attributesOfItem(atPath: fileURL.path)
        let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
        let mod = (attrs[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        let name = fileURL.lastPathComponent
        let ini: Init = try await APIClient.shared.raw("POST", "/uploads/init", ident, [
            "code": code, "filename": name, "size": size, "fingerprint": "\(name):\(size):\(Int(mod * 1000))",
        ])
        mediaId = ini.media_id
        if ini.status == "completed" { let _: Done = try await APIClient.shared.raw("POST", "/uploads/\(ini.media_id)/complete", ident); return }
        guard let partSize = ini.part_size, let count = ini.part_count else { return }
        let done = Set(ini.parts_done ?? [])
        var sent = Int64(done.count) * partSize
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }
        for n in 1...count where !done.contains(n) {
            if cancelled { throw APIError(status: -1, code: "aborted", detail: "İptal edildi") }
            try handle.seek(toOffset: UInt64(Int64(n - 1) * partSize))
            let chunk = handle.readData(ofLength: Int(partSize))
            var attempt = 0
            while true {
                do {
                    let u: Urls = try await APIClient.shared.raw("POST", "/uploads/\(ini.media_id)/part-urls", ident, ["parts": [n]])
                    guard let s = u.urls["\(n)"], let url = URL(string: s.hasPrefix("http") ? s : APIClient.shared.base.absoluteString + s) else { throw APIError(status: 0, code: "network", detail: "url") }
                    var req = URLRequest(url: url)
                    req.httpMethod = "PUT"
                    let (_, resp) = try await URLSession.shared.upload(for: req, from: chunk)
                    let st = (resp as? HTTPURLResponse)?.statusCode ?? 0
                    guard (200..<300).contains(st) else { throw APIError(status: st, code: "http_\(st)", detail: "HTTP \(st)") }
                    break
                } catch {
                    attempt += 1
                    if attempt >= 6 || cancelled { throw error }
                    try await Task.sleep(nanoseconds: UInt64(min(15.0, 0.8 * pow(2, Double(attempt))) * 1_000_000_000))
                }
            }
            sent += Int64(chunk.count)
            progress(Progress(sent: sent, total: size))
        }
        let _: Done = try await APIClient.shared.raw("POST", "/uploads/\(ini.media_id)/complete", ident)
    }
}
