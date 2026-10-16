import Foundation
import UIKit

enum ConnectionState: Equatable {
    case connecting, connected, reconnecting(Int), offline, failed, roomGone(String), replaced
}

/// One socket per room screen. Backoff + jitter, max 6 automatic attempts, state refresh via GET before reconnect.
@MainActor
final class RoomSocket: ObservableObject {
    static let maxAttempts = 6
    @Published private(set) var state: ConnectionState = .connecting
    @Published private(set) var rtt: Double?
    private(set) var offsetMs: Double = 0
    private(set) var reconnects = 0

    var onEvent: (([String: Any]) -> Void)?
    var onRoomRefresh: ((Room) -> Void)?

    private let code: String
    private let ident: Identity
    private var task: URLSessionWebSocketTask?
    private var attempt = 0
    private var stopped = false
    private var lastPong = Date()
    private var pingTimer: Timer?
    private var retryTask: Task<Void, Never>?
    private var samples: [(rtt: Double, offset: Double)] = []
    private var observers: [NSObjectProtocol] = []

    init(code: String, ident: Identity) {
        self.code = code
        self.ident = ident
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.wake() }
        })
    }

    func start() { stopped = false; attempt = 0; Task { await connect() } }

    func stop() {
        stopped = true
        retryTask?.cancel()
        pingTimer?.invalidate()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    func retryNow() { attempt = 0; stopped = false; Task { await connect() } }

    private func wake() {
        guard !stopped else { return }
        if task == nil { attempt = 0; Task { await connect() } } else { ping() }
    }

    private func connect() async {
        guard !stopped, task == nil else { return }
        state = attempt == 0 ? .connecting : .reconnecting(attempt)
        if attempt > 0 || reconnects > 0 {
            do { onRoomRefresh?(try await APIClient.shared.room(code)) } catch let e as APIError {
                if e.status == 404 || e.status == 410 { state = .roomGone(e.code); stopped = true; return }
                scheduleRetry(); return
            } catch { scheduleRetry(); return }
        }
        var c = URLComponents(url: APIClient.shared.wsBase, resolvingAgainstBaseURL: false)!
        c.queryItems = [.init(name: "code", value: code), .init(name: "participant_id", value: ident.participantId), .init(name: "token", value: ident.token)]
        let t = URLSession.shared.webSocketTask(with: c.url!)
        task = t
        t.resume()
        receive(t)
        lastPong = Date()
        for d in [0.0, 0.4, 0.9] { DispatchQueue.main.asyncAfter(deadline: .now() + d) { [weak self] in self?.ping() } }
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if Date().timeIntervalSince(self.lastPong) > 25 { self.drop(t) } else { self.ping() }
            }
        }
    }

    private func receive(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            Task { @MainActor in
                guard let self, self.task === t else { return }
                switch result {
                case .success(.string(let s)):
                    if let obj = (try? JSONSerialization.jsonObject(with: Data(s.utf8))) as? [String: Any] { self.handle(obj) }
                    self.receive(t)
                case .success:
                    self.receive(t)
                case .failure:
                    let code = t.closeCode.rawValue
                    if code == 4410 || code == 4404 || code == 4403 { self.state = .roomGone(code == 4404 ? "room_not_found" : "room_closed"); self.stop(); return }
                    if code == 4000 { self.state = .replaced; self.stop(); return }
                    self.drop(t)
                }
            }
        }
    }

    private func handle(_ obj: [String: Any]) {
        let type = obj["type"] as? String
        if type == "hello" || type == "pong" || type == "playback" { if attempt != 0 || state != .connected { attempt = 0; state = .connected } }
        if type == "pong", let ct = obj["client_time"] as? Double, let st = obj["server_time"] as? Double {
            let now = Date().timeIntervalSince1970 * 1000
            lastPong = Date()
            let r = now - ct
            samples = Array((samples + [(r, st + r / 2 - now)]).suffix(8))
            offsetMs = samples.min { $0.rtt < $1.rtt }!.offset
            rtt = r
            return
        }
        if type == "room_closed" { state = .roomGone("room_closed"); stop(); return }
        onEvent?(obj)
    }

    private func drop(_ t: URLSessionWebSocketTask) {
        guard task === t else { return }
        t.cancel(with: .abnormalClosure, reason: nil)
        task = nil
        pingTimer?.invalidate()
        reconnects += 1
        scheduleRetry()
    }

    private func scheduleRetry() {
        guard !stopped else { return }
        attempt += 1
        if attempt > Self.maxAttempts { state = .failed; return }
        state = .reconnecting(attempt)
        let base = min(30.0, pow(2.0, Double(attempt - 1)))
        let delay = base / 2 + Double.random(in: 0...(base / 2))
        retryTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            await self?.connect()
        }
    }

    @discardableResult
    func send(_ payload: [String: Any]) -> Bool {
        guard let task, state == .connected, let data = try? JSONSerialization.data(withJSONObject: payload), let s = String(data: data, encoding: .utf8) else { return false }
        task.send(.string(s)) { _ in }
        return true
    }

    private func ping() { send(["type": "ping", "client_time": Date().timeIntervalSince1970 * 1000]) || sendPingWhileConnecting() }
    private func sendPingWhileConnecting() -> Bool {
        guard let task, let data = try? JSONSerialization.data(withJSONObject: ["type": "ping", "client_time": Date().timeIntervalSince1970 * 1000]) else { return false }
        task.send(.string(String(decoding: data, as: UTF8.self))) { _ in }
        return true
    }
}
