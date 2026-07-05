# MyDate — 智能记事本与日程管理

现代化 Web 应用，集任务看板、日历视图、AI 大模型排程与 Native Bridge 闹钟于一体。

## 技术栈

| 层级 | 选型 |
|------|------|
| 构建 | Vite 8 + React 19 + TypeScript |
| 样式 | Tailwind CSS v4 |
| 状态 | Zustand + localStorage 持久化 |
| AI | OpenAI 兼容 API（DeepSeek / OpenAI 等） |
| 闹钟 | AlarmManager Native Bridge（Web 模拟 → 原生可替换） |

## 核心模块

### 1. AlarmManager Native Bridge

```
src/services/alarm/
├── types.ts           # NativeAlarmBridge 接口定义
├── WebAlarmProvider.ts # Notification + Web Audio + Vibration
├── AlarmManager.ts    # 单例门面，自动检测 Electron/Capacitor 桥接
└── index.ts
```

- 网页端：桌面通知 + 双音交替铃声 + 震动模拟
- 未来打包：注入 `window.mydateElectron` 或 `window.MyDateNative` 即可切换

### 2. AI 大模型排程

- 设置页配置 **API Key / Base URL / Model Name**
- System Prompt 注入 Eisenhower 矩阵 + 黄金精力曲线 + 运筹学约束
- 返回标准 JSON，前端渲染可视化时间轴
- 「同步到日历 & 闹钟」一键写入任务并注册提醒

### 3. 日历 + 时区 + 节假日

- 2025–2026 中国法定节假日与调休（班/休）标注
- GPS 定位 + 逆地理编码 + IANA 时区感知
- 时区变更时任务/闹钟 UTC 无损换算

## 数据流

```
AI 规划 → applyScheduleToTasks → 日历任务 + alarmAtUtc
                                    ↓
                              AlarmManager 轮询
                                    ↓
                         通知 + 铃声 + 震动
```

## 快速启动

```bash
npm install
npm run dev
```

1. 打开 **设置** → 填入 DeepSeek/OpenAI API Key
2. **AI 规划** → 输入任务 → 开始规划 → 同步到日历
3. **日历** → 获取当前位置 → 查看节假日标注

## 构建

```bash
npm run build
npm run preview
```
