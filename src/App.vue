<template>
  <LoginGate v-if="!user" />
  <div v-else class="app">
    <header class="topbar">
      <div class="brand">
        <span class="seal">營造</span>
        <div class="brand-text">
          <strong>营造 · 数字营造系统</strong>
          <span>宋《营造法式》斗栱榫卯 · 可拆可拼可改可造</span>
        </div>
      </div>
      <nav v-show="navOpen" class="modules">
        <button
          v-for="m in MODULES"
          :key="m.id"
          class="module"
          :class="{ active: module === m.id }"
          :disabled="m.disabled"
          @click="switchModule(m.id)"
        >{{ m.label }}</button>
      </nav>
      <div v-show="navOpen" class="user-area">
        <button
          class="module sound-toggle"
          :title="soundEnabled ? '关闭音效' : '开启音效'"
          @click="setSoundEnabled(!soundEnabled)"
        >{{ soundEnabled ? '🔔' : '🔇' }}</button>
        <button
          class="module ambient-toggle"
          :class="{ on: ambientOn }"
          :title="ambientOn ? '关闭环境音' : '开启环境音（古琴）'"
          @click="ambientOn ? stopAmbient() : startAmbient()"
        >♪ {{ ambientOn ? '停止' : '环境音' }}</button>
        <button class="module" @click="tutorialOpen = true">？新手教程</button>
        <span class="user-chip" :title="'已登录：' + user">◈ {{ user }}</span>
        <button class="module" @click="logoutUser">退出</button>
      </div>
      <button class="module nav-toggle" :title="navOpen ? '收起功能栏' : '展开功能栏'" @click="navOpen = !navOpen">
        {{ navOpen ? '✕ 收起' : '☰ 功能' }}
      </button>
    </header>

    <main class="stage-wrap">
      <Viewer3D
        :module="module"
        :params="viewerParams"
        :explode="explode"
        :highlight="highlight"
        :grade="grade"
        :game-step="game.step"
        :joint-id="jointId"
        :joint-t="jointT"
        :quake-opts="quakeOpts"
        :all-labels="module === 'school' ? schoolAllLabels : false"
        @select="onSelect"
        @sequence="onSequence"
        @joint-info="jointMeta = $event"
        @quake-stats="onQuakeStats"
      />

      <!-- 左：信息卡 -->
      <aside class="info-card" :class="{ on: !!wiki || module === 'game' }">
        <!-- 拼装挑战 HUD -->
        <template v-if="module === 'game'">
          <div class="card-head">
            <h3>拼装挑战</h3>
            <span class="alias">{{ game.puzuoName }}</span>
          </div>
          <template v-if="game.phase === 'playing'">
            <p class="dims">第 {{ Math.min(game.step + 1, game.total) }} / {{ game.total }} 件 · 已落位 {{ game.step }}</p>
            <template v-if="game.guided && guidedStep">
              <div class="guided-card">
                <p class="gd-name">「{{ guidedStep.name }}」</p>
                <p class="gd-why">{{ guidedStep.why }}</p>
                <p class="gd-tip">💡 {{ guidedStep.tip }}</p>
              </div>
              <p class="role" style="margin-top: 0.5rem">从下方构件盘点选它落位。</p>
            </template>
            <template v-else-if="game.tutorial && tutorialHint">
              <p class="role">
                教学提示：下一件是<b>「{{ tutorialHint.name }}」</b>——{{ tutorialHint.role }}
              </p>
              <p class="dims" style="margin-top: 0.5rem">从下方构件盘点选它落位。</p>
            </template>
            <p v-else class="role">按<b>铺作次序</b>从下方构件盘选出下一件。选错会晃——历史的次序没有商量。</p>
            <p class="dims" style="margin-top: 0.5rem">用时 {{ game.elapsed }}s · 错误 {{ game.wrong }}</p>
          </template>
          <template v-else-if="game.phase === 'done'">
            <p class="dims">落成 · 用时 {{ game.elapsed }}s · 错误 {{ game.wrong }} 次</p>
            <p class="role">评定：<b class="grade">{{ rating }}</b> —— {{ ratingText }}</p>
            <p class="role" style="margin-top: 0.5em">换一朵更复杂的铺作，再来一局。</p>
          </template>
          <template v-else>
            <p class="role">
              整朵铺作已拆成构件盘。按《营造法式》的<b>铺作次序</b>，从下方选出下一件——
              选对它会飞回原位，选错会晃动。自四铺作起，直到八铺作重栱。
            </p>
          </template>
        </template>

        <!-- 参数工坊 -->
        <template v-else-if="module === 'workshop'">
          <div class="card-head">
            <h3>材分八等</h3>
            <span class="alias">第 {{ grade }} 等材 · {{ CAI_GRADES[grade - 1].use }}</span>
          </div>
          <p class="dims">材广 {{ CAI_GRADES[grade - 1].cai }} 寸 × 厚 {{ CAI_GRADES[grade - 1].hou }} 寸</p>
          <p class="role">
            "凡构屋之制，皆以材为祖。"——材等一定，全屋构件按比例缩放。
            拖动右侧滑杆：同一朵铺作，八等材就是八种大小的房子。
          </p>
          <div class="dims-table">
            <div><span>每分</span><b>{{ fenCm }} cm</b></div>
            <div><span>总出跳</span><b>{{ depthCm }} cm</b></div>
            <div><span>铺作通高</span><b>{{ heightCm }} cm</b></div>
          </div>
          <div class="src">
            <span class="src-label">出处</span>
            <span>《营造法式》卷四·材分八等（按宋尺 1 尺 ≈ 31.2cm 换算）</span>
          </div>
        </template>

        <!-- 榫卯谱 -->
        <template v-else-if="module === 'joints'">
          <div class="card-head">
            <h3>{{ jointMeta?.name ?? '榫卯谱' }}</h3>
            <span class="alias">不用一钉一铆</span>
          </div>
          <p class="role">{{ jointMeta?.desc }}</p>
          <p class="dims" style="margin-top: 0.6rem">拖动右侧「开合」滑杆，亲手把榫合上、再拆开。</p>
          <div class="src">
            <span class="src-label">出处</span>
            <span>{{ jointMeta?.source }}</span>
          </div>
        </template>

        <!-- 营造之旅 -->
        <template v-else-if="module === 'palace'">
          <div class="card-head">
            <h3>营造之旅</h3>
            <span class="alias">一座殿宇的诞生</span>
          </div>
          <p class="role">
            筑台基、立柱架阑额、施铺作、举折成顶——17 秒走完一座庑殿大殿的营造次序，
            终幕日暮西沉。<b>点击画面可暂停游走</b>，自由环视；右上角可重播。
          </p>
          <p class="role" style="margin-top: 0.5em">
            殿上 18 朵铺作与整座屋架，全部由材分制算法实时生成。
          </p>
        </template>

        <!-- 斗栱抗震 -->
        <template v-else-if="module === 'quake'">
          <div class="card-head">
            <h3>斗栱抗震</h3>
            <span class="alias">教学示意模拟</span>
          </div>
          <p class="role">
            斗栱层像一组会滑移的弹簧：地震能量在层层错动中被榫卯摩擦消耗。
            切换<b>「刚性连接」</b>对比——同样的大震，屋面响应天差地别。
          </p>
          <p class="dims" style="font-size: 1.7rem; text-align: center; margin-top: 0.6rem">
            减震 {{ dampingPct }}%
          </p>
          <div class="dims-table">
            <div><span>地面峰值</span><b>{{ quakeStats.peakG.toFixed(1) }} 分</b></div>
            <div><span>屋面峰值</span><b>{{ quakeStats.peakR.toFixed(1) }} 分</b></div>
          </div>
          <div class="src">
            <span class="src-label">呼应</span>
            <span>应县木塔近千年不倒、晋祠圣母殿历经大震——正是这套耗能智慧的实证。模型为简化教学模拟。</span>
          </div>
        </template>

        <!-- 学堂 -->
        <template v-else>
          <div class="card-head">
            <h3>{{ wiki ? wiki.name : '营造学堂' }}</h3>
            <span v-if="wiki?.alias" class="alias">又作 {{ wiki.alias }}</span>
            <span v-else-if="!wiki" class="alias">{{ puzuoName }} · 柱头铺作</span>
          </div>
          <template v-if="wiki">
            <p class="dims">{{ wiki.dims }}</p>
            <p class="place">📍 {{ wiki.place }}</p>
            <p class="role">{{ wiki.role }}</p>
            <div class="src">
              <span class="src-label">出处</span>
              <span>{{ wiki.source }}</span>
            </div>
            <p class="hook">“{{ wiki.hook }}”</p>
          </template>
          <template v-else>
            <p class="role">
              这朵铺作由《营造法式》材分制<b>实时生成</b>：右侧调跳数与造栱制度，铺作随之重构；
              拖动「拆解」滑杆，看它一层层解开。点击任意构件或标注，读它的考据。
            </p>
            <p class="role" style="margin-top: 0.6em">
              层距的来历：单栱计心每层 48 分 = 足材 21 + 斗口 6 + 瓜子栱 15 + 斗口 6——每个数字都有出处。
            </p>
          </template>
          <div class="build-chain">
            <p class="bc-title">它如何撑起一座建筑 · 从柱身到屋面</p>
            <div class="bc-steps">
              <template v-for="(n, i) in BUILD_CHAIN" :key="n.name">
                <span class="bc-node" :class="{ hot: i === chainIdx }" :title="n.desc">{{ n.name }}</span>
                <i v-if="i < BUILD_CHAIN.length - 1" class="bc-arrow">→</i>
              </template>
            </div>
            <p class="bc-desc">
              <template v-if="chainHot"><b>📍 {{ chainHot.name }}</b> —— {{ chainHot.desc }}</template>
              <template v-else>点击任意构件，看它站在链条的哪一环。</template>
            </p>
            <p class="bc-note">
              把这样一朵铺作沿檐下一朵朵排开、架到每根柱头上，串以柱头枋，上承撩檐槫；钉椽、铺望、苫背、盖瓦——大殿的檐廊就此合成。走进「营造之旅」，看整座大殿如何立起来。
            </p>
          </div>
        </template>
      </aside>

      <!-- 右：控制台 -->
      <aside class="console" :class="{ open: consoleOpen }">
        <!-- 学堂 -->
        <template v-if="module === 'school'">
          <div class="sec">
            <span class="sec-label">跳数 · 铺作</span>
            <div class="seg">
              <button
                v-for="n in 5" :key="n" class="seg-btn"
                :class="{ active: schoolParams.tiao === n }"
                @click="schoolParams.tiao = n"
              >{{ PUZUO_NAMES[n] }}</button>
            </div>
          </div>
          <div class="sec">
            <span class="sec-label">造栱制度</span>
            <div class="seg">
              <button class="seg-btn" :class="{ active: !schoolParams.zhongGong }" @click="schoolParams.zhongGong = false">单栱造</button>
              <button class="seg-btn" :class="{ active: schoolParams.zhongGong }" @click="schoolParams.zhongGong = true">重栱造</button>
            </div>
            <div class="seg" style="margin-top: 0.4rem">
              <button class="seg-btn" :class="{ active: schoolParams.jiXin }" @click="schoolParams.jiXin = true">计心造</button>
              <button class="seg-btn" :class="{ active: !schoolParams.jiXin }" @click="schoolParams.jiXin = false">偷心造</button>
            </div>
          </div>
          <div class="sec row">
            <span class="sec-label">耍头</span>
            <button class="switch" :class="{ on: schoolParams.shuaTou }" @click="schoolParams.shuaTou = !schoolParams.shuaTou"><i></i></button>
          </div>
          <div class="sec row">
            <span class="sec-label">昂制（下昂）</span>
            <button class="switch" :class="{ on: schoolParams.ang }" @click="schoolParams.ang = !schoolParams.ang"><i></i></button>
          </div>
          <div class="sec row">
            <span class="sec-label">全部标注</span>
            <button class="switch" :class="{ on: schoolAllLabels }" @click="schoolAllLabels = !schoolAllLabels"><i></i></button>
          </div>
          <div class="sec">
            <span class="sec-label">拆解 · {{ Math.round(explode * 100) }}%</span>
            <input v-model.number="explode" type="range" min="0" max="1" step="0.01" class="slider" />
          </div>
          <button class="btn wide enc-btn" @click="openEncyclopedia()">
            📖 构件图鉴
          </button>
          <div class="sec">
            <span class="sec-label">铺作次序 · 悬停点亮一层</span>
            <ol class="steps">
              <li
                v-for="s in steps" :key="s.text"
                @mouseenter="highlight = s.layer"
                @mouseleave="highlight = null"
              >{{ s.text }}</li>
            </ol>
            <blockquote class="cite">
              「凡铺作自柱头上栌斗口内出一栱或一昂，皆谓之一跳，传至五跳止。」「凡铺作逐跳上安栱谓之计心；若逐跳上不安栱……谓之偷心。」
              <span>——《营造法式》卷四 · 大木作制度 · 总铺作次序</span>
            </blockquote>
          </div>
        </template>

        <!-- 拼装挑战 -->
        <template v-else-if="module === 'game'">
          <div class="sec">
            <span class="sec-label">关卡 · 铺作</span>
            <div class="seg">
              <button
                v-for="n in 3" :key="n" class="seg-btn"
                :class="{ active: gameDraft.tiao === n }"
                @click="gameDraft.tiao = n"
              >{{ PUZUO_NAMES[n] }}</button>
            </div>
            <div class="seg" style="margin-top: 0.4rem">
              <button class="seg-btn" :class="{ active: !gameDraft.zhongGong }" @click="gameDraft.zhongGong = false">单栱造</button>
              <button class="seg-btn" :class="{ active: gameDraft.zhongGong }" @click="gameDraft.zhongGong = true">重栱造</button>
            </div>
            <div class="sec row" style="margin-top: 0.6rem; margin-bottom: 0">
              <span class="sec-label">昂制（下昂）</span>
              <button class="switch" :class="{ on: gameDraft.ang }" @click="gameDraft.ang = !gameDraft.ang"><i></i></button>
            </div>
          </div>
          <div class="sec row">
            <span class="sec-label">新手教学（无干扰 + 提示）</span>
            <button class="switch" :class="{ on: gameDraft.tutorial }" @click="gameDraft.tutorial = !gameDraft.tutorial"><i></i></button>
          </div>
          <div class="sec row">
            <span class="sec-label">教学关卡（引导式搭建）</span>
            <button class="switch" :class="{ on: gameDraft.guided }" @click="gameDraft.guided = !gameDraft.guided"><i></i></button>
          </div>
          <button class="btn wide" @click="startGame">
            {{ game.phase === 'playing' ? '重新开始' : gameDraft.guided ? '开始教学搭建' : '开始拼装' }}
          </button>
          <p class="tip" style="margin-top: 0.7rem">
            构件盘在下方。每一步从候选里选出正确的下一件——干扰件就在其中。
          </p>
          <div v-if="user" class="sec" style="margin-top: 1rem; margin-bottom: 0">
            <span class="sec-label">我的落成记录</span>
            <ol class="steps">
              <li v-if="!myRecordList.length">还没有落成记录——去拼第一朵。</li>
              <li v-for="r in myRecordList.slice(0, 5)" :key="r.at + r.levelKey">
                {{ r.levelName }} · {{ r.time }}s · {{ r.rating }}级
              </li>
            </ol>
          </div>
          <p v-else class="tip" style="margin-top: 0.7rem">登录后自动保存你的落成成绩。</p>
        </template>

        <!-- 参数工坊 -->
        <template v-else-if="module === 'workshop'">
          <div class="sec">
            <span class="sec-label">材等 · {{ grade }} 等（{{ CAI_GRADES[grade - 1].use }}）</span>
            <input v-model.number="grade" type="range" min="1" max="8" step="1" class="slider" />
            <div class="seg" style="margin-top: 0.6rem">
              <button class="seg-btn" :class="{ active: wsParams.tiao === 2 }" @click="wsParams.tiao = 2">五铺作</button>
              <button class="seg-btn" :class="{ active: wsParams.tiao === 3 }" @click="wsParams.tiao = 3">六铺作</button>
              <button class="seg-btn" :class="{ active: wsParams.tiao === 4 }" @click="wsParams.tiao = 4">七铺作</button>
            </div>
          </div>
          <div class="sec">
            <span class="sec-label">材分八等</span>
            <ol class="steps">
              <li
                v-for="g in CAI_GRADES" :key="g.grade"
                :class="{ on: grade === g.grade }"
                @click="grade = g.grade"
              >{{ g.grade }}等 · 广{{ g.cai }}×厚{{ g.hou }}寸</li>
            </ol>
          </div>
        </template>

        <!-- 斗栱抗震控制台 -->
        <template v-else-if="module === 'quake'">
          <div class="sec">
            <span class="sec-label">振幅 · {{ quakeOpts.A }} 分</span>
            <input v-model.number="quakeOpts.A" type="range" min="2" max="28" step="1" class="slider" />
            <div class="seg" style="margin-top: 0.4rem">
              <button class="seg-btn" :class="{ active: quakeOpts.A === 8 }" @click="quakeOpts.A = 8">小震</button>
              <button class="seg-btn" :class="{ active: quakeOpts.A === 16 }" @click="quakeOpts.A = 16">中震</button>
              <button class="seg-btn" :class="{ active: quakeOpts.A === 28 }" @click="quakeOpts.A = 28">大震</button>
            </div>
          </div>
          <div class="sec">
            <span class="sec-label">频率 · {{ quakeOpts.freqHz.toFixed(1) }} Hz</span>
            <input v-model.number="quakeOpts.freqHz" type="range" min="0.8" max="3.5" step="0.1" class="slider" />
          </div>
          <div class="sec">
            <span class="sec-label">屋面连接方式</span>
            <div class="seg">
              <button class="seg-btn" :class="{ active: quakeOpts.mode === 'dougong' }" @click="quakeOpts.mode = 'dougong'">斗栱连接</button>
              <button class="seg-btn" :class="{ active: quakeOpts.mode === 'rigid' }" @click="quakeOpts.mode = 'rigid'">刚性连接</button>
            </div>
          </div>
          <button class="btn wide" @click="quakeOpts.running = !quakeOpts.running">
            {{ quakeOpts.running ? '⏸ 停止震动' : '▶ 开始震动' }}
          </button>
          <p class="tip" style="margin-top: 0.7rem">切到「刚性连接」再开大震——对比屋面的反应。</p>
        </template>

        <!-- 榫卯谱控制台 -->
        <template v-else-if="module === 'joints'">
          <div class="sec">
            <span class="sec-label">选一种榫卯</span>
            <div class="joints-grid">
              <button
                v-for="j in JOINT_LIST" :key="j.id"
                class="seg-btn" :class="{ active: jointId === j.id }"
                @click="jointId = j.id"
              >{{ j.name }}</button>
            </div>
          </div>
          <div class="sec">
            <span class="sec-label">开合 · {{ Math.round(jointT * 100) }}%</span>
            <input v-model.number="jointT" type="range" min="0" max="1" step="0.01" class="slider" />
            <p class="tip">0% 拆解 → 100% 合体。有些榫卯分两步：先合体，再上销。</p>
          </div>
        </template>
      </aside>

      <!-- 移动端控制台开关 -->
      <button class="console-toggle" @click="consoleOpen = !consoleOpen">☰ {{ consoleOpen ? '收起' : '控制台' }}</button>

      <!-- 拼装构件盘 -->
      <div v-if="module === 'game' && game.phase === 'playing'" class="tray">
        <button
          v-for="(c, i) in game.candidates"
          :key="c.key + i"
          class="tray-card"
          :class="{ shake: shakeIdx === i }"
          @click="pick(i)"
        >{{ c.name }}</button>
      </div>

      <!-- 教程（登录后首次访问自动弹出） -->
      <TutorialGuide :open="tutorialOpen" @close="tutorialOpen = false" />
      <ComponentEncyclopedia
        :open="encyclopediaOpen"
        :initial-key="encyclopediaInitial"
        @close="encyclopediaOpen = false"
      />

      <div class="hint">拖拽旋转 · 滚轮缩放 · 点击构件读考据</div>
      <div class="milestone">{{ milestoneText }}</div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import type { StudioModule } from './components/Viewer3D.vue'
