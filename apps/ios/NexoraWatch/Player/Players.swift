import AVKit
import SwiftUI
import WebKit

/// AVPlayer for MP4 / WebM(where supported) / HLS / uploaded media. Buffering is tracked separately from pause.
@MainActor
final class AVSyncPlayer: NSObject, ObservableObject, SyncablePlayer {
    let player = AVPlayer()
    @Published var error: String?
    @Published private(set) var buffering = false
    var onUserPlayPause: ((Bool) -> Void)?
    private var obs: [NSKeyValueObservation] = []
    private(set) var isReady = false
    private var programmatic = false

    var currentTime: Double { player.currentTime().seconds.isFinite ? player.currentTime().seconds : 0 }
    var isPaused: Bool { player.timeControlStatus == .paused }
    var isBuffering: Bool { player.timeControlStatus == .waitingToPlayAtSpecifiedRate }
    let supportsRate = true

    func load(_ url: URL) {
        obs.removeAll()
        isReady = false
        error = nil
        let item = AVPlayerItem(url: url)
        player.automaticallyWaitsToMinimizeStalling = true
        player.replaceCurrentItem(with: item)
        obs.append(item.observe(\.status) { [weak self] item, _ in
            Task { @MainActor in
                guard let self else { return }
                if item.status == .readyToPlay { self.isReady = true }
                if item.status == .failed { self.error = item.error?.localizedDescription ?? "player_error" }
            }
        })
        obs.append(player.observe(\.timeControlStatus) { [weak self] p, _ in
            Task { @MainActor in
                guard let self else { return }
                self.buffering = p.timeControlStatus == .waitingToPlayAtSpecifiedRate
                if !self.programmatic, p.timeControlStatus != .waitingToPlayAtSpecifiedRate { self.onUserPlayPause?(p.timeControlStatus == .playing) }
            }
        })
    }

    private func quiet(_ f: () -> Void) { programmatic = true; f(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { self.programmatic = false } }
    func play() { quiet { player.play() } }
    func pause() { quiet { player.pause() } }
    func seek(_ s: Double) { quiet { player.seek(to: CMTime(seconds: s, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero) } }
    func setRate(_ r: Float) { if player.timeControlStatus == .playing, abs(player.rate - r) > 0.004 { quiet { player.rate = r } } }
}

struct NativePlayerView: UIViewControllerRepresentable {
    let player: AVPlayer
    let showsControls: Bool
    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let vc = AVPlayerViewController()
        vc.player = player
        vc.showsPlaybackControls = showsControls
        vc.allowsPictureInPicturePlayback = true
        vc.canStartPictureInPictureAutomaticallyFromInline = true
        return vc
    }
    func updateUIViewController(_ vc: AVPlayerViewController, context: Context) { vc.showsPlaybackControls = showsControls }
}

/// Official YouTube IFrame Player API inside WKWebView (only allowed WebView use). No rate correction for YouTube.
@MainActor
final class YouTubeSyncPlayer: NSObject, ObservableObject, SyncablePlayer, WKScriptMessageHandler {
    let webView: WKWebView
    @Published var error: String?
    var onUserPlayPause: ((Bool) -> Void)?
    private(set) var isReady = false
    private var state = -1
    private var time = 0.0
    var currentTime: Double { time }
    var isPaused: Bool { state != 1 && state != 3 }
    var isBuffering: Bool { state == 3 }
    let supportsRate = false

    override init() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: .zero, configuration: cfg)
        super.init()
        cfg.userContentController.add(self, name: "yt")
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
    }

    func load(videoId: String, controls: Bool) {
        let html = """
        <html><head><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000;height:100%}#p{width:100%;height:100%}</style></head><body><div id=p></div>
        <script src="https://www.youtube.com/iframe_api"></script><script>
        var p;function post(o){webkit.messageHandlers.yt.postMessage(o)}
        function onYouTubeIframeAPIReady(){p=new YT.Player('p',{videoId:'\(videoId)',playerVars:{playsinline:1,controls:\(controls ? 1 : 0),rel:0},
        events:{onReady:function(){post({e:'ready'});setInterval(function(){post({e:'t',t:p.getCurrentTime(),s:p.getPlayerState()})},250)},
        onStateChange:function(x){post({e:'s',s:x.data})},onError:function(x){post({e:'err',c:x.data})}}})}
        </script></body></html>
        """
        webView.loadHTMLString(html, baseURL: URL(string: "https://www.youtube.com"))
    }

    nonisolated func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let o = m.body as? [String: Any] else { return }
        Task { @MainActor in
            switch o["e"] as? String {
            case "ready": self.isReady = true
            case "t": self.time = o["t"] as? Double ?? self.time; self.state = o["s"] as? Int ?? self.state
            case "s":
                self.state = o["s"] as? Int ?? -1
                if self.state == 1 || self.state == 2 { self.onUserPlayPause?(self.state == 1) }
            case "err": self.error = "YouTube error \(o["c"] ?? "")"
            default: break
            }
        }
    }

    private func js(_ s: String) { webView.evaluateJavaScript(s) }
    func play() { js("p&&p.playVideo()") }
    func pause() { js("p&&p.pauseVideo()") }
    func seek(_ s: Double) { js("p&&p.seekTo(\(s),true)"); time = s }
    func setRate(_ r: Float) {}
}

struct YouTubeView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ v: WKWebView, context: Context) {}
}
