// Instagram posts / reels and X (Twitter) posts have official embeds but no JavaScript control, so they play for
// everyone without sync (capabilities.sync = false), like Kick: nothing is drawn over them, no guest lock.
//   Instagram: www.instagram.com/p|reel/<code>/embed/ (the page Instagram's own embed code loads)
//   X: platform.twitter.com/embed/Tweet.html?id=<id> (the page X's widgets.js loads for an embedded post)
const SRC = {
  instagram: (v) => {
    const seg = /\/reel\//.test(v.embed_url || "") ? "reel" : "p";
    return `https://www.instagram.com/${seg}/${encodeURIComponent(v.video_id)}/embed/`;
  },
  x: (v, lang) => `https://platform.twitter.com/embed/Tweet.html?${new URLSearchParams({ id: v.video_id, theme: "dark", dnt: "true", lang })}`,
};
const TITLES = { instagram: "Instagram", x: "X" };

export const SocialEmbed = ({ video, lang = "tr" }) => (
  <iframe
    title={TITLES[video.kind]}
    src={SRC[video.kind](video, lang)}
    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
    allowFullScreen
    className="social-embed"
    data-testid={`${video.kind}-player`}
  />
);

export const SOCIAL_KINDS = new Set(Object.keys(SRC));
