// JS side of the local "NexoraAds" module. On iOS, in Expo Go or in a build without the module this is null
// and every call becomes a no-op.
import { requireOptionalNativeModule } from "expo-modules-core";

export type BannerEvent = { visible: boolean; height: number };

type NexoraAdsNative = {
  init(accountId: string, consentJson: string, ageRestricted: boolean): void;
  showBanner(placementId: string, bottomInsetDp: number): void;
  hideBanner(): void;
  loadInterstitial(placementId: string): void;
  showInterstitial(placementId: string): void;
  addListener(event: "onBanner", cb: (e: BannerEvent) => void): { remove(): void };
};

export const NexoraAds = requireOptionalNativeModule<NexoraAdsNative>("NexoraAds");