import TutorialGuide from './components/TutorialGuide.vue'
import LoginGate from './components/LoginGate.vue'
import LoadingSplash from './components/LoadingSplash.vue'
import ComponentEncyclopedia from './components/ComponentEncyclopedia.vue'
// three.js 体积较大：登录门先行渲染，Viewer3D（含 three）按需异步加载（带加载动画）
const Viewer3D = defineAsyncComponent({
  loader: () => import('./components/Viewer3D.vue'),
  loadingComponent: LoadingSplash,
  delay: 200,
})
import { DEFAULT_PARAMS, puzuoHeight, puzuoDepth, angCounts, type PuzuoParams } from './bofa/puzuo'
import { WIKI } from './bofa/kaogu'
import { CAI_GRADES } from './core/units'
import { JOINT_LIST } from './bofa/joints'
import { woodSound, setSoundEnabled, soundEnabled, startAmbient, stopAmbient, ambientOn } from './core/audio'
import { currentUser, logout, saveRecord, bestFor, loadRecords } from './core/auth'

const MODULES: { id: StudioModule; label: string; disabled?: boolean }[] = [
  { id: 'school', label: '营造学堂' },
  { id: 'game', label: '拼装挑战' },
  { id: 'workshop', label: '参数工坊' },
  { id: 'joints', label: '榫卯谱' },
  { id: 'quake', label: '斗栱抗震' },
  { id: 'palace', label: '营造之旅' }
]
const PUZUO_NAMES: Record<number, string> = { 1: '四', 2: '五', 3: '六', 4: '七', 5: '八' }
const CN = ['零', '一', '二', '三', '四', '五']

