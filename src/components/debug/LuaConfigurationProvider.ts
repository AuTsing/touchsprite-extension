import * as vscode from 'vscode';

// debug启动时的配置项处理
class LuaConfigurationProvider implements vscode.DebugConfigurationProvider {
    resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        // if launch.json is missing or empty
        if (!config.type && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lua') {
                vscode.window.showInformationMessage('请先正确配置launch文件!');
                config.type = 'lua';
                config.name = 'LuaPanda';
                config.request = 'launch';
            }
        }

        // 旧版本的launch.json中没有tag, 利用name给tag赋值
        if (config.tag === undefined) {
            if (config.name === 'LuaPanda') {
                config.tag = 'normal';
            } else if (config.name === 'LuaPanda-Attach') {
                config.tag = 'attach';
            }
            // config.name === "LuaPanda-DebugFile" 是对 3.1.0 版本的兼容
            else if (config.name === 'LuaPanda-IndependentFile' || config.name === 'LuaPanda-DebugFile') {
                config.tag = 'independent_file';
            }
        }

        // 关于打开调试控制台的自动设置
        if (config.tag === 'independent_file') {
            if (!config.internalConsoleOptions) {
                config.internalConsoleOptions = 'neverOpen';
            }
        } else {
            if (!config.internalConsoleOptions) {
                config.internalConsoleOptions = 'openOnSessionStart';
            }
        }

        // rootFolder 固定为 ${workspaceFolder}, 用来查找本项目的launch.json.
        config.rootFolder = '${workspaceFolder}';

        if (!config.TempFilePath) {
            config.TempFilePath = '${workspaceFolder}';
        }

        // 开发模式设置
        if (config.DevelopmentMode !== true) {
            config.DevelopmentMode = false;
        }

        // attach 模式这里不用赋初值，后面会拷贝luapanda模式的配置信息
        if (config.tag !== 'attach') {
            if (!config.program) {
                config.program = '';
            }

            if (config.packagePath === undefined) {
                config.packagePath = [];
            }

            if (config.truncatedOPath === undefined) {
                config.truncatedOPath = '';
            }

            if (config.distinguishSameNameFile === undefined) {
                config.distinguishSameNameFile = false;
            }

            if (config.dbCheckBreakpoint === undefined) {
                config.dbCheckBreakpoint = false;
            }

            if (!config.args) {
                config.args = new Array<string>();
            }

            if (config.autoPathMode === undefined) {
                // 默认使用自动路径模式
                config.autoPathMode = true;
            }

            if (!config.cwd) {
                config.cwd = '${workspaceFolder}';
            }

            if (!config.luaFileExtension) {
                config.luaFileExtension = '';
            } else {
                // luaFileExtension 兼容 ".lua" or "lua"
                let firseLetter = config.luaFileExtension.substr(0, 1);
                if (firseLetter === '.') {
                    config.luaFileExtension = config.luaFileExtension.substr(1);
                }
            }

            if (config.stopOnEntry === undefined) {
                config.stopOnEntry = false;
            }

            if (config.pathCaseSensitivity === undefined) {
                config.pathCaseSensitivity = false;
            }

            if (config.connectionPort === undefined) {
                config.connectionPort = 8818;
            }

            if (config.logLevel === undefined) {
                config.logLevel = 1;
            }

            if (config.autoReconnect !== true) {
                config.autoReconnect = false;
            }

            if (config.updateTips === undefined) {
                config.updateTips = true;
            }

            if (config.useCHook === undefined) {
                config.useCHook = true;
            }

            if (config.isNeedB64EncodeStr === undefined) {
                config.isNeedB64EncodeStr = true;
            }

            if (config.VSCodeAsClient === undefined) {
                config.VSCodeAsClient = false;
            }

            if (config.connectionIP === undefined) {
                config.connectionIP = '127.0.0.1';
            }
        }

        return config;
    }
}

export default LuaConfigurationProvider;
