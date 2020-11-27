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

export default class ProjectGenerator {
    public projectRoot?: string;
    public focusing?: vscode.Uri;
    public projectFiles: IProjectFile[] = [];
    public runfile: string;
    private _ignores: string[] = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePath') || [];
    private _includes: string[] = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath') || [];
    private _generatedUpTimes: number = 0;

    constructor(runfile: string = 'main.lua') {
        this.runfile = runfile;
    }

    public generate() {
        this._generatedUpTimes = 0;
        const focusing = vscode.window.activeTextEditor?.document?.uri;
        if (focusing) {
            this.focusing = focusing;
            const dir = path.dirname(focusing.fsPath);
            this.generateDown(dir);
            this.generateUp(dir);
            if (this.projectRoot) {
                const projectPaths = [...this._includes, this.projectRoot];
                const collectedFiles: string[] = [];
                projectPaths.forEach(pjp => {
                    this.collectFiles(pjp, collectedFiles);
                });
                this.projectFiles = this.generateProject(collectedFiles);
            }
        }
    }

    public generateZip() {
        this._ignores = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePathInZip') || [];
        this._includes = vscode.workspace.getConfiguration().get('touchsprite-extension.includePathInZip') || [];
        this.generate();
        this._ignores = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePath') || [];
        this._includes = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath') || [];
    }

    private isRoot(files: string[]): boolean {
        if (files.indexOf(this.runfile) > -1) {
            return true;
        } else {
            return false;
        }
    }

    private generateDown(dir: string) {
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
                    this.generateDown(d);
                }
            });
        }
    }

    private generateUp(dir: string) {
        if (this.projectRoot) {
            return;
        }
        this._generatedUpTimes++;
        const files = fs.readdirSync(dir);
        if (this.isRoot(files)) {
            this.projectRoot = dir;
        } else if (this._generatedUpTimes <= 3) {
            const upDir = path.dirname(dir);
            this.generateUp(upDir);
        }
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
            const remain = file.substr(this.projectRoot!.length, file.length - this.projectRoot!.length);
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
}