const module = ref<StudioModule>('school')
const explode = ref(0)
const highlight = ref<number | null>(null)
const selected = ref<string | null>(null)

// ── 学堂 ──
const schoolParams = reactive<PuzuoParams>({ ...DEFAULT_PARAMS, ang: false })
const schoolAllLabels = ref(false)
const navOpen = ref(true)

// ── 从柱身到屋面：一根构件如何搭进一座建筑 ──
const BUILD_CHAIN: { name: string; desc: string }[] = [
  { name: '柱身', desc: '全屋的竖向骨架——一切重量兜兜转转，最终都回到柱身上。' },
  { name: '阑额 · 普拍枋', desc: '柱头之间的横向联系，是铺作坐落的"地基"。' },
  { name: '栌斗', desc: '铺作基座：柱头的力从这里进入斗栱，一层一层散开。' },
  { name: '铺作（斗 · 栱 · 昂）', desc: '檐下传力层——斗接栱、栱接枋，把出檐挑得远远的，再把重量稳稳送回柱身。' },
  { name: '柱头枋', desc: '沿檐把一排排铺作串成整体的长枋。' },
  { name: '撩檐槫', desc: '檐口最外那根圆檩，檐椽一字排开压在它身上。' },
  { name: '椽飞 · 屋面', desc: '椽上铺望板、苫背、盖瓦——一座殿宇就此合顶。' }
]
const CHAIN_OF: Record<string, number> = {
  puaipai: 1, ludou: 2, zhutoufang: 4, liaoyan: 5,
  huagong: 3, nidao: 3, guazi: 3, man: 3,
  jiaohidou: 3, sandou: 3, qixindou: 3, linggong: 3, shuatou: 3, xiaang: 3
}
function normalizedKey(sel: string | null): string | null {
  if (!sel) return null
  const base = sel.split('-')[0]
  return base === 'jiaohudou' ? 'jiaohidou' : base === 'xia' ? 'xiaang' : base
}
const chainIdx = computed(() => {
  const key = normalizedKey(selected.value)
  return key ? CHAIN_OF[key] ?? -1 : -1
})
const chainHot = computed(() => (chainIdx.value >= 0 ? BUILD_CHAIN[chainIdx.value] : null))
const ANG_NUM = ['', '单下昂', '双下昂', '三下昂']
const MIAO_NUM = ['', '单杪', '双杪']
function puzuoTitle(tiao: number, zhongGong: boolean, jiXin: boolean, ang: boolean): string {
  const c = ang ? angCounts(tiao) : null
  const zh = zhongGong ? '重栱' : '单栱'
  if (c) return `${PUZUO_NAMES[tiao]}铺作${zh}出${MIAO_NUM[c.mang]}${ANG_NUM[c.ang]}`
  return `${PUZUO_NAMES[tiao]}铺作${zh}${jiXin ? '计心' : '偷心'}造`
}
const steps = computed(() => {
  const list: { layer: number; text: string }[] = [
    { layer: 0, text: '普拍枋 · 栌斗 —— 铺作之基' }
  ]
  const c = schoolParams.ang ? angCounts(schoolParams.tiao) : null
  const aAng = c?.ang ?? 0
  const mAng = c?.mang ?? schoolParams.tiao
  for (let k = 1; k <= schoolParams.tiao; k++) {
    if (k <= mAng) {
      list.push({ layer: k, text: `第${CN[k]}跳 · 华栱自斗口出跳 30 分` })
      if (schoolParams.jiXin) {
        const next = k === mAng ? (c ? '，斗口再出昂' : '，斗口再出华栱') : '，斗口再出华栱'
        list.push({
          layer: k + 0.5,
          text: `跳头 · ${schoolParams.zhongGong ? '瓜子栱 + 慢栱' : '瓜子栱'}${next}`
        })
      }
    } else {
      const j = k - mAng
      list.push({
        layer: k - 0.5,
        text: `第${CN[k]}跳 · 第${CN[j]}昂自前跳头斗口斜出${j === aAng ? '，昂头承令栱' : '（昂上不安栱谓之偷心）'}`
      })
    }
  }
  if (!c) list.push({ layer: schoolParams.tiao + 1, text: '橑檐槫 —— 檐荷至此传回柱身' })
  return list
})
const puzuoName = computed(
  () => puzuoTitle(schoolParams.tiao, schoolParams.zhongGong, schoolParams.jiXin, schoolParams.ang)
)

