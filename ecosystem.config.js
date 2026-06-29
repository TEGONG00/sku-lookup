module.exports = {
  apps: [{
    name: "sku-lookup",
    script: "sku-lookup-server.js",
    env: { PORT: "3456" },
    autorestart: true,
    max_restarts: 10,
  }]
};