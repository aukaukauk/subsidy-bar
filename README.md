<p align="right"><a href="README.zh-CN.md">中文</a></p>

# SubsidyBar

SubsidyBar is a lightweight SwiftBar menu item for Codex users.

It displays the API-equivalent value of local Codex usage after subtracting the relevant subscription allocation.

```text
-$201
```

That number means the current-period Codex usage would cost about `$201` more than the allocated subscription amount if priced at API-equivalent rates.

This is an estimate for visibility and comparison. It is not a billing tool.

## What It Tracks

SubsidyBar currently supports **Codex only**.

It reads local Codex usage through `@ccusage/codex`, using:

```text
~/.codex/sessions
~/.codex/archived_sessions
```

Archived sessions are included by default. SubsidyBar creates a temporary merged `CODEX_HOME` for ccusage and does not modify your real Codex logs.

## Install For SwiftBar

Install [SwiftBar](https://swiftbar.app/) first.

Then run:

```bash
npx --yes subsidybar setup
```

During setup, SubsidyBar asks for:

```text
SwiftBar Plugin Folder
Monthly subscription USD
Weekly reset time
```

The default plugin directory is:

```text
~/SubsidyBar
```

If you already use SwiftBar, enter your existing Plugin Folder. If not, press Enter and choose `~/SubsidyBar` when SwiftBar asks for a Plugin Folder.

The installer generates:

```text
~/SubsidyBar/subsidybar.5m.sh
```

That file is a small bash wrapper. Published npm installs call:

```bash
npx --yes subsidybar@latest swiftbar
```

For a custom SwiftBar plugin folder:

```bash
npx --yes subsidybar setup --dir "/path/to/your/plugin-folder"
```

## Local Development

From this repo:

```bash
./bin/subsidybar status
./bin/subsidybar details
./bin/subsidybar swiftbar
./bin/subsidybar config
./bin/subsidybar setup
```

The project currently requires Node.js 24+ because it runs TypeScript directly.

## Configuration

Config is stored at:

```text
~/.config/subsidybar/config.json
```

Show current config:

```bash
subsidybar config
```

Set your monthly subscription:

```bash
subsidybar config set subscription 100
```

Set the reporting period:

```bash
subsidybar config set period quota
subsidybar config set period week
subsidybar config set period month
```

Set or reset the weekly Codex refresh time:

```bash
subsidybar config set reset "Mon 23:08"
subsidybar config set reset auto
```

`quota` uses your Codex weekly cycle. For weekly periods, the monthly subscription is divided by 4. For `month`, the full monthly subscription is used.

## SwiftBar Menu

The menu bar shows the estimated subsidy number.

The dropdown keeps only the essential details:

```text
Quota: Apr 28 - Apr 30
Vendor loss: -$201
API value: $226.00
Subscription: $25 ($100/mo)
Tokens: 278.00M
Reset: May 4 23:08
```

You can change period and subscription from the dropdown.

## Notes

SubsidyBar uses public API-equivalent pricing from ccusage. It is not an official OpenAI bill and does not reflect internal Codex subscription economics.

If `@ccusage/codex` changes how it reads archived sessions, SubsidyBar may need a small update.