// ── 拼装挑战 ──
interface SeqItem { key: string; name: string; wikiKey: string }
const game = reactive({
  params: { tiao: 1, zhongGong: false, jiXin: true, shuaTou: true } as PuzuoParams,
  phase: 'idle' as 'idle' | 'playing' | 'done',
  step: 0,
  wrong: 0,
  elapsed: 0,
  total: 0,
  tutorial: false,
  guided: false,
  lastPlaced: '',
  candidates: [] as { key: string; name: string }[],
  seq: shallowRef<SeqItem[]>([]),
  puzuoName: ''
})
const gameDraft = reactive({ tiao: 1, zhongGong: false, ang: false, tutorial: false, guided: false })
let timer: ReturnType<typeof setInterval> | undefined
let startedAt = 0
const shakeIdx = ref(-1)

function startGame() {
  game.params = { tiao: gameDraft.tiao, zhongGong: gameDraft.zhongGong, ang: gameDraft.ang, jiXin: true, shuaTou: true }
  game.phase = 'playing'
  game.step = 0
  game.wrong = 0
  game.elapsed = 0
  game.tutorial = gameDraft.tutorial || gameDraft.guided
  game.guided = gameDraft.guided
  game.guided = gameDraft.guided
  game.puzuoName = puzuoTitle(game.params.tiao, game.params.zhongGong, true, game.params.ang)
  startedAt = Date.now()
  clearInterval(timer)
  timer = setInterval(() => {
    if (game.phase === 'playing') game.elapsed = Math.round((Date.now() - startedAt) / 1000)
  }, 500)
  game.seq = []
  viewerParams.value = { ...game.params, nonce: (viewerParams.value.nonce ?? 0) + 1 } as PuzuoParams
  module.value = 'game'
  consoleOpen.value = false
}

