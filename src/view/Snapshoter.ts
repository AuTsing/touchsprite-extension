import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Server from '../components/Server';
import Api from '../components/Api';
import Ui, { StatusBarType } from '../components/UI';

export interface IWebviewPostMessage {
    command: string;
    data?: any;
}

class Snapshoter {
    private _panel: vscode.WebviewPanel | undefined;
    private readonly _extensionGlobalState: vscode.Memento;
    private readonly _extensionPath: string;
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly _server: Server;
    private readonly _ui: Ui;
    private readonly _api: Api;

    constructor(context: vscode.ExtensionContext, server: Server, ui: Ui) {
        this._extensionPath = context.extensionPath;
        this._extensionGlobalState = context.globalState;
        this._disposables = context.subscriptions;
        this._server = server;
        this._ui = ui;
        this._api = new Api();
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

    public show() {
        if (this._panel) {
            const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
            this._panel.reveal(columnToShowIn);
            return;
        }

        vscode.commands.executeCommand('workbench.action.closePanel');
        this._panel = vscode.window.createWebviewPanel('snapshoter', '触动插件: 取色器', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        this._panel.webview.html = this.getWebviewContent();
        this._panel.webview.onDidReceiveMessage(
            msg => {
                const { command } = msg;
                switch (command) {
                    case 'loadImgFromDevice':
                        const attachingDevice = this._server.getAttachingDevice();
                        if (!attachingDevice) {
                            this._panel?.webview.postMessage({
                                command: 'showMessage',
                                data: { message: '设备截图失败: 未连接设备' },
                            });
                            return;
                        }
                        this._api
                            .getSnapshot(attachingDevice)
                            .then(res => {
                                if (!res.data) {
                                    return Promise.reject('获取远程图片失败');
                                }
                                this._panel?.webview.postMessage({
                                    command: 'add',
                                    data: { img: Buffer.from(res.data, res.data.byteLength).toString('base64') },
                                });
                                return Promise.resolve(res.data);
                            })
                            .then(data => {
                                const snapshotDir: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
                                if (!snapshotDir) {
                                    return Promise.resolve('ok');
                                }
                                return new Promise<string>((resolve, reject) => {
                                    fs.writeFile(path.join(snapshotDir, `PIC_${Date.now()}.png`), data, 'binary', err => {
                                        if (err) {
                                            reject('截图保存失败 ' + err.toString());
                                            return;
                                        }
                                        resolve('截图保存成功');
                                    });
                                });
                            })
                            .then(() => {
                                this._ui.setStatusBarTemporary(StatusBarType.successful);
                            })
                            .catch(err => {
                                this._ui.setStatusBarTemporary(StatusBarType.failed);
                                this._ui.logging(`截图失败: ${err.toString()}`);
                            });
                        break;
                    case 'loadImgFromLocal':
                        const openDialogOptions: vscode.OpenDialogOptions = {
                            canSelectFiles: true,
                            canSelectFolders: false,
                            canSelectMany: false,
                            filters: { Img: ['png'] },
                        };
                        vscode.window.showOpenDialog(openDialogOptions).then((uri: vscode.Uri[] | undefined) => {
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
                        this._extensionGlobalState.update('templates', msg.data).then(
                            () => this._ui.setStatusBarTemporary(`$(check) 代码模板保存成功`, 3000),
                            err => {
                                this._ui.setStatusBarTemporary(`$(issues) 代码模板保存失败`, 3000);
                                this._ui.logging('代码模板保存失败: ' + err.toString());
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
            if (e.webviewPanel.visible) {
                vscode.commands.executeCommand('workbench.action.closePanel');
            }
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

export default Snapshoter;