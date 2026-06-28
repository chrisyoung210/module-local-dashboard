import { memo, useMemo, useRef, useEffect, type CSSProperties } from "react";
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
  DashboardValuesFrame,
  OverlayAnchor,
  OverlayRegionConfig,
  RegionRect,
  WidgetType,
} from "./types";
import styles from "./LocalDashboardOverlay.module.css";

// ── Color conversion ─────────────────────────────────────────────────

function toCssColor(hex: string | null | undefined): string | undefined {
  if (!hex || !hex.startsWith("#") || hex.length !== 9) return hex ?? undefined;
  return "#" + hex.slice(3, 9) + hex.slice(1, 3);
}

// ── Shared types ─────────────────────────────────────────────────────

interface BufferEntry {
  t: number;
  v: number;
}

// ── Region positioning ──────────────────────────────────────────────

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

// ── Region renderer ─────────────────────────────────────────────────

export function DashboardRegionRenderer({
  containerWidth,
  containerHeight,
  frame,
  historyBuffer,
  historyVersion,
  trackPoints,
  gearState,
  layout,
  region,
}: {
  containerWidth: number;
  containerHeight: number;
  frame: DashboardValuesFrame | null;
  historyBuffer: Map<string, BufferEntry[]>;
  historyVersion: number;
  trackPoints: Record<string, { points: { x: number; z: number }[]; angleDeg: number; flipX: number; flipZ: number }>;
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
        {layout.controls.map((control) => (
          <DynamicDashboardControl
            key={control.id}
            control={control}
            frame={frame}
            historyBuffer={historyBuffer}
            historyVersion={historyVersion}
            trackPoints={trackPoints}
            gearState={gearState}
          />
        ))}
      </div>
    </div>
  );
}

// ── Widget type dispatch ────────────────────────────────────────────

interface DynamicDashboardControlProps {
  control: DashboardControl;
  frame: DashboardValuesFrame | null;
  historyBuffer: Map<string, BufferEntry[]>;
  historyVersion: number;
  trackPoints: Record<string, { points: { x: number; z: number }[]; angleDeg: number; flipX: number; flipZ: number }>;
  gearState?: GearSmootherState;
}

function resolveWidgetType(control: DashboardControl): WidgetType {
  return control.widgetType;
}

export const DynamicDashboardControl = memo(function DynamicDashboardControl({
  control,
  frame,
  historyBuffer,
  historyVersion,
  trackPoints,
  gearState,
}: DynamicDashboardControlProps) {
  const widgetType = resolveWidgetType(control);

  switch (widgetType) {
    case "static":
      return null;
    case "chart":
      return (
        <ChartWidget
          control={control}
          historyBuffer={historyBuffer}
          historyVersion={historyVersion}
        />
      );
    case "map":
      return (
        <MapWidget control={control} frame={frame} trackPoints={trackPoints} />
      );
    case "text":
    default:
      return (
        <TextWidget control={control} frame={frame} gearState={gearState} />
      );
  }
}, controlPropsAreEqual);

function controlPropsAreEqual(
  previous: DynamicDashboardControlProps,
  next: DynamicDashboardControlProps,
): boolean {
  if (
    previous.control !== next.control ||
    previous.gearState !== next.gearState ||
    previous.historyBuffer !== next.historyBuffer ||
    previous.trackPoints !== next.trackPoints
  ) {
    return false;
  }

  const wt = resolveWidgetType(next.control);
  if (wt === "chart") {
    return previous.historyVersion === next.historyVersion;
  }

  if (wt === "map") {
    const tf = next.control.telemetryField || "normalizedCarPosition";
    const pv = previous.frame?.values[tf];
    const nv = next.frame?.values[tf];
    return Object.is(pv, nv);
  }

  return controlFrameInputsAreEqual(
    next.control,
    previous.frame,
    next.frame,
    next.gearState !== undefined,
  );
}

// ── Text widget ─────────────────────────────────────────────────────

interface TextWidgetProps {
  control: DashboardControl;
  frame: DashboardValuesFrame | null;
  gearState?: GearSmootherState;
}

const TextWidget = memo(function TextWidget({
  control,
  frame,
  gearState,
}: TextWidgetProps) {
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
});

// ── Dependency tracking ─────────────────────────────────────────────

const controlDependencyCache = new WeakMap<DashboardControl, string[]>();

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
  previous: DashboardValuesFrame | null,
  next: DashboardValuesFrame | null,
  usesGearSmoother = false,
): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;

  const prevValues = previous.values;
  const nextValues = next.values;
  const dependencies = controlDependencies(control);
  for (const field of dependencies) {
    if (!Object.is(prevValues[field], nextValues[field])) {
      return false;
    }
  }

  return !(
    usesGearSmoother &&
    dependencies.includes("gear") &&
    previous.timestampNs !== next.timestampNs
  );
}

// ── Text resolution ─────────────────────────────────────────────────

export function resolveControlText(
  control: DashboardControl,
  frame: DashboardValuesFrame | null,
  gearState?: GearSmootherState,
): string {
  const template = control.textTemplate ?? "{value}";
  const expression = /^\s*\{\{expr:([\s\S]*)\}\}\s*$/.exec(template);
  if (expression) {
    if (!frame) return "--";
    try {
      return evaluateTextExpression(
        expression[1],
        frame.values as unknown as Record<string, unknown>,
        control.telemetryField ?? undefined,
        control.format ?? undefined,
      );
    } catch {
      return "";
    }
  }
  return template.replace(/\{([^}]+)\}/g, (_match, token: string) => {
    const [rawField, explicitFormat] = token.split("|");
    const field = rawField === "value" ? (control.telemetryField ?? control.id) : rawField;
    if (!field || !frame) return "--";

    let value = frame.values[field];
    if (value === undefined) return "--";

    if (field === "gear" && gearState) {
      const gearMs = Math.floor(frame.timestampNs / 1_000_000);
      value = smoothGear(gearState, Number(value), gearMs).committedGear;
    }

    if (field === "gear") {
      return formatGear(Number(value));
    }

    return formatTelemetryValue(value, explicitFormat ?? control.format);
  });
}

