import * as Os from 'os';
import * as Path from 'path';
import * as Net from 'net';
import * as FsPromises from 'fs/promises';
import Axios from 'axios';
import Device, { TsFileRoot, TsFile, TsApiStatusResponseData } from './Device';
import DeviceSearcher from './DeviceSearcher';
import Projector, { ProjectMode } from './Projector';
import Output from './Output';
import { TS_OPENAPI_URL } from '../values/Constants';
import Storage, { Configurations } from './Storage';
import Asker from './Asker';
import StatusBar from './StatusBar';
import Workspace from './Workspace';

interface TsOpenApiResponseData {
    status: number;
    message: string;
    time: number;
    auth: string;
    valid: string;
    remainder_token: number;
}

export default class Touchsprite {
    private readonly storage: Storage;
    private readonly asker: Asker;
    private readonly workspace: Workspace;
    private readonly loggerPort: number;
    private attachedDevice: Device | null;
    private hostIp: string | null;

    constructor(storage: Storage, asker: Asker, workspace: Workspace) {
        this.storage = storage;
        this.asker = asker;
        this.workspace = workspace;
        this.loggerPort = Math.round(Math.random() * (20000 - 24999 + 1) + 24999);
        this.attachedDevice = null;
        this.hostIp = null;
        this.runLogger();
    }

    private async runLogger() {
        const logger = Net.createServer(socket => {
            socket.on('data', data => Output.println(data.toString('utf8', 4, data.length - 2)));
        });
        logger.on('error', e => {
            logger.close();
            Output.eprintln('日志服务器启用失败，这可能导致设备日志无法正常接收:', e.message);
            Output.elogln((e as Error).stack ?? e);
        });
        logger.listen(this.loggerPort);
    }

    private async getAuth(accessKey: string, id: string): Promise<string> {
        const postData = JSON.stringify({
            action: 'getAuth',
            key: accessKey,
            devices: [id],
            valid: 3600,
            time: Math.floor(Date.now() / 1000),
        });
        const postDataLength = Buffer.byteLength(postData);

        const resp = await Axios.post<TsOpenApiResponseData>(TS_OPENAPI_URL, postData, {
            headers: {
                Connection: 'close',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postDataLength,
            },
        });
        if (!resp.data.auth) {
            throw Error('获取授权失败');
        }

        return resp.data.auth;
    }

    private async getAccessKey(): Promise<string> {
        let accessKey = this.storage.getStringConfiguration(Configurations.AccessKey);
        if (!accessKey) {
            accessKey = await this.asker.askForAccessKey();
        }

        return accessKey;
    }

    getHostIp(): string {
        if (!this.hostIp) {
            const interfaces = Os.networkInterfaces();
            forInterfaces: for (const interfaceKey in interfaces) {
                if (interfaceKey.toLocaleLowerCase().indexOf('vmware') >= 0) {
                    continue;
                }
                if (interfaceKey.toLocaleLowerCase().indexOf('virtualbox') >= 0) {
                    continue;
                }
                if (interfaceKey.toLocaleLowerCase().indexOf('vethernet') >= 0) {
                    continue;
                }
                const infos = interfaces[interfaceKey]!;
                for (const info of infos) {
                    if (info.family !== 'IPv4') {
                        continue;
                    }
                    if (info.address === '127.0.0.1') {
                        continue;
                    }
                    if (info.internal === true) {
                        continue;
                    }
                    if (info.mac === '00:00:00:00:00:00') {
                        continue;
                    }
                    this.hostIp = info.address;
                    break forInterfaces;
                }
            }
        }

        if (!this.hostIp) {
            throw Error('无法获取主机 IP');
        }

        return this.hostIp;
    }

    private async attachDevice(ip: string): Promise<void> {
        const accessKey = await this.getAccessKey();
        const axios = Axios.create({ baseURL: `http://${ip}:50005`, timeout: 10000 });
        const id = (await axios.get<string>('/deviceid', { headers: { Connection: 'close', 'Content-Length': 0 } }))
            .data;
        const auth = await this.getAuth(accessKey, id);
        const name = (
            await axios.get<string>('/devicename', { headers: { Connection: 'close', 'Content-Length': 0, auth } })
        ).data;
        const isIosPersonal = this.storage.getBooleanConfiguration(Configurations.IsIosPersonal);

        let platform!: 'ios' | 'android';
        if (id.length === 32) {
            platform = 'ios';
        }
        if (id.length === 33) {
            platform = 'android';
        }

        let userPath!: string;
        if (platform === 'ios') {
            userPath = '/var/mobile/Media/TouchSprite';
        }
        if (platform === 'android') {
            userPath = '/sdcard/TouchSprite';
        }

        if (isIosPersonal === true) {
            platform = 'ios';
            userPath = '/var/mobile/Media/TouchSpritePe';
        }

        if (this.attachedDevice) {
            this.handleDetachDevice();
        }

        this.attachedDevice = new Device(ip, id, auth, name, platform, userPath, axios);
        this.storage.addDeviceIp(this.attachedDevice.ip);
        StatusBar.connected(this.attachedDevice.ip);
    }

