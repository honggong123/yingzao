// 打包并运行几何审计脚本（wood.ts 依赖 DOM Canvas，用桩替换）
import esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'

await esbuild.build({
  entryPoints: ['scripts/audit-puzuo.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'scripts/audit-puzuo.cjs',
  plugins: [
    {
      name: 'stub-wood',
      setup(build) {
        build.onResolve({ filter: /core\/wood/ }, () => ({
          path: fileURLToPath(new URL('./wood-stub.ts', import.meta.url))
        }))
      }
    }
  ]
})
console.log('bundle ok')