// ── Control styling ─────────────────────────────────────────────────

export function computeControlStyle(
  control: DashboardControl,
  frame: DashboardValuesFrame | null,
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
    fontSize: control.fontSize ?? 12,
    color: toCssColor(conditionalStyle.color ?? control.textColor) ?? "#fff",
    backgroundColor:
      toCssColor(conditionalStyle.backgroundColor ??
      control.backgroundColor) ??
      "transparent",
  };
}

export function evaluateConditionalRules(
  rules: DashboardConditionalRule[],
  frame: DashboardValuesFrame | null,
): { color?: string; backgroundColor?: string } {
  const style: { color?: string; backgroundColor?: string } = {};
  if (!frame) return style;

  for (const rule of rules) {
    const value = frame.values[rule.telemetryField];
    if (
      value === undefined ||
      !Number.isFinite(value) ||
      !matchesRule(value, rule.operator, rule.compareValue)
    ) {
      continue;
    }

    if (rule.target === "textColor") {
      style.color = toCssColor(rule.color) ?? rule.color;
    }
    if (rule.target === "backgroundColor") {
      style.backgroundColor = toCssColor(rule.color) ?? rule.color;
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

// ── Chart widget (reads from local historyBuffer, time-independent) ──

interface ChartWidgetProps {
  control: DashboardControl;
  historyBuffer: Map<string, BufferEntry[]>;
  historyVersion: number;
}

function ChartWidget({ control, historyBuffer, historyVersion }: ChartWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fields = control.chartFields ?? [];
  const N = (control as any).chartSampleCount ?? control.chartSampleCount ?? 600;
  const { width, height } = control;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (fields.length === 0) return;

    for (const field of fields) {
      const key = (field as any).telemetryField ?? "";
      const entries = historyBuffer.get(key);
      if (!entries || entries.length === 0) continue;

      const points = entries.slice(-N);

      if (points.length < 2) continue;

      ctx.strokeStyle = field.color || "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();

      const pointsMinusOne = Math.max(points.length - 1, 1);
      for (let i = 0; i < points.length; i++) {
        const x = (i / pointsMinusOne) * width;
        const y = (1 - points[i].v) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [control, historyBuffer, historyVersion, width, height, fields, N]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: control.x,
        top: control.y,
        width,
        height,
        backgroundColor: toCssColor(control.backgroundColor) ?? "transparent",
      }}
    />
  );
}

// ── Map widget ──────────────────────────────────────────────────────

interface MapWidgetProps {
  control: DashboardControl;
  frame: DashboardValuesFrame | null;
  trackPoints: Record<string, { points: { x: number; z: number }[]; angleDeg: number; flipX: number; flipZ: number }>;
}

function MapWidget({ control, frame, trackPoints }: MapWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height, trackId } = control;
  const dotColor = control.dotColor ?? "#ff0";
  const dotSize = control.dotSize ?? 6;
  const effectiveTrackId = trackId || "monza";
  const trackData = effectiveTrackId ? trackPoints[effectiveTrackId] : undefined;
  const points = trackData?.points;
  const angleDeg = trackData?.angleDeg ?? 0;
  const flipX = trackData?.flipX ?? 1;
  const flipZ = trackData?.flipZ ?? 1;
  const carX =
    frame ? frame.values["carX"] : undefined;
  const carZ =
    frame ? frame.values["carZ"] : undefined;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (!points || points.length < 2) {
      ctx.fillStyle = "#888";
      ctx.font = `${Math.max(10, height / 6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("No track data", width / 2, height / 2);
      return;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const trackW = maxX - minX || 1;
    const trackH = maxZ - minZ || 1;

    const scale = Math.min(width / trackW, height / trackH) * 0.9;
    const offsetX = (width - trackW * scale) / 2;
    const offsetY = (height - trackH * scale) / 2;

    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const sx = (points[i].x - minX) * scale + offsetX;
      const sy = -(points[i].z - maxZ) * scale + offsetY;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    if (carX !== undefined && Number.isFinite(carX) && carZ !== undefined && Number.isFinite(carZ)) {
      let rCarX = carX as number;
      let rCarZ = carZ as number;
      if (angleDeg !== 0) {
        const rad = (-angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const cx = rCarX, cz = rCarZ;
        rCarX = cx * cos - cz * sin;
        rCarZ = cx * sin + cz * cos;
      }
      if (flipX !== 1.0) rCarX = -rCarX;
      if (flipZ !== 1.0) rCarZ = -rCarZ;

      rCarX = Math.max(minX, Math.min(maxX, rCarX));
      rCarZ = Math.max(minZ, Math.min(maxZ, rCarZ));

      const cx = (rCarX - minX) * scale + offsetX;
      const cy = -(rCarZ - maxZ) * scale + offsetY;

      ctx.fillStyle = dotColor ?? "#ff0";
      ctx.beginPath();
      ctx.arc(cx, cy, dotSize ?? 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points, carX, carZ, width, height, dotColor, dotSize, angleDeg, flipX, flipZ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: control.x,
        top: control.y,
        width,
        height,
        backgroundColor: toCssColor(control.backgroundColor) ?? "transparent",
      }}
    />
  );
}
