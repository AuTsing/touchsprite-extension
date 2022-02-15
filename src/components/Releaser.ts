import * as Vscode from 'vscode';
import * as Path from 'path';
import * as Fs from 'fs';
import * as FormData from 'form-data';
import Axios, { AxiosInstance } from 'axios';
import * as Luaparse from 'luaparse';
import * as ChanglogParser from 'changelog-parser';
import * as Ui from './Ui';
import Projector, { EProjectMode } from './Projector';
import Zipper from './Zipper';

export interface ILuaconfigTable {
    id?: string;
    version?: string;
}

export default class Releaser {
    private readonly output: Ui.Output;
    private readonly statusBar: Ui.StatusBar;
    private readonly loginer: AxiosInstance;
    private readonly updater: AxiosInstance;
    private readonly table: ILuaconfigTable;

    constructor() {
        this.output = Ui.useOutput();
        this.statusBar = Ui.useStatusBar();
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
        this.table = {};
    }

    private async login(): Promise<void> {
        if (this.updater.defaults.headers.common['cookie']) {
            return;
        }

        let cookie = Vscode.workspace.getConfiguration('touchsprite-extension').get<string>('cookie') ?? '';
        if (cookie === '') {
            cookie = (await Vscode.window.showInputBox({ prompt: '请输入登录Cookie', value: '' })) ?? '';
            Vscode.workspace.getConfiguration('touchsprite-extension').update('cookie', cookie, true);
        }
        if (cookie === '') {
            throw new Error('登录Cookie不正确');
        }

        const cookies = cookie.split(';').map(str => str.trim());
        const loginCookie = cookies.find(cookie => cookie.slice(0, 9) === '_identity');
        if (!loginCookie) {
            throw new Error('登录Cookie不包含字段"identity"');
        }

        const resp = await this.loginer.get('https://account.touchsprite.com/', {
            headers: { cookie: cookie },
        });
        if (resp.status !== 302) {
            throw new Error('登录失败');
        }

        const releaseCookies = resp.headers['set-cookie'];
        const releaseCookie = releaseCookies?.find(ck => ck.slice(0, 9) === 'PHPSESSID');
        if (!releaseCookie) {
            throw new Error('获取发布Cookie失败');
        }

        const usingReleaseCookie = releaseCookie.split(';')[0];

        this.updater.defaults.headers.common['cookie'] = usingReleaseCookie;
    }

    private loadLuaconfig(root: string) {
        this.table.id = undefined;
        this.table.version = undefined;

        const files = Fs.readdirSync(root);
        if (!files.includes('luaconfig.lua')) {
            return;
        }

        const file = Path.join(root, 'luaconfig.lua');
        const content = Fs.readFileSync(file, { encoding: 'utf8' });
        const ast = Luaparse.parse(content);
        if (!ast) {
            return;
        }
        if (ast.type !== 'Chunk') {
            return;
        }

        const bodies = ast.body;
        const statement = bodies.find((body: any) => body.type === 'ReturnStatement');
        if (!statement) {
            return;
        }

        const expression = statement.arguments?.[0];
        if (!expression) {
            return;
        }

        let tableExpression: any | undefined;
        if (expression.type === 'TableConstructorExpression') {
            tableExpression = expression;
        }
        if (expression.type === 'IndexExpression') {
            if (expression.base?.type !== 'TableConstructorExpression') {
                return;
            }
            if (expression.index?.type !== 'NumericLiteral') {
                return;
            }
            const fields = expression.base.fields;
            const index = expression.index.value - 1;
            tableExpression = fields[index]?.value;
        }
        if (!tableExpression) {
            return;
        }

        const fields = tableExpression?.fields;
        if (!fields) {
            return;
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
                this.table.id = value;
            }
            if (key === 'version') {
                this.table.version = value;
            }
        }
    }

    private async getId(): Promise<string> {
        let id: string | undefined;
        if (!id) {
            id = this.table.id;
        }

        if (!id) {
            this.output.warning('无法读取到配置文件字段 "id" ，请输入脚本ID');
            id = await Vscode.window.showInputBox({ prompt: '请输入脚本ID', value: '' });
        }

        if (!id) {
            throw new Error('未填写脚本ID');
        }

        if (!/^\d*$/.test(id)) {
            throw new Error('脚本ID不正确');
        }

        return id;
    }

    private async getVersion(): Promise<string> {
        let version: string | undefined;
        if (!version) {
            version = this.table.version;
        }

        if (!version) {
            this.output.warning('无法读取到配置文件字段 "version" ，请输入脚本ID');
            version = await Vscode.window.showInputBox({ prompt: '请输入脚本版本号', value: '' });
        }

        if (!version) {
            throw new Error('未填写脚本版本号');
        }

        if (!/^\d+\.\d+\.\d+$/.test(version)) {
            throw new Error('脚本版本号不正确');
        }

        return version;
    }

    private async getChangelog(root: string, ver: string): Promise<string> {
        const files = Fs.readdirSync(root);
        if (!files.includes('CHANGELOG.md')) {
            return ' ';
        }

        const file = Path.join(root, 'CHANGELOG.md');
        const content = Fs.readFileSync(file, { encoding: 'utf8' });

        const { versions } = await ChanglogParser({ text: content });
        if (!versions) {
            return ' ';
        }

        const { title, body } = versions[0];
        const modifiedTitle = title.replace('latest', ver);
        const changelog = `${modifiedTitle}\n${body}`;

        this.output.info('读取更新日志成功: ' + modifiedTitle);
        return changelog;
    }

    private async getEncrypt(id: string): Promise<string> {
        const resp = await this.updater.get('https://dev.touchsprite.com/touch/script/view', { params: { id: id } });
        if (resp.data.code !== 200 || resp.data.msg !== '查询成功') {
            throw new Error('查询脚本状态失败，' + resp.data.msg);
        }

        const encrypt = resp.data.data.version.encrypt_mode.substring(1);
        if (!encrypt) {
            throw new Error('获取脚本加密模式失败');
        }

        return encrypt;
    }

    private async uploadZip(zip: string): Promise<string> {
        const zipStream = Fs.createReadStream(zip);
        const formData = new FormData();
        formData.append('ScriptUpload[file]', zipStream);
        const formHeaders = formData.getHeaders();

        const resp = await this.updater.post('https://dev.touchsprite.com/touch/script/upload', formData, { headers: formHeaders });
        if (resp.data.code !== 200 || resp.data.msg !== '上传成功') {
            throw new Error('上传脚本失败');
        }

        const uploadKey = resp.data;
        if (!uploadKey) {
            throw new Error('获取上传密钥失败');
        }

        return uploadKey;
    }

    public async release(): Promise<void> {
        try {
            const projector = new Projector(undefined, EProjectMode.zip);
            const root = projector.locateRoot();

            const zipper = new Zipper();
            const zip = await zipper.zipProject();

            this.loadLuaconfig(root);
            const id = await this.getId();
            const version = await this.getVersion();
            const changelog = await this.getChangelog(root, version);
            await this.login();
            const encrypt = await this.getEncrypt(id);
            const uploadKey = await this.uploadZip(zip);

            console.log(encrypt);
        } catch (e) {
            this.output.error('发布工程失败: ' + (e as Error).message);
        }
    }
}
