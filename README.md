# SKU Lookup Server

飞书多维表格 Webhook 服务，输入短 SKU 自动从 LevelUpForLess.com 抓取图片链接和库存。

## 首次部署

```bash
git clone https://github.com/TEGONG00/sku-lookup.git
cd sku-lookup
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## 更新

```bash
cd sku-lookup
git pull
pm2 restart sku-lookup
```

## 测试

```bash
curl http://localhost:3456/lookup?sku=IOCH-207-BG
# → {"imageUrl":"https://...","available":true,"variantSku":"...","error":null}

curl http://localhost:3456/lookup?sku=NOTEXIST
# → {"imageUrl":"","available":false,"variantSku":"","error":null}
```

## Nginx 反代

```bash
cat > /etc/nginx/sites-available/sku-lookup << 'EOF'
server {
    listen 80;
    server_name sku.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/sku-lookup /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 飞书 Workflow 配置

将 Workflow 中 HTTPClientAction 的 URL 改为：

```
http://你的域名或IP:3456/lookup?sku=
```