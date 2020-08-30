import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export enum ProjectFileRoot {
    res = 'res',
    lua = 'lua',
}

export interface IProjectFile {
    url: string;
    path: string;
    filename: string;
    root: ProjectFileRoot;
}

class Project {
    private readonly _rootPath: string;
    private readonly _list: IProjectFile[];
    private readonly _ignores: string[];

    constructor(dir: string) {
        this._rootPath = dir ;
        const ignorePath: string[] | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePath');
        this._ignores = ignorePath ? ignorePath : [];
        const collectedFiles: string[] = [];
        this.collectFiles(this._rootPath, collectedFiles);
        this._list = this.generateProject(collectedFiles);
    }

    private collectFiles(dir: string, list: string[]) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            if (this._ignores.indexOf(file) > -1) {
                return;
            }
            const fPath = path.join(dir, file);
            const stat = fs.statSync(fPath);
            if (stat.isDirectory() === true) {
                this.collectFiles(fPath, list);
            }
            if (stat.isFile() === true) {
                list.push(fPath);
            }
        });
    }

    private generateProject(files: string[]) {
        return files.map(file => {
            const remain = file.substr(this._rootPath.length, file.length - this._rootPath.length);
            const isLua = path.basename(remain).indexOf('.lua') >= 0 || path.basename(remain).indexOf('.so') >= 0;
            const pjf: IProjectFile = {
                url: file,
                path: path.dirname(remain).replace(/\\/g, '/'),
                filename: path.basename(remain),
                root: isLua ? ProjectFileRoot.lua : ProjectFileRoot.res,
            };
            return pjf;
        });
    }

    public isThereFile(filename: string) {
        return this._list.find(pjf => pjf.filename === filename);
    }

    public getList() {
        return this._list;
    }
}

export default Project;
