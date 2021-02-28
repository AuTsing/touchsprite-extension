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
                    this.includes = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath') || [];
                    this.ignores = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePath') || [];
                } else if (this.generateMode === GeneratorMode.zip) {
                    this.includes = vscode.workspace.getConfiguration().get('touchsprite-extension.includePathInZip') || [];
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
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return Promise.reject('未打开工程');
        }
        if (workspaceFolders.length === 1) {
            const workspaceFolder = workspaceFolders[0];
            const dir = workspaceFolder.uri.fsPath;
            const files = fs.readdirSync(dir);
            if (files.indexOf(this.runfile) > -1) {
                this.projectRoot = dir;
            }
        } else {
            const focusing = vscode.window.activeTextEditor?.document?.uri;
            if (!focusing) {
                return Promise.reject('未指定工程');
            }
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(focusing);
            if (!workspaceFolder) {
                return Promise.reject('所选工程无法正确读取');
            }
            const dir = workspaceFolder.uri.fsPath;
            const files = fs.readdirSync(dir);
            if (files.indexOf(this.runfile) > -1) {
                this.projectRoot = dir;
            }
        }
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
