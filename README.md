# WorkoutX 动作查询与训练计划网站

基于 Next.js 全栈、WorkoutX Free API、Postgres 缓存和可替换 AI Provider 的个人训练计划 MVP。

## 功能

- 中文自然语言动作查询：例如“在家用哑铃练胸”。
- 图像化肌肉选择器：可在前后视完整男性人体图上点选胸肌、背阔肌、腹肌、臀腿等细分肌群并查询动作。
- WorkoutX Free 端点优先：不调用 `/v1/exercises/search` 或 `/v1/workout/generate`。
- Postgres 缓存动作、查询结果、WorkoutX 额度头、器材识别记录和当前周计划。
- OpenAI Responses API 视觉识别器材；无 `OPENAI_API_KEY` 时自动使用 Mock Provider。
- 规则式每周训练计划：按目标、等级、周训练天数、单次时长、器材、训练需求和重点肌群生成。

## 快速启动

```bash
cp .env.example .env
# 编辑 .env，至少配置 WORKOUTX_API_KEY；如需真实视觉识别，配置 OPENAI_API_KEY。

docker compose up -d postgres
npm install
npm run db:deploy
npm run dev
```

打开 http://localhost:3000。

## 常用命令

```bash
npm test        # 单元测试
npm run lint    # ESLint
npm run build   # Prisma generate + Next.js 生产构建
npm run db:push # 无 migration 的快速同步方式
npm run db:deploy # 使用 prisma/migrations 初始化数据库
```

## 环境变量

- `DATABASE_URL`：Postgres 连接串。
- `WORKOUTX_API_KEY`：WorkoutX API key，仅服务端使用。
- `WORKOUTX_API_BASE_URL`：默认 `https://api.workoutxapp.com/v1`。
- `AI_PROVIDER`：`openai` 或 `mock`。
- `OPENAI_API_KEY`：OpenAI key；未设置时自动 fallback 到 mock。
- `OPENAI_BASE_URL`：可选 OpenAI-compatible base URL，例如自建网关或代理；留空使用官方 OpenAI API。兼容别名 `OPENAI_BASEURL`。
- `OPENAI_MODEL`：默认 `gpt-5.5`。
- `AI_FALLBACK_TO_MOCK`：默认启用；OpenAI Responses/Chat Completions 上游失败时返回 Mock 候选，避免 UI/API 整体不可用。设为 `false` 可改为硬失败。
- `QUERY_CACHE_TTL_HOURS`：查询缓存小时数，默认 24。
- `NEXT_PUBLIC_BASE_PATH`：仅当部署在子路径时设置，例如站点访问地址是 `https://example.com/workoutx`，则设置为 `/workoutx`。修改后必须重新构建/重启 Next.js。

## 部署检查

如果部署后“接口不可用”或“人体图不显示”，优先检查这三类路径是否能直接访问：

```bash
curl -I https://你的域名/api/plans/current
curl -I https://你的域名/api/exercises?bodyPart=chest\&limit=1
curl -I https://你的域名/bodymaps/male-front.svg
```

如果你的应用部署在子路径，例如 `https://你的域名/workoutx`，则需要：

```bash
NEXT_PUBLIC_BASE_PATH=/workoutx
npm run build
npm run start
```

并确认以下路径返回 200：

```bash
curl -I https://你的域名/workoutx/api/plans/current
curl -I https://你的域名/workoutx/api/exercises?bodyPart=chest\&limit=1
curl -I https://你的域名/workoutx/bodymaps/male-front.svg
```

Nginx/反代必须把页面、`/_next`、`/api`、`/bodymaps` 都转发到 Next.js 服务。子路径部署示例：

```nginx
location /workoutx/ {
  proxy_pass http://127.0.0.1:3000/workoutx/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## API

- `GET /api/exercises?query=&bodyPart=&target=&equipment=&limit=10`
- `GET /api/exercises/:id`
- `GET /api/gifs/:id.gif`：服务端代理 WorkoutX GIF，避免前端暴露 API key
- `POST /api/ai/equipment-recognize`，multipart 字段 `image`
- `POST /api/plans/generate`：支持 `need`、`equipment`、`bodyFocus`、`targetFocus`
- `GET /api/plans/current`
- `PUT /api/plans/current`
