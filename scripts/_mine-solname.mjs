// 从 SWF 二进制挖 SharedObject 名（solName）：解 zlib 后在常量池搜 save_data / _data 模式
// 用法: node scripts/_mine-solname.mjs <swf路径> ...
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

for (const p of process.argv.slice(2)) {
  const buf = readFileSync(p);
  const sig = buf.subarray(0, 3).toString("latin1");
  let body;
  if (sig === "CWS") body = inflateSync(buf.subarray(8));
  else if (sig === "FWS") body = buf;
  else {
    console.log(`${p}: 未知签名 ${sig}`);
    continue;
  }
  const s = body.toString("latin1");
  const hits = new Set();
  for (const m of s.matchAll(/save_data[a-zA-Z0-9_]*/g)) hits.add(m[0]);
  for (const m of s.matchAll(/[a-zA-Z0-9_]{3,40}_data(?![a-zA-Z0-9])/g)) hits.add(m[0]);
  // SharedObject.getLocal 的第二参数也可能出现路径；顺带抓 sharedobject 字符串附近
  console.log(`${p}`);
  console.log(`  save_data*: ${[...hits].filter((h) => h.startsWith("save_data")).join(", ") || "无"}`);
  const others = [...hits].filter((h) => !h.startsWith("save_data")).slice(0, 10);
  if (others.length) console.log(`  *_data: ${others.join(", ")}`);
}
