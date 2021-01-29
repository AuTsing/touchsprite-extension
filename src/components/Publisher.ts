import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as FormData from 'form-data';
import Version from './kits/Version';
import * as qs from 'querystring';
import Server from './Server';
import Ui from './ui/Ui';
import { StatusBarType } from './ui/StatusBar';
import ProjectGenerator from './ProjectGenerator';
import * as path from 'path';
import * as vscode from 'vscode';

const luaparse = require('luaparse');

interface ITouchspriteResponse {
    code: number;
    msg: string;
    data: any;
}

interface IAstObject {
    type: string;
    [index: string]: any;
}

class Publisher {
    private readonly server: Server;
    private readonly loginer: AxiosInstance;
    private readonly updater: AxiosInstance;
    private publishCookie: string | undefined;

    constructor(server: Server) {
        this.server = server;
        this.loginer = axios.create({ maxRedirects: 0 });
        this.loginer.interceptors.response.use(
            resp => resp,
            err => {
                if (err.response.status === 302) {
                    return Promise.resolve(err.response);
                } else {
                    return Promise.reject(err);
                }
            }
        );
        this.updater = axios.create();
    }

    public async publish() {
        const pjg = new ProjectGenerator();
        pjg.generateZip();
        new Promise((resolve, reject) => {
            if (!pjg.focusing) {
                return reject('未指定工程');
            }
            if (!pjg.projectRoot) {
                return reject('所选工程不包含引导文件 main.lua');
            }
            return resolve(this.askPublishCookie());
        })
            .then(() => {
                if (!this.publishCookie) {
                    return Promise.reject('用户验证失败, 请检查Cookie是否可用');
                }
                this.updater.defaults.headers.cookie = this.publishCookie;
                return Promise.all<string, string, string>([
                    this.readScriptId(pjg.projectRoot!),
                    this.readScriptVersion(pjg.projectRoot!),
                    this.server.zipProject(),
                ]);
            })
            .then((values: any) => {
                const id: string = values[0];
                const ver: string = values[1];
                const zip: string = values[2];
                if (!id) {
                    return Promise.reject('脚本ID无法正确读取');
                }
                if (!ver) {
                    return Promise.reject('脚本版本号无法正确读取');
                }
                return Promise.all([id, ver, zip]);
            })
            .then(values => {
                const id = values[0];
                const ver = values[1];
                const zip = values[2];
                Ui.setStatusBar('$(cloud-upload) 发布中...');
                return Promise.all([
                    id,
                    this.askScriptState(id).then(respData => {
                        if (ver === 'major' || ver === 'minor' || ver === 'patch') {
                            const version = new Version(respData.data.version.version);
                            const newVer = version[ver]().get();
                            return newVer;
                        } else {
                            return ver;
                        }
                    }),
                    this.uploadScript(zip).then(respData => {
                        const key = respData.data.key;
                        return key;
                    }),
                ]);
            })
            .then(values => {
                const id = values[0];
                const ver = values[1];
                const key = values[2];
                return this.versionScript(id, ver, key);
            })
            .then(resp => {
                Ui.setStatusBarTemporary(StatusBarType.successful);
                Ui.logging(`发布版本成功: ID >> ${resp.id}; VER >> ${resp.ver};`);
            })
            .catch(err => {
                Ui.setStatusBarTemporary(StatusBarType.failed);
                Ui.logging(`发布版本失败: ${err}`);
            });
    }

    private askScriptState(id: string): Promise<ITouchspriteResponse> {
        return this.updater
            .get('https://dev.touchsprite.com/touch/script/view', {
                params: { id: id },
            })
            .then(resp => {
                if (resp.data.code === 200 && resp.data.msg === '查询成功') {
                    return resp.data;
                } else {
                    return Promise.reject(resp.data.msg);
                }
            });
    }

    private uploadScript(zip: string): Promise<ITouchspriteResponse> {
        const zipStream = fs.createReadStream(zip);
        const formData = new FormData();
        formData.append('ScriptUpload[file]', zipStream);
        const formHeaders = formData.getHeaders();

        return this.updater.post('https://dev.touchsprite.com/touch/script/upload', formData, { headers: { ...formHeaders } }).then(resp => {
            if (resp.data.code === 200 && resp.data.msg === '上传成功') {
                return resp.data;
            } else {
                return Promise.reject(resp.data.msg);
            }
        });
    }

