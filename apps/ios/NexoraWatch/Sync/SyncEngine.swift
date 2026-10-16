import Foundation

/// Abstract player so AVPlayer and the YouTube iframe share one sync engine.
@MainActor
protocol SyncablePlayer: AnyObject {
    var isReady: Bool { get }
    var currentTime: Double { get }
    var isPaused: Bool { get }
    var isBuffering: Bool { get }
    var supportsRate: Bool { get }
    func play()
    func pause()
    func seek(_ seconds: Double)
    func setRate(_ rate: Float)
}

enum SyncMath {
    static let seekThreshold = 2.0
    static let rateBand = 0.25

    static func expected(_ pb: Playback, offsetMs: Double, nowMs: Double = Date().timeIntervalSince1970 * 1000) -> Double {
        guard pb.playing else { return pb.position }
        return max(0, pb.position + (nowMs + offsetMs - pb.updated_at) / 1000)
    }

    enum Action: Equatable { case none, seek(Double), rate(Float) }

    /// Guest decision: big drift -> seek; small drift on rate-capable players -> bounded rate nudge (±5%).
    static func decide(drift: Double, target: Double, supportsRate: Bool, cooldownActive: Bool) -> Action {
        if abs(drift) > seekThreshold { return cooldownActive ? .none : .seek(target + 0.15) }
        if supportsRate && abs(drift) > rateBand { return .rate(Float(min(1.05, max(0.95, 1 - drift * 0.1)))) }
        return .rate(1)
    }
}

@MainActor
final class SyncEngine: ObservableObject {
    @Published var drift: Double?
    @Published var corrections = 0
    @Published var needsGesture = false
    weak var player: SyncablePlayer?
    var isHost = false
    var publish: ((_ playing: Bool, _ position: Double, _ seq: Int64) -> Void)?

    private var playback: Playback?
    private var offsetMs: Double = 0
    private var cooldownUntil = Date.distantPast
    private var lastPub: (at: Date, playing: Bool, position: Double)?
    private var seq: Int64 = 0
    private var timer: Timer?

    func update(playback: Playback, offsetMs: Double) {
        if let cur = self.playback, cur.revision >= playback.revision { self.offsetMs = offsetMs; return }
        self.playback = playback
        self.offsetMs = offsetMs
    }

    func start() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: isHost ? 1.0 : 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    func stop() { timer?.invalidate() }

    /// Host: called from player events (user tapped play/pause/seek). Buffering is never published as pause.
    func hostChanged(playing: Bool) {
        guard isHost, let p = player, p.isReady, !p.isBuffering else { return }
        seq = max(seq + 1, Int64(Date().timeIntervalSince1970 * 1000))
        lastPub = (Date(), playing, p.currentTime)
        publish?(playing, p.currentTime, seq)
    }

    private func tick() {
        guard let p = player, p.isReady, let pb = playback else { return }
        if isHost {
            guard !p.isBuffering else { return }
            let ref = lastPub ?? (Date(), pb.playing, SyncMath.expected(pb, offsetMs: offsetMs))
            let exp = ref.position + (ref.playing ? Date().timeIntervalSince(ref.at) : 0)
            if (!p.isPaused) != ref.playing || abs(p.currentTime - exp) > 0.75 || (ref.playing && Date().timeIntervalSince(ref.at) > 20) {
                hostChanged(playing: !p.isPaused)
            }
            return
        }
        let target = SyncMath.expected(pb, offsetMs: offsetMs)
        if !pb.playing {
            if !p.isPaused { p.pause() }
            if abs(p.currentTime - target) > 0.5, Date() > cooldownUntil { p.seek(target); cooldownUntil = Date().addingTimeInterval(1.5) }
            p.setRate(1)
            return
        }
        if p.isPaused { p.play(); return }
        if p.isBuffering { return }
        let d = p.currentTime - target
        drift = d
        switch SyncMath.decide(drift: d, target: target, supportsRate: p.supportsRate, cooldownActive: Date() < cooldownUntil) {
        case .seek(let s):
            p.setRate(1); p.seek(s); corrections += 1; cooldownUntil = Date().addingTimeInterval(3)
        case .rate(let r):
            p.setRate(r)
        case .none:
            break
        }
    }
}
