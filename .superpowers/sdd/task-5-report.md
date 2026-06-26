# Task 5 报告：后台预设与管理前端收敛

## 一、改动文件

| 文件 | 改动概述 |
|------|---------|
| `src/controllers/admin.controller.js` | PROVIDER_PRESETS 收敛为方舟单条；删除 getRemoteModelsUrl；重写 testProvider（方舟 POST 连通测试）；重写 listRemoteModels（方舟无列模型接口，返回空列表） |
| `admin-web/src/views/ModelConfig.vue` | 删除"新增 Provider"按钮；模型弹窗厂商固定 ark（禁用选择）；"拉取模型列表"按钮禁用并提示方舟不支持；清理未用的 canFetchRemoteModels computed；补提示样式 |
| `admin-web/src/api/admin.js` | 未改动（Task 3 已加 rebuildEmbedding，provider CRUD 封装已完整匹配新逻辑） |
| `admin-web/src/views/ImageModelConfig.vue` | 未改动（Task 4 已锁方舟；本次确认无旧厂商残留，doubao-seedream 为方舟模型 ID 占位符非厂商） |

## 二、清理的旧厂商分支（逐条）

1. **`PROVIDER_PRESETS` 收敛（行 15-17）**：删除 deepseek / qwen / claude / doubao / moonshot / qianfan / zhipu / xinghuo / minimax 共 9 个旧条目，仅保留 `{ ark: { name:'火山方舟', base_url:'https://ark.cn-beijing.volces.com/api/plan' } }`。`listProviderPresets` 返回该单条。

2. **删除 `getRemoteModelsUrl` 函数（原行 47-59）**：该函数按厂商拼接 models 端点（qwen→`/compatible-mode/v1/models`、claude→`/v1/models`、其余→`/models`）。方舟为 POST 接口（`/chat/completions`、`/responses`、`/images/generations`），无 GET 列模型端点，此函数已无用，整体删除。判断依据：纯厂商特殊处理，方舟不需要。

3. **重写 `testProvider`（原行 841 处 claude 分支）**：原逻辑对 claude 用 `x-api-key`+`anthropic-version` 头 GET `/v1/models`，其余 Bearer GET `/models`。方舟是 POST，GET 行不通。改为：POST `/chat/completions`，Bearer 认证，body 发极小请求（`max_tokens:1`，model 用 `doubao-seed-1-6-thinking-250715`），2xx 判连通成功，401/403 判鉴权失败，其余 HTTP 错误判连通但报错信息。删除 claude 专用头逻辑。

4. **重写 `listRemoteModels`（原行 1150 处 claude 分支）**：原逻辑同 testProvider，按厂商选拼接 URL 与头。方舟无列模型接口，改为保留接口但直接返回空列表 `[]`，前端按钮已禁用。删除 claude 专用头与 fetch 逻辑。

### 未动的旧厂商分支（说明）

- **`getVoiceProviderWsUrl` 中的 `provider === 'qwen'` / `'openai'` / `'gemini'`（行 1357 附近）**：属语音通话厂商配置，**阶段二范围，按需求不动**。这些是语音厂商的 WebSocket URL 拼接，与对话/图像 Provider 收敛无关。

### 全仓库旧厂商残留（非本任务范围，说明）

- `src/controllers/voice.controller.js:15` 默认 `provider = 'qwen'`：语音默认值，阶段二。
- `src/utils/db-init.js:158` image_models 种子数据写 `doubao` provider + `'your-doubao-endpoint-id'`：建表初始化 INSERT（表已存在则跳过），属 Task 4 迁移遗留。当前线上表已存在不会执行，不影响功能，但种子数据仍为旧厂商占位，见 concerns。
- `src/controllers/chat.controller.js` 的 `'deepseek-v4-pro'`：方舟模型 ID（ai.service.js 种子 provider='ark'），非厂商，保留正确。
- `src/services/ai.service.js` 种子中含 deepseek/minimax model_id：均为方舟模型 ID，provider 均为 'ark'，正确。

## 三、ModelConfig.vue 简化点

