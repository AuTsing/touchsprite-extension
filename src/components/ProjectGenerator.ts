import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export enum ProjectFileRoot {
    res = 'res',
    lua = 'lua',
}

enum GeneratorMode {
    send,
    zip,
}

export interface IProjectFile {
    url: string;
    path: string;
    filename: string;
    root: ProjectFileRoot;
}

export interface IRawFile {
    url: string;
    dir: string;
}

export default class ProjectGenerator {
    public runfile: string;
    private projectRoot: string | undefined;
    private locateTimes: number = 0;
    private generateMode: GeneratorMode = GeneratorMode.send;
    private includes: string[] = [];
    private ignores: string[] = [];

    constructor(runfile: string = 'main.lua') {
        this.runfile = runfile;
    }

    public generate() {
        return this.locateMain()
            .then(root => {
                if (this.generateMode === GeneratorMode.send) {
                    this.includes = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePath') || [];
                    this.ignores = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath') || [];
                } else if (this.generateMode === GeneratorMode.zip) {
                    this.includes = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePathInZip') || [];
                    this.ignores = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePathInZip') || [];
                }
                const projectPaths = [...this.includes, root];
                const collectedFiles: IRawFile[] = [];
                projectPaths.forEach(pjp => {
                    this.collectFiles(pjp, collectedFiles, pjp);
                });
                return Promise.resolve(collectedFiles);
            })
            .then(files => {
                return this.generateProject(files);
            });
    }

    public locateMain() {
        const focusing = vscode.window.activeTextEditor?.document?.uri;
        if (!focusing) {
            return Promise.reject('未指定工程');
        }
        const focusingDir = path.dirname(focusing.fsPath);
        this.locateDown(focusingDir);
        this.locateUp(focusingDir);
        if (!this.projectRoot) {
            return Promise.reject('所选工程不包含引导文件: ' + this.runfile);
        }
        return Promise.resolve(this.projectRoot);
    }

    public getRoot() {
        if (this.projectRoot) {
            return Promise.resolve(this.projectRoot);
        } else {
            return this.locateMain();
        }
    }

    private isRoot(files: string[]): boolean {
        if (files.indexOf(this.runfile) > -1) {
            return true;
        } else {
            return false;
        }
    }

    private locateDown(dir: string) {
        if (this.projectRoot) {
            return;
        }
        const files = fs.readdirSync(dir);
        if (this.isRoot(files)) {
            this.projectRoot = dir;
        } else {
            const dirs = files.map(file => path.join(dir, file));
            dirs.forEach(d => {
                const stat = fs.statSync(d);
                if (stat.isDirectory()) {
                    this.locateDown(d);
                }
            });
        }
    }

    private locateUp(dir: string) {
        if (this.projectRoot) {
            return;
        }
        this.locateTimes++;
        const files = fs.readdirSync(dir);
        if (this.isRoot(files)) {
            this.projectRoot = dir;
        } else if (this.locateTimes <= 3) {
            const upDir = path.dirname(dir);
            this.locateUp(upDir);
        }
    }

    private collectFiles(dir: string, list: IRawFile[], collectingPath: string) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            if (this.ignores.indexOf(file) > -1) {
                return;
            }
            const fPath = path.join(dir, file);
            const stat = fs.statSync(fPath);
            if (stat.isDirectory() === true) {
                this.collectFiles(fPath, list, collectingPath);
            }
            if (stat.isFile() === true) {
                list.push({ url: fPath, dir: collectingPath });
            }
        });
    }

    private generateProject(files: IRawFile[]) {
        return files.map(file => {
            const remain = file.url.substr(file.dir.length, file.url.length - file.dir.length);
            const isLua = path.basename(remain).indexOf('.lua') >= 0 || path.basename(remain).indexOf('.so') >= 0;
            const pjf: IProjectFile = {
                url: file.url,
                path: path.dirname(remain).replace(/\\/g, '/'),
                filename: path.basename(remain),
                root: isLua ? ProjectFileRoot.lua : ProjectFileRoot.res,
            };
            return pjf;
        });
    }

    public useSend() {
        this.generateMode = GeneratorMode.send;
        return this;
    }

    public useZip() {
        this.generateMode = GeneratorMode.zip;
        return this;
    }
}
