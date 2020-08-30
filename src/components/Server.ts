import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import Ui, { StatusBarType } from './Ui';
import Api from './Api';
import Project, { IProjectFile, ProjectFileRoot } from './Project';
import Zipper from './Zipper';

export interface IDevice {
    ip: string;
    id: string | undefined;
    name: string | undefined;
    auth: string | undefined;
    expire: number | undefined;
    osType: string | undefined;
}

class Server {
    private readonly _ui: Ui;
    private _accessKey: string;
    private _hostIp: string;
    private _api: Api;
    private _attachingDevice: IDevice | undefined;

    constructor(ui: Ui) {
        this._ui = ui;
        this._accessKey = '';
        this._hostIp = '';
        this.checkAccessKey();
        this.checkLogger();
        this.checkHostIp();
        this._api = new Api();
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
                this._ui.logging(data.toString('utf8', 4, data.length - 2));
            });
        });
        logger.on('error', (err: any) => {
            logger ? logger.close() : null;
            this._ui.logging(
                '日志服务器启用失败，有可能是端口已被占用，请尝试重启、检查防火墙、虚拟网卡等设置，错误代码：' +
                    err.message +
                    ' 如无法解决，请将错误代码发送给开发者获取帮助'
            );
        });
        logger.listen(14088, () => {
            this._ui.logging('日志服务器已启用');
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
        this._ui.logging(`无法正常检测到本机局域网IP，这可能导致设备搜索器和服务器无法正常使用，请尝试重启、检查防火墙、虚拟网卡等设置`);
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

        this._ui.setStatusBar(`连接设备: ${ip} 中...`);
        this._api
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
                this._ui.setStatusBar(`$(device-mobile) 触动插件: ${device.ip} 已连接`);
            })
            .catch(err => {
                this._ui.resetStatusBar();
                this._ui.logging(`连接设备失败: ${err.message}`);
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
                    this._ui.logging('连接设备失败: IP地址格式错误');
                }
            });
    }

    public detachDevice() {
        this._attachingDevice = undefined;
        this._ui.resetStatusBar();
    }

    public operationsMenu() {
        vscode.window.showQuickPick(['触动插件: 搜索设备', '触动插件: 连接设备', '触动插件: 断开设备']).then(selected => {
            switch (selected) {
                case '触动插件: 搜索设备':
                    vscode.commands.executeCommand('extension.search');
                    break;
                case '触动插件: 连接设备':
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

    public runProject(runfile = 'main.lua') {
        if (!this._attachingDevice) {
            this._ui.setStatusBarTemporary(StatusBarType.failed);
            this._ui.logging('运行工程失败: 尚未连接设备');
            return;
        }
        this._api
            .setLogServer(this._attachingDevice, this._hostIp)
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('设置日志服务器失败');
                }
                return this._api.setLuaPath(this._attachingDevice!, runfile);
            })
            .then(async res => {
                if (res.data !== 'ok') {
                    return Promise.reject('设置引导文件失败');
                }
                this._ui.setStatusBar('$(cloud-upload) 上传工程中...');
                const focusing = vscode.window.activeTextEditor?.document;
                if (!focusing) {
                    return Promise.reject('未指定工程');
                }
                const project = new Project(path.dirname(focusing.fileName));
                if (!project.isThereFile(runfile)) {
                    return Promise.reject(`所选工程不包含引导文件 ${runfile}`);
                }
                const pjfs = project.getList();
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
            .then(async () => {
                const includePath: string[] | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
                const miss: string[] = [];
                if (includePath && includePath.length > 0) {
                    for (const icp of includePath) {
                        const project = new Project(icp);
                        const pjfs = project.getList();
                        for (const pjf of pjfs) {
                            await this._api.upload(this._attachingDevice!, pjf).then(res => {
                                if (res.data !== 'ok') {
                                    miss.push(pjf.filename);
                                }
                            });
                        }
                    }
                }
                if (miss.length > 0) {
                    const missInOne = miss.join(', ');
                    return Promise.reject(`以下文件上传失败[${missInOne}]`);
                }
                return Promise.resolve('ok');
            })
            .then(() => {
                this._ui.setStatusBar(StatusBarType.connected);
                return this._api.runLua(this._attachingDevice!);
            })
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('执行引导文件失败');
                }
                this._ui.setStatusBarTemporary(StatusBarType.successful);
                this._ui.logging('运行工程成功');
            })
            .catch(err => {
                this._ui.setStatusBarTemporary(StatusBarType.failed);
                this._ui.logging(`运行工程失败: ${err.toString()}`);
            });
    }

    public runTestProject() {
        const testRunFile: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.testRunFile');
        const runfile = testRunFile ? testRunFile : 'main.test.lua';
        return this.runProject(runfile);
    }

    public runScript() {
        if (!this._attachingDevice) {
            this._ui.setStatusBarTemporary(StatusBarType.failed);
            this._ui.logging('运行工程失败: 尚未连接设备');
            return;
        }
        const focusing = vscode.window.activeTextEditor?.document;
        if (!focusing) {
            this._ui.setStatusBarTemporary(StatusBarType.failed);
            this._ui.logging('运行工程失败: 未指定脚本');
            return;
        }
        if (path.extname(focusing.fileName) !== '.lua') {
            this._ui.setStatusBarTemporary(StatusBarType.failed);
            this._ui.logging('运行工程失败: 所选文件非Lua脚本');
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
                this._ui.setStatusBar('$(cloud-upload) 上传脚本中...');
                return this._api.upload(this._attachingDevice!, pjf);
            })
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('上传脚本文件失败');
                }
                this._ui.setStatusBar(StatusBarType.connected);
                return this._api.runLua(this._attachingDevice!);
            })
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('执行脚本文件失败');
                }
                this._ui.setStatusBarTemporary(StatusBarType.successful);
                this._ui.logging('运行脚本成功');
            })
            .catch(err => {
                this._ui.setStatusBarTemporary(StatusBarType.failed);
                this._ui.logging(`运行工程失败: ${err.toString()}`);
            });
    }

    public stopScript() {
        if (!this._attachingDevice) {
            this._ui.setStatusBarTemporary(StatusBarType.failed);
            this._ui.logging('停止工程失败: 尚未连接设备');
            return;
        }
        this._api
            .stopLua(this._attachingDevice)
            .then(res => {
                if (res.data !== 'ok') {
                    return Promise.reject('停止脚本失败');
                }
                this._ui.setStatusBarTemporary(StatusBarType.successful);
                this._ui.logging('停止脚本成功');
            })
            .catch(err => {
                this._ui.setStatusBarTemporary(StatusBarType.failed);
                this._ui.logging(`停止脚本失败: ${err.toString()}`);
            });
    }

    public zipProject() {
        const focusing = vscode.window.activeTextEditor?.document;
        if (!focusing) {
            this._ui.setStatusBarTemporary(StatusBarType.failed);
            this._ui.logging('打包工程失败: 未指定工程');
            return;
        }
        this._ui.setStatusBar('$(loading) 打包工程中...');
        const projects: Project[] = [];
        const mainPath = path.dirname(focusing.fileName);
        const mainProject = new Project(mainPath);
        projects.push(mainProject);
        const includePath: string[] | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
        if (includePath && includePath.length > 0) {
            for (const icp of includePath) {
                const project = new Project(icp);
                projects.push(project);
            }
        }
        const zipper = new Zipper();
        projects.forEach(project => zipper.addFiles(project));
        Promise.all(projects)
            .then(() => zipper.zipFiles(mainPath))
            .then(() => {
                this._ui.setStatusBarTemporary(StatusBarType.successful);
                this._ui.logging('打包工程成功: ' + mainPath + '.zip');
            })
            .catch(err => {
                this._ui.setStatusBarTemporary(StatusBarType.failed);
                this._ui.logging(`打包工程失败: ${err.toString()}`);
            });
    }

    public getHostIp() {
        return this._hostIp;
    }

    public getAttachingDevice() {
        return this._attachingDevice;
    }

    public test() {}
}

export default Server;
