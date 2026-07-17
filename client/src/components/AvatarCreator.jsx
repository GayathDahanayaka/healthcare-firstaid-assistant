import { useEffect, useRef, useState } from "react";
import { AvaturnSDK } from "@avaturn/sdk";

// Free tier — sign up at https://developer.avaturn.me for your own subdomain.
// "demo" works for testing but is shared/rate-limited; swap before final submission.
const AVATURN_SUBDOMAIN = "demo";

function AvatarCreator({ onAvatarCreated }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let sdk;
    let cancelled = false;

    async function load() {
      try {
        sdk = new AvaturnSDK();
        await sdk.init(containerRef.current, {
          url: `https://${AVATURN_SUBDOMAIN}.avaturn.dev`,
        });
        if (cancelled) return;
        setLoading(false);

        sdk.on("export", (data) => {
          if (data?.url) onAvatarCreated(data.url);
        });
      } catch (err) {
        console.error("Avaturn failed to load:", err);
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      sdk?.destroy?.();
    };
  }, [onAvatarCreated]);

  return (
    <div className="avatar-creator-shell">
      <div className="avatar-creator-header">
        <h2>Create Your Avatar</h2>
        <p>Design your look, then click "Next" inside the editor when you're done.</p>
      </div>

      {error && (
        <div className="avatar-error">
          Couldn't load the avatar creator right now. You can{" "}
          <button className="link-btn" onClick={() => onAvatarCreated(null)}>
            skip and continue to chat
          </button>{" "}
          instead.
        </div>
      )}

      {loading && !error && (
        <div className="avatar-loading">Loading avatar creator…</div>
      )}

      <div ref={containerRef} className="avaturn-container" />
    </div>
  );
}

export default AvatarCreator;