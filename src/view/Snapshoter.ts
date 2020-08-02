import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Server from '../Server';
import TsMessager from '../TsMessager';

export interface IWebviewPostMessage {
    command: string;
    data?: any;
}

export default class Snapshoter {
    private _panel: vscode.WebviewPanel | undefined;
    private readonly _extensionGlobalState: vscode.Memento;
    private readonly _extensionPath: string;
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly _server: Server;

    constructor(context: vscode.ExtensionContext, server: Server) {
        this._extensionPath = context.extensionPath;
        this._extensionGlobalState = context.globalState;
        this._disposables = context.subscriptions;
        this._server = server;
    }

    private getWebviewContent(): string {
        const reactAppPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'assets', 'webview', 'main.js'));
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

    public showSnapshoter() {
        if (!this._server.attachingDevice) {
            vscode.window.showErrorMessage('未连接设备');
            return;
        }

        if (this._panel) {
            const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
            this._panel.reveal(columnToShowIn);
            return;
        }

        vscode.commands.executeCommand('workbench.action.closePanel');
        this._panel = vscode.window.createWebviewPanel('snapshoter', this._server.attachingDevice.ip, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        this._panel.webview.html = this.getWebviewContent();
        this._panel.webview.onDidReceiveMessage(
            msg => {
                const { command } = msg;
                switch (command) {
                    case 'loadImgFromDevice':
                        TsMessager.getPicture(this._server.attachingDevice!).then(res => {
                            if (res && res.data) {
                                const img = res.data;
                                this._panel!.webview.postMessage({
                                    command: 'add',
                                    data: { img: Buffer.from(img, img.byteLength).toString('base64') },
                                });
                                vscode.window.setStatusBarMessage(`截图成功`, 3000);
                            } else {
                                this._server.logging('截图失败，请检查设备连接状态');
                            }
                        });
                        break;
                    case 'loadImgFromLocal':
                        const openDialogOptions: vscode.OpenDialogOptions = {
                            canSelectFiles: true,
                            canSelectFolders: false,
                            canSelectMany: false,
                            filters: { Img: ['png'] },
                        };
                        vscode.window.showOpenDialog(openDialogOptions).then(async (uri: vscode.Uri[] | undefined) => {
                            if (uri && uri.length > 0) {
                                this._panel!.webview.postMessage({
                                    command: 'add',
                                    data: { img: Buffer.from(fs.readFileSync(uri[0].fsPath)).toString('base64') },
                                });
                            }
                        });
                        break;
                    case 'loadTemplates':
                        this._panel!.webview.postMessage({
                            command: 'loadTemplates',
                            data: this._extensionGlobalState.get<string>('templates'),
                        });
                        break;
                    case 'saveTemplates':
                        console.log(msg);
                        this._extensionGlobalState.update('templates', msg.data).then(
                            () => vscode.window.setStatusBarMessage(`代码模板保存成功`, 3000),
                            reason => {
                                vscode.window.setStatusBarMessage(`代码模板保存失败`, 3000);
                                console.log('代码模板保存失败', reason);
                            }
                        );
                        break;
                    case 'copy':
                        vscode.env.clipboard.writeText(msg.data);
                        break;
                    default:
                        console.log('unknown command: ' + command);
                        break;
                }
            },
            undefined,
            this._disposables
        );
        this._panel.onDidChangeViewState(e => {
            const command = e.webviewPanel.visible ? 'workbench.action.closePanel' : 'workbench.action.focusPanel';
            vscode.commands.executeCommand(command);
        });
        this._panel.onDidDispose(
            () => {
                this._panel = undefined;
            },
            null,
            this._disposables
        );
    }
}
