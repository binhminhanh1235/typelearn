import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import * as notesIndexHandler from './edge-functions/api/notes/index.js';
import * as notesIdHandler from './edge-functions/api/notes/[id].js';
import * as statsHandler from './edge-functions/api/stats/[syncCode].js';

/**
 * In-memory KV Store giả lập biến toàn cục `my_kv` của EdgeOne Pages khi chạy local dev/preview
 */
function createLocalKV() {
  const store = new Map();
  return {
    async get(key, type = 'text') {
      if (!store.has(key)) return null;
      const raw = store.get(key);
      if (type === 'json') {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return null;
        }
      }
      return raw;
    },
    async put(key, value) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '', limit = 256 } = {}) {
      const keys = [];
      for (const k of store.keys()) {
        if (!prefix || k.startsWith(prefix)) {
          keys.push({ name: k });
          if (keys.length >= limit) break;
        }
      }
      return { complete: true, cursor: '', keys };
    }
  };
}

function edgeOneMockPlugin() {
  if (!globalThis.my_kv) {
    globalThis.my_kv = createLocalKV();
  }

  const createMiddleware = () => async (req, res, next) => {
    const urlStr = req.url || '/';
    if (!urlStr.startsWith('/api/')) {
      return next();
    }

    try {
      const fullUrl = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
      const pathname = fullUrl.pathname.replace(/\/+$/, '');
      const method = (req.method || 'GET').toUpperCase();

      let handlerModule = null;
      let params = {};

      if (pathname === '/api/notes') {
        handlerModule = notesIndexHandler;
      } else if (pathname.startsWith('/api/notes/')) {
        const id = decodeURIComponent(pathname.slice('/api/notes/'.length));
        handlerModule = notesIdHandler;
        params = { id };
      } else if (pathname.startsWith('/api/stats/')) {
        const syncCode = decodeURIComponent(pathname.slice('/api/stats/'.length));
        handlerModule = statsHandler;
        params = { syncCode };
      }

      if (!handlerModule) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'API route not found' }));
        return;
      }

      // Đọc body nếu là POST/PUT
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const bodyBuffer = Buffer.concat(chunks);

      const webHeaders = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') webHeaders[k] = v;
        else if (Array.isArray(v)) webHeaders[k] = v.join(', ');
      }

      const webRequest = new Request(fullUrl.toString(), {
        method,
        headers: webHeaders,
        body: ['GET', 'HEAD'].includes(method) || bodyBuffer.length === 0 ? undefined : bodyBuffer
      });

      const context = {
        request: webRequest,
        params,
        env: {
          ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'admin123'
        },
        waitUntil: () => {}
      };

      let webResponse;
      if (method === 'GET' && handlerModule.onRequestGet) {
        webResponse = await handlerModule.onRequestGet(context);
      } else if (method === 'POST' && handlerModule.onRequestPost) {
        webResponse = await handlerModule.onRequestPost(context);
      } else if (method === 'PUT' && handlerModule.onRequestPut) {
        webResponse = await handlerModule.onRequestPut(context);
      } else if (method === 'DELETE' && handlerModule.onRequestDelete) {
        webResponse = await handlerModule.onRequestDelete(context);
      } else if (handlerModule.onRequest) {
        webResponse = await handlerModule.onRequest(context);
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });
      const responseText = await webResponse.text();
      res.end(responseText);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  };

  return {
    name: 'vite-plugin-edgeone-v8-mock',
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    }
  };
}

export default defineConfig({
  plugins: [preact(), edgeOneMockPlugin()],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