function onSequence(seq: SeqItem[]) {
  if (module.value !== 'game') return
  game.seq = seq
  game.total = seq.length
  if (game.phase === 'playing' && game.step === 0) nextCandidates()
}

function nextCandidates() {
  const correct = game.seq[game.step]
  if (!correct) return
  if (game.tutorial) {
    // 新手教学：无干扰件，一次一件
    game.candidates = [{ key: correct.key, name: correct.name }]
    return
  }
  const otherNames = [...new Set(game.seq.map((s) => s.name))].filter((n) => n !== correct.name)
  for (let i = otherNames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[otherNames[i], otherNames[j]] = [otherNames[j], otherNames[i]]
  }
  const distract = otherNames.slice(0, 2).map((n) => ({ key: 'd:' + n, name: n }))
  const list = [{ key: correct.key, name: correct.name }, ...distract]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  game.candidates = list
}

function pick(i: number) {
  if (game.phase !== 'playing') return
  const c = game.candidates[i]
  if (c.name === game.seq[game.step]?.name) {
    game.step++
    game.lastPlaced = c.name
    if (game.step >= game.seq.length) {
      game.phase = 'done'
      clearInterval(timer)
      woodSound.complete()
      if (user.value) {
        saveRecord(user.value, {
          levelKey: `${game.params.tiao}-${game.params.zhongGong ? '重' : '单'}${game.params.ang ? '-昂' : ''}`,
          levelName: game.puzuoName,
          time: game.elapsed,
          wrong: game.wrong,
          rating: game.wrong === 0 ? '甲' : game.wrong <= 2 ? '乙' : '丙',
          at: new Date().toISOString().slice(0, 10)
        })
        myRecordList.value = loadRecords(user.value)
      }
    } else {
      nextCandidates()
    }
  } else {
    game.wrong++
    shakeIdx.value = i
    setTimeout(() => (shakeIdx.value = -1), 420)
    woodSound.wrong()
  }
}

// 教学提示：下一件的名称与角色
const tutorialHint = computed(() => {
  if (!game.tutorial || game.phase !== 'playing') return null
  const next = game.seq[game.step]
  if (!next) return null
  return { name: next.name, role: WIKI[next.wikiKey]?.role ?? '' }
})