1. **API Key 配置区**：保留表格结构（数据来自 listProviders，方舟单行），删除"+ 新增 Provider"按钮，改为提示语"仅支持方舟一行，不支持新增其他厂商 Provider"。卡头加收敛说明。
2. **模型弹窗厂商选择**：原为 `<select>` 多厂商下拉（遍历 providerPresets），改为 `disabled` 固定 `ark`（火山方舟）+ 提示。新增/编辑均固定 ark。
3. **模型 ID 区"拉取模型列表"按钮**：原依赖 `canFetchRemoteModels`（按厂商查 providers 有无 Key）启用，现方舟无列模型接口，按钮硬 `disabled`，并加 title 与提示"方舟 Plan 未提供模型列表接口，请手动填写模型 ID"。
4. **清理未用代码**：删除 `canFetchRemoteModels` computed（按钮已硬禁用，不再引用），同步从 vue import 移除 `computed`（避免 eslint 未使用报错）。
5. **modelForm.provider 默认值**：`''` → `'ark'`，openModelCreate 重置也设 `'ark'`。
6. **样式补充**：新增 `.section-hint` / `.footer-hint` / `.form-hint`。
7. **语音通话厂商配置区**：未动（阶段二）。

## 四、self-review

- [x] PROVIDER_PRESETS 仅 ark（node -e 校验：旧厂商 key 无残留）。
- [x] admin.controller 旧厂商分支已清理（getRemoteModelsUrl 删除、testProvider/listRemoteModels 重写；x-api-key/anthropic-version 无残留）。
- [x] `node --check` 通过；controller require 加载正常（49 方法导出）。
- [x] 前端 `npm run build` 通过（118 模块，1.17s，无报错/警告）。
- [x] ModelConfig.vue：只剩方舟配置、模型管理固定 ark、无"新增其他厂商 Provider"。
- [x] api/admin.js 与新逻辑一致（rebuildEmbedding 在、provider CRUD 全套在），未改动。
- [x] ImageModelConfig.vue 无遗留旧厂商引用（doubao-seedream 为方舟模型 ID）。
- [x] 改动范围：仅 2 文件，未越界。

## 五、未动确认

- **voice_providers**：`getVoiceProviderWsUrl` 的 qwen/openai/gemini 分支、`voice.controller.js`、`voice-call/presets`、ModelConfig.vue 语音厂商区——全部未动（阶段二）。
- **已收敛 service 代码**：`src/services/ai.service.js`、`embedding.service.js`、`retrieval.service.js`、图片 Provider 等均未动（git diff --stat 为空）。
- **document_chunks**：rebuildEmbedding 接口为 Task 3 已有，本次未新增改动。
- **api/admin.js**：未改动。

## 六、concerns

1. **testProvider 连通测试会消耗 token**：方舟无 GET 健康检查接口，改用 POST `/chat/completions` + `max_tokens:1` 测试，会发起一次极小真实请求（计费）。若方舟后续提供更轻量的连通/鉴权校验端点，可替换。当前为管理后台手动触发、非高频，可接受。
2. **listRemoteModels 返回空列表**：方舟无列模型接口，保留接口返回 `[]` 不报错，前端按钮已禁用。若方舟未来支持，需在此接口恢复拉取逻辑。
3. **db-init.js:158 种子数据仍为 doubao 占位**：image_models 建表初始 INSERT 写的是 `('豆包文生图','doubao','your-doubao-endpoint-id',...)`，属 Task 4 迁移脚本范围。线上表已存在则跳过不影响功能，但种子数据未更新为方舟。建议 Task 4 范围跟进或在阶段一收尾时补迁移脚本（本次未动，因超出本任务文件范围）。
4. **ImageModelConfig.vue 仍加载 getProviderPresets 但未用预设数据**：Task 4 留下，provider 已硬编码 ark、表单不依赖预设数据。无害加载，未清理以减少改动面；如需整洁可后续移除。
5. **testProvider 的 model 字段硬编码** `doubao-seed-1-6-thinking-250715`：用于连通测试的模型 ID。若该模型在方舟 Plan 不可用，测试会因参数错误返回非 2xx（但仍能区分鉴权与连通）。更稳妥可从 ai_models 默认模型读取，但当前实现已满足"测方舟连通"需求。
