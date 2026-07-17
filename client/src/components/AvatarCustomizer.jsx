import { useState } from "react";

const SKIN_TONES = ["#f2c9a1", "#e0ac69", "#c68642", "#8d5524", "#5a3825"];
const HAIR_COLORS = ["#2c1b18", "#4a2c1a", "#a05c2c", "#d4a017", "#1a1a1a", "#e8e8e8"];
const SHIRT_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#f59e0b", "#0f172a"];
const HAIR_STYLES = ["short", "long", "bald"];

function AvatarCustomizer({ onAvatarCreated }) {
  const [config, setConfig] = useState({
    skinColor: SKIN_TONES[0],
    hairColor: HAIR_COLORS[0],
    shirtColor: SHIRT_COLORS[0],
    hairStyle: "short",
  });

  const update = (key, value) => setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="avatar-customizer">
      <h2>Build Your Avatar</h2>

      <div className="picker-group">
        <label>Skin tone</label>
        <div className="swatches">
          {SKIN_TONES.map((c) => (
            <button
              key={c}
              className={`swatch ${config.skinColor === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => update("skinColor", c)}
            />
          ))}
        </div>
      </div>

      <div className="picker-group">
        <label>Hair style</label>
        <div className="option-row">
          {HAIR_STYLES.map((s) => (
            <button
              key={s}
              className={`option-btn ${config.hairStyle === s ? "active" : ""}`}
              onClick={() => update("hairStyle", s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {config.hairStyle !== "bald" && (
        <div className="picker-group">
          <label>Hair color</label>
          <div className="swatches">
            {HAIR_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${config.hairColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => update("hairColor", c)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="picker-group">
        <label>Shirt color</label>
        <div className="swatches">
          {SHIRT_COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${config.shirtColor === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => update("shirtColor", c)}
            />
          ))}
        </div>
      </div>

      <button className="confirm-btn" onClick={() => onAvatarCreated(config)}>
        Continue to Chat
      </button>
    </div>
  );
}

export default AvatarCustomizer;