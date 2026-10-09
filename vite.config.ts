import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 미리보기 도구가 PORT 로 포트를 정해 주면 그대로 쓰고, 직접 실행할 때는 예전처럼 5173 을 쓴다.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '127.0.0.1', port, strictPort: true },
});
