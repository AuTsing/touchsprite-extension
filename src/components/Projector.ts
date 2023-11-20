import * as Vscode from 'vscode';
import * as FsPromises from 'fs/promises';
import * as Fs from 'fs';
import * as Path from 'path';
import { TsFile, TsFileRoot } from './Device';
import Storage, { Configurations } from './Storage';
import Output from './Output';

export enum ProjectMode {
    send = 'send',
    zip = 'zip',
}

export interface CollectedFile {
    root: string;
    url: string;
    dir: string;
    filename: string;
}

export default class Projector {
    private readonly storage: Storage;
    private readonly mainFilename: string;
    private readonly projectMode: ProjectMode;
    private readonly includes: string[];
    private readonly excludes: string[];

    constructor(storage: Storage, mainFilename: string = 'main.lua', projectMode: ProjectMode = ProjectMode.send) {
        this.storage = storage;
        this.mainFilename = mainFilename;
        this.projectMode = projectMode;

        switch (this.projectMode) {
            case ProjectMode.send:
                this.includes = this.storage.getConfiguration(Configurations.IncludeWhenSend) as string[];
                this.excludes = this.storage.getConfiguration(Configurations.ExcludeWhenSend) as string[];
                break;
            case ProjectMode.zip:
                this.includes = this.storage.getConfiguration(Configurations.IncludeWhenZip) as string[];
                this.excludes = this.storage.getConfiguration(Configurations.ExcludeWhenZip) as string[];
                break;
        }
    }

    async locateRoot(): Promise<string> {
        const workspaceFolders = Vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('未打开工程');
        }

        if (workspaceFolders.length === 1) {
            const usingFolder = workspaceFolders[0];
            const dir = usingFolder.uri.fsPath;
            const files = await FsPromises.readdir(dir);
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
        const files = await FsPromises.readdir(dir);
        if (files.includes(this.mainFilename)) {
            return dir;
        }

        throw new Error('所指定工程不包含引导文件 ' + this.mainFilename);
    }

    private async collectFiles(root: string, dir: string, container: CollectedFile[]) {
        const files = await FsPromises.readdir(dir);
        for (const file of files) {
            if (this.excludes.includes(file)) {
                continue;
            }

            const url = Path.join(dir, file);
            const stat = await FsPromises.stat(url);

            if (stat.isDirectory()) {
                await this.collectFiles(root, url, container);
            }

            if (stat.isFile()) {
                container.push({ root, url, dir, filename: file });
            }
        }
    }

    async generate(): Promise<TsFile[]> {
        const root = await this.locateRoot();
        const paths = [...this.includes, root].filter(it => {
            if (Fs.existsSync(it)) {
                return true;
            } else {
                Output.wprintln('忽略不可用路径:', it);
                return false;
            }
        });
        const files: CollectedFile[] = [];
        for (const path of paths) {
            await this.collectFiles(path, path, files);
        }
        const tsFiles: TsFile[] = files.map(file => {
            const url = file.url;
            const isLua = Path.extname(file.filename) === '.lua' || Path.extname(file.filename) === '.so';
            const root = isLua ? TsFileRoot.lua : TsFileRoot.res;
            const path = Path.join('/', Path.relative(file.root, file.dir)).replace(/\\/g, '/');
            const filename = file.filename;
            const tsFile: TsFile = { url, root, path, filename };
            return tsFile;
        });
        return tsFiles;
    }
}