// 引导模式：每步的教育文案
const GUIDE_TEXT: Record<string, { why: string; tip: string }> = {
  puaipai: { why: '先铺设普拍枋——它是斗栱的基座，所有构件都从它开始。', tip: '普拍枋横贯柱头，让每朵铺作有一个共同的坐面。' },
  ludou: { why: '在柱头安放栌斗——大斗是整朵铺作的承重起点，开口向上准备承托华栱。', tip: '注意栌斗的三个分区：耳、平、欹——开口在耳与耳之间。' },
  huagong: { why: '将华栱插入栌斗口内——它是唯一向外挑出的构件，像悬臂梁一样把檐口推出去。', tip: '华栱用足材（21分），比横栱更厚实——因为它承受的弯矩最大。' },
  'jiaohudou': { why: '在华栱跳头放交互斗——十字开口准备承接下一层。', tip: '交互斗的十字口很关键：一个方向接华栱，另一个方向接横栱。' },
  nidao: { why: '在栌斗口内安放泥道栱——它与华栱十字相交，负责沿墙面方向的横向连系。', tip: '泥道栱因常刷土朱而得名——"泥道"就是墙面的意思。' },
  sandou: { why: '在横栱两端各放一只散斗——它们将集中力分散传给上层构件。', tip: '"散"言其多——一朵八铺作中的散斗可达十数只。' },
  qixindou: { why: '在栱心正中放一只齐心斗——它恰好压在铺作的中轴线上。', tip: '齐心斗和散斗高度相同（10分），但位置不同——一在心，一在两端。' },
  zhutoufang: { why: '在斗上铺设柱头枋——它把各朵铺作串联成整体，让力沿墙面方向均匀传递。', tip: '柱头枋与泥道栱平行——它在铺作层的最上方，是"屋面"与"斗栱"的分界线。' },
  linggong: { why: '在最外跳头安放令栱——五瓣卷杀是它的身份特征，它是离屋檐最近的栱。', tip: '令栱长72分，比泥道栱长9分——因为它直接承托檐口荷载。' },
  shuatou: { why: '插入耍头——蚂蚱头从令栱上方探出，是铺作的装饰收笔，不承重。', tip: '在昂制铺作中，耍头的位置常被昂替代——它是华栱的"装饰替身"。' },
  liaoyan: { why: '安放橑檐槫——圆形截面，屋面椽子搭在它上面。整朵铺作的使命到此完成。', tip: '从椽到槫，从槫到令栱，从令栱到华栱——力沿着这条路径传回柱身。' },
  man: { why: '在瓜子栱上安放慢栱——它是重栱造的标志，让横向传力路径加倍。', tip: '慢栱长92分，是铺作中最长的栱——"慢"在从容跨得更远。' },
  guazi: { why: '在跳头安放瓜子栱——短横栱，将力分配到华栱的跳头上。', tip: '瓜子栱62分，比泥道栱短1分——差这1分就是身份的区别。' },
  xiaang: { why: '昂制铺作以斜代平——下昂斜置，昂尖探向檐口，用杠杆原理把出跳拉得更远。', tip: '昂尖批竹斜面指向檐口，昂尾翘入梁栿之下——一根斜木，撑起半个屋檐。' },
}

const guidedStep = computed(() => {
  if (!game.guided || game.phase !== 'playing') return null
  const item = game.seq[game.step]
  if (!item) return null
  const wikiKey = item.key.split('-')[0]
  const mapped = wikiKey === 'jiaohudou' ? 'jiaohidou' : wikiKey === 'xia' ? 'xiaang' : wikiKey
  const w = WIKI[mapped]
  const g = GUIDE_TEXT[mapped]
  return {
    name: item.name,
    why: g?.why ?? w?.role ?? '',
    tip: g?.tip ?? w?.hook ?? ''
  }
})

const rating = computed(() => (game.wrong === 0 ? '甲' : game.wrong <= 2 ? '乙' : '丙'))
const ratingText = computed(() =>
  game.wrong === 0 ? '一口气回位，没走错一步——匠人手感。' : game.wrong <= 2 ? '偶有踌躇，次序已入心。' : '次序还需多拆几遍——铺作不语，次序自明。'
)

// ── 参数工坊 ──
const grade = ref(3)
const wsParams = reactive<PuzuoParams>({ tiao: 3, zhongGong: true, jiXin: true, shuaTou: true })
const fenCm = computed(() => ((CAI_GRADES[grade.value - 1].hou / 10) * 31.2).toFixed(1))
const depthCm = computed(() => ((puzuoDepth(wsParams) * CAI_GRADES[grade.value - 1].hou) / 10 * 31.2 / 10).toFixed(0))
const heightCm = computed(() => ((puzuoHeight(wsParams) * CAI_GRADES[grade.value - 1].hou) / 10 * 31.2 / 10).toFixed(0))

// ── 榫卯谱 ──
const jointId = ref('yanwei')
const jointT = ref(1)
const jointMeta = ref<{ name: string; desc: string; source: string } | null>(null)

// ── 斗栱抗震 ──
const quakeOpts = reactive({ A: 16, freqHz: 2, mode: 'dougong' as 'dougong' | 'rigid', running: false })
const quakeStats = ref({ ratio: 1, peakG: 0, peakR: 0 })
const dampingPct = computed(() => Math.round(Math.max(0, (1 - quakeStats.value.ratio) * 100)))

function onQuakeStats(s: { ratio: number; peakG: number; peakR: number }) {
  quakeStats.value = s
}

// ── 用户与教程 ──
const user = currentUser
const tutorialOpen = ref(false)
const consoleOpen = ref(false)
const encyclopediaOpen = ref(false)
const encyclopediaInitial = ref('')
const myRecordList = ref<ReturnType<typeof loadRecords>>([])

function logoutUser() {
  logout()
  myRecordList.value = []
}

function openEncyclopedia(key?: string) {
  encyclopediaInitial.value = key ?? ''
  encyclopediaOpen.value = true
}

// 登录后：载入成绩；首次使用（v2 教程标记不存在）自动弹新手教程
watch(user, (u) => {
  if (!u) return
  myRecordList.value = loadRecords(u)
  try {
    if (!localStorage.getItem('yingzao-tutorial-v2-done')) tutorialOpen.value = true
  } catch {
    /* 无痕模式忽略 */
  }
}, { immediate: true })

onMounted(() => {
  if (user.value) myRecordList.value = loadRecords(user.value)
})

