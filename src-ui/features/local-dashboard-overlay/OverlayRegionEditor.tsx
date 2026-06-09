import type { OverlayAnchor, OverlayRegionConfig } from "./types";
import styles from "./LocalDashboardOverlay.module.css";

export function OverlayRegionEditor({
  anchors,
  layouts,
  onChange,
  onDelete,
  region
}: {
  anchors: readonly OverlayAnchor[];
  layouts: { id: string; name: string }[];
  onChange: (region: OverlayRegionConfig) => void;
  onDelete: () => void;
  region: OverlayRegionConfig;
}) {
  function patch(next: Partial<OverlayRegionConfig>) {
    onChange({ ...region, ...next });
  }

  return (
    <article className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{region.name || "Dashboard Region"}</h2>
        <button type="button" onClick={onDelete}>Delete</button>
      </div>

      <label className={styles.inlineCheck}>
        <input
          type="checkbox"
          checked={region.enabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
        />
        Enabled
      </label>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          Name
          <input
            value={region.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          Layout
          <select
            value={region.layoutId}
            onChange={(event) => patch({ layoutId: event.target.value })}
          >
            <option value="">None</option>
            {layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>{layout.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Anchor
          <select
            value={region.anchor}
            onChange={(event) => patch({ anchor: event.target.value as OverlayAnchor })}
          >
            {anchors.map((anchor) => (
              <option key={anchor} value={anchor}>{anchor}</option>
            ))}
          </select>
        </label>
        <NumberField label="Offset X" value={region.offsetX} onChange={(offsetX) => patch({ offsetX })} />
        <NumberField label="Offset Y" value={region.offsetY} onChange={(offsetY) => patch({ offsetY })} />
        <NumberField
          label="Scale"
          value={region.scale}
          step={0.1}
          min={0.1}
          max={5}
          onChange={(scale) => patch({ scale })}
        />
        <NumberField label="Z-index" value={region.zIndex} onChange={(zIndex) => patch({ zIndex })} />
      </div>
    </article>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step = 1,
  value
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className={styles.field}>
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(clamp(next, min, max));
        }}
      />
    </label>
  );
}

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}
