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
import {
    TS_APP_INFO_URL,
    TS_APP_UPDATE_URL,
    TS_APP_UPLOAD_URL,
    TS_ENT_INFO_URL,
    TS_ENT_UPDATE_URL,
    TS_ENT_UPLOAD_URL,
    TS_INFO_URL,
    TS_LOGIN_URL,
    TS_UPDATE_URL,
    TS_UPLOAD_URL,
} from '../values/Constants';
import StatusBar from './StatusBar';
import Output from './Output';

interface LuaconfigInfo {
    ID: string | null;
    ID_ENT: string | null;
    ID_APP: string | null;
    ID_APP_TS: string | null;
    VERSION: string | null;
}

function toReleaseInfos(this: LuaconfigInfo): ReleaseInfo[] {
    const releaseInfos: ReleaseInfo[] = [];

    if (this.ID !== null) {
        const ids = this.ID.split(',');
        const infos = ids.map(it => ({ id: it, name: '', target: ProductTarget.Ts }));
        releaseInfos.push(...infos);
    }
    if (this.ID_ENT !== null) {
        const ids = this.ID_ENT.split(',');
        const infos = ids.map(it => ({ id: it, name: '企业版', target: ProductTarget.Ent }));
        releaseInfos.push(...infos);
    }
    if (this.ID_APP !== null) {
        const ids = this.ID_APP.split(',');
        const infos = ids.map(it => ({ id: it, name: '小精灵', target: ProductTarget.App }));
        releaseInfos.push(...infos);
    }
    if (this.ID_APP_TS !== null) {
        const ids = this.ID_APP_TS.split(',');
        const infos = ids.map(it => ({ id: it, name: '小精灵脚本', target: ProductTarget.AppTs }));
        releaseInfos.push(...infos);
    }

    return releaseInfos;
}

interface ScriptInfo {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly encrypt: string;
    readonly updatedAt: string;
    readonly uuid: string;
}

interface ReleaseInfo {
    readonly id: string;
    readonly name: string;
    readonly target: ProductTarget;
}

enum ProductTarget {
    Ts,
    Ent,
    App,
    AppTs,
}

function getProjectInfoUrl(target: ProductTarget): string {
    switch (target) {
        case ProductTarget.Ts:
            return TS_INFO_URL;
        case ProductTarget.Ent:
            return TS_ENT_INFO_URL;
        case ProductTarget.App:
            return TS_APP_INFO_URL;
        case ProductTarget.AppTs:
            return TS_APP_INFO_URL;
    }
}

function getUploadProjectUrl(target: ProductTarget): string {
    switch (target) {
        case ProductTarget.Ts:
            return TS_UPLOAD_URL;
        case ProductTarget.Ent:
            return TS_ENT_UPLOAD_URL;
        case ProductTarget.App:
            return TS_APP_UPLOAD_URL;
        case ProductTarget.AppTs:
            return TS_APP_UPLOAD_URL;
    }
}

function getUpdateProjectUrl(target: ProductTarget): string {
    switch (target) {
        case ProductTarget.Ts:
            return TS_UPDATE_URL;
        case ProductTarget.Ent:
            return TS_ENT_UPDATE_URL;
        case ProductTarget.App:
            return TS_APP_UPDATE_URL;
        case ProductTarget.AppTs:
            return TS_APP_UPDATE_URL;
    }
}

function genUploadProjectPayload(
    target: ProductTarget,
    info: ScriptInfo,
    zipStream: Fs.ReadStream,
    filename: string,
    size: number,
): FormData {
    const formData = new FormData();

    switch (target) {
        case ProductTarget.Ts:
            formData.append('ScriptUpload[file]', zipStream);
            break;
        case ProductTarget.Ent:
            formData.append('file', zipStream);
            formData.append('script_id', info.id);
            break;
        case ProductTarget.App:
            formData.append('qqfile', zipStream);
            formData.append('qquuid', info.uuid);
            formData.append('qqfilename', filename);
            formData.append('qqtotalfilesize', size);
            break;
        case ProductTarget.AppTs:
            formData.append('qqfile', zipStream);
            formData.append('qquuid', info.uuid);
            formData.append('qqfilename', filename);
            formData.append('qqtotalfilesize', size);
            break;
    }

    return formData;
}

