import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { C } from "./src/theme";
import { setServer } from "./src/core/api";
import { store } from "./src/core/storage";
import type { JoinResponse } from "./src/core/types";
import { HomeScreen } from "./src/screens/HomeScreen";
import { RoomScreen } from "./src/screens/RoomScreen";

type Route = { name: "home" } | { name: "room"; code: string; initial?: JoinResponse; key: number };

/** nexora://room/ABC234, https://<web>/room/ABC234 or a bare code. */
export function codeFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/room\/([A-Za-z2-9]{6})(?:[/?#]|$)/);
  return m ? m[1].toUpperCase() : null;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>({ name: "home" });

  useEffect(() => {
    (async () => {
      const saved = await store.getServer();
      if (saved) setServer(saved);
      const code = codeFromUrl(await Linking.getInitialURL().catch(() => null));
      if (code) setRoute({ name: "room", code, key: Date.now() });
      setReady(true);
    })();
    const sub = Linking.addEventListener("url", ({ url }) => {
      const code = codeFromUrl(url);
      if (code) setRoute({ name: "room", code, key: Date.now() });
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {!ready ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={C.cyan} />
          </View>
        ) : route.name === "home" ? (
          <HomeScreen
            onEnter={(code, res) => setRoute({ name: "room", code, initial: res, key: Date.now() })}
            onOpenCode={(code) => setRoute({ name: "room", code, key: Date.now() })}
          />
        ) : (
          <RoomScreen key={route.key} code={route.code} initial={route.initial} onExit={() => setRoute({ name: "home" })} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
