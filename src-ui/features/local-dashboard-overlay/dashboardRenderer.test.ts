import { describe, expect, it } from "vitest";
import {
  controlDependencies,
  controlFrameInputsAreEqual,
  computeRegionRect,
  evaluateConditionalRules,
  resolveControlText,
} from "./dashboardRenderer";
import {
  createInitialGearSmootherState,
  formatDelta,
  formatLapTime,
  smoothGear,
} from "./telemetryFormat";
import type { DashboardControl, LiveFrame, OverlayAnchor } from "./types";

const frame: LiveFrame = {
  speedKmh: 123.4,
  brakePct: 0,
  throttlePct: 73,
  gear: 3,
  rpm: 7000,
  steeringDeg: 0,
  distanceM: 0,
  currentLapDistanceM: 100,
  speedIntegratedLapDistanceM: 100,
  lapNumber: 2,
  position: 5,
  sessionTimeLeftS: 300,
  inPit: false,
  trackName: "Monza",
  carModel: "GT3",
  timestampMs: 1000,
  currentLapTimeMs: 108326,
  normalizedCarPosition: 0.5,
  bestLapDeltaTimeMs: -180,
  predictedLapTimeByBest: 108000,
  sessionLapDeltaTimeMs: 320,
  predictedLapTimeBySession: 109000,
};

describe("computeRegionRect", () => {
  const cases: Array<[OverlayAnchor, number, number]> = [
    ["topLeft", 0, 0],
    ["topCenter", 400, 0],
    ["topRight", 800, 0],
    ["centerLeft", 0, 250],
    ["center", 400, 250],
    ["centerRight", 800, 250],
    ["bottomLeft", 0, 500],
    ["bottomCenter", 400, 500],
    ["bottomRight", 800, 500],
  ];

  it.each(cases)("positions %s", (anchor, left, top) => {
    expect(
      computeRegionRect({
        containerWidth: 1000,
        containerHeight: 600,
        layoutWidth: 200,
        layoutHeight: 100,
        scale: 1,
        anchor,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ left, top, width: 200, height: 100 });
  });

  it("applies scale and offsets without clamping", () => {
    expect(
      computeRegionRect({
        containerWidth: 1000,
        containerHeight: 600,
        layoutWidth: 200,
        layoutHeight: 100,
        scale: 1.5,
        anchor: "bottomCenter",
        offsetX: -30,
        offsetY: 25,
      }),
    ).toEqual({ left: 320, top: 475, width: 300, height: 150 });
  });
});

describe("formatting", () => {
  it("formats delta and lap time", () => {
    expect(formatDelta(320)).toBe("+0.32s");
    expect(formatDelta(-180)).toBe("-0.18s");
    expect(formatDelta(null)).toBe("--");
    expect(formatLapTime(108326)).toBe("1:48.326");
  });

  it("resolves {value} through telemetryField", () => {
    const control = controlWith({
      telemetryField: "speedKmh",
      textTemplate: "{value}",
      format: "integer",
    });
    expect(resolveControlText(control, frame)).toBe("123");
  });

  it("evaluates a saved dynamic text expression as one expression", () => {
    const control = controlWith({
      textTemplate:
        '{{expr:(({calc:delta_time_to_session_best_lap}) >= 0 ? "+" : "") + {calc:delta_time_to_session_best_lap|s.ff}}}',
    });

    expect(
      resolveControlText(control, {
        ...frame,
        "calc:delta_time_to_session_best_lap": 1000,
      } as LiveFrame),
    ).toBe("+1.00");
    expect(
      resolveControlText(control, {
        ...frame,
        "calc:delta_time_to_session_best_lap": -250,
      } as LiveFrame),
    ).toBe("-0.25");
  });

  it("formats gear labels", () => {
    expect(
      resolveControlText(controlWith({ textTemplate: "{gear}" }), frame),
    ).toBe("3");
    expect(
      resolveControlText(controlWith({ textTemplate: "{gear}" }), {
        ...frame,
        gear: 0,
      }),
    ).toBe("N");
    expect(
      resolveControlText(controlWith({ textTemplate: "{gear}" }), {
        ...frame,
        gear: -1,
      }),
    ).toBe("R");
  });

  it("smooths short neutral flicker during gear changes", () => {
    let state = createInitialGearSmootherState(3);
    state = smoothGear(state, 0, 1000);
    expect(state.committedGear).toBe(3);
    state = smoothGear(state, 4, 1100);
    expect(state.committedGear).toBe(4);
    state = smoothGear(state, 0, 1200);
    state = smoothGear(state, 0, 1400);
    expect(state.committedGear).toBe(0);
  });
});

describe("conditional rules", () => {
  it("applies later matching colors and ignores unknown fields", () => {
    expect(
      evaluateConditionalRules(
        [
          {
            target: "textColor",
            telemetryField: "bestLapDeltaTimeMs",
            operator: "lt",
            compareValue: 0,
            color: "green",
          },
          {
            target: "backgroundColor",
            telemetryField: "missing",
            operator: "gt",
            compareValue: 0,
            color: "red",
          },
          {
            target: "textColor",
            telemetryField: "bestLapDeltaTimeMs",
            operator: "lt",
            compareValue: 0,
            color: "lime",
          },
        ],
        frame,
      ),
    ).toEqual({ color: "lime" });
  });
});

describe("control memoization", () => {
  it("collects template and conditional-rule dependencies", () => {
    const control = controlWith({
      telemetryField: "speedKmh",
      textTemplate: "{value|integer} / {rpm}",
      conditionalRules: [
        {
          target: "textColor",
          telemetryField: "bestLapDeltaTimeMs",
          operator: "lt",
          compareValue: 0,
          color: "green",
        },
      ],
    });

    expect(controlDependencies(control)).toEqual([
      "speedKmh",
      "rpm",
      "bestLapDeltaTimeMs",
    ]);
  });

  it("ignores frame changes unrelated to the control", () => {
    const control = controlWith({ telemetryField: "speedKmh" });
    expect(
      controlFrameInputsAreEqual(control, frame, {
        ...frame,
        rpm: frame.rpm + 100,
        timestampMs: frame.timestampMs + 16,
      }),
    ).toBe(true);
    expect(
      controlFrameInputsAreEqual(control, frame, {
        ...frame,
        speedKmh: frame.speedKmh + 1,
      }),
    ).toBe(false);
  });

  it("collects dependencies from a saved text expression", () => {
    const control = controlWith({
      textTemplate: '{{expr:(({delta}) >= 0 ? "+" : "") + {delta|s.ff}}}',
    });
    expect(controlDependencies(control)).toEqual(["delta"]);
  });

  it("keeps gear controls updating while smoothing uses elapsed time", () => {
    const control = controlWith({ telemetryField: "gear" });
    expect(
      controlFrameInputsAreEqual(
        control,
        frame,
        { ...frame, timestampMs: frame.timestampMs + 16 },
        true,
      ),
    ).toBe(false);
  });
});

function controlWith(patch: Partial<DashboardControl>): DashboardControl {
  return {
    id: "control",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    fontSize: 12,
    textColor: "#fff",
    ...patch,
  };
}
