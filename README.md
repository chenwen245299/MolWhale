# MolWhale

对话式分子设计工作台的**脚手架**。分子领域的功能尚未实现 —— 目前立起来的是骨架：
Codex 风格的三栏界面、文件夹式的项目/对话存储、OpenAI SDK 驱动的对话循环、
可插拔的 MCP 工具，以及模型服务与 MCP 服务器的设置界面。

## 技术栈

React 19 + `react-native-web` + TypeScript + Vite + Tauri 2 + pnpm，与 Nomi 保持一致。

```bash
pnpm install
pnpm tauri dev     # 完整桌面应用
pnpm dev           # 仅前端（用内存假数据，方便调布局）
pnpm check         # lint + 格式 + 类型 + 构建 + clippy
```

`pnpm dev` 在浏览器里也能跑：每个 `api.ts` 在非 Tauri 环境下会回落到内存假数据
（见 `src/tauri.ts` 的 `isTauri()`），所以调界面不必每次都起 Rust。

## 数据布局

工作区根目录**由用户在首次启动时选定**。选定后的目录结构：

```
<工作区根目录>/
  .molwhale/
    config.json              # 设置、模型服务（含 API key）、MCP 服务器
  projects/
    <项目目录名>/
      project.json           # 名称、描述、创建时间
      conversations/
        <对话目录名>/
          conversation.json  # 标题、服务商、模型、时间戳
          messages.jsonl     # 追加写的消息流水
          files/             # 该对话产生的分子文件与工具输出
```

几个刻意的选择：

- **目录名即 id。** 用户在访达里看到的是自己起的名字，而不是一串 UUID。代价是
  重命名只改 `project.json` 里的显示名，目录名保持不变 —— 已经记下的路径不会失效。
- **每个对话一个目录。** 分子设计会产出大量结构、构象、性质表；`files/` 让"这个
  对话产生了什么"变成一个可以直接打开的文件夹。
- **`messages.jsonl` 追加写。** 流式回答天然是 append-only，长对话不会每次都重写
  整个文件；崩溃导致的半行只损失一条消息，而不是整个文件。
- **配置在工作区内。** 整个工作区自包含，可以整体移动、备份或同步。
  另有一个 `storage-location.json` 存在 app data 目录里，只记录根目录路径。

## 架构

### Agent 循环在前端

对话循环跑在 webview 里（`src/chat/chatRuntime.ts`），用官方 `openai` npm SDK
指向 OpenAI 兼容接口（默认 OpenRouter）。HTTP 请求走 `@tauri-apps/plugin-http`，
绕开 webview 的 CORS。

**一个需要知道的取舍**：API key 的存储沿用 Argus 的设计 —— 落在工作区配置文件里，
原子写入，provider 列表接口只返回 `hasKey: bool` 而不含密钥。但因为循环在 JS 侧，
签名请求时必须拿到明文，所以额外开了一个 `get_provider_key` 命令。它是"密钥不出
Rust"的唯一缺口，刻意保持为一个可 grep 的具名命令：将来若把循环移回 Rust，
删掉这个命令和 `chatRuntime.ts` 里的一处调用即可。

### MCP：Rust 管进程，JS 管协议

- **stdio 服务器**：webview 不能 spawn 进程，所以 Rust 负责起子进程和按行分帧
  （`src-tauri/src/mcp.rs`），通过事件把 stdout 推回前端。协议本身完全交给官方
  TS SDK，前端只实现了一个自定义 `Transport`（`src/mcp/transport.ts`）。
  这样协议实现始终是官方那份，Rust 侧不必跟踪规范修订。
- **HTTP 服务器**：直接用 SDK 的 `StreamableHTTPClientTransport`。

工具以 `服务器名__工具名` 的形式暴露给模型：模型能看出自己在调哪个服务器，且不同
服务器的同名工具不会互相遮蔽。名字会被强制裁剪到 `[A-Za-z0-9_-]{1,64}` ——
非法的函数名会让**整个请求**失败，而不只是那一个工具。

连接的生命周期是"一次回答开一次，答完就关"：否则用户关掉聊天窗后，还会有一堆
node 进程挂着。

### 设置界面

外壳参考 Claude Code：一个独立弹窗，左侧是分组的导航栏，右侧是选中的页面。
四个页面不是同一种形状，这是刻意的：

- **通用 / 关于** 是行式表单（标签在左、控件在右、细分隔线），适合固定的几个字段。
- **模型服务 / MCP 服务器** 是列表 + 详情（参考 Nomi），因为它们是可以不断增加、
  需要来回切换的集合 —— 十几个服务商堆成卡片流会比固定的一列更难找。

