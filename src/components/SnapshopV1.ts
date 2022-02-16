import * as Vscode from 'vscode';
import * as Path from 'path';
import * as Fs from 'fs';
import Touchsprite from './Touchsprite';
import * as Ui from './Ui';

export enum WebviewMessageCommand {
    loadImgFromDevice = 'loadImgFromDevice',
    loadImgFromLocal = 'loadImgFromLocal',
    loadImgFromLocalWithUris = 'loadImgFromLocalWithUris',
    loadTemplates = 'loadTemplates',
    saveTemplates = 'saveTemplates',
    copy = 'copy',
    putValue = 'putValue',
    getValue = 'getValue',
}

export interface IWebviewMessage {
    command: WebviewMessageCommand;
    data: any;
}

export default class SnapshopV1 {
    private output: Ui.Output;
    private context: Vscode.ExtensionContext;
    private touchsprite: Touchsprite;
    private panel?: Vscode.WebviewPanel;

    constructor(context: Vscode.ExtensionContext, touchsprite: Touchsprite) {
        this.context = context;
        this.touchsprite = touchsprite;
        this.output = Ui.useOutput();
    }

    private loadWebview(): string {
        const root = this.context.extensionPath;
        const html = Path.join(root, 'assets', 'snapshop_v1', 'index.html');
        const htmlContent = Fs.readFileSync(html, { encoding: 'utf8' });
        const js = Path.join(root, 'assets', 'snapshop_v1', 'main.js');
        const uri = Vscode.Uri.file(js).with({ scheme: 'vscode-resource' });
        const htmlContentReplaced = htmlContent.replace('${reactAppUri}', `${uri}`);

        return htmlContentReplaced;
    }

    public open(): void {
        Vscode.commands.executeCommand('workbench.action.closePanel');

        if (this.panel) {
            this.panel.reveal(Vscode.window.activeTextEditor?.viewColumn);
            return;
        }

        this.panel = Vscode.window.createWebviewPanel('snapshop_v1', 'Snapshop v1', Vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        this.panel.webview.onDidReceiveMessage((message: IWebviewMessage) => {
            if (!this.panel) {
                return;
            }
            switch (message.command) {
                case WebviewMessageCommand.loadImgFromDevice:
                    return this.handleLoadImgFromDevice(this.panel);
                case WebviewMessageCommand.loadImgFromLocal:
                    return this.handleLoadImgFromLocal(this.panel);
                case WebviewMessageCommand.loadImgFromLocalWithUris:
                    return this.handleLoadImgFromLocal(this.panel, message.data);
                case WebviewMessageCommand.loadTemplates:
                    return this.handleLoadTemplates(this.panel);
                case WebviewMessageCommand.saveTemplates:
                    return this.handleSaveTemplates(this.panel, message.data);
                case WebviewMessageCommand.copy:
                    return this.handleCopy(this.panel, message.data);
                case WebviewMessageCommand.putValue:
                    return this.handlePutValue(this.panel, message.data.key, message.data.value);
                case WebviewMessageCommand.getValue:
                    return this.handleGetValue(this.panel, message.data.key);
                default:
                    return;
            }
        });
        this.panel.webview.html = this.loadWebview();
        this.panel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible) {
                Vscode.commands.executeCommand('workbench.action.closePanel');
            } else {
                Vscode.commands.executeCommand('workbench.action.togglePanel');
            }
        });
        this.panel.onDidDispose(() => (this.panel = undefined));
    }

    private async handleLoadImgFromDevice(panel: Vscode.WebviewPanel) {
        try {
            const img = await this.touchsprite.snap();
            if (!img) {
                return;
            }

            panel.webview.postMessage({
                command: 'add',
                data: { imgs: [Buffer.from(img, img.byteLength).toString('base64')] },
            });
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `设备截图失败: ${err.toString()}` },
                });
            }
            panel.webview.postMessage({
                command: 'loadedImg',
                data: {},
            });
        }
    }

    private async handleLoadImgFromLocal(panel: Vscode.WebviewPanel, paths?: string[]) {
        try {
            if (!paths) {
                const uris = await Vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                    filters: { Img: ['png'] },
                    defaultUri: this.context.globalState.get<string>('defaultLoadingPath')
                        ? Vscode.Uri.file(this.context.globalState.get<string>('defaultLoadingPath')!)
                        : undefined,
                });
                paths = uris?.map(uri => uri.fsPath);
            }
            if (paths && paths.length > 0) {
                this.context.globalState.update('defaultLoadingPath', paths[0]);
                const imgs = paths.map(p => Buffer.from(Fs.readFileSync(p)).toString('base64'));
                panel.webview.postMessage({
                    command: 'add',
                    data: { imgs },
                });
            } else {
                panel.webview.postMessage({
                    command: 'loadedImg',
                    data: {},
                });
            }
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `打开本地图片失败: ${err.toString()}` },
                });
            }
            panel.webview.postMessage({
                command: 'loadedImg',
                data: {},
            });
        }
    }

    private handleLoadTemplates(panel: Vscode.WebviewPanel) {
        try {
            panel.webview.postMessage({
                command: 'loadTemplates',
                data: { templates: this.context.globalState.get<string>('templates') || '' },
            });
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `读取模板失败: ${err.toString()}` },
                });
            }
        }
    }

    private handleSaveTemplates(panel: Vscode.WebviewPanel, data: string) {
        try {
            this.context.globalState.update('templates', data);
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `保存模板成功` },
            });
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `保存模板失败: ${err.toString()}` },
                });
            }
        }
    }

    private handleCopy(panel: Vscode.WebviewPanel, data: string) {
        try {
            Vscode.env.clipboard.writeText(data);
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `复制失败: ${err.toString()}` },
                });
            }
        }
    }

    private handlePutValue(panel: Vscode.WebviewPanel, key: string, data: any) {
        try {
            this.context.globalState.update(key, data);
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `保存成功` },
            });
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `保存失败: ${err.toString()}` },
                });
            }
        }
    }

    private handleGetValue(panel: Vscode.WebviewPanel, key: string) {
        try {
            const data = this.context.globalState.get(key);
            panel.webview.postMessage({
                command: 'getValue-' + key,
                data: { key: key, value: data },
            });
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `读取失败: ${err.toString()}` },
                });
            }
        }
    }

    public recommendSnapshopV2() {
        this.output.warning(
            '旧版取色器(Snapshop v1)不再作为默认图色工具，但在本插件 2.x 版本依然会得到保留，如果仍要使用请自行设置快捷键启用；推荐使用全新的图色工具 Snapshop v2，详情请查看：https://marketplace.visualstudio.com/items?itemName=autsing.snapshop-extension'
        );
    }
}
