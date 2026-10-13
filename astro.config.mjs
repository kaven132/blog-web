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
    plugins: [tailwindcss()],
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
