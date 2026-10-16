import SwiftUI

@main
struct NexoraWatchApp: App {
    @StateObject private var l10n = L10n.shared
    @State private var deepLinkCode: String?

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                HomeView(deepLinkCode: $deepLinkCode)
            }
            .environmentObject(l10n)
            .environment(\.layoutDirection, l10n.isRTL ? .rightToLeft : .leftToRight)
            .preferredColorScheme(.dark)
            .tint(Theme.cyan)
            .onOpenURL { url in
                // Universal link: https://<host>/room/ABC123  or custom scheme nexora://room/ABC123
                if let code = url.pathComponents.last, code.count == 6 { deepLinkCode = code.uppercased() }
            }
        }
    }
}

enum Theme {
    static let bg = Color(hex: 0x09090D)
    static let card = Color(hex: 0x161622)
    static let input = Color(hex: 0x202033)
    static let cyan = Color(hex: 0x00F3FF)
    static let purple = Color(hex: 0xB952FF)
    static let purpleDark = Color(hex: 0x290A45)
    static let muted = Color(hex: 0x8B8B9E)
    static let border = Color(hex: 0x2E2E3A)
    static let success = Color(hex: 0x00FFA3)
    static let error = Color(hex: 0xFF2A55)
    static let warning = Color(hex: 0xFFD600)
    static let gradient = LinearGradient(colors: [Color(hex: 0x6EF3FF), Color(hex: 0xA78BFA), purple], startPoint: .leading, endPoint: .trailing)
    // Outfit / DM Sans: bundle only after license check (SIL OFL); falls back to system font.
    static func title(_ size: CGFloat) -> Font { .custom("Outfit-Bold", size: size, relativeTo: .title) }
    static func body(_ size: CGFloat = 15) -> Font { .custom("DMSans-Regular", size: size, relativeTo: .body) }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// Shared translation keys from packages/localization/locales.json; English fallback for missing keys.
final class L10n: ObservableObject {
    static let shared = L10n()
    @Published var lang: String
    private let table: [String: [String: String]]

    init() {
        let url = Bundle.main.url(forResource: "locales", withExtension: "json")
        let data = url.flatMap { try? Data(contentsOf: $0) } ?? Data("{}".utf8)
        table = (try? JSONDecoder().decode([String: [String: String]].self, from: data)) ?? [:]
        let saved = UserDefaults.standard.string(forKey: "nx.lang")
        let device = String(Locale.preferredLanguages.first?.prefix(2) ?? "tr")
        lang = saved ?? (table[device] != nil ? device : "tr")
    }

    var isRTL: Bool { lang == "ar" }

    func setLang(_ l: String) {
        lang = l
        UserDefaults.standard.set(l, forKey: "nx.lang")
    }

    func t(_ key: String, _ vars: [String: String] = [:]) -> String {
        var s = table[lang]?[key] ?? table["en"]?[key] ?? key
        for (k, v) in vars { s = s.replacingOccurrences(of: "{\(k)}", with: v) }
        return s
    }
}
