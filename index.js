/**
 * Host half of the zephyr widget bundle (防风挂件).
 *
 * The Client module owns rendering; this half owns the one thing a browser cannot
 * know on its own: how much the account has spent, and whether we are currently
 * inside a peak-price window.
 *
 * Everything is served from a single named route, `/zephyr/usage.json`:
 *
 *   { ok, now, balance, currency, todaySpend, peak: { active, nextChangeAt } }
 *
 * The route is registered through the optional `webServer` service inside
 * `ctx.inject`, so a host without a web server simply never binds it instead of
 * failing the whole plugin.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
// 账本文件名保持旧名：里面记的是「今天从多少余额开始」，改名会让今日花费重新起算。
const LEDGER_FILE = path.join(DSH_HOME, '.windbreak-usage.json')
const ROUTE_PATH = '/zephyr/usage.json'

/** Balance is a network call: keep one answer for a while. */
const BALANCE_TTL_MS = 45 * 1000
/** Integer money units, mirroring the accounting convention (avoids float drift). */
const SCALE = 100000000

// ---------------------------------------------------------------------------
// Peak / valley (北京时间, 与 dsh-whale-widget 的规则保持一致)
// ---------------------------------------------------------------------------

/** 工作日高峰时段，左闭右开。 */
const PEAK_HOURS = [[9, 12], [14, 18]]

/**
 * 价格日历生效起点（epoch 秒）：
 *  - 北京 2026-08-23 00:00 起，周末全谷价
 *  - 北京 2026-09-19 00:00 起，法定节假日全谷价
 * 在此之前的历史时间按「只有工作日时段算峰」处理，避免回看旧数据时讲错。
 */
const WEEKEND_VALLEY_FROM_SEC = Math.floor(Date.UTC(2026, 7, 22, 16, 0, 0) / 1000)
const HOLIDAY_VALLEY_FROM_SEC = Math.floor(Date.UTC(2026, 8, 18, 16, 0, 0) / 1000)

/**
 * 法定节假日（北京日期，YYYY-MM-DD）。每年 11 月补下一年；
 * 2026 年之前的日子都在生效起点之前，写了也只会被忽略，保留是为了可读性。
 */
const HOLIDAY_VALLEY = new Set([
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
  '2027-01-01', '2027-01-02', '2027-01-03',
  // 2027 年按农历推算，官方调休方案一般在前一年年底公布，届时替换这一段即可。
  '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09',
  '2027-02-10', '2027-02-11',
  '2027-04-03', '2027-04-04', '2027-04-05',
  '2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04', '2027-05-05',
  '2027-06-09', '2027-06-10', '2027-06-11',
  '2027-09-15', '2027-09-16', '2027-09-17',
  '2027-10-01', '2027-10-02', '2027-10-03', '2027-10-04',
  '2027-10-05', '2027-10-06', '2027-10-07',
])

const pad2 = (n) => (n < 10 ? '0' + n : String(n))

/** 把一个 epoch 秒拆成北京时间的年月日时分与星期。 */
function beijingParts(timeSec) {
  const t = new Date(Math.floor(Number(timeSec) * 1000) + 8 * 3600000)
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    date: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    dow: t.getUTCDay(),
  }
}

function beijingDayKey(timeSec) {
  const p = beijingParts(timeSec)
  return p.year + '-' + pad2(p.month) + '-' + pad2(p.date)
}

function inPeakHours(hour) {
  for (let i = 0; i < PEAK_HOURS.length; i += 1) {
    const from = PEAK_HOURS[i][0]
    const to = PEAK_HOURS[i][1]
    if (hour >= from && hour < to) return true
  }
  return false
}

/** 该时刻是否处在高峰（峰价）时段。 */
export function isPeakTime(timeSec) {
  const sec = Math.floor(Number(timeSec))
  if (!Number.isFinite(sec)) return false
  const p = beijingParts(sec)
  // 周末：生效起点之后全谷价
  if (p.dow === 0 || p.dow === 6) {
    if (sec >= WEEKEND_VALLEY_FROM_SEC) return false
    return inPeakHours(p.hour)
  }
  // 法定节假日：生效起点之后全谷价
  if (sec >= HOLIDAY_VALLEY_FROM_SEC && HOLIDAY_VALLEY.has(beijingDayKey(sec))) return false
  return inPeakHours(p.hour)
}

/**
 * 下一个「峰谷状态发生变化」的时刻（epoch 秒），最多向后找 12 天。
 * 状态只可能在 0/9/12/14/18 点这些边界上翻转，所以只扫这些点。
 */
export function nextPeakChangeAt(timeSec) {
  const sec = Math.floor(Number(timeSec))
  if (!Number.isFinite(sec)) return null
  const current = isPeakTime(sec)
  const base = Math.floor(sec / 3600) * 3600
  const limit = 24 * 12
  for (let i = 1; i <= limit; i += 1) {
    const candidate = base + i * 3600
    const hour = beijingParts(candidate).hour
    if (hour !== 0 && hour !== 9 && hour !== 12 && hour !== 14 && hour !== 18) continue
    if (isPeakTime(candidate) !== current) return candidate
  }
  return null
}

// ---------------------------------------------------------------------------
// 今日花费：余额观测差（不是交易接口，只是「账户余额今天掉了多少」）
// ---------------------------------------------------------------------------

function toUnits(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * SCALE)
}