    private async attachDeviceByDefault(): Promise<void> {
        const doing = StatusBar.doing('连接中');
        try {
            const ips = this.storage.getDeviceIps();
            if (ips.length === 0) {
                throw new Error('未连接设备');
            }
            const lastIp = ips[ips.length - 1];
            Output.println(`未连接设备，尝试连接最后使用设备: ${lastIp}`);
            await this.attachDevice(lastIp);
        } catch (e) {
            throw e;
        } finally {
            doing?.dispose();
        }
    }

    private watchRunningStatus() {
        if (!this.attachedDevice) {
            return;
        }
        StatusBar.running(this.attachedDevice.ip);
        const stopWatching = setInterval(async () => {
            try {
                if (!this.attachedDevice) {
                    throw new Error('未连接设备');
                }
                const running = await this.attachedDevice.status();
                if (running !== TsApiStatusResponseData.running) {
                    throw new Error('运行结束');
                }
            } catch (e) {
                StatusBar.running();
                clearInterval(stopWatching);
            }
        }, 1000);
    }

    private async uploadProject(mainFilename: string): Promise<void> {
        const doing = StatusBar.doing('上传工程中');
        try {
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }
            const projector = new Projector(this.storage, mainFilename, ProjectMode.send);
            const tsFiles = await projector.generate();
            const total = tsFiles.length;
            let progress = 0;
            for (const file of tsFiles) {
                await this.attachedDevice.upload(file);
                doing?.updateProgress(++progress / total);
                StatusBar.refresh();
            }
        } catch (e) {
            throw e;
        } finally {
            doing?.dispose();
        }
    }

    async getSnap(): Promise<ArrayBuffer> {
        const doing = StatusBar.doing('截图中');
        try {
            if (!this.attachedDevice) {
                await this.attachDeviceByDefault();
            }
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }

            const snapOrient = this.storage.getStringConfiguration(Configurations.SnapOrient);
            let numberOfOrient: number;
            switch (snapOrient) {
                case 'home键在下':
                    numberOfOrient = 0;
                    break;
                case 'home键在左':
                    numberOfOrient = 2;
                    break;
                case 'home键在右':
                default:
                    numberOfOrient = 1;
                    break;
            }
            const img = await this.attachedDevice.snapshot(numberOfOrient);

            const snapDir = this.storage.getStringConfiguration(Configurations.SnapDir);
            if (snapDir) {
                const url = Path.join(snapDir, `PIC_${Date.now()}.png`);
                await FsPromises.writeFile(url, Buffer.from(img));
            }

            StatusBar.result('截图成功');
            return img;
        } catch (e) {
            throw e;
        } finally {
            doing?.dispose();
        }
    }

    handleDetachDevice() {
        try {
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }
            this.attachedDevice = null;
            StatusBar.disconnected();
            Output.println('断开设备成功');
        } catch (e) {
            Output.eprintln('断开设备失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        }
    }

    async handleAttachDeviceByInput(): Promise<void> {
        const doing = StatusBar.doing('连接中');
        try {
            const ip = await this.asker.askForDeviceIpWithHistory();
            await this.attachDevice(ip);
            Output.println('连接设备成功:', ip);
        } catch (e) {
            Output.eprintln('连接设备失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        } finally {
            doing?.dispose();
        }
    }

    async handleAttachDeviceBySearch(): Promise<void> {
        const doing = StatusBar.doing('连接中');
        try {
            const deviceSearcher = new DeviceSearcher(this.getHostIp());
            const device = await deviceSearcher.search();
            await this.attachDevice(device.ip);
            Output.println('连接设备成功:', device.ip);
        } catch (e) {
            Output.eprintln('连接设备失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        } finally {
            doing?.dispose();
        }
    }

    async handleRunProject(mainFilename: string = 'main.lua', boot?: string): Promise<void> {
        const doing = StatusBar.doing('准备运行工程');
        try {
            boot = boot ?? mainFilename;

            if (!this.attachedDevice) {
                await this.attachDeviceByDefault();
            }
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }

            const running = await this.attachedDevice.status();
            if (running === TsApiStatusResponseData.running) {
                await this.handleStopScript();
            }

            await this.uploadProject(mainFilename);
            await this.attachedDevice.logServer(this.getHostIp(), this.loggerPort);
            await this.attachedDevice.setLuaPath(boot);
            await this.attachedDevice.runLua();
            this.watchRunningStatus();

            Output.println('运行工程成功');
        } catch (e) {
            Output.eprintln('运行工程失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        } finally {
            doing?.dispose();
        }
    }

    async handleRunTestProject(): Promise<void> {
        return this.handleRunProject('maintest.lua');
    }

    async handleRunScript(): Promise<void> {
        const doing = StatusBar.doing('准备运行脚本');
        try {
            if (!this.attachedDevice) {
                await this.attachDeviceByDefault();
            }
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }

            const running = await this.attachedDevice.status();
            if (running === TsApiStatusResponseData.running) {
                await this.handleStopScript();
            }

            await this.attachedDevice.logServer(this.getHostIp(), this.loggerPort);

            const focusingFile = this.workspace.getFocusingFile();
            const url = focusingFile.fileName;
            const filename = Path.basename(url);
            const ext = Path.extname(filename);
            if (ext !== '.lua') {
                throw new Error('文件非 Lua 脚本');
            }

            await this.attachedDevice.setLuaPath(filename);
            await this.attachedDevice.upload({
                url,
                root: TsFileRoot.lua,
                path: '/',
                filename,
            });
            await this.attachedDevice.runLua();
            this.watchRunningStatus();

            Output.println('运行脚本成功');
        } catch (e) {
            Output.eprintln('运行脚本失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        } finally {
            doing?.dispose();
        }
    }

    async handleStopScript(): Promise<void> {
        try {
            if (!this.attachedDevice) {
                await this.attachDeviceByDefault();
            }
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }

            await this.attachedDevice.stopLua();

            Output.println('停止脚本成功');
        } catch (e) {
            Output.eprintln('停止脚本失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        }
    }

    async handleUploadFile(): Promise<void> {
        const doing = StatusBar.doing('上传文件中');
        try {
            if (!this.attachedDevice) {
                await this.attachDeviceByDefault();
            }
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }

            const dst = await this.asker.askForUploadDst();
            const uris = await this.asker.askForUploadFiles();
            const files: TsFile[] = uris.map(uri => {
                const url = uri.path.substring(1);
                const filename = Path.basename(url);
                return {
                    url,
                    root: dst,
                    path: '/',
                    filename,
                };
            });

            for (const file of files) {
                await this.attachedDevice.upload(file);
            }

            Output.println('上传文件成功:', `${files.length} 个文件`);
            StatusBar.result('上传文件成功');
        } catch (e) {
            Output.eprintln('上传文件失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        } finally {
            doing?.dispose();
        }
    }

    async handleClearScript(): Promise<void> {
        const doing = StatusBar.doing('清空脚本中');
        try {
            if (!this.attachedDevice) {
                await this.attachDeviceByDefault();
            }
            if (!this.attachedDevice) {
                throw new Error('未连接设备');
            }

            const dirs: string[] = ['/'];
            const dirsToRm: string[] = [];
            const filesToRm: string[] = [];

            while (dirs.length > 0) {
                const dir = dirs.shift()!;
                const list = await this.attachedDevice.getFileList(dir);
                list.Dirs?.forEach(nextDir => dirs.push(dir + nextDir + '/'));
                list.Files?.forEach(nextFile => filesToRm.push(dir + nextFile));
                if (dir !== '/') {
                    dirsToRm.push(dir);
                }
            }

            const total = dirsToRm.length + filesToRm.length;
            let progress = 0;
            for (const file of filesToRm) {
                await this.attachedDevice.rmFile(file);
                doing?.updateProgress(++progress / total);
                StatusBar.refresh();
            }
            for (const dir of dirsToRm.reverse()) {
                await this.attachedDevice.rmFile(dir);
                doing?.updateProgress(++progress / total);
                StatusBar.refresh();
            }

            Output.println('清空脚本成功:', `${total} 个文件`);
            StatusBar.result('清空脚本成功');
        } catch (e) {
            Output.eprintln('清空脚本失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        } finally {
            doing?.dispose();
        }
    }
}
