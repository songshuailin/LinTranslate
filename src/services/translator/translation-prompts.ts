export function buildNaturalTranslationRules(targetLanguage: string): string {
  return `翻译要求：
- 只输出${targetLanguage}译文。不要解释、注释或前缀。
- 不要总结，不要扩写，不要添加原文没有的信息。
- 不要逐字直译；英文习语、技术隐喻、产品表达要按中文语境意译。
- UI 和技术术语要准确，例如 toolbar 译为“工具栏”，state machine 译为“状态机”，happy path 可译为“理想路径/正常流程”。
- 遇到长句可以适当拆句，让译文自然、准确、适合中文阅读。
- 尽量保留原文的换行和段落结构。
- 代码、命令、路径、变量名、函数名、API 名称等专有内容不要错误翻译。
- 代码注释、文档字符串、日志、错误信息、README、界面文案等自然语言需要翻译。`.trim()
}
