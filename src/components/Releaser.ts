import * as Path from 'path';
import * as FsPromises from 'fs/promises';
import * as Fs from 'fs';
import * as FormData from 'form-data';
import Axios, { AxiosInstance } from 'axios';
import * as Luaparse from 'luaparse';
import * as ChanglogParser from 'changelog-parser';
import Projector, { ProjectMode } from './Projector';
import Zipper from './Zipper';
import Storage, { Configurations } from './Storage';
import Asker from './Asker';
import { TS_ENT_INFO_URL, TS_ENT_UPDATE_URL, TS_ENT_UPLOAD_URL, TS_INFO_URL, TS_LOGIN_URL, TS_UPDATE_URL, TS_UPLOAD_URL } from '../values/Constants';
import StatusBar from './StatusBar';
import Output from './Output';

export interface LuaconfigTable {
    id: string | null;
    idEnt: string | null;
    version: string | null;
}

export interface ITsScriptInfo {
    name: string;
    version: string;
    encrypt: string;
    updatedAt: string;
}

export enum ProductTarget {
    Ts,
    Ent,
}

export default class Releaser {
    private readonly storage: Storage;
    private readonly asker: Asker;
    private readonly loginer: AxiosInstance;
    private readonly updater: AxiosInstance;

    constructor(storage: Storage, asker: Asker) {
        this.storage = storage;
        this.asker = asker;
        this.loginer = Axios.create({
            timeout: 30000,
            maxRedirects: 0,
        });
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
        this.updater = Axios.create({
            timeout: 30000,
        });
    }

    private async login(): Promise<void> {
        if (this.updater.defaults.headers.common['cookie']) {
            return;
        }

        let cookie = this.storage.getConfiguration(Configurations.Cookie);
        if (cookie === '') {
            cookie = await this.asker.askForCookie();
        }

        const resp = await this.loginer.get(TS_LOGIN_URL, {
            headers: { cookie: cookie },
        });
        if (resp.status !== 302) {
            throw new Error('登录失败');
        }

        const releaseCookies = resp.headers['set-cookie'];
        const releaseCookie = releaseCookies?.find(ck => ck.slice(0, 9) === 'PHPSESSID');
        if (!releaseCookie) {
            throw new Error('获取发布 Cookie 失败');
        }

        const usingReleaseCookie = releaseCookie.split(';')[0];

        this.updater.defaults.headers.common['cookie'] = usingReleaseCookie;
    }

