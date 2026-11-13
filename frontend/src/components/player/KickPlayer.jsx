// Kick offers one official embed: an iframe of player.kick.com/<channel> with URL parameters and no JavaScript control
// (https://help.kick.com/en/articles/8010826-how-to-embed-your-kick-livestream). A channel therefore plays live for
// everyone, without sync (capabilities.sync = false), like the Drive preview: nothing is drawn over it, no guest lock.
export const KickPlayer = ({ video }) => (
  <iframe
    title="Kick"
    src={`https://player.kick.com/${encodeURIComponent(video.channel)}?autoplay=true`}
    allow="autoplay; fullscreen"
    allowFullScreen
    scrolling="no"
    data-testid="kick-player"
  />
);