    private versionScript(id: string, ver: string, key: string) {
        const formData = {
            version: ver,
            key: key,
            script_id: id,
            is_default: true,
            encrypt_mode: 6,
            updated_logs: ' ',
        };
        return this.updater
            .post('https://dev.touchsprite.com/touch/script/version', qs.stringify(formData), {
                headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            })
            .then(resp => {
                if (resp.data.code === 200 && resp.data.msg === '版本上传成功') {
                    return { id: id, ver: ver };
                } else {
                    return Promise.reject(resp.data.msg);
                }
            });
    }

    private readLuaconfig(config: string) {
        try {
            fs.accessSync(config, fs.constants.R_OK);
            const content = fs.readFileSync(config, { encoding: 'utf8' });
            const ast = luaparse.parse(content);
            if (ast && ast.type === 'Chunk') {
                const rets: IAstObject[] = ast.body;
                const ret = rets.find(ret => ret.type === 'ReturnStatement');
                if (ret && ret.arguments.length === 1 && ret.arguments[0].type === 'TableConstructorExpression') {
                    const maps: IAstObject[] = ret.arguments[0].fields;
                    const table: { [index: string]: any } = {};
                    maps.forEach(map => {
                        let key: string = '';
                        let value: any = undefined;
                        if (map.type === 'TableKey') {
                            key = map.key.raw.slice(1, -1);
                        } else if (map.type === 'TableKeyString') {
                            key = map.key.name;
                        }
                        if (map.value.type === 'StringLiteral') {
                            value = map.value.raw.slice(1, -1);
                        } else if (map.value.type === 'NumericLiteral' || map.value.type === 'BooleanLiteral') {
                            value = map.value.value;
                        }
                        if (key && value !== undefined) {
                            table[key] = value;
                        }
                    });
                    return table;
                }
            }
            return {};
        } catch (err) {
            return {};
        }
    }

    private async readScriptId(root: string): Promise<string> {
        const configUri = path.join(root, '/luaconfig.lua');
        const table = this.readLuaconfig(configUri);
        if (table.id && /^[0-9]*$/.test(table.id)) {
            return table.id;
        } else {
            Ui.logging(`WARNING: 读取配置文件 ${configUri} 字段 id 失败, 请手动指定脚本ID`);
            let id: string = '';
            await vscode.window
                .showInputBox({
                    prompt: '请手动指定脚本ID',
                    value: '',
                })
                .then(inputValue => {
                    inputValue = inputValue ? inputValue : '';
                    inputValue = /^[0-9]*$/.test(inputValue) ? inputValue : '';
                    id = inputValue;
                });
            return id;
        }
    }

    private async readScriptVersion(root: string): Promise<string> {
        const configUri = path.join(root, '/luaconfig.lua');
        const table = this.readLuaconfig(configUri);
        if (table.version && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(table.version)) {
            return table.version;
        } else {
            Ui.logging(`WARNING: 读取配置文件 ${configUri} 字段 version 失败, 请选择版本调整方式`);
            let version: string = '';
            await vscode.window.showQuickPick(['major', 'minor', 'patch', '手动输入']).then(async selected => {
                if (!selected) {
                    return;
                }
                if (selected === '手动输入') {
                    await vscode.window
                        .showInputBox({
                            prompt: '请输入版本号',
                            value: '',
                            placeHolder: 'x.y.z',
                        })
                        .then(inputValue => {
                            inputValue = inputValue ? inputValue : '';
                            inputValue = /^[0-9]+\.[0-9]+\.[0-9]+$/.test(inputValue) ? inputValue : '';
                            version = inputValue;
                        });
                } else {
                    version = selected;
                }
            });
            return version;
        }
    }

    private askPublishCookie() {
        if (this.publishCookie) {
            return Promise.resolve();
        }
        const configCookie = vscode.workspace.getConfiguration('touchsprite-extension');
        const cookie: string = configCookie.cookie;
        if (!cookie) {
            return Promise.reject('登陆cookie未定义, 请在设置中填入cookie后重试');
        }
        return this.loginer.get('https://account.touchsprite.com/', { headers: { cookie: cookie } }).then(resp => {
            if (resp.status === 302) {
                const gotCookies: string[] = resp.headers['set-cookie'];
                const gotCookie = gotCookies.find(ck => ck.slice(0, 9) === 'PHPSESSID');
                if (gotCookie) {
                    this.publishCookie = gotCookie.split(';')[0];
                }
            }
        });
    }

    public test() {}
}

export default Publisher;