// ── 共用 ──
const viewerParams = ref<PuzuoParams & { nonce?: number }>({ ...DEFAULT_PARAMS })
// 学堂/工坊各自维护参数；viewer 需要的对象随模块切换。
// 工坊把 grade 写进 nonce：材等变化也要触发重建（缩放模型）。
watchEffect(() => {
  if (module.value === 'school') viewerParams.value = { ...schoolParams, nonce: 0 }
  else if (module.value === 'workshop') viewerParams.value = { ...wsParams, nonce: grade.value }
  else if (module.value === 'quake') viewerParams.value = { ...DEFAULT_PARAMS, nonce: 0 }
})
function switchModule(id: StudioModule) {
  if (id === module.value) return
  module.value = id
  explode.value = 0
  highlight.value = null
  selected.value = null
  woodSound.tick()
}
const milestoneText = computed(() => {
  const map: Record<string, string> = {
    school: '里程碑 M2 / M6 · 营造学堂',
    game: '里程碑 M3 / M6 · 拼装挑战',
    workshop: '里程碑 M4 / M6 · 参数工坊',
    joints: '里程碑 M4 / M6 · 榫卯谱',
    quake: '优化更新 · 斗栱抗震演示',
    palace: '里程碑 M5 / M6 · 营造之旅'
  }
  return map[module.value] ?? ''
})

const wiki = computed(() => {
  if (!selected.value) return null
  const base = selected.value.split('-')[0]
  const key = base === 'jiaohudou' ? 'jiaohidou' : base === 'xia' ? 'xiaang' : base
  return WIKI[key] ?? null
})

function onSelect(key: string | null) {
  selected.value = key
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.app { height: 100%; display: flex; flex-direction: column; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.9rem 1.6rem; border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(29, 23, 18, 0.92), rgba(21, 17, 13, 0.85)); z-index: 10;
}
.brand { display: flex; align-items: center; gap: 0.9rem; }
.seal {
  display: grid; place-items: center; width: 46px; height: 46px;
  border: 2px solid var(--cinnabar); color: var(--cinnabar);
  font-weight: 700; font-size: 1.05rem; letter-spacing: 0.1em; border-radius: 3px; line-height: 1.1; text-align: center;
}
.brand-text strong { display: block; font-size: 1.05rem; letter-spacing: 0.28em; }
.brand-text span { color: var(--faint); font-size: 0.72rem; letter-spacing: 0.18em; }
.modules { display: flex; gap: 0.4rem; }
.user-area { display: flex; align-items: center; gap: 0.3rem; margin-left: 0.6rem; }
.user-chip {
  color: var(--amber);
  border: 1px solid rgba(217, 164, 65, 0.35);
  border-radius: 2px;
  padding: 0.3em 0.8em;
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  white-space: nowrap;
}
.sound-toggle { font-size: 0.95rem; }
.ambient-toggle { font-size: 0.8rem; }
.ambient-toggle.on { color: var(--amber); border-color: rgba(217, 164, 65, 0.4); }
.auth-cta { border-color: rgba(217, 164, 65, 0.4); }
.module {
  font-family: var(--serif); background: transparent; border: 1px solid transparent;
  color: var(--dim); padding: 0.4em 0.7em; font-size: 0.82rem; letter-spacing: 0.1em; border-radius: 2px; cursor: pointer;
  white-space: nowrap;
}
.module:hover:not(:disabled) { color: var(--amber); }
.module.active { color: var(--amber); border-color: rgba(217, 164, 65, 0.45); background: rgba(217, 164, 65, 0.07); }
.module:disabled { color: var(--faint); opacity: 0.55; cursor: default; }

.stage-wrap { flex: 1; position: relative; overflow: hidden; }