品牌图标分两套：服务商用 `src/assets/providers/*.svg`，模型用 `src/assets/models/*.svg`，
都按关键字匹配（见 `src/providers/icons.ts`）。两个目录对同一品牌的命名不完全一致
（`qwen` / `qwenai`），且各有对方没有的条目（providers 有 openrouter、siliconflow，
models 有 inclusionai、z-ai），所以匹配会先走别名、再回落到另一个目录 —— 一条规则写一次
两边都生效。没有匹配的落到首字母色块（模型取 `vendor/model` 的 vendor 首字母），
列表不会因此参差。

新建服务商时填入 OpenRouter、DeepSeek 等名称会自动预填接口地址；手动改过地址后
就停止跟随，避免覆盖自定义端点。

### 目录

```
src/
  App.tsx              三栏骨架，三处可拖动分隔
  theme.ts             设计 token（目前只有深色）
  tauri.ts             isTauri() 与 invoke 封装
  assets/providers/    服务商品牌 SVG
  assets/models/       模型品牌 SVG
  i18n/                中文为主，英文对照；字符串表互为类型约束
  shell/               侧栏、拖动分隔、Workflows 占位、首次启动的目录选择
  chat/                对话运行时、消息流、输入框、标题栏、模型选择
  providers/           模型服务：列表 + 详情、品牌图标、密钥字段
  mcp/                 MCP 传输、客户端、设置
  settings/            设置弹窗、导航、布局原语
  panels/              右栏面板注册表
  components/ui.tsx    按钮、输入框等基础控件
```

Rust 侧一个域一个模块，命令统一在 `lib.rs` 的 `invoke_handler` 注册，
错误类型统一 `Result<T, String>`，serde 结构统一 `camelCase`。

## 主题

三种模式：浅色、深色、跟随系统（默认），存在工作区配置里。所有颜色都出自
`theme.ts` 的 `Tokens`，两套调色板填的是同一个 shape，所以切换主题只是换一个
context value。

浅色不是深色的机械反转：深色模式里侧栏比窗口底色**亮**一档，浅色模式里侧栏比内容区
**暗**一档 —— 两边都是让内容区站到最前。强调色也换了，`#4FD1B8` 在近黑背景上分量
合适，但作为白字背后的填充对比度不够，浅色用的是更深的 `#0E9B82`。

「跟随系统」用 `useSyncExternalStore` 订阅 `prefers-color-scheme`，而不是 effect +
setState —— media query 本身就是一个外部 store，这样系统切换时不会先渲染错再纠正。

有三处在 React 树之外，必须单独同步（见 `shell/useAppliedTheme.ts`）：根元素的
`color-scheme`（决定原生控件和默认滚动条的画法）、`global.css` 里的 CSS 变量
（body 底色和滚动条滑块，它们读不到 token context）、以及 **Tauri 窗口自身的背景色**
—— 不设这个，浅色模式下启动和拖拽窗口时会闪一下 `tauri.conf.json` 里那个深色底。

## 左侧栏

顶部是折叠按钮，下面依次是 `+ 新建`（在选中项目下建对话）、`Workflows`（占位），
再往下是 `项目` 分组 —— 新建项目的 `+` 挂在分组标题上，而不是和「新建对话」并列，
因为这两个动作作用的层级不同。

折叠时侧栏**不卸载**，而是把宽度动画到 0（`overflow: hidden`，内层保持完整宽度），
这样内容是从边缘裁掉而不是一边缩一边重新折行 —— 后者是「廉价折叠」的典型观感。
拖拽分隔条同步收到 0 宽，主区标题栏的左内边距（12px ↔ 78px，让开红绿灯）用同一条
缓动曲线过渡。`prefers-reduced-motion: reduce` 时时长归零。

快捷键 `Cmd/Ctrl+B`。

## 窗口拖动

三栏各自的顶部形成一条完整的标题栏，都用 `data-tauri-drag-region="deep"`。
用 `deep` 而不是裸写是必须的：裸写只在**直接点中该元素**时才触发，标题文字作为子
元素反而会把拖动挡掉。Tauri 会自动把子树里的 button / select / input 排除在拖动区
之外，所以模型选择器和图标按钮照常可点。

## 右侧栏

上下两块，中间可拖动。功能待定 —— 两块目前都渲染占位组件。要填功能时改
`src/panels/registry.tsx` 加一个条目即可，布局与拖动逻辑不需要动。

## 尚未实现

- 任何分子领域功能（渲染、力场、格式解析）
- Markdown 渲染（消息目前按纯文本渲染）
- 自动更新与打包签名
