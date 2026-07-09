# Wordle 中文版

仿"不背单词"App 风格的 Wordle 游戏。

## 在线访问

GitHub Pages: https://pinesis688.github.io/test/

## 功能

- 5 难度 (高考/四级/六级/考研/雅思) × 4 长度 (4-7字母)
- 高考词库紧扣新课标 3500 词(参考维克托英语),考点释义 100% 覆盖
- 提示锁定 (跨行持久)、排除字母、限时模式
- 词库浏览:难度/长度筛选 + 分页 + 成语专区(150+ 常用成语)
- 2143 词中文释义 + 2683 词牛津级释义 (Free Dictionary API, CC-BY-SA)
- 签到系统、猜词分布统计、分享结果
- 游戏中查词、词库搜索(支持按释义搜词)

## 项目结构

```
├── index.html          # HTML 结构
├── css/style.css       # 样式
├── js/
│   ├── config.js       # 状态与常量
│   ├── game.js         # 游戏逻辑
│   ├── ui.js           # 界面交互
│   └── main.js         # 入口与事件绑定
├── data/
│   ├── vocab.js        # 词库 (5难度×4长度)
│   ├── mean.js         # 简版中文释义 (高考考纲2143词)
│   ├── dict.js         # 词典 (音标/词性/多义项/例句)
│   └── idiom.js        # 成语库 (150+条)
└── tests/run.js        # 端到端测试 (jsdom)
```

## 数据源

- 高考词库: 新课标 3500 词(参考维克托英语高考词汇),已剔除非考纲生僻词
- Free Dictionary API (dictionaryapi.dev) - CC-BY-SA
- 手工中文释义(考点常用义优先)

## 本地运行

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

## 测试

```bash
npm install
npm test
```

覆盖:词库完整性、释义覆盖率、游戏核心流程(猜中/判负/异步锁)、
countCandidates 约束求解、useExclude 答案泄露防护、词库 UI。
