// 提交包专用构建：全部 JS/CSS 内联进单个 HTML——评委双击即开，零环境要求。
// 仅用于产出离线单文件版，不影响常规构建（npm run build）。
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
})