.info-card {
  position: absolute; left: 1.4rem; bottom: 1.4rem; width: min(350px, calc(100vw - 2.8rem));
  background: rgba(26, 20, 14, 0.9); border: 1px solid var(--line); border-left: 3px solid var(--amber);
  border-radius: 3px; padding: 1.1rem 1.3rem; backdrop-filter: blur(6px);
}
.info-card.on { border-left-color: var(--cinnabar); }
.card-head { display: flex; align-items: baseline; gap: 0.8rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.card-head h3 { font-size: 1.25rem; letter-spacing: 0.2em; }
.alias { color: var(--faint); font-size: 0.75rem; letter-spacing: 0.12em; }
.dims { color: var(--amber); font-size: 0.83rem; margin-bottom: 0.45rem; }
.role { color: var(--dim); font-size: 0.9rem; }
.role b { color: var(--ink); }
.role .grade { color: var(--cinnabar); font-size: 1.4rem; }
.dims-table { display: flex; gap: 1.2rem; margin: 0.6rem 0 0.2rem; }
.dims-table div { display: flex; flex-direction: column; color: var(--faint); font-size: 0.7rem; letter-spacing: 0.15em; }
.dims-table b { color: var(--amber); font-size: 1rem; }
.src {
  margin-top: 0.7rem; padding-top: 0.6rem; border-top: 1px dashed var(--line);
  color: var(--faint); font-size: 0.75rem; display: flex; gap: 0.7em; align-items: baseline;
}
.src-label { border: 1px solid var(--line); padding: 0.05em 0.5em; border-radius: 2px; flex-shrink: 0; }
.hook { margin-top: 0.55rem; color: var(--ink); font-size: 0.9rem; }

.guided-card {
  background: rgba(217, 164, 65, 0.06);
  border: 1px solid rgba(217, 164, 65, 0.25);
  border-radius: 3px;
  padding: 0.8rem 1rem;
  margin: 0.5rem 0;
}
.gd-name { color: var(--amber); font-size: 1.05rem; font-weight: bold; letter-spacing: 0.1em; margin-bottom: 0.4rem; }
.gd-why { color: var(--ink); font-size: 0.85rem; line-height: 1.7; margin-bottom: 0.4rem; }
.gd-tip { color: var(--faint); font-size: 0.78rem; line-height: 1.6; }

.console {
  position: absolute; right: 1.4rem; top: 1rem; width: min(280px, calc(100vw - 2.8rem));
  background: rgba(26, 20, 14, 0.9); border: 1px solid var(--line); border-radius: 3px;
  padding: 1rem 1.1rem; backdrop-filter: blur(6px); max-height: calc(100% - 2.5rem); overflow-y: auto;
}
.sec { margin-bottom: 1rem; }
.sec.row { display: flex; align-items: center; justify-content: space-between; }
.sec-label { display: block; color: var(--faint); font-size: 0.72rem; letter-spacing: 0.28em; margin-bottom: 0.5rem; }
.seg { display: flex; gap: 0.3rem; }
.seg-btn {
  flex: 1; font-family: var(--serif); background: transparent; border: 1px solid var(--line);
  color: var(--dim); padding: 0.35em 0; font-size: 0.85rem; letter-spacing: 0.1em; border-radius: 2px; cursor: pointer; transition: all 0.2s;
}
.seg-btn:hover { border-color: var(--amber); color: var(--amber); }
.seg-btn.active { border-color: var(--amber); color: var(--amber); background: rgba(217, 164, 65, 0.1); }
.joints-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem; }
.btn.wide { width: 100%; justify-content: center; }
.enc-btn { width: 100%; justify-content: center; margin-top: 0.8rem; }
.tip { color: var(--faint); font-size: 0.75rem; letter-spacing: 0.08em; }
.switch {
  width: 42px; height: 22px; border-radius: 11px; border: 1px solid var(--line);
  background: var(--bg); position: relative; cursor: pointer; transition: all 0.25s;
}
.switch i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--faint); transition: all 0.25s; }
.switch.on { border-color: var(--amber); background: rgba(217, 164, 65, 0.15); }
.switch.on i { left: 22px; background: var(--amber); }
.slider { width: 100%; accent-color: var(--amber); }
.steps { list-style: none; }
.steps li {
  color: var(--dim); font-size: 0.82rem; padding: 0.32em 0.5em;
  border-left: 2px solid var(--line); margin-left: 0.2em; cursor: default; transition: all 0.15s;
}
.steps li:hover, .steps li.on { color: var(--amber); border-left-color: var(--amber); background: rgba(217, 164, 65, 0.07); }
.cite {
  margin: 0.5rem 0 0; padding: 0.5rem 0.65rem; font-size: 0.72rem; line-height: 1.7;
  color: rgba(230, 214, 178, 0.62); border-left: 2px solid rgba(217, 164, 65, 0.35);
  background: rgba(217, 164, 65, 0.05);
}
.cite span { display: block; margin-top: 0.25rem; text-align: right; color: rgba(217, 164, 65, 0.75); }
.place { margin: 0.35rem 0 0; font-size: 0.78rem; color: var(--amber); letter-spacing: 0.04em; }
.build-chain { margin-top: 0.8rem; padding-top: 0.65rem; border-top: 1px dashed rgba(217, 164, 65, 0.3); }
.bc-title { margin: 0 0 0.45rem; font-size: 0.72rem; letter-spacing: 0.18em; color: rgba(217, 164, 65, 0.9); }
.bc-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.bc-node {
  font-size: 0.72rem; padding: 2px 7px; border-radius: 3px; white-space: nowrap;
  border: 1px solid rgba(230, 214, 178, 0.28); color: rgba(230, 214, 178, 0.78);
  transition: all 0.2s;
}
.bc-node.hot {
  border-color: var(--amber); color: var(--amber);
  background: rgba(217, 164, 65, 0.14); box-shadow: 0 0 10px rgba(217, 164, 65, 0.25);
}
.bc-arrow { font-style: normal; font-size: 0.68rem; color: rgba(217, 164, 65, 0.45); }
.bc-desc { margin: 0.5rem 0 0; font-size: 0.76rem; line-height: 1.7; color: rgba(230, 214, 178, 0.85); }
.bc-desc b { color: var(--amber); }
.bc-note { margin: 0.5rem 0 0; font-size: 0.72rem; line-height: 1.75; color: rgba(230, 214, 178, 0.55); }
.nav-toggle { flex-shrink: 0; }

.tray {
  position: absolute; left: 50%; bottom: 1.2rem; transform: translateX(-50%);
  display: flex; gap: 0.8rem; z-index: 20;
}
.tray-card {
  font-family: var(--serif);
  min-width: 7.2em;
  padding: 0.7em 1.4em;
  background: linear-gradient(180deg, #241c13, #1a140e);
  border: 1px solid rgba(217, 164, 65, 0.5);
  color: var(--ink); font-size: 1.05rem; letter-spacing: 0.3em; border-radius: 3px;
  cursor: pointer; transition: transform 0.15s, box-shadow 0.2s, border-color 0.2s;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}
.tray-card:hover { transform: translateY(-4px); border-color: var(--amber); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.6); }
.tray-card.shake { animation: shake 0.4s; border-color: var(--cinnabar); color: var(--cinnabar); }
@keyframes shake {
  20% { transform: translateX(-7px); } 40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); } 80% { transform: translateX(3px); }
}

.hint { position: absolute; left: 1.4rem; top: 1rem; color: var(--faint); font-size: 0.75rem; letter-spacing: 0.22em; pointer-events: none; }
.console-toggle { display: none; }
.milestone {
  position: absolute; left: 50%; bottom: 1rem; transform: translateX(-50%);
  color: var(--faint); font-size: 0.68rem; letter-spacing: 0.22em; pointer-events: none;
}
@media (max-width: 860px) {
  .topbar { padding: 0.6rem 0.9rem; }
  .seal { width: 36px; height: 36px; font-size: 0.85rem; }
  .brand-text strong { font-size: 0.9rem; letter-spacing: 0.12em; }
  .brand-text span { display: none; }
  .user-chip { display: none; }
  .modules { display: none; }
  .console-toggle {
    display: inline-flex;
    position: absolute;
    right: 1rem;
    top: 1rem;
    font-family: var(--serif);
    background: rgba(26, 20, 14, 0.9);
    border: 1px solid rgba(217, 164, 65, 0.45);
    color: var(--amber);
    font-size: 0.8rem;
    letter-spacing: 0.15em;
    padding: 0.4em 0.9em;
    border-radius: 2px;
    z-index: 30;
  }
  .console { display: none; top: 3.6rem; max-height: 58%; }
  .console.open { display: block; }
  .info-card { display: none; left: 0.8rem; bottom: 0.8rem; width: calc(100vw - 1.6rem); max-height: 46%; overflow-y: auto; }
  .info-card.on { display: block; }
  .tray { width: calc(100vw - 1.6rem); }
  .tray-card { min-width: 0; flex: 1; font-size: 0.92rem; padding: 0.6em 0.6em; }
  .palace-caption { font-size: 1rem; white-space: normal; text-align: center; width: calc(100vw - 2rem); }
}
</style>
