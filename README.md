写在前面的话：
你好我叫AYGY暗夜古韵
或者你可以叫我
ANSE安娜斯千

贴纸与形象来自虚拟歌姬「防风Zephyr」企划组，随插件一起分发前请确认你拥有分发权。
关注防风Zephyr

# 防风挂件 Zephyr（dsh-zephyr-widget）

DSH Web UI 右下角的小挂件：一张可拖动的「防风 / Zephyr」Q 版贴纸，会跟着会话状态换表情，
点一下有台词和音效，底下还能看今日花费和峰谷时段。

> 包名里的 `zephyr` 是角色英文名；中文名仍是「防风」。npm 包名只允许小写，
> 所以写 `dsh-zephyr-widget` 而不是 `dsh-Zephyr-widget`。

## 功能

- **贴纸形象**：12 张表情，点击随机换一张，默认站着的那张是「比心」
- **会话联动**：干活中 / 等你确认 / 完成 自动换表情；手动点过之后 8 秒内优先显示你选的那张
- **峰谷与花费**：今日花费（余额观测估算）、当前是峰价还是谷价、距离下次切换的倒计时（`HH:MM`）；
  节假日表覆盖 2026 全年 + 2027（2027 按农历推算，官方调休公布后替换 `index.js` 里那一段即可）
- **设置面板**：点右上角的三点按钮打开；大小 88–220px、随机换表情间隔 8–90s、点击音效、
  常用台词、显示/隐藏花费条、重置状态
- **等待确认**：角色背后一圈黄色呼吸光环 + 左上角「!」气泡；光环可在菜单关掉
- **点击反馈**：换表情时角色背后扩出光环，两种样式可选——
  **圆环**（一圈实线向外扩，0.7s）或 **星芒**（内 16 根顺时针、外 16 根逆时针反向转）；
  颜色有黄 / 青绿 / 粉 / 白，也可以关掉
- **可拉伸菜单**：菜单右下角拖拽改高度，高度会记住；内容超高时自带滚动条
- 位置、大小、开关全部存在浏览器 localStorage

## 安装
最快的方式（已发布到 npm）：

```bash
dsh plugin --profile web add dsh-zephyr-widget
```bash
dsh plugin --profile web add github:AYGYSKY/zephyr-widget
```
> 需要 DSH **44.7.0 或更高**。

### 方式 A：从 Releases 下载（推荐）

到 [Releases](https://github.com/AYGYSKY/zephyr-widget/releases) 下载最新的
`dsh-zephyr-widget-x.y.z.tgz`，然后在 DSH 里对助手说：

> 装一下这个插件：<你保存它的位置>\dsh-zephyr-widget-0.3.36.tgz

助手会用插件管理器（`install_bundle`，target 指向这个 tgz）装上。
装完 **刷新页面**（Ctrl+Shift+R）就能看到右下角的小人。

### 方式 B：解压到目录再装

```bash
mkdir -p ~/.dsh/plugins/zephyr-widget
tar -xzf dsh-zephyr-widget-0.3.36.tgz -C ~/.dsh/plugins/zephyr-widget --strip-components=1
```

然后让助手装这个目录：`装一下那个 zephyr-widget 目录`（target 指向目录，装的是 link 版本，
之后改文件即时生效，适合自己开发时用）。

### 方式 C：发布到 npm 后按包名装

去掉 `package.json` 里的 `"private": true`，`npm publish` 之后让助手：

> 装一下 dsh-zephyr-widget 这个插件

### 卸载

对助手说「卸载 dsh-zephyr-widget」，或直接在插件管理器里移除该 bundle，然后刷新页面。

### 从 0.3.7 及更早的 windbreak 版本升级

旧包名是 `dsh-windbreak-widget`，先卸载旧的再装新的即可。偏好设置（localStorage 键
`dsh.windbreak-widget.*`）和今日花费账本（`~/.dsh/.windbreak-usage.json`）都刻意沿用了旧名，
**不会因为改名丢失**。

## 要求

- DSH 需要带 Web 界面（挂件注册在 `shell.overlay` 这一层，Web 版和桌面壳都有）
- 花费/峰谷那一行依赖宿主提供 `deepseekAccount` 服务；拿不到余额时这行**自动隐藏**，
  不会显示假数字，挂件本体照常工作
- 数据都在本机：不联网、不外发，HTTP 路由只服务回环地址（外部 Host / 跨站 Origin 一律 403）

## 隐私与数据

- 余额只从宿主账号服务读，不落盘
- 记账文件：`~/.dsh/.windbreak-usage.json`（只存「今日起点余额 / 最新余额」两个整数，
  不存任何账号信息；文件名沿用旧名以保住历史数据）。当天首次观测晚于 00:10 时，
  今日花费前面会带 `~` 表示估算
- 所有偏好都在浏览器 localStorage，前缀 `dsh.windbreak-widget.`（同上，刻意沿用旧前缀）

## 目录结构

```
zephyr-widget/
├── package.json        # 包清单：dsh.bundle.patch + dsh.client
├── cordis.patch.yml    # 往 harness 里 insert 这个插件
├── index.js            # host 侧：/zephyr/usage.json（余额 + 峰谷 + 今日花费）
├── client.template.js  # 源码：挂件与设置面板（图片用 __STICKERS__ 占位）
├── client.js           # 构建产物：12 张 webp 以 base64 内联，约 290 KB
├── icon.png
├── locale/{zh,en}.json
├── assets/             # 12 张 256px webp + assets.json（重新构建用）
├── tools/              # build.js / pack.py / smoke.mjs / process.py / sheet.py / make_pulse_styles.py
├── preview/            # 界面示意图（手绘 mock，非真实截图）
│   ├── overview.png/.pdf   # 功能总览（1600×1000）
│   ├── pulse-styles.png    # 两种点击光环
│   ├── waiting-ring.png    # 等待确认状态
│   ├── layout2.png         # 布局与齿轮位置
│   ├── named.png           # 12 张表情命名
│   ├── processed.png       # 素材处理结果
│   └── _archive/           # 早期迭代稿（contact / hud2 / layout / menu / menu2 / menu3）
└── dist/               # 打好的 tgz
```

## 开发

```bash
node tools/build.js      # assets/assets.json + client.template.js → client.js
node tools/smoke.mjs     # 用假的 ModuleLoader/React 跑一遍，检查菜单/HUD/点击
python tools/pack.py     # 按 package.json 的 version 生成 dist/*.tgz
```

## 素材说明

贴纸与形象来自虚拟歌姬「防风Zephyr」企划组，随插件一起分发前请确认你拥有分发权。
