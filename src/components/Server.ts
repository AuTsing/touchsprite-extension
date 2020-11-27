import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import Ui from './ui/Ui';
import { StatusBarType } from './ui/StatusBar';
import Api from './Api';
import Zipper from './Zipper';
import * as fs from 'fs';
import ProjectGenerator, { IProjectFile, ProjectFileRoot } from './ProjectGenerator';

export interface IDevice {
    ip: string;
    id: string | undefined;
    name: string | undefined;
    auth: string | undefined;
    expire: number | undefined;
    osType: string | undefined;
}

class Server {
    private readonly _api: Api;
    private _accessKey: string;
    private _hostIp: string;
    private _attachingDevice: IDevice | undefined;
    private readonly _extensionPath: string;

    constructor(context: vscode.ExtensionContext) {
        this._accessKey = '';
        this._hostIp = '';
        this.checkAccessKey();
        this.checkLogger();
        this.checkHostIp();
        this._api = new Api();
        this._extensionPath = context.extensionPath;
    }

    private checkAccessKey() {
        let accessKey: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.accessKey');
        if (accessKey) {
            this._accessKey = accessKey;
            return;
        }
        vscode.window
            .showInformationMessage(
                '开发者AccessKey尚未填写，没有正确填写开发者AccessKey将导致插件无法正常使用，是否现在填写？填写后你可以随时在设置中修改。',
                '是',
                '否',
                '不再提示'
            )
            .then(result => {
                if (result === '是') {
                    vscode.window
                        .showInputBox({
                            prompt: '请输入开发者key',
                            value: '',
                            placeHolder: '开发者key请浏览触动官网查询',
                            ignoreFocusOut: true,
                        })
                        .then(inputValue => {
                            if (inputValue) {
                                this._accessKey = inputValue;
                                vscode.workspace.getConfiguration().update('touchsprite-extension.accessKey', inputValue, true);
                            } else {
                                return this.checkAccessKey();
                            }
                        });
                } else if (result === '否') {
                    return this.checkAccessKey();
                } else {
                    return;
                }
            });
    }

    private checkLogger() {
        const logger = net.createServer((socket: net.Socket) => {
            socket.on('data', data => {
                Ui.logging(data.toString('utf8', 4, data.length - 2));
            });
        });
        logger.on('error', (err: any) => {
            logger ? logger.close() : null;
            Ui.logging(
                '日志服务器启用失败，有可能是端口已被占用，请尝试重启、检查防火墙、虚拟网卡等设置，错误代码：' +
                    err.message +
                    ' 如无法解决，请将错误代码发送给开发者获取帮助'
            );
        });
        logger.listen(14088, () => {
            Ui.logging('触动插件已启用');
        });
    }

