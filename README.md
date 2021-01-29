# TouchSprite-Extension

![license](https://img.shields.io/github/license/AuTsing/touchsprite-extension)
![version](https://img.shields.io/visual-studio-marketplace/v/autsing.touchsprite-extension)
![installs](https://img.shields.io/visual-studio-marketplace/i/autsing.touchsprite-extension)
![downloads](https://img.shields.io/visual-studio-marketplace/d/autsing.touchsprite-extension)

TouchSprite-Extension ( 触动精灵开发插件 ) 是基于触动精灵官方的 API 库进行开发的第三方插件，为开发者提供在 VSCode 进行触动精灵脚本开发的条件。

# 目录

-   [标题](#TouchSprite-Extension)
-   [目录](#目录)
-   [功能](#功能)
-   [使用](#使用)
    -   [使用前](#使用前)
    -   [初始化](#初始化)
    -   [开始使用](#开始使用)
    -   [AccessKey](#AccessKey)
    -   [代码调试](#代码调试)
    -   [发布工程](#发布工程)
    -   [快捷键](#快捷键)
-   [Todo](#Todo)
-   [Contribution](#Contribution)
-   [License](#license)
-   [声明](#声明)

# 功能

-   [x] 运行工程 🆒
-   [x] 运行测试工程
-   [x] 断点调试 🆕
-   [x] 停止工程
-   [x] 上传文件
-   [x] 打包工程
-   [x] 发布工程 🆕
-   [x] 抓图
-   [x] 取色
-   [x] 颜色代码生成
-   [x] 二值化图片
-   [x] 图片比较

# 使用

## 使用前

该插件仅针对触动方面进行扩展，由于市面上存在很多 Lua 相关插件，所以部分编写需求功能本插件不再提供，以下推荐比较常用的插件，配合本插件能获得更好的代码编写体验。

-   [Lua](https://marketplace.visualstudio.com/items?itemName=sumneko.lua) : 该插件提供语法检测，代码高亮，悬停提示，代码补全等功能
-   [lua-format-extension](https://marketplace.visualstudio.com/items?itemName=autsing.lua-format-extension) : 由于 Lua 插件暂时没用完成代码格式化功能，所以暂时提供一款简单的代码格式化工具，支持 UTF-8 字符

## 初始化

以下功能需要先在设置中填写开发者 AccessKey 项，如果你不使用以下功能，请忽略。

-   运行工程, 运行测试工程, 断点调试, 停止工程, 上传文件, 设备截图

以下功能需要先在设置中填写开发者后台 Cookie 项，如果你不使用以下功能，请忽略。

-   发布工程

## 开始使用

快捷键 **<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>** 调出输入框，输入 `触动插件` ，以 `触动插件` 开头的命令均为本插件提供的便捷指令。

## AccessKey

进入[触动开发者后台](https://dev.touchsprite.com/) - 个人中心 - API，即可看到 AccessKey，注意设备已满的话请先清空设备。

![avatar]()

## 代码调试

代码调试需要编写好测试引导文件 _maintest.lua_ 并设置好断点。然后使用快捷键 **<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>** 调出输入框，输入 `触动插件: 开始调试` 以开始调试。

_e.g. maintest.lua_

```lua
local main = function() toast('Hello,world!') end
main()
```

## 发布工程

发布工程前需要填写开发者后台 Cookie。

1. 进入[触动开发者后台](https://dev.touchsprite.com/)

2. 登陆，确认已经是登陆状态

3. 网页中点击 右键 - 检查 调出开发者工具

4. 选择 Network(网络) 标签页

    ![avatar]()

5. 点击刷新按钮，等待刷新完毕

    ![avatar]()

6. 找到 `index` 项，通常在首位，展开

    ![avatar]()

7. 找到`Headers` - `Request Headers` - `cookie` 项，复制该项的值填入设置中即可

    ![avatar]()

8. (可选) 发布工程会自动检测工程目录下的 _luaconfig.lua_ 文件，该文件返回一个表，`id` 字段和 `version` 字段会被读取使用，如果文件不存在或者无法读取，插件会提供手动输入

    _e.g. luaconfig.lua_

    ```lua
    return {
        ['id'] = '123456',
        ['version'] = '1.0.0',
    }
    ```

## 快捷键

以下快捷键为默认快捷键，如果热键被插件占用，请自行修改。

-   <kbd>F5</kbd> 运行测试工程
-   <kbd>F6</kbd> 运行工程
-   <kbd>F7</kbd> 运行当前脚本
-   <kbd>Shift</kbd>+<kbd>F5</kbd> 停止工程
-   <kbd>F8</kbd> 打开取色器
-   (取色界面下) <kbd>w</kbd> <kbd>a</kbd> <kbd>s</kbd> <kbd>d</kbd> 移动光标
-   (取色界面下) <kbd>1</kbd> - <kbd>9</kbd> / <kbd>鼠标左键</kbd> 抓取颜色
-   (取色界面下) <kbd>q</kbd> <kbd>e</kbd> 选取点 1,2
-   (取色界面下) <kbd>z</kbd> 清空取色记录
-   (取色界面下) <kbd>x</kbd> 清空点 1,2
-   (取色界面下) <kbd>f</kbd> <kbd>g</kbd> <kbd>h</kbd> 生成颜色代码

# Todo

-   [ ] 重构触动 API 功能
-   [ ] 优化信息反馈模块
-   [ ] 发布工程模块允许更多自定义
-   [ ] 多编辑器无法独立使用插件的问题
-   [ ] 调试模块精简
-   [ ] 字库代码生成
-   [ ] 触动函数代码补全
-   [ ] 脚手架生成

插件目前由我一个人进行开发并进行维护，由于时间精力有限，难免会存在 BUG 以及一些其他问题。如果你发现了任何错误，或者愿意协助我开发插件，或者时有什么更好的意见建议，请[告诉我](https://github.com/AuTsing/touchsprite-extension/issues)或使用[Pull Requests](https://github.com/AuTsing/touchsprite-extension/pulls)提交，同时也可以通过加群进行反馈。

-   [QQ 群：1040367696](http://shang.qq.com/wpa/qunwpa?idkey=4568016974574bb1af0fa76337d4d55dd9f16509238b1ff7c6f0e79655654d1b)
-   QQ：763025696

# Contribution

-   发布工程功能使用项目: [luaparse](https://github.com/fstirlitz/luaparse)
-   断点调试功能使用项目: [LuaPanda](https://github.com/Tencent/LuaPanda)

# License

[GNU General Public License version 3](https://github.com/AuTsing/touchsprite-extension/blob/master/LICENSE) @AuTsing

# 声明

插件仅供学习交流使用，使用过程中请遵守相关法律法规；插件为开源软件，不会保存和上传关于你的任何内容。如果你不同意，请立即停止使用并删除插件。

如果你对插件内容有任何异议，请提交[issues](https://github.com/AuTsing/touchsprite-extension/issues)，或请联系我。

**Enjoy!**
