import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Server from '../components/Server';
import Api from '../components/Api';
import Ui from '../components/ui/Ui';

export interface IVscodeMessageEventData {
    command: string;
    // DEVTEMP 新增colorinfo
    data: { message: string } | { imgs: string[] } | { templates: string } | { colorinfo: any };
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
                    // DEVTEMP 新增两个方法
                    case 'loadImgInfo':
                        return this.handleLoadImgInfo(this.panel, msg.data);
                    case 'saveImgInfo':
                        return this.handleSaveImgInfo(this.panel, msg.data);
                    case 'loadImgFromDevice':
                        return this.handleLoadImgFromDevice(this.panel);
                    case 'loadImgFromLocal':
                        return this.handleLoadImgFromLocal(this.panel);
                    case 'loadImgFromLocalWithUris':
                        return this.handleLoadImgFromLocal(this.panel, msg.data);
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
        const { disposer } = Ui.doing('截图中');
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
            // DEVTEMP 回头再改自动保存逻辑,暂时去除
            // const snapshotSavePath: string = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir') || '';
            // const snapshotClassifyByDpi: boolean = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotClassifyByDpi') || false;
            // if (snapshotSavePath) {
            //     let dir = '';
            //     if (snapshotClassifyByDpi) {
            //         const dpi = resp1.headers.width ? `${resp1.headers.width}_${resp1.headers.height}` : 'undefined';
            //         dir = path.join(snapshotSavePath, dpi);
            //     } else {
            //         dir = snapshotSavePath;
            //     }
            //     if (!fs.existsSync(dir)) {
            //         fs.mkdirSync(dir);
            //     }
            //     const url = path.join(dir, `PIC_${Date.now()}.png`);
            //     fs.writeFile(url, resp1.data, 'binary', err => {
            //         if (err) {
            //             Ui.outputWarn(`保存截图至本地失败: ${err.toString()}`);
            //         }
            //     });
            // }
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `设备截图失败: ${err.toString()}` },
                } as IVscodeMessageEventData);
            }
            panel.webview.postMessage({
                command: 'loadedImg',
                data: {},
            } as IVscodeMessageEventData);
        }
        disposer();
    }

    private async handleLoadImgFromLocal(panel: vscode.WebviewPanel, paths?: string[]) {
        try {
            if (!paths) {
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                    // DEVTEMP 临时新增json格式
                    filters: { Img: ['png','color']},
                    defaultUri: this.extensionGlobalState.get<string>('defaultLoadingPath')
                        ? vscode.Uri.file(this.extensionGlobalState.get<string>('defaultLoadingPath')!)
                        : undefined,
                });
                paths = uris?.map(uri => uri.fsPath);
            }
            if (paths && paths.length > 0) {
                this.extensionGlobalState.update('defaultLoadingPath', paths[0]);
                // DEVTEMP 临时增加读取json中的地址
                if (paths.toString().slice(-5) == "color") {
                    const colorinfo = JSON.parse(fs.readFileSync(paths.toString(), "utf8"))
                    paths[0] = colorinfo.imgpath
                    if (fs.existsSync(paths.toString())) {
                        const imgs = paths.map(p => Buffer.from(fs.readFileSync(p)).toString('base64'));
                        panel.webview.postMessage({
                            command: 'add',
                            data: { imgs, colorinfo},
                        } as IVscodeMessageEventData);
                    }else{
                        panel.webview.postMessage({
                            command: 'showMessage',
                            data: { message: `配置图片文件不存在` },
                        } as IVscodeMessageEventData);
                    }
                    panel.webview.postMessage({
                        command: 'load',
                        data: { colorinfo },
                    } as IVscodeMessageEventData);
                    panel.webview.postMessage({
                        command: 'updateTitle',
                        data: { colorinfo },
                    } as IVscodeMessageEventData);
                    panel.webview.postMessage({
                        command: 'showMessage',
                        data: { message: `取点配置成功导入` },
                    } as IVscodeMessageEventData);
                }else{
                    const imgs = paths.map(p => Buffer.from(fs.readFileSync(p)).toString('base64'));
                    panel.webview.postMessage({
                        command: 'add',
                        data: { imgs },
                    } as IVscodeMessageEventData);
                }
            } else {
                panel.webview.postMessage({
                    command: 'loadedImg',
                    data: {},
                } as IVscodeMessageEventData);
            }
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `打开本地图片失败: ${err.toString()}` },
                } as IVscodeMessageEventData);
            }
            panel.webview.postMessage({
                command: 'loadedImg',
                data: {},
            } as IVscodeMessageEventData);
        }
    }

    //  DEVTEMP 临时测试,保存json
    private handleSaveImgInfo(panel: vscode.WebviewPanel, data: any) {
        const colorInfoSavePath: string = vscode.workspace.getConfiguration().get('touchsprite-extension.colorInfoDir') || '';
        const snapshotSavePath: string = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir') || '';
        
        if (!fs.existsSync(colorInfoSavePath)) {
            fs.mkdirSync(colorInfoSavePath);
        }
        if (!fs.existsSync(snapshotSavePath)) {
            fs.mkdirSync(snapshotSavePath);
        }
        const url = path.join(colorInfoSavePath, `${data.colorinfo.label2}.color`);
        const imagePath = path.join(snapshotSavePath, `${data.colorinfo.md5}.png`);
        if (!fs.existsSync(imagePath)) {
            const dataBuffer = Buffer.from(data.base64.replace(/^data:image\/\w+;base64,/, ""), 'base64');
            fs.writeFileSync(imagePath,dataBuffer)
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `保存图片成功` },
            } as IVscodeMessageEventData);
        }
        data.colorinfo.imgpath = imagePath
        fs.writeFileSync(url,JSON.stringify(data.colorinfo))
        panel.webview.postMessage({
            command: 'updateTitle',
            data: { colorinfo: data.colorinfo },
        } as IVscodeMessageEventData);
        panel.webview.postMessage({
            command: 'showMessage',
            data: { message: `保存取色成功` },
        } as IVscodeMessageEventData);
    }

        //  DEVTEMP 临时测试,读取json
        private handleLoadImgInfo(panel: vscode.WebviewPanel, data: any) {
            const colorInfoSavePath: string = vscode.workspace.getConfiguration().get('touchsprite-extension.colorInfoDir') || '';
            const colorinfofile = path.join(colorInfoSavePath, `${data}.color`);
            if (!fs.existsSync(colorinfofile)) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `未找到配置文件` },
                } as IVscodeMessageEventData);
                return
            }else{
                const colorinfo = JSON.parse(fs.readFileSync(colorinfofile, "utf8"))
                panel.webview.postMessage({
                    command: 'load',
                    data: { colorinfo },
                } as IVscodeMessageEventData);
            }
            panel.webview.postMessage({
                command: 'showMessage',
                data: { message: `配置载入成功` },
            } as IVscodeMessageEventData);
        }
    

    private handleLoadTemplates(panel: vscode.WebviewPanel) {
        try {
            panel.webview.postMessage({
                command: 'loadTemplates',
                data: { templates: this.extensionGlobalState.get<string>('templates') || '' },
            });
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `读取模板失败: ${err.toString()}` },
                } as IVscodeMessageEventData);
            }
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
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `保存模板失败: ${err.toString()}` },
                } as IVscodeMessageEventData);
            }
        }
    }

    private handleCopy(panel: vscode.WebviewPanel, data: string) {
        try {
            vscode.env.clipboard.writeText(data);
        } catch (err) {
            if (err instanceof Error) {
                panel.webview.postMessage({
                    command: 'showMessage',
                    data: { message: `复制失败: ${err.toString()}` },
                } as IVscodeMessageEventData);
            }
        }
    }
}

export default Snapshoter;