function readLedger() {
  try {
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const day = String(parsed.day || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
    const openingUnits = Number(parsed.openingUnits)
    const lastUnits = Number(parsed.lastUnits)
    if (!Number.isSafeInteger(openingUnits) || !Number.isSafeInteger(lastUnits)) return null
    return {
      day,
      openingUnits,
      lastUnits,
      lastAt: Number(parsed.lastAt) || 0,
      openedAt: Number(parsed.openedAt) || 0,
      currency: typeof parsed.currency === 'string' ? parsed.currency : 'CNY',
    }
  } catch (err) {
    return null
  }
}

function writeLedger(row) {
  try {
    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true })
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(row) + '\n', 'utf8')
  } catch (err) {
    // 记账失败不影响本次展示，下一次观测会重试。
  }
}

/**
 * 用当前余额更新账本，返回 { todaySpend, partial }。
 *
 *  今日花费 = 当日起点余额 - 当前余额
 *
 * 余额上升（充值 / 赠金到账）时不把差值算成负数：把起点整体平移，保持已记录的消费不变。
 */
function observeBalance(balance, currency, now) {
  const units = toUnits(balance)
  if (units === null) return { todaySpend: null, partial: true }
  const day = beijingDayKey(Math.floor(now / 1000))
  const row = readLedger()
  let openingUnits
  let openedAt
  if (!row || row.day !== day) {
    // 新的一天：以此刻余额为起点；当天更早的消费无从得知，标记为部分数据。
    openingUnits = units
    openedAt = now
  } else {
    openingUnits = row.openingUnits
    openedAt = Number(row.openedAt) || now
    // 余额变多（充值 / 赠金）：把起点同步抬高，别把充值记成负消费。
    // 余额变少就是正常消费，起点不动 —— 否则当天花掉的钱会被抹平。
    if (units > row.lastUnits) openingUnits += units - row.lastUnits
  }
  writeLedger({ day, openingUnits, lastUnits: units, lastAt: now, openedAt, currency })
  const spent = (openingUnits - units) / SCALE
  // 当天第一次观测离 00:00 太久 ⇒ 这之前的消费没被记进账本，数字偏小。
  const dayStartMs = Date.parse(day + 'T00:00:00+08:00')
  const partial = !Number.isFinite(dayStartMs) || openedAt - dayStartMs > 10 * 60 * 1000
  return { todaySpend: spent > 0 ? spent : 0, partial }
}

// ---------------------------------------------------------------------------
// 余额：DeepSeek 账号服务（可选服务，必须用 ctx.get 读）
// ---------------------------------------------------------------------------

let balanceCache = { at: 0, value: null }

async function readBalance(ctx, now) {
  if (now - balanceCache.at < BALANCE_TTL_MS) return balanceCache.value
  let value = null
  try {
    const account = typeof ctx.get === 'function' ? ctx.get('deepseekAccount') : null
    if (account && typeof account.getBalance === 'function') {
      const result = await account.getBalance({
        version: String(process.env.DSH_CLIENT_VERSION || process.env.DSH_VERSION || '') || 'unknown',
        locale: String(process.env.DSH_LOCALE || '') || 'zh_CN',
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      })
      if (result && result.status === 'ready') {
        const normal = Array.isArray(result.value) ? result.value : []
        const bonus = Array.isArray(result.bonusWallets) ? result.bonusWallets : []
        const wallets = normal.concat(bonus).filter((w) => w && Number.isFinite(Number(w.balance)))
        if (wallets.length > 0) {
          const summed = wallets.reduce((acc, w) => acc + Number(w.balance), 0)
          const pick = wallets.find((w) => String(w.currency || '').toUpperCase() === 'CNY') || wallets[0]
          value = { balance: summed, currency: String(pick.currency || 'CNY').toUpperCase() }
        }
      }
    }
  } catch (err) {
    value = null
  }
  balanceCache = { at: now, value }
  return value
}

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

/** 只服务本机页面：Host 必须是回环地址，跨站 Origin 一律拒绝。 */
function originAllowed(req) {
  const host = String(req.headers.host || '').toLowerCase()
  const hostname = host.replace(/:\d+$/, '').replace(/^\[/, '').replace(/\]$/, '')
  const loopback = hostname === 'localhost'
    || hostname === '::1'
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  if (!loopback) return false
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(String(origin)).host.toLowerCase() === host
  } catch (err) {
    return false
  }
}

export function apply(ctx) {
  ctx.inject(['webServer'], (scope) => {
    const dispose = scope.webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: (req, res) => {
        if (!originAllowed(req)) {
          sendJson(res, 403, { ok: false, error: 'forbidden' })
          return
        }
        const now = Date.now()
        const nowSec = Math.floor(now / 1000)
        Promise.resolve(readBalance(ctx, now)).then((wallet) => {
          const peakActive = isPeakTime(nowSec)
          const nextChangeAt = nextPeakChangeAt(nowSec)
          const body = {
            ok: true,
            now,
            peak: { active: peakActive, nextChangeAt },
            peakHours: PEAK_HOURS,
            balance: null,
            currency: null,
            todaySpend: null,
            partial: false,
          }
          if (wallet) {
            body.balance = wallet.balance
            body.currency = wallet.currency
            const spent = observeBalance(wallet.balance, wallet.currency, now)
            body.todaySpend = spent.todaySpend
            body.partial = spent.partial === true
          }
          sendJson(res, 200, body)
        }).catch((err) => {
          sendJson(res, 500, { ok: false, error: String((err && err.message) || err).slice(0, 200) })
        })
      },
    })
    scope.effect(() => () => {
      try {
        if (typeof dispose === 'function') dispose()
      } catch (err) {
        // 路由已经不在表里时忽略。
      }
    })
  })
}
