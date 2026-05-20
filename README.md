# 像素画生成网站

全栈像素画工具：色盘制作、照片预处理、参数化像素化、批量预览、Excel 导出（色号格子 + 色卡对照表）。

## 功能

- **色盘**：上传 1~n 张色盘图提取颜色，**三档提取强度**（保守/平衡/高保真），勾选排序，自定义色号
- **生成**：上传照片、裁剪、选色盘、设置画布 H×W、预处理预览、渲染参数
- **批量预览**：多参数组合小图预览（最多 50 组）
- **Excel**：双 Sheet（像素画彩色格子 + 色卡对照表），样式与 xlsxwriter 参考实现一致

## 技术栈

- 前端：Vite + React + TypeScript
- 后端：FastAPI + SQLAlchemy + Pillow + xlsxwriter
- 数据库：SQLite（开发）

## 本地运行

### 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173

1. 注册账号
2. 创建色盘 → 上传照片生成 → 下载 Excel

## 环境变量（可选）

在 `backend/.env`：

```
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///./pixel_art.db
```

## 生产化部署（多人局域网/内网使用）

适合给**多个同事**在同一局域网访问，不依赖 `5173` 开发端口，服务会常驻运行。

### 1. 准备环境

- 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- 复制环境配置并修改密钥：

```powershell
copy .env.example .env
# 编辑 .env：SECRET_KEY 改为长随机字符串
```

### 2. 一键部署

```powershell
.\scripts\deploy_prod.bat
```

或指定局域网访问地址（写入 CORS）：

```powershell
.\scripts\deploy_prod.ps1 -SiteOrigin "http://192.168.1.100"
```

### 3. 访问方式

- 本机：`http://127.0.0.1/`
- 局域网其他人：`http://<你的电脑IP>/`（脚本结束时会打印 LAN 地址）
- 对外网需路由器端口转发 + 域名，并更新 `.env` 中 `CORS_ORIGINS`

### 4. 运维命令

```powershell
docker compose ps          # 查看状态
docker compose logs -f api # 查看后端日志
docker compose down        # 停止
docker compose up -d       # 后台启动（已 build 后）
```

数据持久化在 Docker 卷：`pixel_data`（数据库）、`pixel_uploads`（上传图片）。

### 5. 与开发模式的区别

| 项目 | 开发 (`start_site.bat`) | 生产 (`deploy_prod.bat`) |
|------|-------------------------|---------------------------|
| 前端 | Vite 5173 | Nginx 80 |
| 进程 | 手动开终端，关窗即停 | Docker 自动重启 |
| 适用 | 本机调试 | 多人稳定访问 |

## Docker（开发/简易）

```bash
docker compose up --build
```

生产推荐用 `deploy_prod.bat`（含健康检查与数据卷）。

## 自定义域名

- 可以自定义域名，`huashiofftyl` 作为**本地开发域名**可用（例如 `huashiofftyl.local`）。
- 若要公网访问，需要使用已注册且有后缀的正式域名（如 `huashiofftyl.com`）。
- 本地测试步骤：
  1. 在 hosts 中添加 `127.0.0.1 huashiofftyl.local`
  2. 用反向代理（Nginx/Caddy）把该域名转发到前端服务
  3. 保持 `/api` 和 `/uploads` 代理到后端 `8000` 端口

## API 文档

后端启动后访问 http://127.0.0.1:8000/docs

## 一键端到端自测

- PowerShell:
  - `.\scripts\run_e2e.ps1`
  - 指定 API 地址：`.\scripts\run_e2e.ps1 -ApiUrl http://127.0.0.1:8000`
- BAT（可双击）:
  - `.\scripts\run_e2e.bat`
  - 指定 API 地址：`.\scripts\run_e2e.bat http://127.0.0.1:8000`

## 一键启动网站（前后端）

- 推荐双击：`.\scripts\start_site.bat`
- 或 PowerShell：`.\scripts\start_site.ps1`
- 不自动打开浏览器：`.\scripts\start_site.ps1 -NoBrowser`

## 限制

- 画布最大 200×200
- 批量预览最多 50 组参数组合
- Excel 导出最多 40000 格