    private async loadLuaconfig(root: string): Promise<LuaconfigTable> {
        const luaconfig: LuaconfigTable = {
            id: null,
            idEnt: null,
            version: null,
        };

        const files = await FsPromises.readdir(root);
        if (!files.includes('luaconfig.lua')) {
            return luaconfig;
        }

        const file = Path.join(root, 'luaconfig.lua');
        const content = await FsPromises.readFile(file, { encoding: 'utf8' });
        const ast = Luaparse.parse(content);
        if (!ast) {
            return luaconfig;
        }
        if (ast.type !== 'Chunk') {
            return luaconfig;
        }

        const bodies = ast.body;
        const statement = bodies.find((body: any) => body.type === 'ReturnStatement');
        if (!statement) {
            return luaconfig;
        }

        const expression = statement.arguments?.[0];
        if (!expression) {
            return luaconfig;
        }

        let tableExpression: any | undefined;
        if (expression.type === 'TableConstructorExpression') {
            tableExpression = expression;
        }
        if (expression.type === 'IndexExpression') {
            if (expression.base?.type !== 'TableConstructorExpression') {
                return luaconfig;
            }
            if (expression.index?.type !== 'NumericLiteral') {
                return luaconfig;
            }
            const fields = expression.base.fields;
            const index = expression.index.value - 1;
            tableExpression = fields[index]?.value;
        }
        if (!tableExpression) {
            return luaconfig;
        }

        const fields = tableExpression?.fields;
        if (!fields) {
            return luaconfig;
        }

        for (const field of fields) {
            let key: string | undefined;
            if (field.type === 'TableKey') {
                key = field.key.raw.replace(/\'/g, '');
            }
            if (field.type === 'TableKeyString') {
                key = field.key.name;
            }
            if (!key) {
                continue;
            }

            let value: string | undefined;
            if (field.value.type === 'StringLiteral') {
                value = field.value.raw.replace(/\'/g, '');
            }
            if (field.value.type === 'NumericLiteral') {
                value = field.value.raw;
            }
            if (!value) {
                continue;
            }

            if (key === 'id') {
                luaconfig.id = value;
            }
            if (key === 'idEnt') {
                luaconfig.idEnt = value;
            }
            if (key === 'version') {
                luaconfig.version = value;
            }
        }

        return luaconfig;
    }

    private async getChangelog(root: string, ver: string): Promise<string> {
        const files = await FsPromises.readdir(root);
        if (!files.includes('CHANGELOG.md')) {
            return ' ';
        }

        const file = Path.join(root, 'CHANGELOG.md');
        const content = await FsPromises.readFile(file, { encoding: 'utf8' });

        const { versions } = await ChanglogParser({ text: content });
        if (!versions) {
            return ' ';
        }

        const { title, body } = versions[0];
        const modifiedTitle = title.replace('latest', ver);
        const changelog = `${modifiedTitle}\n${body}`;

        Output.println('读取更新日志成功:', modifiedTitle);
        return changelog;
    }

    private async getProjectInfo(id: string, target: ProductTarget = ProductTarget.Ts): Promise<ITsScriptInfo> {
        let url: string;
        switch (target) {
            case ProductTarget.Ts:
            default:
                url = TS_INFO_URL;
                break;
            case ProductTarget.Ent:
                url = TS_ENT_INFO_URL;
                break;
        }

        const resp = await this.updater.get(url, { params: { id: id } });
        if (resp.data.code !== 200 || resp.data.msg !== '查询成功') {
            throw new Error(resp.data.msg ?? resp.data.code ?? '查询脚本状态失败');
        }

        const name = resp.data.data?.details?.name ?? resp.data.data?.script?.introduction;
        if (!name) {
            throw new Error('获取脚本名失败');
        }

        const version = resp.data.data?.version?.version;
        if (!version) {
            throw new Error('获取脚本版本号失败');
        }

        const encrypt = resp.data.data?.version?.encrypt_mode?.substring(1);
        if (!encrypt) {
            throw new Error('获取脚本加密模式失败');
        }

        const updatedAt = resp.data.data?.version?.created_at ?? resp.data.data?.version?.updated_at;
        if (!updatedAt) {
            throw new Error('获取脚本更新日期失败');
        }

        return { name, version, encrypt, updatedAt };
    }

    private async uploadProject(zip: string, id?: string, target: ProductTarget = ProductTarget.Ts): Promise<string> {
        const zipStream = Fs.createReadStream(zip);
        const formData = new FormData();
        let url: string;

        switch (target) {
            case ProductTarget.Ts:
            default:
                formData.append('ScriptUpload[file]', zipStream);
                url = TS_UPLOAD_URL;
                break;
            case ProductTarget.Ent:
                formData.append('file', zipStream);
                formData.append('script_id', id);
                url = TS_ENT_UPLOAD_URL;
                break;
        }

        const formHeaders = formData.getHeaders();

        const resp = await this.updater.post(url, formData, {
            headers: formHeaders,
        });
        if (resp.data.code !== 200 || resp.data.msg !== '上传成功') {
            throw new Error(resp.data.msg ?? resp.data.code ?? '上传失败');
        }

        const uploadKey = resp.data.data?.key;
        if (!uploadKey) {
            throw new Error('获取上传密钥失败');
        }

        return uploadKey;
    }

    private async updateProject(id: string, version: string, changelog: string, encrypt: string, uploadKey: string, target: ProductTarget = ProductTarget.Ts) {
        const formData = new FormData();
        formData.append('is_default', 'true');
        formData.append('default', '1');
        formData.append('script_id', id);
        formData.append('version', version);
        formData.append('encrypt_mode', encrypt);
        formData.append('updated_logs', changelog);
        formData.append('key', uploadKey);
        const formHeaders = formData.getHeaders();

        let url: string;
        switch (target) {
            case ProductTarget.Ts:
            default:
                url = TS_UPDATE_URL;
                break;
            case ProductTarget.Ent:
                url = TS_ENT_UPDATE_URL;
                break;
        }

        const resp = await this.updater.post(url, formData, {
            headers: formHeaders,
        });
        if (resp.data.code !== 200 || (resp.data.msg !== '版本上传成功' && resp.data.msg !== '上传成功')) {
            throw new Error(resp.data.msg ?? resp.data.code ?? '更新版本失败');
        }
    }

    public async handleRelease(): Promise<void> {
        const doing = StatusBar.doing('发布工程中');
        try {
            const projector = new Projector(this.storage, undefined, ProjectMode.zip);
            const root = await projector.locateRoot();

            const zipper = new Zipper(this.storage);
            const zip = await zipper.handleZipProject();
            if (!zip) {
                throw new Error('打包工程失败');
            }

            const luaconfig = await this.loadLuaconfig(root);
            if (!luaconfig.id && !luaconfig.idEnt) {
                throw new Error('请先设置配置文件字段 `id/idEnt`');
            }
            if (!luaconfig.version) {
                throw new Error('请先设置配置文件字段 `version`');
            }

            const changelog = await this.getChangelog(root, luaconfig.version);

            await this.login();

            if (luaconfig.id) {
                Output.println('准备发布工程:', luaconfig.id);

                const oldInfo = await this.getProjectInfo(luaconfig.id, ProductTarget.Ts);
                const uploadKey = await this.uploadProject(zip, luaconfig.id, ProductTarget.Ts);
                await this.updateProject(luaconfig.id, luaconfig.version, changelog, oldInfo.encrypt, uploadKey, ProductTarget.Ts);
                const newInfo = await this.getProjectInfo(luaconfig.id, ProductTarget.Ts);

                Output.printlnAndShow('发布工程成功:', `${newInfo.name}(${luaconfig.id})`, `${oldInfo.version} -> ${newInfo.version}`);
            }

            if (luaconfig.idEnt) {
                Output.println('准备发布企业版工程:', luaconfig.idEnt);

                const oldInfo = await this.getProjectInfo(luaconfig.idEnt, ProductTarget.Ent);
                const uploadKey = await this.uploadProject(zip, luaconfig.idEnt, ProductTarget.Ent);
                await this.updateProject(luaconfig.idEnt, luaconfig.version, changelog, oldInfo.encrypt, uploadKey, ProductTarget.Ent);
                const newInfo = await this.getProjectInfo(luaconfig.idEnt, ProductTarget.Ent);

                Output.printlnAndShow('发布企业版工程成功:', `${newInfo.name}(${luaconfig.idEnt})`, `${oldInfo.version} -> ${newInfo.version}`);
            }
        } catch (e) {
            Output.eprintln('发布工程失败:', (e as Error).message ?? e);
        } finally {
            doing?.dispose();
        }
    }
}
