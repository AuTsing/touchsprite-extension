import * as Vscode from 'vscode';
import * as Fs from 'fs';
import * as Path from 'path';
import { ITsFile, ETsFileRoot } from './Device';

export enum EProjectMode {
    send = 'send',
    zip = 'zip',
}

export interface ICollectedFile {
    root: string;
    url: string;
    dir: string;
    filename: string;
}

export default class Projector {
    private readonly mainFilename: string;
    private readonly projectMode: EProjectMode;
    private readonly includes: string[];
    private readonly excludes: string[];

    constructor(mainFilename: string = 'main.lua', projectMode: EProjectMode = EProjectMode.send) {
        this.mainFilename = mainFilename;
        this.projectMode = projectMode;

        let includes!: string[];
        let excludes!: string[];
        if (this.projectMode === EProjectMode.send) {
            includes = Vscode.workspace.getConfiguration('touchsprite-extension').get<string[]>('includeWhenSend') ?? [];
            excludes = Vscode.workspace.getConfiguration('touchsprite-extension').get<string[]>('excludeWhenSend') ?? [];
        }
        if (this.projectMode === EProjectMode.zip) {
            includes = Vscode.workspace.getConfiguration('touchsprite-extension').get<string[]>('includeWhenZip') ?? [];
            excludes = Vscode.workspace.getConfiguration('touchsprite-extension').get<string[]>('excludeWhenZip') ?? [];
        }
        this.includes = includes;
        this.excludes = excludes;
    }

    public locateRoot(): string {
        const workspaceFolders = Vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('未打开工程');
        }

        if (workspaceFolders.length === 1) {
            const usingFolder = workspaceFolders[0];
            const dir = usingFolder.uri.fsPath;
            const files = Fs.readdirSync(dir);
            if (files.includes(this.mainFilename)) {
                return dir;
            }
        }

        const focusingFolder = Vscode.window.activeTextEditor?.document.uri;
        if (!focusingFolder) {
            throw new Error('未指定工程');
        }

        const usingFolder = Vscode.workspace.getWorkspaceFolder(focusingFolder);
        if (!usingFolder) {
            throw new Error('所指定工程无法读取');
        }

        const dir = usingFolder.uri.fsPath;
        const files = Fs.readdirSync(dir);
        if (files.includes(this.mainFilename)) {
            return dir;
        }

        throw new Error('所指定工程不包含引导文件 ' + this.mainFilename);
    }

    private collectFiles(root: string, dir: string, container: ICollectedFile[]) {
        const files = Fs.readdirSync(dir);
        for (const file of files) {
            if (this.excludes.includes(file)) {
                continue;
            }

            const url = Path.join(dir, file);
            const stat = Fs.statSync(url);

            if (stat.isDirectory()) {
                this.collectFiles(root, url, container);
            }

            if (stat.isFile()) {
                container.push({ root, url, dir, filename: file });
            }
        }
    }

    public generate(): ITsFile[] {
        const root = this.locateRoot();
        const paths = [...this.includes, root];
        const files: ICollectedFile[] = [];
        for (const path of paths) {
            this.collectFiles(path, path, files);
        }
        const tsFiles: ITsFile[] = files.map(file => {
            const url = file.url;
            const isLua = Path.extname(file.filename) === '.lua' || Path.extname(file.filename) === '.so';
            const root = isLua ? ETsFileRoot.lua : ETsFileRoot.res;
            const path = Path.join('/', Path.relative(file.root, file.dir)).replace(/\\/g, '/');
            const filename = file.filename;
            const tsFile: ITsFile = { url, root, path, filename };
            return tsFile;
        });
        return tsFiles;
    }
}
