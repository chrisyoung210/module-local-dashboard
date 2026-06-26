# Chart Widget 默认值预填充

## 背景

Chart widget 在没有真实遥测数据时（preview 模式、replay 模式下未开始回放、auto-recording 未运行时）显示空白。原因：`TelemetryHistory` 缓冲区只在 auto-recording 的 inner loop 中被写入，其他模式下 history 永远为空。

## 方案

给 chart 的每个 field 增加 `defaultValue`，给 chart widget 增加 `defaultSampleCount`。Dashboard 后端在 history 为空时自动用默认值填充 `defaultSampleCount` 个样本，跨 `windowS` 时间窗口均匀分布。真实数据到达后自然覆盖。

---

## 变更清单

### 1. 数据模型 - `module_dashboard_protocol/types/index.ts`

#### `ChartFieldConfig` 新增字段

```typescript
export interface ChartFieldConfig {
  fieldName: string;
  color: string;
  label: string;
  /** 无真实数据时用于预填充 history 的默认值 */
  defaultValue?: number | null;  // ← 新增
}
```

#### `DashboardControl` 新增字段

```typescript
export interface DashboardControl {
  // ... 现有字段 ...
  chartFields: ChartFieldConfig[];
  chartWindowS?: number | null;
  /** 无真实数据时预填充的样本数（跨 windowS 窗口均匀分布） */
  defaultSampleCount?: number | null;  // ← 新增
  // ...
}
```

#### `normalizeControl()` 已更新

`defaultValue` 和 `defaultSampleCount` 已在序列化/反序列化路径中正常传递（支持 camelCase 和 snake_case）。

### 2. 主模块类型 - `src-ui/types.ts`

同上，`ChartFieldConfig` 和 `DashboardControl` 已添加对应字段。

### 3. 前端数据管道 - `LocalDashboardOverlayWindow.tsx`

#### `overlayControl()` (L196-222)

已通过 `chartFields` 映射传递 `defaultValue`，并传递 `defaultSampleCount`：

```typescript
chartFields: (control.chartFields ?? []).map((f) => ({
  fieldName: f.telemetryField,
  color: f.color,
  label: "",
  defaultValue: f.defaultValue ?? null,   // ← 已传递
})),
defaultSampleCount: control.defaultSampleCount ?? null,  // ← 已传递
```

#### IPC 调用 (L632-642)

`fieldsJson` 格式变更：

**旧**：`["raw:controls.gas", "raw:controls.brake"]`（字符串数组）

**新**：`[{name:"raw:controls.gas", defaultValue:0}, {name:"raw:controls.brake", defaultValue:1}]`（对象数组）

IPC 调用新增 `defaultSampleCount` 参数（`u32 | null`）：

```typescript
invoke("get_live_dashboard_frame_with_history", {
  fieldsJson: JSON.stringify(fieldConfigs),  // 对象数组
  windowS: maxWindowS,
  defaultSampleCount,  // number | 0，取所有 chartControls 中的最大值
})
```

### 4. 后端 IPC - `src/ipc/mod.rs`

#### 函数签名变更

```rust
// 旧
async fn get_live_dashboard_frame_with_history(
    fields_json: String,
    window_s: f64,
    monitor: tauri::State<'_, AutoRecordingMonitor>,
)

// 新
async fn get_live_dashboard_frame_with_history(
    fields_json: String,
    window_s: f64,
    default_sample_count: Option<u32>,   // ← 新增
    monitor: tauri::State<'_, AutoRecordingMonitor>,
)
```

#### 预填充逻辑

```rust
// combined（真实数据）为空 && default_count > 0 && defaultValue 存在
// → 在 [now_ms - window_s*1000, now_ms] 范围内均匀生成 default_count 个 (t, defaultValue) 样本
if combined.is_empty() && default_count > 0 {
    if let Some(default_val) = fc.default_value {
        let interval_ms = (window_s * 1000.0) / default_count as f64;
        for i in 0..default_count {
            let t = now_ms - (default_count - 1 - i) as f64 * interval_ms;
            combined.push((t, default_val));
        }
    }
}
```

---

## 其他模块需要做的事

Dashboard 设计器/编辑器模块需要在 Chart Widget 的属性面板中增加两个输入控件：

| 字段 | 位置 | 类型 | 说明 |
|---|---|---|---|
| `defaultValue` | `ChartFieldConfig`（每个 field 独立） | `number` | 无数据时的默认 Y 值，如 gas=0, brake=1 |
| `defaultSampleCount` | `DashboardControl`（整个 chart） | `number` | 预填充样本数，如 600（60Hz×10s） |

示例配置：
```json
{
  "widgetType": "chart",
  "chartWindowS": 30,
  "defaultSampleCount": 600,
  "chartFields": [
    { "fieldName": "raw:controls.gas", "color": "#00ff00", "label": "Gas", "defaultValue": 0 },
    { "fieldName": "raw:controls.brake", "color": "#ff0000", "label": "Brake", "defaultValue": 1 }
  ]
}
```

**不需要改**：
- `module_local_dashboard` 的 `ChartWidget` 渲染逻辑（无需感知预填充，它收到的就是 `{t, v}[]` 数组）
- `ChartWidget` 的接口（`history: FieldHistory[]` 不变）
