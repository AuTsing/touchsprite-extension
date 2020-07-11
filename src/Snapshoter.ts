import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Server from './Server';
import TsMessager from './TsMessager';

class Snapshoter {
    private webviewPanel: vscode.WebviewPanel | undefined;

    public snap = (context: vscode.ExtensionContext, server: Server) => {
        if (!server.attachingDevice) {
            vscode.window.showErrorMessage('未连接设备');
            return;
        }
        TsMessager.getPicture(server.attachingDevice).then(res => {
            let pic = res.data;
            let snapshotDir: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
            this.webviewPanel = vscode.window.createWebviewPanel('snapshotor', `${server.attachingDevice?.ip}`, vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
            });
            const index = vscode.Uri.file(path.join(context.extensionPath, 'assets', 'webview', 'index.html'));
            this.webviewPanel.webview.html = fs.readFileSync(index.fsPath, 'utf-8');
            this.webviewPanel.webview.onDidReceiveMessage(message => {
                switch (message.command) {
                    case 'init':
                        vscode.commands.executeCommand('workbench.action.closePanel');
                        if (snapshotDir) {
                            fs.writeFile(path.join(snapshotDir, `IMG_${Date.now()}.png`), pic, 'binary', err => {
                                if (err) {
                                    server.logging('保存截图失败：' + err.message);
                                    return;
                                } else {
                                    vscode.window.setStatusBarMessage(`截图成功`, 3000);
                                    return;
                                }
                            });
                        }
                        this.webviewPanel?.webview.postMessage({
                            command: 'init',
                            payload: Buffer.from(pic, pic.byteLength).toString('base64'),
                        });
                        break;
                    case 'snapshot':
                        vscode.commands.executeCommand('workbench.action.closePanel');
                        if (snapshotDir) {
                            fs.writeFile(path.join(snapshotDir, `IMG_${Date.now()}.png`), pic, 'binary', err => {
                                if (err) {
                                    server.logging('保存截图失败：' + err.message);
                                    return;
                                } else {
                                    vscode.window.setStatusBarMessage(`截图成功`, 3000);
                                    return;
                                }
                            });
                        }
                        TsMessager.getPicture(server.attachingDevice!).then(res => {
                            let pic = res.data;
                            this.webviewPanel?.webview.postMessage({
                                command: 'init',
                                payload: Buffer.from(pic, pic.byteLength).toString('base64'),
                            });
                        });
                        break;
                    case 'openLocal':
                        vscode.window
                            .showOpenDialog({
                                filters: { 图片: ['png'] },
                            })
                            .then(info => {
                                if (info && info.length) {
                                    this.webviewPanel?.webview.postMessage({
                                        command: 'init',
                                        payload: Buffer.from(fs.readFileSync(info[0].fsPath)).toString('base64'),
                                    });
                                }
                            });
                        break;
                    case 'copy':
                        vscode.env.clipboard.writeText(message.payload);
                        break;
                    case 'saveImage':
                        let lastSave: string | undefined = context.globalState.get('lastSave');
                        if (!lastSave) {
                            lastSave = os.homedir();
                        }
                        vscode.window
                            .showSaveDialog({
                                defaultUri: vscode.Uri.file(path.join(lastSave, `IMG_${Date.now()}.png`)),
                            })
                            .then(info => {
                                if (info) {
                                    context.globalState.update('lastSave', path.dirname(info.fsPath));
                                    fs.writeFileSync(info.fsPath, Buffer.from(message.payload, 'base64'));
                                    vscode.window.setStatusBarMessage(`图片保存成功`);
                                }
                            });
                        break;
                    case 'loadTemplate':
                        this.webviewPanel?.webview.postMessage({
                            command: 'loadTemplate',
                            payload: context.globalState.get('template'),
                        });
                        break;
                    case 'saveTemplate':
                        context.globalState.update('template', message.payload);
                        vscode.window.setStatusBarMessage(`代码模板保存成功`, 3000);
                        break;
                    default:
                        console.log(`unknown ${message.command}`);
                        break;
                }
            });
        });
    };
}

export default Snapshoter;
