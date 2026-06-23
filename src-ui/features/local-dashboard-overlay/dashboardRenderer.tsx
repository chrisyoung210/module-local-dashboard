import { memo, useMemo, type CSSProperties } from "react";
import {
  formatGear,
  formatTelemetryValue,
  smoothGear,
  type GearSmootherState,
} from "./telemetryFormat";
import { evaluateTextExpression } from "./textExpression";
import type {
  DashboardConditionalRule,
  DashboardControl,
  DashboardLayoutPayload,
  LiveFrame,
  OverlayAnchor,
  OverlayRegionConfig,
  RegionRect,
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
    height,
  };
}

export function DashboardRegionRenderer({
  containerWidth,
  containerHeight,
  frame,
  gearState,
  layout,
  region,
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
    offsetY: region.offsetY,
  });

  return (
    <div
      className={styles.region}
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: region.zIndex,
      }}
    >
      <div
        className={styles.stage}
        style={{
          width: layout.canvasWidth,
          height: layout.canvasHeight,
          transform: `scale(${region.scale})`,
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

interface DynamicDashboardControlProps {
  control: DashboardControl;
  frame: LiveFrame | null;
  gearState?: GearSmootherState;
}

const controlDependencyCache = new WeakMap<DashboardControl, string[]>();

export const DynamicDashboardControl = memo(function DynamicDashboardControl({
  control,
  frame,
  gearState,
}: DynamicDashboardControlProps) {
  const style = useMemo(
    () => computeControlStyle(control, frame),
    [control, frame],
  );
  const text = useMemo(
    () => resolveControlText(control, frame, gearState),
    [control, frame, gearState],
  );

  return (
    <div className={styles.dynamicControl} style={style}>
      {text}
    </div>
  );
}, controlPropsAreEqual);

function controlPropsAreEqual(
  previous: DynamicDashboardControlProps,
  next: DynamicDashboardControlProps,
): boolean {
  if (
    previous.control !== next.control ||
    previous.gearState !== next.gearState
  ) {
    return false;
  }

  return controlFrameInputsAreEqual(
    next.control,
    previous.frame,
    next.frame,
    next.gearState !== undefined,
  );
}

export function controlDependencies(control: DashboardControl): string[] {
  const cached = controlDependencyCache.get(control);
  if (cached) return cached;

  const dependencies = new Set<string>();
  const template = control.textTemplate ?? "{value}";
  const savedExpression = /^\s*\{\{expr:([\s\S]*)\}\}\s*$/.exec(template);
  const dependencyTemplate = savedExpression?.[1] ?? template;

  for (const match of dependencyTemplate.matchAll(/\{([^{}]+)\}/g)) {
    const [rawField] = match[1].split("|");
    const field = rawField === "value" ? control.telemetryField : rawField;
    if (field) dependencies.add(field);
  }

  for (const rule of control.conditionalRules ?? []) {
    dependencies.add(rule.telemetryField);
  }

  const result = [...dependencies];
  controlDependencyCache.set(control, result);
  return result;
}

export function controlFrameInputsAreEqual(
  control: DashboardControl,
  previous: LiveFrame | null,
  next: LiveFrame | null,
  usesGearSmoother = false,
): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;

  const dependencies = controlDependencies(control);
  for (const field of dependencies) {
    if (
      !Object.is(readFrameValue(previous, field), readFrameValue(next, field))
    ) {
      return false;
    }
  }

  return !(
    usesGearSmoother &&
    dependencies.includes("gear") &&
    previous.timestampMs !== next.timestampMs
  );
}

export function resolveControlText(
  control: DashboardControl,
  frame: LiveFrame | null,
  gearState?: GearSmootherState,
): string {
  const template = control.textTemplate ?? "{value}";
  const expression = /^\s*\{\{expr:([\s\S]*)\}\}\s*$/.exec(template);
  if (expression) {
    if (!frame) return "--";
    try {
      return evaluateTextExpression(
        expression[1],
        frame as unknown as Record<string, unknown>,
        control.telemetryField,
        control.format,
      );
    } catch {
      return "";
    }
  }
  return template.replace(/\{([^}]+)\}/g, (_match, token: string) => {
    const [rawField, explicitFormat] = token.split("|");
    const field = rawField === "value" ? control.telemetryField : rawField;
    if (!field || !frame) return "--";

    let value = readFrameValue(frame, field);
    if (field === "gear" && gearState) {
      value = smoothGear(
        gearState,
        Number(value),
        frame.timestampMs,
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
  frame: LiveFrame | null,
): CSSProperties {
  const conditionalStyle = evaluateConditionalRules(
    control.conditionalRules ?? [],
    frame,
  );
  return {
    position: "absolute",
    left: control.x,
    top: control.y,
    width: control.width,
    height: control.height,
    fontSize: control.fontSize,
    color: conditionalStyle.color ?? control.textColor,
    backgroundColor:
      conditionalStyle.backgroundColor ??
      control.backgroundColor ??
      "transparent",
  };
}

export function evaluateConditionalRules(
  rules: DashboardConditionalRule[],
  frame: LiveFrame | null,
): { color?: string; backgroundColor?: string } {
  const style: { color?: string; backgroundColor?: string } = {};
  if (!frame) return style;

  for (const rule of rules) {
    const value = Number(readFrameValue(frame, rule.telemetryField));
    if (
      !Number.isFinite(value) ||
      !matchesRule(value, rule.operator, rule.compareValue)
    ) {
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

function matchesRule(
  value: number,
  operator: string,
  compareValue: number,
): boolean {
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
