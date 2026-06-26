# Chart Widget 默认值渲染

## 背景

chart widget 在没有真实遥测数据时（preview / replay 未开始 / 未录制）不显示任何内容，用户看不到 widget 占位。

## 数据模型变更（已完成）

`DashboardControl` 和 `ChartFieldConfig` 已新增字段，数据管道已透传。

| 字段 | 类型 | 位置 | 说明 |
|---|---|---|---|
| `defaultValue` | `number \| null` | `ChartFieldConfig` | 无真实数据时该 field 的默认 Y 值 |
| `defaultSampleCount` | `number \| null` | `DashboardControl` | 预填充样本数 |

示例配置：
```json
{
  "widgetType": "chart",
  "chartWindowS": 30,
  "defaultSampleCount": 600,
  "chartFields": [
    { "fieldName": "raw:controls.gas", "color": "#00ff00", "label": "Gas", "defaultValue": 0 },
    { "fieldName": "raw:controls.brake", "color": "#ff0000", "label": "Brake", "defaultValue": 0 }
  ]
}
```

## module_local_dashboard 需要的改动

**文件**：`src-ui/features/local-dashboard-overlay/dashboardRenderer.tsx`

**位置**：`ChartWidget` 函数（约 L426-499）

**改动**：在绘制折线的循环中，当 `history` 中没有该 field 的真实数据点时，若 `field.defaultValue != null` 且 `control.defaultSampleCount > 0`，则生成合成数据画一条水平直线。

伪代码：

```tsx
// 现有：找 field 对应的 history
const fh = history.find((h) => h.field_name === field.fieldName);

// 如果有真实数据 → 正常绘制（现有逻辑不变）
if (fh && fh.points.length > 0) {
    const visible = fh.points.filter(p => p.t >= earliestT && p.t <= latestT);
    if (visible.length >= 2) {
        // ... 现有绘制代码 ...
    }
    continue;
}

// 新增：没有真实数据，有默认值 → 生成合成数据
const sampleCount = control.defaultSampleCount ?? 0;
if (field.defaultValue != null && sampleCount > 0) {
    ctx.strokeStyle = field.color || "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < sampleCount; i++) {
        const x = (i / (sampleCount - 1)) * width;
        const y = height / 2;  // 默认值在垂直方向居中，或根据 defaultValue 映射
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}
```

**约束**：
- 只改 `ChartWidget` 函数体
- 不改组件签名和 props
- 真实数据优先：有 `history` 数据时走现有逻辑，合成数据只作为 fallback
- `history`、`frame`、`control` 等 props 已包含所需字段，无需额外传参
