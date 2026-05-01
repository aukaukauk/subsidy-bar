<p align="right"><a href="README.md">English</a></p>

# SubsidyBar

SubsidyBar 是一个面向 Codex 用户的轻量 SwiftBar 菜单栏工具。

它显示本地 Codex 用量按 API 价格折算后的估算价值，并扣除相应周期内的订阅费分摊。

SubsidyBar 的前提是：统计的 Codex 用量没有接入第三方 API provider 或 gateway。如果本地 Codex 日志里混入了第三方 API 用量，SubsidyBar 不能自动把它和订阅额度区分开。

```text
-$201
```

这个数字表示：如果当前周期内的 Codex 用量按 API-equivalent 价格计费，它会比订阅费分摊高出约 `$201`。

这是一个用于可视化和对比的估算工具，不是账单工具。

## 统计范围

SubsidyBar 目前只支持 **Codex**。

如果你在同一份本地日志里使用多个已订阅的 Codex 账号，就把这些账号的每月订阅费加总后填进去。SubsidyBar 不单独区分账号。

它通过 `@ccusage/codex` 读取本地 Codex 用量，默认包含：

```text
~/.codex/sessions
~/.codex/archived_sessions
```

归档的 session 默认也会统计。SubsidyBar 会临时创建一个合并后的 `CODEX_HOME` 给 ccusage 读取，不会修改你真实的 Codex 日志。

## 安装到 SwiftBar

先安装 [SwiftBar](https://swiftbar.app/)。

然后运行：

```bash
npx --yes subsidybar setup
```

安装时 SubsidyBar 会在终端里询问：

```text
SwiftBar Plugin Folder
每月订阅费总额
每周刷新时间
```

默认插件目录是：

```text
~/SubsidyBar
```

如果你已经在使用 SwiftBar，就填你现有的 Plugin Folder。如果没有，就直接回车，并在 SwiftBar 要求选择 Plugin Folder 时选择 `~/SubsidyBar`。

安装器会生成：

```text
~/SubsidyBar/subsidybar.5m.sh
```

这个文件是一个很小的 bash wrapper。发布到 npm 后，它会调用：

```bash
npx --yes subsidybar@<setup-version> swiftbar
```

生成的 wrapper 会固定到 setup 时使用的 SubsidyBar 版本。需要更新 SwiftBar 插件命令时，重新运行 setup 即可。

如果你的 SwiftBar 使用了自定义插件目录：

```bash
npx --yes subsidybar setup --dir "/path/to/your/plugin-folder"
```

## 本地开发

在这个仓库里可以直接运行：

```bash
./bin/subsidybar status
./bin/subsidybar details
./bin/subsidybar swiftbar
./bin/subsidybar config
./bin/subsidybar setup
```

当前项目依赖 Node.js 24+，因为它直接运行 TypeScript。

## 配置

配置文件保存在：

```text
~/.config/subsidybar/config.json
```

查看当前配置：

```bash
subsidybar config
```

设置每月订阅费总额：

```bash
subsidybar config set subscription 100
```

设置统计周期：

```bash
subsidybar config set period quota
subsidybar config set period week
subsidybar config set period month
```

设置或重置 Codex 每周刷新时间：

```bash
subsidybar config set reset "Mon 23:08"
subsidybar config set reset auto
```

`quota` 会使用 Codex 的每周周期。周周期会把每月订阅费总额除以 4，`month` 会使用完整的每月订阅费总额。

这个周分摊是一个简单估算。例如 `$100/mo` 会按 `$25/week` 处理，不按全年周数重新年化。

用量来自 ccusage 的 daily 聚合结果。如果额度刷新发生在一天中间，SubsidyBar 会从下一个本地日期开始统计，避免把刷新前的用量混入新周期。

## SwiftBar 菜单

菜单栏显示估算补贴金额。

下拉菜单只保留必要信息：

```text
Quota: Apr 28 - Apr 30
Vendor loss: -$201
API value: $226.00
Subscription: $25 ($100/mo)
Tokens: 278.00M
Reset: May 4 23:08
```

如果 API-equivalent value 低于订阅费分摊，这一行会显示为 `Unused allocation`，而不是 `Vendor loss`。

你可以直接在下拉菜单里切换周期和订阅费。

## 注意

SubsidyBar 使用 ccusage 的 API-equivalent 价格估算。它不是 OpenAI 官方账单，也不代表 Codex 订阅真实内部成本。

补贴金额的含义建立在“被统计的 Codex 用量来自订阅额度”这个前提上。第三方 API 用量不应该混入被统计的 Codex 日志。

如果以后 `@ccusage/codex` 改了 archived sessions 的读取方式，SubsidyBar 可能需要做一点调整。
