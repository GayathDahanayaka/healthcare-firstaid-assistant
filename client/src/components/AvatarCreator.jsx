import { useEffect, useState } from "react";

function AvatarCreator({ onAvatarCreated }) {
  const [showCreator, setShowCreator] = useState(true);

  useEffect(() => {
    function handleMessage(event) {
      if (typeof event.data !== "string") return;
      if (!event.data.includes("v1.avatar.exported")) return;

      try {
        const json = JSON.parse(event.data);
        const avatarUrl = json.data?.url;
        if (avatarUrl) {
          onAvatarCreated(avatarUrl);
          setShowCreator(false);
        }
      } catch (e) {
        console.warn("Could not parse RPM message", e);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onAvatarCreated]);

  if (!showCreator) return null;

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <iframe
        title="Avatar Creator"
        src="https://demo.readyplayer.me/avatar?frameApi"
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="camera *; microphone *"
      />
    </div>
  );
}

export default AvatarCreator;