# 回答问题需要遵守

使用中文回答

# 禁止

禁止修改module_live_telemetry, acc-coach, module_dashboard_protocol, acctlm_core, ld_to_acctlm这5个子模块，如果需要这些模块修改内容，告诉用户。

# 文档撰写

当用户让你撰写文档时，仅允许将文档写入`./docs/module_local_dashboard`目录中。

在docs/module_local_dashboard中，主要有3个目录，分别为：
 - audit：写入审计文档
 - prd：写入需求文档，该需求文档主要是指module_local_dashboard写的需求，需要其余子模块实现的功能
 - public-protocol：和其余子模块的交互协议（命令协议和数据协议）、交互逻辑等相关文档写入该目录。
