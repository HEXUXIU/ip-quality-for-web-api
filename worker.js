
/**
 * =========================================================
 * IP 质量体检 Worker v0.11
 * 单 IP 查询版
 *
 * 核心特性：
 * - 单 IP 查询，去掉批量处理逻辑
 * - 可选 IPQS API 查询，由前端传入 Key
 * - 高级速率限制（按 IP + API 权重）
 * - 并发调用支持
 * - 生产级压缩：Gzip / Brotli
 * - IP 校验（IPv4/IPv6）
 * - API 返回结果标准化，前端统一使用 standardized 字段
 * - 错误信息增强，包含 URL 和原始错误
 * - Map 内存自动清理，限制 timestamps 数量
 * - CORS 支持
 *
 * 注意事项：
 * - rateMap 存储在 Worker 内存中，仅对单实例有效
 * - 大流量场景建议使用 Cloudflare KV
 * =========================================================
 */

/////////////////////////////
// ======== 压缩模块 ========
/////////////////////////////
async function gzipEncode(str){
        const cs = new CompressionStream("gzip");
        const writer = cs.writable.getWriter();
        writer.write(new TextEncoder().encode(str));
        writer.close();
        return new Response(cs.readable).arrayBuffer();
      }
      
      async function brotliEncode(str) {
        // 直接降级到 gzip 压缩，避免 Illegal invocation 错误
        return gzipEncode(str);
      }
      
      /////////////////////////////
      // ======== 配置模块 ========
      /////////////////////////////
      const MAX_CONCURRENT = 3;
      const DEFAULT_TIMEOUT = 5000;
      const RATE_LIMIT = 20;
      const RATE_WINDOW = 60*1000; // 1 分钟
      
      // 高级速率限制存储
      const rateMap = new Map();
      
      // 可扩展 API 配置
      const API_CONFIG = {
        // IP数据库服务
        ipinfo:  { url: "https://ipinfo.io/{ip}/json", requiresKey: false, weight: 1 },
        ipapi:   { url: "http://ip-api.com/json/{ip}?lang=zh-CN", requiresKey: false, weight: 1 },
        ipsb:    { url: "https://api.ip.sb/geoip?ip={ip}", requiresKey: false, weight: 1 },
        ipgs:    { url: "https://ip.gs/json?ip={ip}", requiresKey: false, weight: 1 },
        skk:     { url: "https://api.skk.moe/ip?ip={ip}", requiresKey: false, weight: 1 },
        ipzx:    { url: "https://ip.zxinc.org/?ip={ip}", requiresKey: false, weight: 1 },
        ipregistry: { url: "https://api.ipregistry.co/{ip}?key=tryout", requiresKey: false, weight: 1 },
        ipdata:  { url: "https://api.ipdata.co/{ip}?api-key=test", requiresKey: false, weight: 1 },
        ipwhois: { url: "https://ipwhois.app/json/{ip}", requiresKey: false, weight: 1 },
        
        // 风险评估服务
        ipqs:    { url: "https://www.ipqualityscore.com/api/json/ip/{API_KEY}/{ip}", requiresKey: true, weight: 2 },
        scamalytics: { url: "https://scamalytics.com/ip/{ip}", requiresKey: false, weight: 1 },
        abuseipdb: { url: "https://api.abuseipdb.com/api/v2/check?ipAddress={ip}", requiresKey: false, weight: 1 },
        
        // CDN和代理检测
        cloudflare: { url: "https://ip.nodeget.com/json", requiresKey: false, weight: 1 }
      };
      
      /////////////////////////////
      // ======== IP 校验模块 ========
      /////////////////////////////
      const isValidIPv4 = ip=>{
        const parts = ip.split(".");
        if(parts.length!==4) return false;
        return parts.every(n=>/^\d+$/.test(n) && parseInt(n)<=255);
      };
      const isValidIPv6 = ip=>{
        const parts = ip.split(":");
        if(parts.length<3 || parts.length>8) return false;
        return parts.every(p=>p.length===0||/^[0-9a-fA-F]{0,4}$/.test(p));
      };
      const isValidIP = ip=>isValidIPv4(ip)||isValidIPv6(ip);
      
      /////////////////////////////
      // ======== fetch 封装模块 ========
      /////////////////////////////
      async function fetchWithTimeout(url, timeout=DEFAULT_TIMEOUT){
        const controller = new AbortController();
        const id = setTimeout(()=>controller.abort(), timeout);
        const start = Date.now();
        try{
          const res = await fetch(url,{signal:controller.signal});
          
          // 尝试以不同编码解析响应
          const text = await res.text();
          let data;
          try {
            // 首先尝试直接解析
            data = JSON.parse(text);
          } catch {
            // 如果失败，尝试处理编码问题
            try {
              // 尝试修复常见的编码问题
              const cleanedText = text.replace(/\u0000/g, "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
              data = JSON.parse(cleanedText);
            } catch {
              data = {error:"Invalid JSON", rawText: text.substring(0, 200) + (text.length > 200 ? "..." : "")};
            }
          }
          
          return { data, elapsed: Date.now()-start, status: res.status, error:null };
        }catch(e){
          return { data:null, elapsed: Date.now()-start, status:0, error:`${e.message} (url: ${url})` };
        }finally{ clearTimeout(id); }
      }
      
      function getApiUrl(apiName, ip, ipqsKey){
        const cfg = API_CONFIG[apiName];
        if(!cfg || !cfg.url) return null;
        let url = cfg.url.replace("{ip}",ip);
        if(apiName==="ipqs"){
          if(!ipqsKey) return null;
          url = url.replace("{API_KEY}", ipqsKey);
        }
        return url;
      }
      
      /////////////////////////////
      // ======== API 数据标准化模块 ========
      /////////////////////////////
      const transformFns = {
        // IP数据库服务数据标准化
        ipinfo: data=>({ 
          country: data.country, 
          city: data.city, 
          isp: data.org,
          asn: data.org? data.org.split(" ")[0] : null,
          loc: data.loc
        }),
        ipapi: data=>({ 
          country: data.country, 
          city: data.city, 
          isp: data.isp,
          org: data.org,
          asn: data.as? data.as.split(" ")[0] : null
        }),
        ipsb: data=>({ 
          country: data.country, 
          city: data.city, 
          isp: data.organization,
          asn: data.asn
        }),
        ipgs: data=>({ 
          country: data.country, 
          city: data.city, 
          isp: data.isp
        }),
        skk: data=>({ 
          country: data.country, 
          city: data.city, 
          isp: data.isp
        }),
        ipzx: data=>({ 
          country: data.country, 
          city: data.city, 
          isp: data.isp
        }),
        ipregistry: data=>({
          country: data.location? data.location.country.code : null,
          city: data.location? data.location.city : null,
          isp: data.company? data.company.name : null,
          asn: data.connection? data.connection.asn : null
        }),
        ipdata: data=>({
          country: data.country_code,
          city: data.city,
          isp: data.org,
          asn: data.asn? data.asn.asn : null
        }),
        ipwhois: data=>({
          country: data.country_code,
          city: data.city,
          isp: data.isp,
          asn: data.connection? data.connection.asn : null
        }),
        
        // 风险评估服务数据标准化
        ipqs: data=>({ 
          country: data.country, 
          city: data.city, 
          isp: data.organization,
          fraud_score: data.fraud_score,
          proxy: data.proxy,
          vpn: data.vpn,
          tor: data.tor
        }),
        scamalytics: data=>({
          fraud_score: data.score? data.score.risk : null,
          proxy: data.signals? data.signals.proxy : null,
          vpn: data.signals? data.signals.vpn : null,
          tor: data.signals? data.signals.tor : null
        }),
        abuseipdb: data=>({
          abuse_score: data.data? data.data.abuseConfidenceScore : null,
          isp: data.data? data.data.isp : null,
          country: data.data? data.data.countryCode : null
        }),
        
        // CDN和代理检测数据标准化
        cloudflare: data=>({
          risk_score: data.ip? data.ip.riskScore : null,
          proxy: data.ip? data.ip.proxy : null
        })
      };
      
      /////////////////////////////
      // ======== API 调用模块 ========
      /////////////////////////////
      async function processIp(ip, targetApis, order="concurrent", ipqsKey){
        const results = {};
      
        const workerFn = async(api)=>{
          const url = getApiUrl(api, ip, ipqsKey);
          if(!url) return { data:null, elapsed:0, status:0, error:"API配置缺失或缺少IPQS_KEY" };
          const res = await fetchWithTimeout(url);
      
          // 简化错误信息
          if(res.status===403) res.error="forbidden";
          if(res.status===429) res.error="rate_limited";
          if(res.status>=500) res.error="server_error";
      
          // 保留标准化数据
          const transform = transformFns[api];
          if(transform && res.data && !res.data.error) {
            // 清洗数据，移除乱码字段
            const cleanedData = {};
            for (const [key, value] of Object.entries(res.data)) {
              if (typeof value === "string" && /?/.test(value)) {
                // 跳过包含乱码的字段
                continue;
              }
              cleanedData[key] = value;
            }
            res.standardized = transform(cleanedData);
          }
      
          return res;
        };
      
        if(order==="sequential"){
          for(const api of targetApis) results[api]=await workerFn(api);
        }else{
          const queue=[...targetApis];
          const active=[];
          while(queue.length || active.length){
            while(active.length<MAX_CONCURRENT && queue.length){
              const apiName = queue.shift();
              const p = workerFn(apiName).then(r=>{
                results[apiName]=r;
                active.splice(active.indexOf(p),1);
              });
              active.push(p);
            }
            if(active.length) await Promise.race(active);
          }
        }
      
        return results;
      }
      
      /////////////////////////////
      // ======== 速率限制模块 ========
      /////////////////////////////
      function checkRateLimit(clientIP){
        const now = Date.now();
        const record = rateMap.get(clientIP) || {timestamps:[], weight:1};
        const valid = record.timestamps.filter(ts=>ts>now-RATE_WINDOW);
        const totalWeight = valid.reduce((acc,w)=>acc+record.weight,0);
      
        if(totalWeight>=RATE_LIMIT) return false;
      
        valid.push(now);
        // 限制 timestamps 数组长度，避免无限增长
        if(valid.length>100) valid.splice(0, valid.length-100);
        record.timestamps = valid;
        rateMap.set(clientIP,record);
      
        // 清理长时间未使用的 IP
        for(const [key, rec] of rateMap){
          if(!rec.timestamps.length || Math.max(...rec.timestamps)<now-RATE_WINDOW){
            rateMap.delete(key);
          }
        }
      
        return true;
      }
      
      /////////////////////////////
      // ======== Worker 主入口 ========
      /////////////////////////////
      export default {
        async fetch(request){
          const url = new URL(request.url);
          const ipParam = url.searchParams.get("ip");
          const apiParam = url.searchParams.get("api")?.toLowerCase();
          const ipqsKey = url.searchParams.get("ipqs_key");
          const debug = url.searchParams.get("debug")==="1";
          const orderParam = url.searchParams.get("order") || "concurrent";
      
          if(!ipParam || !isValidIP(ipParam))
            return new Response(JSON.stringify({error:"Invalid IP"}),{status:400,headers:{"Content-Type":"application/json"}});
      
          const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
          if(!checkRateLimit(clientIP))
            return new Response(JSON.stringify({error:"Rate limit exceeded"}),{status:429,headers:{"Content-Type":"application/json"}});
      
          const targetApis = apiParam ? [apiParam] : Object.keys(API_CONFIG);
          const results = await processIp(ipParam,targetApis,orderParam,ipqsKey);
      
          // 暂时禁用压缩，返回原始信息以排查乱码问题
          const body = JSON.stringify({ip:ipParam, results});
          const headers = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};
          
          // 检测客户端是否支持压缩
          const acceptEncoding = request.headers.get("Accept-Encoding") || "";
          console.log("Accept-Encoding:", acceptEncoding);
          
          // 直接返回未压缩的响应
          return new Response(body, {status:200, headers});
        }
      };
      