    private checkHostIp() {
        const interfaces = os.networkInterfaces();
        for (let devName in interfaces) {
            const iface = interfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    this._hostIp = alias.address;
                    return;
                }
            }
        }
        Ui.logging(`WARN: 无法正常获取本机局域网IP，这可能导致触动服务无法正常使用，请尝试重启、检查防火墙、卸载虚拟网卡等操作，也可以尝试手动设置本机IP`);
    }

    public attachDevice(ip: string) {
        const device: IDevice = {
            ip: ip,
            id: undefined,
            name: undefined,
            auth: undefined,
            expire: undefined,
            osType: undefined,
        };

        Ui.setStatusBar(`连接设备: ${ip} 中...`);
        return this._api
            .getDeviceId(device)
            .then(res => {
                device.id = res.data;
                return this._api.getAuth(device, this._accessKey);
            })
            .then(res => {
                const { data } = res;
                if (data.status === 403) {
                    return Promise.reject('连接设备数超过最大设备数，请前往开发者后台清空设备，稍后再尝试');
                }
                if (data.status !== 200) {
                    return Promise.reject('获取身份验证失败');
                }
                device.auth = data.auth;
                device.expire = data.time + data.valid;
                return this._api.getDeviceName(device);
            })
            .then(res => {
                device.name = res.data;
                const osType: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.osType');
                switch (osType) {
                    case '苹果':
                        device.osType = 'iOS';
                        break;
                    case '安卓':
                        device.osType = 'Android';
                        break;
                    case '安卓模拟器':
                        device.osType = 'Android_x86';
                        break;
                    case '自动':
                    default:
                        if (device.name === 'iPhone') {
                            device.osType = 'iOS';
                        } else {
                            device.osType = 'Android';
                        }
                        break;
                }
                return Promise.resolve(device);
            })
            .then(device => {
                this._attachingDevice = device;
                Ui.setStatusBar(`$(device-mobile) 触动插件: ${device.ip} 已连接`);
            })
            .catch(err => {
                Ui.resetStatusBar();
                Ui.logging(`连接设备失败: ${err.message}`);
            });
    }

    public attachDeviceThroughInput() {
        vscode.window
            .showInputBox({
                prompt: '请输入设备IP地址',
                value: '192.168.',
                placeHolder: 'x.x.x.x',
            })
            .then(inputValue => {
                inputValue = inputValue ? inputValue : '';
                inputValue = /^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(inputValue) ? inputValue : '';
                if (inputValue) {
                    this.attachDevice(inputValue);
                } else {
                    Ui.logging('连接设备失败: IP地址格式错误');
                }
            });
    }

    public detachDevice() {
        this._attachingDevice = undefined;
        Ui.resetStatusBar();
    }

    public operationsMenu() {
        vscode.window.showQuickPick(['触动插件: 连接设备(搜索设备)', '触动插件: 连接设备(手动输入)', '触动插件: 断开设备']).then(selected => {
            switch (selected) {
                case '触动插件: 连接设备(搜索设备)':
                    vscode.commands.executeCommand('extension.search');
                    break;
                case '触动插件: 连接设备(手动输入)':
                    vscode.commands.executeCommand('extension.connect');
                    break;
                case '触动插件: 断开设备':
                    vscode.commands.executeCommand('extension.disconnect');
                    break;
                default:
                    break;
            }
        });
    }

    public runProject(runfile = 'main.lua', boot?: string) {
        boot = boot ? boot : runfile;
        if (!this._attachingDevice) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('运行工程失败: 尚未连接设备');
            return;
        }
        return this._api
            .setLogServer(this._attachingDevice, this._hostIp)
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('设置日志服务器失败');
                }
                return this._api.setLuaPath(this._attachingDevice!, boot!);
            })
            .then(async res => {
                if (res.data !== 'ok') {
                    return Promise.reject('设置引导文件失败');
                }
                Ui.setStatusBar('$(cloud-upload) 上传工程中...');
                const pjg = new ProjectGenerator(runfile);
                pjg.generate();
                if (!pjg.focusing) {
                    return Promise.reject('未指定工程，请聚焦在工程文件再运行');
                }
                if (!pjg.projectRoot) {
                    return Promise.reject(`所选工程不包含引导文件 ${runfile}`);
                }
                const pjfs = pjg.projectFiles;
                const miss: string[] = [];
                for (const pjf of pjfs) {
                    await this._api.upload(this._attachingDevice!, pjf).then(res => {
                        if (res.data !== 'ok') {
                            miss.push(pjf.filename);
                        }
                    });
                }
                if (miss.length > 0) {
                    const missInOne = miss.join(', ');
                    return Promise.reject(`以下文件上传失败[${missInOne}]`);
                }
                return Promise.resolve('ok');
            })
            .then(() => {
                Ui.setStatusBar(StatusBarType.connected);
                return this._api.runLua(this._attachingDevice!);
            })
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('执行引导文件失败');
                }
                Ui.setStatusBarTemporary(StatusBarType.successful);
                Ui.logging('运行工程成功');
            })
            .catch(err => {
                Ui.setStatusBarTemporary(StatusBarType.failed);
                Ui.logging(`运行工程失败: ${err.toString()}`);
            });
    }

    public runTestProject() {
        const testRunFile: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.testRunFile');
        const runfile = testRunFile ? testRunFile : 'maintest.lua';
        return this.runProject(runfile);
    }

    public runScript() {
        if (!this._attachingDevice) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('运行工程失败: 尚未连接设备');
            return;
        }
        const focusing = vscode.window.activeTextEditor?.document;
        if (!focusing) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('运行工程失败: 未指定脚本');
            return;
        }
        if (path.extname(focusing.fileName) !== '.lua') {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('运行工程失败: 所选文件非Lua脚本');
            return;
        }
        this._api
            .setLogServer(this._attachingDevice, this._hostIp)
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('设置日志服务器失败');
                }
                return this._api.setLuaPath(this._attachingDevice!, path.basename(focusing.fileName));
            })
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('设置引导文件失败');
                }
                const pjf: IProjectFile = {
                    url: focusing.fileName,
                    path: '/',
                    filename: path.basename(focusing.fileName),
                    root: ProjectFileRoot.lua,
                };
                Ui.setStatusBar('$(cloud-upload) 上传脚本中...');
                return this._api.upload(this._attachingDevice!, pjf);
            })
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('上传脚本文件失败');
                }
                Ui.setStatusBar(StatusBarType.connected);
                return this._api.runLua(this._attachingDevice!);
            })
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('执行脚本文件失败');
                }
                Ui.setStatusBarTemporary(StatusBarType.successful);
                Ui.logging('运行脚本成功');
            })
            .catch(err => {
                Ui.setStatusBarTemporary(StatusBarType.failed);
                Ui.logging(`运行工程失败: ${err.toString()}`);
            });
    }

    public stopScript() {
        if (!this._attachingDevice) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('停止工程失败: 尚未连接设备');
            return;
        }
        this._api
            .stopLua(this._attachingDevice)
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('停止脚本失败');
                }
                Ui.setStatusBarTemporary(StatusBarType.successful);
                Ui.logging('停止脚本成功');
            })
            .catch(err => {
                Ui.setStatusBarTemporary(StatusBarType.failed);
                Ui.logging(`停止脚本失败: ${err.toString()}`);
            });
    }

    public zipProject() {
        const pjg = new ProjectGenerator();
        pjg.generateZip();
        if (!pjg.focusing) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('打包工程失败: 未指定工程');
            return;
        }
        if (!pjg.projectRoot) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('打包工程失败: 所选工程不包含引导文件 main.lua');
            return;
        }
        Ui.setStatusBar('$(loading) 打包工程中...');
        const mainDir = pjg.projectRoot;
        const zipper = new Zipper();
        zipper
            .addFiles(pjg)
            .then(() => zipper.zipFiles(mainDir))
            .then(() => {
                Ui.setStatusBarTemporary(StatusBarType.successful);
                Ui.logging('打包工程成功: ' + mainDir + '.zip');
            })
            .catch(err => {
                Ui.setStatusBarTemporary(StatusBarType.failed);
                Ui.logging(`打包工程失败: ${err.toString()}`);
            });
    }

    public uploadFile() {
        if (!this._attachingDevice) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('运行工程失败: 尚未连接设备');
            return;
        }
        let root: ProjectFileRoot = ProjectFileRoot.res;
        const showQuickPickOptions: vscode.QuickPickOptions = {
            placeHolder: '上传至...',
        };
        vscode.window
            .showQuickPick(['lua', 'res'], showQuickPickOptions)
            .then(terminal => {
                if (!terminal) {
                    return;
                }
                root = terminal === 'lua' ? ProjectFileRoot.lua : ProjectFileRoot.res;
                const openDialogOptions: vscode.OpenDialogOptions = {
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                };
                return vscode.window.showOpenDialog(openDialogOptions);
            })
            .then(async (uri: vscode.Uri[] | undefined) => {
                if (uri && uri.length > 0) {
                    const pjfs: IProjectFile[] = uri.map(file => {
                        const url = file.path.substring(1);
                        return {
                            url: url,
                            path: '/',
                            filename: path.basename(url),
                            root: root,
                        };
                    });
                    Ui.setStatusBar('$(cloud-upload) 上传文件中...');
                    const miss: string[] = [];
                    for (const pjf of pjfs) {
                        await this._api.upload(this._attachingDevice!, pjf).then(res => {
                            if (res.data !== 'ok') {
                                miss.push(pjf.filename);
                            }
                        });
                    }
                    if (miss.length > 0) {
                        const missInOne = miss.join(', ');
                        return Promise.reject(`以下文件上传失败[${missInOne}]`);
                    }
                    return Promise.resolve(uri.length);
                } else {
                    return Promise.reject(`未选择文件`);
                }
            })
            .then(
                succeed => {
                    Ui.setStatusBarTemporary(StatusBarType.successful);
                    Ui.logging('上传文件成功: ' + succeed);
                },
                err => {
                    Ui.setStatusBarTemporary(StatusBarType.failed);
                    Ui.logging(`上传文件失败: ${err.toString()}`);
                }
            );
    }

    public setHostIp() {
        vscode.window
            .showInputBox({
                prompt: '请本机IP地址',
                value: '192.168.',
                placeHolder: 'x.x.x.x',
            })
            .then(inputValue => {
                inputValue = inputValue ? inputValue : '';
                inputValue = /^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(inputValue) ? inputValue : '';
                if (inputValue) {
                    this._hostIp = inputValue;
                    Ui.logging('设置本机IP地址成功: ' + inputValue);
                } else {
                    Ui.logging('设置本机IP地址失败: IP地址格式错误');
                }
            });
    }

    public getHostIp() {
        return this._hostIp;
    }

    public getAttachingDevice() {
        return this._attachingDevice;
    }

    public async debug() {
        if (!this._attachingDevice) {
            Ui.setStatusBarTemporary(StatusBarType.failed);
            Ui.logging('开启调试失败: 尚未连接设备');
            return;
        }

        const luapanda = vscode.Uri.file(path.join(this._extensionPath, 'assets', 'debugger', 'LuaPanda.lua'));

        const bootStr = `require("LuaPanda").start("${this._hostIp}",8818)local a=function(b)LuaPanda.printToVSCode(b,1,2)end;nLog=a;require("maintest")`;
        fs.writeFileSync(path.join(this._extensionPath, 'assets', 'debugger', 'boot.lua'), bootStr);
        const boot = vscode.Uri.file(path.join(this._extensionPath, 'assets', 'debugger', 'boot.lua'));

        const uris: vscode.Uri[] = [luapanda, boot];

        new Promise<any>(async (resolve, reject) => {
            if (uris && uris.length > 0) {
                const pjfs: IProjectFile[] = uris.map(file => {
                    const url = file.path.substring(1);
                    return {
                        url: url,
                        path: '/',
                        filename: path.basename(url),
                        root: ProjectFileRoot.lua,
                    };
                });
                Ui.setStatusBar('$(cloud-upload) 上传文件中...');
                const miss: string[] = [];
                for (const pjf of pjfs) {
                    await this._api.upload(this._attachingDevice!, pjf).then(res => {
                        if (res.data !== 'ok') {
                            miss.push(pjf.filename);
                        }
                    });
                }
                if (miss.length > 0) {
                    const missInOne = miss.join(', ');
                    return reject(`以下文件上传失败[${missInOne}]`);
                }
            }
            return resolve(uris.length);
        })
            .then((succeed: number) => {
                Ui.logging('上传引导文件成功: ' + succeed);

                return vscode.debug.startDebugging(undefined, {
                    type: 'lua',
                    request: 'launch',
                    tag: 'normal',
                    name: 'LuaPanda',
                    description: '通用模式,通常调试项目请选择此模式 | launchVer:3.2.0',
                    luaFileExtension: '',
                    connectionPort: 8818,
                    stopOnEntry: false,
                    useCHook: true,
                    autoPathMode: true,
                });
            })
            .then(() => {
                const testRunFile: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.testRunFile');
                const runfile = testRunFile ? testRunFile : 'maintest.lua';
                return this.runProject(runfile, 'boot.lua');
            })
            .catch(err => {
                Ui.setStatusBarTemporary(StatusBarType.failed);
                Ui.logging(`开始调试失败: ${err.toString()} 请尝试调整配置后重新运行`);
            });
    }

    public test() {
        const pjg = new ProjectGenerator();
        pjg.generate();
        console.log(pjg.focusing, pjg.projectRoot, pjg.projectFiles);
    }
}

export default Server;
