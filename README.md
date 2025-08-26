# IP Quality for Web - API Worker 
这是 [IPQuality for Web](https://github.com/HEXUXIU/IPQuality-for-Web) 项目的后端 API 服务，基于 Cloudflare Worker 构建。它聚合了多个 IP 数据服务，为前端提供全面的 IP 信息查询功能。 
 
## 功能特性 
 
- **多数据源集成**: 集成多个 IP 数据库和风险评估服务 
- **高性能**: 基于 Cloudflare 全球网络，低延迟响应 
- **并发处理**: 同时查询多个数据源，提高查询效率 
- **标准化响应**: 统一的数据格式，便于前端处理 
- **速率限制**: 防止滥用，保护后端服务 
- **错误处理**: 完善的错误处理机制 
 
## 技术栈 
 
- **运行环境**: Cloudflare Worker 
- **数据源**: ipinfo.io, ip-api.com, ip.sb, IPQualityScore, Scamalytics 等 
- **部署**: Wrangler CLI 
 
## 部署到 Cloudflare Worker 
 
### 前置条件 
 
1. Cloudflare 账户 
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/) 
3. 登录 Wrangler: wrangler login 
 
### 部署步骤 
 
1. 克隆仓库: 
git clone https://github.com/HEXUXIU/ip-quality-for-web-api.git 
cd ip-quality-for-web-api 
2. 安装依赖 (如果有的话): 
npm install 
 
3. 配置环境变量 (可选): 
   在 Cloudflare Worker 仪表板中设置以下环境变量以启用更多数据源： 
   - IPQS_KEY - IPQualityScore API 密钥 
   - IPDATA_KEY - ipdata.co API 密钥 
   - ABUSEIPDB_KEY - AbuseIPDB API 密钥 
 
4. 部署到 Cloudflare: 
wrangler deploy 
 
5. 记录 Worker URL，用于前端配置: 
   部署成功后，Wrangler 会显示 Worker 的 URL，类似于 https://ip-quality-worker.your-subdomain.workers.dev 
 
## API 使用说明 
 
### 查询 IP 信息 
 
curl https://ip-quality-worker.your-subdomain.workers.dev/?ip=8.8.8.8 
 
## 许可证 
 
本项目采用 MIT License - 详见 [LICENSE](LICENSE) 文件 
 
本项目主要由AI生成，并借鉴了 [xykt/IPQuality](https://github.com/xykt/IPQuality) 的设计思路，目的是使无法使用该脚本的系统也可以部分达到该效果。原项目采用 AGPL-3.0 许可证，感谢 IPQuality 脚本的作者。 
