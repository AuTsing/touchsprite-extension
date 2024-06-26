# TouchSprite Extension

![license](https://img.shields.io/github/license/AuTsing/touchsprite-extension)
![version](https://img.shields.io/visual-studio-marketplace/v/autsing.touchsprite-extension)
![installs](https://img.shields.io/visual-studio-marketplace/i/autsing.touchsprite-extension)
![downloads](https://img.shields.io/visual-studio-marketplace/d/autsing.touchsprite-extension)

TouchSprite Extension ( 触动精灵开发插件 ) 是基于触动精灵官方的 API 库进行开发的第三方插件，为开发者提供在 VSCode 进行触动精灵脚本开发的条件。

# 目录

-   [标题](#TouchSprite-Extension)
-   [目录](#目录)
-   [功能](#功能)
-   [使用](#使用)
    -   [使用前](#使用前)
    -   [初始化](#初始化)
    -   [开始使用](#开始使用)
    -   [AccessKey](#AccessKey)
    -   [发布工程](#发布工程)
    -   [快捷键](#快捷键)
-   [Todo](#Todo)
-   [Contribution](#Contribution)
-   [License](#license)
-   [声明](#声明)

# 功能

-   ✅ 运行工程
-   ✅ 运行测试工程
-   ✅ 运行当前脚本
-   ✅ 停止运行
-   ✅ 上传文件
-   ✅ 清空脚本
-   ✅ 打包工程
-   ✅ 发布工程

# 使用

## 使用前

该插件仅针对触动方面进行扩展，由于市面上存在很多 Lua 相关插件，所以部分编写需求功能本插件不再提供，以下推荐比较常用的插件，配合本插件能获得更好的代码编写体验。

-   [Lua](https://marketplace.visualstudio.com/items?itemName=sumneko.lua) : Lua 语言服务，该插件提供语法检测，代码高亮，悬停提示，代码补全，格式化等功能，推荐使用

## 初始化

以下功能需要先在设置中填写开发者 AccessKey 项，如果你不使用以下功能，请忽略。

-   运行工程, 运行测试工程, 运行当前脚本, 停止运行, 上传文件, 清空脚本, 取色器截图

以下功能需要先在设置中填写开发者后台 Cookie 项，如果你不使用以下功能，请忽略。

-   发布工程

## 开始使用

快捷键 **<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>** 调出输入框，输入 `触动插件` ，以 `触动插件` 开头的命令均为本插件提供的命令。

插件启用后 点击左下角 `触动插件` 按钮，即可列出命令清单。

插件启用后 在 Lua 文件中点击 **<kbd>F5</kbd> <kbd>F6</kbd> <kbd>F7</kbd>**，会调用默认绑定的命令，具体请查看下方快捷键说明

## AccessKey

进入[触动开发者后台](https://dev.touchsprite.com/) - 个人中心 - API，即可看到 AccessKey，注意设备已满的话请先清空设备。

![avatar](https://raw.githubusercontent.com/AuTsing/touchsprite-extension/main/assets/images/readme/20210129163252.png)

## 发布工程

发布工程前需要填写开发者后台 Cookie。

1. 进入[触动开发者后台](https://account.touchsprite.com/)

2. 登陆，确认已经是登陆状态

3. 网页中点击 右键 - 检查 调出开发者工具

4. 选择 Network(网络) 标签页

    ![avatar](https://raw.githubusercontent.com/AuTsing/touchsprite-extension/main/assets/images/readme/20210129164740.png)

5. 点击刷新按钮，等待刷新完毕

    ![avatar](https://raw.githubusercontent.com/AuTsing/touchsprite-extension/main/assets/images/readme/20210129164849.png)

6. 找到 `index` 项，通常在首位，展开

    ![avatar](https://raw.githubusercontent.com/AuTsing/touchsprite-extension/main/assets/images/readme/20210129165159.png)

7. 找到`Headers` - `Request Headers` - `cookie` 项，复制该项的值填入设置中即可，请使用选取复制而非右键复制，否则有可能会导致 cookie 无法识别

    ![avatar](https://raw.githubusercontent.com/AuTsing/touchsprite-extension/main/assets/images/readme/20210129165429.png)

8. (可选) 发布工程会自动检测工程目录下的 _luaconfig.lua_ 文件，该文件应返回一个表，`ID` 字段 ( 普通工程 ) ， `ID_ENT` 字段 ( 企业版工程 ) ，`ID_APP` 字段 ( 小精灵工程 ) ，`VERSION` 字段会被读取使用，如果该文件不存在或者无法读取，会导致发布失败

    _e.g. luaconfig.lua_

    ```lua
    return {
        ID = '123456', --普通工程
        ID_ENT = '123456', --企业版工程
        ID_APP = '12345', --小精灵工程
        VERSION = '1.0.0', --工程版本号
    }
    ```

    如同一个工程需配置不同 ID 的配置，文件应返回表和索引，索引表示要使用哪个配置进行发布

    _e.g. luaconfig.lua_

    ```lua
    return ({
        {
            ID = '123456',
            VERSION = '1.0.0',
        },
        {
            ID = '223456',
            VERSION = '2.0.0',
        },
    })[1]
    ```

9. (可选) 发布工程会自动检测工程目录下的 _CHANGELOG.md_ 文件，该文件提供脚本的更新日志，最上层的版本更新日志会被读取使用，如果文件不存在或者无法读取，更新日志默认为“ ”(一个空格)

    _e.g. CHANGELOG.md_

    ```md
    ## [1.0.1]

    -   新增 ...
    -   修复 ...

    ## [1.0.0]

    -   新增 ...
    -   修复 ...
    ```

    如果需要把日志作为最新版本的更新日志，则可以使用 [latest] 标签，插件会自动将 [latest] 更换成最新版的版本号

    _e.g. CHANGELOG.md_

    ```md
    ## [latest]

    -   新增 ...
    -   修复 ...

    ## [1.0.0]

    -   新增 ...
    -   修复 ...
    ```

## 快捷键

以下快捷键为默认快捷键，如果热键被插件占用，请自行修改。

-   <kbd>F5</kbd> 运行测试工程
-   <kbd>F6</kbd> 运行工程
-   <kbd>F7</kbd> 停止运行

以下为 Snapshop v1 取色器快捷键

-   <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 移动光标
-   <kbd>1</kbd> - <kbd>9</kbd> / <kbd>鼠标左键</kbd> 抓取颜色
-   <kbd>Q</kbd> <kbd>E</kbd> 选取点 1,2
-   <kbd>Z</kbd> 清空取色记录
-   <kbd>X</kbd> 清空点 1,2
-   <kbd>F</kbd> <kbd>G</kbd> <kbd>H</kbd> <kbd>J</kbd> <kbd>K</kbd> 生成颜色代码

# Todo

-   ~~[x] 重构触动 API 功能~~
-   ~~[x] 优化信息反馈模块~~
-   ~~[x] 多编辑器无法独立使用插件的问题~~
-   ~~[x] 发布工程模块允许更多自定义~~
-   ~~[x] 调试模块精简 1 期~~
-   ~~[x] 字库代码生成~~
-   ~~[x] 脚手架生成~~
-   ~~[ ] 调试模块精简 2 期~~
-   ~~[ ] 触动函数代码补全~~

插件目前由我一个人进行开发并进行维护，由于时间精力有限，难免会存在 BUG 以及一些其他问题。如果你发现了任何错误，或者愿意协助我开发插件，或者有什么更好的意见建议，请使用[Issues](https://github.com/AuTsing/touchsprite-extension/issues)或使用[Pull Requests](https://github.com/AuTsing/touchsprite-extension/pulls)提交，同时也可以通过加群进行反馈。

~~插件 2.x 版本进行了重构，精简了许多使用频率极低且使用体验不怎么好的功能，并对上述 Todo 进行重新规划。如仍需使用已被移除的功能请安装旧版插件，已被移除的功能会在找到更好的解决方案时重新添加。~~

3.0 版本已发布。

-   [QQ 群：1040367696](http://shang.qq.com/wpa/qunwpa?idkey=4568016974574bb1af0fa76337d4d55dd9f16509238b1ff7c6f0e79655654d1b)
-   QQ：763025696

# Contribution

-   发布工程功能使用项目: [luaparse](https://github.com/fstirlitz/luaparse), [changelog-parser](https://github.com/hypermodules/changelog-parser)

# License

[GNU General Public License version 3](https://github.com/AuTsing/touchsprite-extension/blob/main/LICENSE) @AuTsing

# 声明

插件仅供学习交流使用，使用过程中请遵守相关法律法规；插件为开源软件，不会保存和上传关于你的任何内容。如果你不同意，请立即停止使用并删除插件。

如果你对插件内容有任何异议，请提交[Issues](https://github.com/AuTsing/touchsprite-extension/issues)，或请联系我。

**Enjoy!**
