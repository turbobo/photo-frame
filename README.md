# Photo Frame · 相框水印工具

纯浏览器端的相机照片边框水印工具。零后端、零上传、隐私安全。

## 特性

- 📷 **多格式**：JPG · PNG · WebP · HEIC · RAW（14 种主流相机）
- 🎨 **13 种模板**：基础（极简/拍立得）· 品牌风（徕卡/红点/参数栏）· 胶片（Film/Dazz/Instax/复古）· 社交（Insta/小红书/杂志/地理）
- 🏷 **自动识别**：EXIF 元数据 + 14 家相机品牌 Logo 自动匹配
- ⚡ **实时预览**：< 50ms 重绘
- 🚀 **秒级部署**：EdgeOne Pages 静态托管，免费额度足够个人使用

## 开发

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器（http://localhost:5173）
npm run build     # 构建生产包（输出到 dist/）
npm run preview   # 本地预览生产构建
```

## 部署

推送到 GitHub / Coding，在 EdgeOne Pages 控制台绑定仓库：

- 构建命令：`npm run build`
- 输出目录：`dist`
- Node 版本：`20.18.0`

## 文档

- [技术方案文档](./技术方案文档.md) — 架构、格式支持、部署
- [产品设计文档](./产品设计文档.md) — 功能清单、UI、交互

## License

MIT
