# SKU Lookup Server

飞书多维表格 Webhook 服务，输入短 SKU 自动从 LevelUpForLess.com 抓取图片链接和库存。

## 部署

```bash
git clone https://github.com/你的用户名/sku-lookup.git
cd sku-lookup
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## 测试

```bash
curl http://localhost:3456/lookup?sku=IOCH-207-BG
```

## Nginx 反代

```nginx
server {
    listen 80;
    server_name sku.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3456;
    }
}
```