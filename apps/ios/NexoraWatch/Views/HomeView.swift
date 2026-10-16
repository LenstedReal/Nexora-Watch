import SwiftUI

struct HomeView: View {
    @EnvironmentObject var l10n: L10n
    @Binding var deepLinkCode: String?
    @State private var join = false
    @State private var nick = UserDefaults.standard.string(forKey: "nx.nick") ?? ""
    @State private var name = ""
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?
    @State private var opened: (code: String, ident: Identity, room: Room)?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Label(l10n.t("chip"), systemImage: "bolt.fill").font(.caption.bold()).foregroundStyle(Theme.cyan)
                    .padding(.horizontal, 11).padding(.vertical, 5).overlay(Capsule().stroke(.white.opacity(0.15)))
                Image("NexoraLogo").resizable().frame(width: 72, height: 72).clipShape(RoundedRectangle(cornerRadius: 16)).accessibilityHidden(true)
                Text("Better Than Rave.").font(Theme.title(30))
                Text("BY LENSTEDREAL").font(.caption.bold()).kerning(3).foregroundStyle(Theme.purple)
                Text(l10n.t("hero_sub")).font(Theme.body()).foregroundStyle(.white.opacity(0.85))
                card
            }
            .padding(20)
        }
        .background(Theme.bg.ignoresSafeArea())
        .navigationDestination(isPresented: Binding(get: { opened != nil }, set: { if !$0 { opened = nil } })) {
            if let o = opened { RoomView(code: o.code, ident: o.ident, initialRoom: o.room) }
        }
        .onChange(of: deepLinkCode) { c in if let c { join = true; code = c } }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("", selection: $join) {
                Text(l10n.t("tab_create")).tag(false)
                Text(l10n.t("tab_join")).tag(true)
            }.pickerStyle(.segmented)
            field(l10n.t("nickname"), $nick, l10n.t("nickname_ph"))
            if join { field(l10n.t("room_code"), $code, "U2ECN6").textInputAutocapitalization(.characters) }
            else { field(l10n.t("room_name"), $name, l10n.t("room_name_ph")) }
            Button(action: submit) {
                HStack { if busy { ProgressView() }; Text(join ? l10n.t("join") : l10n.t("create")).font(Theme.title(16)) }
                    .frame(maxWidth: .infinity).padding(16).background(Theme.gradient).foregroundStyle(.black).clipShape(RoundedRectangle(cornerRadius: 16))
            }.disabled(busy).accessibilityIdentifier("room-submit-btn")
            if let error { Text(error).font(.footnote).foregroundStyle(Theme.error) }
            Text(l10n.t("home_note")).font(.caption).foregroundStyle(Theme.muted).multilineTextAlignment(.center).frame(maxWidth: .infinity)
        }
        .padding(16).background(Theme.card).clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(Theme.border))
    }

    private func field(_ label: String, _ text: Binding<String>, _ ph: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption2).kerning(2).foregroundStyle(Theme.muted)
            TextField(ph, text: text).padding(15).background(Theme.input).clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }

    private func submit() {
        let n = nick.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { error = l10n.t("need_nickname"); return }
        busy = true; error = nil
        Task {
            defer { busy = false }
            do {
                let r = join ? try await APIClient.shared.join(code: code.uppercased(), nickname: n, ident: IdentityStore.get(code.uppercased()))
                             : try await APIClient.shared.createRoom(nickname: n, name: name)
                let ident = Identity(participantId: r.participant.id, token: r.token, nickname: n)
                IdentityStore.save(r.room.code, ident)
                UserDefaults.standard.set(n, forKey: "nx.nick")
                opened = (r.room.code, ident, r.room)
            } catch let e as APIError {
                error = l10n.t("err_\(e.code)") == "err_\(e.code)" ? e.detail : l10n.t("err_\(e.code)")
            } catch { self.error = error.localizedDescription }
        }
    }
}
