import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './', // 相对路径：兼容 Gitee Pages 子路径部署（https://用户名.gitee.io/仓库名/）
  plugins: [vue()],
  server: {
    port: 5174,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        // 大依赖单独分包：长效缓存 + 并行加载
        manualChunks: {
          three: ['three'],
          vue: ['vue'],
          gsap: ['gsap']
        }
      }
    }
  }
})

