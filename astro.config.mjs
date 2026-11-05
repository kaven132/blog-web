import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [react()],
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [
      tailwindcss(),
      {
        // dev 服务器 keep-alive 拉长：Node 默认 5s 空闲即关闭连接，而页面加载时创建的
        // 连接池在几十秒的大文件上传期间全被关掉——上传完成后的下一个请求（保存/点赞）
        // 拿到的是已被服务端关闭的 socket，必报「网络错误」，重试也撞同一批死连接。
        // 120s 覆盖整个上传窗口；headersTimeout 须大于 keepAliveTimeout。
        name: "dev-keepalive-bump",
        configureServer(server) {
          const bump = () => {
            const http = server.httpServer;
            if (!http) return;
            http.keepAliveTimeout = 120000;
            http.headersTimeout = 125000;
          };
          bump();
          server.httpServer?.once?.("listening", bump);
        },
      },
    ],
  },
  security: {
    // 生产模式的 origin 校验（CSRF 防护）需要知道本站真实的「协议+域名+端口」：
    // 未配置时 Astro 会把 url.origin 回退成无端口的 http://localhost，浏览器携带的
    // Origin（带端口）永远匹配不上，DELETE 等无 Content-Type 的写入请求全部 403。
    // 部署到公网时，把真实域名（如 { hostname: "blog.example.com", protocol: "https" }）加进来。
    // 4321 = dev / 生产常用端口；4399 = 本地预览端口（评论表单 multipart POST 会被 CSRF 拦截）
    allowedDomains: [
      { hostname: "localhost", protocol: "http", port: "4321" },
      { hostname: "127.0.0.1", protocol: "http", port: "4321" },
      { hostname: "localhost", protocol: "http", port: "4399" },
      { hostname: "127.0.0.1", protocol: "http", port: "4399" },
    ],
  },
});