function genUpdateProjectPayload(
    target: ProductTarget,
    info: ScriptInfo,
    version: string,
    changelog: string,
    uploadKey: string,
): FormData {
    const formData = new FormData();

    switch (target) {
        case ProductTarget.Ts:
            formData.append('key', uploadKey);
            formData.append('script_id', info.id);
            formData.append('version', version);
            formData.append('is_default', 'true');
            formData.append('encrypt_mode', info.encrypt);
            formData.append('updated_logs', changelog);
            break;
        case ProductTarget.Ent:
            formData.append('key', uploadKey);
            formData.append('script_id', info.id);
            formData.append('version', version);
            formData.append('default', '1');
            formData.append('encrypt_mode', info.encrypt);
            formData.append('updated_logs', changelog);
            break;
        case ProductTarget.App:
            formData.append('md5', uploadKey);
            formData.append('script_id', info.id);
            formData.append('version', version);
            formData.append('encrypt_mode', info.encrypt);
            formData.append('upload_log', changelog);
            formData.append('package_name', '0');
            formData.append('type', '2');
            break;
        case ProductTarget.AppTs:
            formData.append('md5', uploadKey);
            formData.append('script_id', info.id);
            formData.append('version', version);
            formData.append('encrypt_mode', info.encrypt);
            formData.append('upload_log', changelog);
            formData.append('package_name', '0');
            formData.append('type', '1');
            break;
    }

    return formData;
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
            },
        );
        this.updater = Axios.create({
            timeout: 30000,
        });
    }

    private async login() {
        if (this.updater.defaults.headers.common['cookie']) {
            return;
        }

        let cookie = this.storage.getStringConfiguration(Configurations.Cookie);
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

    private async loadLuaconfig(root: string): Promise<LuaconfigInfo> {
        const luaconfig: LuaconfigInfo = {
            ID: null,
            ID_ENT: null,
            ID_APP: null,
            ID_APP_TS: null,
            VERSION: null,
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
            key = key?.toUpperCase();
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

            switch (key) {
                case 'ID':
                    luaconfig.ID = value;
                    break;
                case 'ID_ENT':
                    luaconfig.ID_ENT = value;
                    break;
                case 'ID_APP':
                    luaconfig.ID_APP = value;
                    break;
                case 'ID_APP_TS':
                    luaconfig.ID_APP_TS = value;
                    break;
                case 'VERSION':
                    luaconfig.VERSION = value;
                    break;
            }
        }

        return luaconfig;
    }

    private async loadChangelog(root: string, ver: string): Promise<string> {
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

    private async getProjectInfo(id: string, target: ProductTarget = ProductTarget.Ts): Promise<ScriptInfo> {
        const url = getProjectInfoUrl(target);

        const resp = await this.updater.get(url, { params: { id: id } });
        if (resp.data.code !== 200 || resp.data.msg !== '查询成功') {
            throw new Error(resp.data.msg ?? resp.data.code ?? '查询脚本状态失败');
        }

        const name = resp.data.data?.details?.name ?? resp.data.data?.script?.name;
        if (!name) {
            throw new Error('获取脚本名失败');
        }

        const version = resp.data.data?.version?.version;
        if (!version) {
            throw new Error('获取脚本版本号失败');
        }

        const encrypt = resp.data.data?.version?.encrypt_mode?.replace('V', '').replace('v', '');
        if (!encrypt) {
            throw new Error('获取脚本加密模式失败');
        }

        const updatedAt =
            resp.data.data?.version?.created_at ??
            resp.data.data?.version?.updated_at ??
            resp.data.data?.version?.update_at;
        if (!updatedAt) {
            throw new Error('获取脚本更新日期失败');
        }

        const uuid = resp.data.data?.details?.uuid ?? '';

        return { id, name, version, encrypt, updatedAt, uuid };
    }

    private async uploadProject(
        zip: string,
        info: ScriptInfo,
        target: ProductTarget = ProductTarget.Ts,
    ): Promise<string> {
        const zipStream = Fs.createReadStream(zip);
        const filename = Path.basename(zip);
        const stats = await FsPromises.stat(zip);
        const size = stats.size;
        const url = getUploadProjectUrl(target);
        const formData = genUploadProjectPayload(target, info, zipStream, filename, size);
        const formHeaders = formData.getHeaders();
        const config = { headers: formHeaders };

        const resp = await this.updater.post(url, formData, config);
        if (resp.data.code !== 200 || (resp.data.msg !== '上传成功' && resp.data.msg !== '查询成功')) {
            throw new Error(resp.data.msg ?? resp.data.code ?? '上传失败');
        }

        const uploadKey = resp.data.data?.key;
        if (!uploadKey) {
            throw new Error('获取上传密钥失败');
        }

        return uploadKey;
    }

    private async updateProject(
        info: ScriptInfo,
        version: string,
        changelog: string,
        uploadKey: string,
        target: ProductTarget = ProductTarget.Ts,
    ) {
        const url = getUpdateProjectUrl(target);
        const formData = genUpdateProjectPayload(target, info, version, changelog, uploadKey);
        const formHeaders = formData.getHeaders();
        const config = { headers: formHeaders };

        const resp = await this.updater.post(url, formData, config);
        if (resp.data.code !== 200 || (resp.data.msg !== '版本上传成功' && resp.data.msg !== '上传成功')) {
            throw new Error(resp.data.msg ?? resp.data.code ?? '更新版本失败');
        }
    }

    private async releaseProject(zip: string, version: string, changelog: string, info: ReleaseInfo) {
        try {
            Output.println(`准备发布${info.name}工程:`, info.id);

            const oldInfo = await this.getProjectInfo(info.id, info.target);
            const uploadKey = await this.uploadProject(zip, oldInfo, info.target);
            await this.updateProject(oldInfo, version, changelog, uploadKey, info.target);
            const newInfo = await this.getProjectInfo(info.id, info.target);

            Output.println(
                `发布工程${info.name}(${info.id})成功:`,
                `${newInfo.name}(${info.id})`,
                `${oldInfo.version} -> ${newInfo.version}`,
            );
            StatusBar.result(`发布工程${info.name}成功`);
        } catch (e) {
            Output.eprintln(`发布工程${info.name}(${info.id})失败:`, (e as Error).message ?? e);
        }
    }

    async handleRelease() {
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
            if (
                luaconfig.ID === null &&
                luaconfig.ID_ENT === null &&
                luaconfig.ID_APP === null &&
                luaconfig.ID_APP_TS === null
            ) {
                throw new Error('请先设置配置文件字段 `ID/ID_ENT/ID_APP/ID_APP_TS`');
            }
            if (luaconfig.VERSION === null) {
                throw new Error('请先设置配置文件字段 `VERSION`');
            }

            const changelog = await this.loadChangelog(root, luaconfig.VERSION);

            await this.login();

            const releaseInfos = toReleaseInfos.call(luaconfig);

            await Promise.all(releaseInfos.map(it => this.releaseProject(zip, luaconfig.VERSION!!, changelog, it)));
        } catch (e) {
            Output.eprintln('发布工程失败:', (e as Error).message ?? e);
            Output.elogln((e as Error).stack ?? e);
        } finally {
            doing?.dispose();
        }
    }
}
