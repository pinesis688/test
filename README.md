# Wordle 中文版

仿"不背单词"App 风格的 Wordle 游戏。

## 在线访问

GitHub Pages: https://pinesis688.github.io/test/

## 功能

- 5 难度 (高考/四级/六级/考研/雅思) × 4 长度 (4-7字母)
- 提示锁定 (跨行持久)、排除字母、限时模式
- 2683+ 词牛津级释义 (Free Dictionary API, CC-BY-SA)
- 签到系统、猜词分布统计、分享结果
- 游戏中查词、词库搜索

## 项目结构

```
├── index.html          # HTML 结构
├── css/style.css       # 样式
├── js/
│   ├── config.js       # 状态与常量
│   ├── game.js         # 游戏逻辑
│   ├── ui.js           # 界面交互
│   └── main.js         # 入口与事件绑定
└── data/
    ├── vocab.js        # 词库 (5难度×4长度)
    ├── mean.js         # 简版中文释义
    └── dict.js         # 词典 (音标/词性/多义项/例句)
```

## 数据源

- Free Dictionary API (dictionaryapi.dev) - CC-BY-SA
- enable1.txt 词表 - LGPL
- 手工中文翻译

## 本地运行

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```
