import type { CSSProperties } from "react";
import {
  formatGear,
  formatTelemetryValue,
  smoothGear,
  type GearSmootherState
} from "./telemetryFormat";
import type {
  DashboardConditionalRule,
  DashboardControl,
  DashboardLayoutPayload,
  LiveFrame,
  OverlayAnchor,
  OverlayRegionConfig,
  RegionRect
} from "./types";
import styles from "./LocalDashboardOverlay.module.css";

export interface RegionPositionInput {
  containerWidth: number;
  containerHeight: number;
  layoutWidth: number;
  layoutHeight: number;
  scale: number;
  anchor: OverlayAnchor;
  offsetX: number;
  offsetY: number;
}

export function computeRegionRect(input: RegionPositionInput): RegionRect {
  const width = input.layoutWidth * input.scale;
  const height = input.layoutHeight * input.scale;
  let baseX = 0;
  let baseY = 0;

  switch (input.anchor) {
    case "topCenter":
      baseX = (input.containerWidth - width) / 2;
      break;
    case "topRight":
      baseX = input.containerWidth - width;
      break;
    case "centerLeft":
      baseY = (input.containerHeight - height) / 2;
      break;
    case "center":
      baseX = (input.containerWidth - width) / 2;
      baseY = (input.containerHeight - height) / 2;
      break;
    case "centerRight":
      baseX = input.containerWidth - width;
      baseY = (input.containerHeight - height) / 2;
      break;
    case "bottomLeft":
      baseY = input.containerHeight - height;
      break;
    case "bottomCenter":
      baseX = (input.containerWidth - width) / 2;
      baseY = input.containerHeight - height;
      break;
    case "bottomRight":
      baseX = input.containerWidth - width;
      baseY = input.containerHeight - height;
      break;
    case "topLeft":
    default:
      break;
  }

  return {
    left: baseX + input.offsetX,
    top: baseY + input.offsetY,
    width,
    height
  };
}

export function DashboardRegionRenderer({
  containerWidth,
  containerHeight,
  frame,
  gearState,
  layout,
  region
}: {
  containerWidth: number;
  containerHeight: number;
  frame: LiveFrame | null;
  gearState?: GearSmootherState;
  layout: DashboardLayoutPayload;
  region: OverlayRegionConfig;
}) {
  const rect = computeRegionRect({
    containerWidth,
    containerHeight,
    layoutWidth: layout.canvasWidth,
    layoutHeight: layout.canvasHeight,
    scale: region.scale,
    anchor: region.anchor,
    offsetX: region.offsetX,
    offsetY: region.offsetY
  });

  return (
    <div
      className={styles.region}
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: region.zIndex
      }}
    >
      <div
        className={styles.stage}
        style={{
          width: layout.canvasWidth,
          height: layout.canvasHeight,
          transform: `scale(${region.scale})`
        }}
      >
        <img
          className={styles.staticImage}
          src={`data:${layout.imageMime};base64,${layout.staticImageBase64}`}
          alt=""
        />
        {layout.dynamicControls.map((control) => (
          <DynamicDashboardControl
            key={control.id}
            control={control}
            frame={frame}
            gearState={gearState}
          />
        ))}
      </div>
    </div>
  );
}

export function DynamicDashboardControl({
  control,
  frame,
  gearState
}: {
  control: DashboardControl;
  frame: LiveFrame | null;
  gearState?: GearSmootherState;
}) {
  const style = computeControlStyle(control, frame);
  return (
    <div className={styles.dynamicControl} style={style}>
      {resolveControlText(control, frame, gearState)}
    </div>
  );
}

export function resolveControlText(
  control: DashboardControl,
  frame: LiveFrame | null,
  gearState?: GearSmootherState
): string {
  const template = control.textTemplate ?? "{value}";
  return template.replace(/\{([^}]+)\}/g, (_match, token: string) => {
    const [rawField, explicitFormat] = token.split("|");
    const field = rawField === "value" ? control.telemetryField : rawField;
    if (!field || !frame) return "--";

    let value = readFrameValue(frame, field);
    if (field === "gear" && gearState) {
      value = smoothGear(
        gearState,
        Number(value),
        frame.timestampMs
      ).committedGear;
    }

    if (field === "gear" && !explicitFormat && !control.format) {
      return formatGear(Number(value));
    }

    return formatTelemetryValue(value, explicitFormat ?? control.format);
  });
}

export function computeControlStyle(
  control: DashboardControl,
  frame: LiveFrame | null
): CSSProperties {
  const conditionalStyle = evaluateConditionalRules(control.conditionalRules ?? [], frame);
  return {
    position: "absolute",
    left: control.x,
    top: control.y,
    width: control.width,
    height: control.height,
    fontSize: control.fontSize,
    color: conditionalStyle.color ?? control.textColor,
    backgroundColor: conditionalStyle.backgroundColor ?? control.backgroundColor ?? "transparent"
  };
}

export function evaluateConditionalRules(
  rules: DashboardConditionalRule[],
  frame: LiveFrame | null
): { color?: string; backgroundColor?: string } {
  const style: { color?: string; backgroundColor?: string } = {};
  if (!frame) return style;

  for (const rule of rules) {
    const value = Number(readFrameValue(frame, rule.telemetryField));
    if (!Number.isFinite(value) || !matchesRule(value, rule.operator, rule.compareValue)) {
      continue;
    }

    if (rule.target === "textColor") {
      style.color = rule.color;
    }
    if (rule.target === "backgroundColor") {
      style.backgroundColor = rule.color;
    }
  }
  return style;
}

function matchesRule(value: number, operator: string, compareValue: number): boolean {
  switch (operator) {
    case "gt":
      return value > compareValue;
    case "gte":
      return value >= compareValue;
    case "lt":
      return value < compareValue;
    case "lte":
      return value <= compareValue;
    case "eq":
      return value === compareValue;
    case "neq":
      return value !== compareValue;
    default:
      return false;
  }
}

function readFrameValue(frame: LiveFrame, field: string): unknown {
  return (frame as unknown as Record<string, unknown>)[field];
}
