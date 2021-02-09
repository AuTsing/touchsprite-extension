import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Server from '../components/Server';
import Api from '../components/Api';
import Ui from '../components/ui/Ui';

export interface IVscodeMessageEventData {
    command: string;
    data: { message: string } | { imgs: string[] } | { templates: string } | {};
}

export interface IPostdata {
    command: string;
    data?: any;
}

class Snapshoter {
    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionGlobalState: vscode.Memento;
    private readonly extensionPath: string;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly server: Server;
    private readonly api: Api;

    constructor(context: vscode.ExtensionContext, server: Server) {
        this.extensionPath = context.extensionPath;
        this.extensionGlobalState = context.globalState;
        this.disposables = context.subscriptions;
        this.server = server;
        this.api = new Api();
    }

    private getWebviewContent(): string {
        const reactAppPathOnDisk = vscode.Uri.file(path.join(this.extensionPath, 'assets', 'webview', 'main.js'));
        const reactAppUri = reactAppPathOnDisk.with({ scheme: 'vscode-resource' });

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Snapshoter</title>
            <script>
              window.acquireVsCodeApi = acquireVsCodeApi;
            </script>
        </head>
        <body>
            <div id="root"></div>
            <script src="${reactAppUri}"></script>
        </body>
        </html>`;
    }

    public show() {
        if (this.panel) {
            const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
            this.panel.reveal(columnToShowIn);
            return;
        }

        vscode.commands.executeCommand('workbench.action.closePanel');
        this.panel = vscode.window.createWebviewPanel('picker', '触动插件: 取色器', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        this.panel.webview.html = this.getWebviewContent();
        this.panel.webview.onDidReceiveMessage(
            msg => {
                if (!this.panel) {
                    return;
                }
                switch (msg.command) {
                    case 'loadImgFromDevice':
                        return this.handleLoadImgFromDevice(this.panel);
                    case 'loadImgFromLocal':
                        return this.handleLoadImgFromLocal(this.panel);
                    case 'loadTemplates':
                        return this.handleLoadTemplates(this.panel);
                    case 'saveTemplates':
                        return this.handleSaveTemplates(this.panel, msg.data);
                    case 'copy':
                        return this.handleCopy(this.panel, msg.data);
                    default:
                        Ui.output(`取色器操作失败: 未知命令 "${msg.command}"`);
                }
            },
            undefined,
            this.disposables
        );
        this.panel.onDidChangeViewState(
            e => {
                if (e.webviewPanel.visible) {
                    vscode.commands.executeCommand('workbench.action.closePanel');
                } else {
                    Ui.outputShow();
                }
            },
            undefined,
            this.disposables
        );
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            undefined,
            this.disposables
        );
    }

    private async handleLoadImgFromDevice(panel: vscode.WebviewPanel) {
        const statusBarDisposer = Ui.doing('截图中');
        try {
            const attachingDevice = await this.server.getAttachingDevice();
            const { ip, auth } = attachingDevice;
            const resp1 = await this.api.getSnapshot(ip, auth);
            if (!resp1.data) {
                throw new Error('获取设备截图失败');
            }
            panel.webview.postMessage({
                command: 'add',
                data: { imgs: [Buffer.from(resp1.data, resp1.data.byteLength).toString('base64')] },
            } as IVscodeMessageEventData);
            const snapshotSavePath: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
            if (snapshotSavePath) {
                fs.writeFile(path.join(snapshotSavePath, `PIC_${Date.now()}.png`), resp1.data, 'binary', err => {
                    if (err) {
                        Ui.outputWarn(`保存截图至本地失败: ${err.toString()}`);
                    }
                });
            }
        } catch (err) {
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `设备截图失败: ${err.toString()}` },
            } as IVscodeMessageEventData);
            panel.webview.postMessage({
                command: 'loadedImg',
                data: {},
            } as IVscodeMessageEventData);
        }
        statusBarDisposer();
    }

    private async handleLoadImgFromLocal(panel: vscode.WebviewPanel) {
        try {
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                filters: { Img: ['png'] },
            });
            if (uris && uris.length > 0) {
                const imgs = uris.map(uri => Buffer.from(fs.readFileSync(uri.fsPath)).toString('base64'));
                panel.webview.postMessage({
                    command: 'add',
                    data: { imgs },
                } as IVscodeMessageEventData);
            } else {
                panel.webview.postMessage({
                    command: 'loadedImg',
                    data: {},
                } as IVscodeMessageEventData);
            }
        } catch (err) {
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `打开本地图片失败: ${err.toString()}` },
            } as IVscodeMessageEventData);
            panel.webview.postMessage({
                command: 'loadedImg',
                data: {},
            } as IVscodeMessageEventData);
        }
    }

    private handleLoadTemplates(panel: vscode.WebviewPanel) {
        try {
            panel.webview.postMessage({
                command: 'loadTemplates',
                data: { templates: this.extensionGlobalState.get<string>('templates') || '' },
            });
        } catch (err) {
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `读取模板失败: ${err.toString()}` },
            } as IVscodeMessageEventData);
        }
    }

    private handleSaveTemplates(panel: vscode.WebviewPanel, data: string) {
        try {
            this.extensionGlobalState.update('templates', data);
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `保存模板成功` },
            } as IVscodeMessageEventData);
        } catch (err) {
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `保存模板失败: ${err.toString()}` },
            } as IVscodeMessageEventData);
        }
    }

    private handleCopy(panel: vscode.WebviewPanel, data: string) {
        try {
            vscode.env.clipboard.writeText(data);
        } catch (err) {
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `复制失败: ${err.toString()}` },
            } as IVscodeMessageEventData);
        }
    }
}

export default Snapshoter;
