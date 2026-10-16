import XCTest
@testable import NexoraWatch

final class SyncMathTests: XCTestCase {
    func testExpectedWhilePaused() {
        let pb = Playback(playing: false, position: 42, updated_at: 0, revision: 1, media_id: "m")
        XCTAssertEqual(SyncMath.expected(pb, offsetMs: 0, nowMs: 99_999), 42)
    }

    func testExpectedWhilePlayingUsesServerClock() {
        let pb = Playback(playing: true, position: 10, updated_at: 1_000, revision: 1, media_id: "m")
        XCTAssertEqual(SyncMath.expected(pb, offsetMs: 500, nowMs: 2_500), 12, accuracy: 0.001)
    }

    func testLargeDriftSeeks() {
        XCTAssertEqual(SyncMath.decide(drift: 2.5, target: 100, supportsRate: true, cooldownActive: false), .seek(100.15))
        XCTAssertEqual(SyncMath.decide(drift: 2.5, target: 100, supportsRate: true, cooldownActive: true), .none)
    }

    func testSmallDriftUsesBoundedRateOnlyWhenSupported() {
        XCTAssertEqual(SyncMath.decide(drift: 1.0, target: 0, supportsRate: true, cooldownActive: false), .rate(0.95))
        XCTAssertEqual(SyncMath.decide(drift: 1.0, target: 0, supportsRate: false, cooldownActive: false), .rate(1))
    }
}
