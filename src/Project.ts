import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Project {
    rootPath: string;
    list: Array<ProjectFile>;
    constructor(rootPath: string) {
        this.rootPath = rootPath;
        this.list = this.createProject(rootPath);
    }
    public createProject(rootPath: string) {
        let fileList = Array<string>();
        this.findFile(rootPath, fileList);
        // console.log(fileList);
        // let filtedList = fileList.filter(str => {
        //     return str.indexOf('.lua') >= 0 || str.indexOf('.png') >= 0 || str.indexOf('.txt') >= 0;
        // });
        let project = fileList.map(value => {
            let uploadUrl = value;
            let remain = value.substr(rootPath.length, value.length - rootPath.length);
            let uploadPath = path.dirname(remain).replace(/\\/g, '/');
            let uploadFileName = path.basename(remain);
            return new ProjectFile(uploadUrl, uploadPath, uploadFileName);
        });
        return project;
    }
    public addProjectFile(rootPath: string) {
        let project = this.createProject(rootPath);
        this.list = this.list.concat(project);
    }
    public findFile(p: any, fileList: Array<string>) {
        let ignores: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.ignorePath');
        let ignoresArr = ignores ? ignores : [];
        let files = fs.readdirSync(p);
        files.forEach(name => {
            if (ignoresArr.indexOf(name) > -1) {
                return;
            }
            let fPath = path.join(p, name);
            let stat = fs.statSync(fPath);
            if (stat.isDirectory() === true) {
                this.findFile(fPath, fileList);
            }
            if (stat.isFile() === true) {
                fileList.push(fPath);
            }
        });
    }
}

export class ProjectFile {
    uploadUrl: string;
    uploadPath: string;
    uploadFileName: string;
    uploadRoot: string;
    constructor(uploadUrl: string, uploadPath: string, uploadFileName: string) {
        this.uploadUrl = uploadUrl;
        this.uploadPath = uploadPath;
        this.uploadFileName = uploadFileName;
        if (uploadFileName.indexOf('.lua') >= 0) {
            this.uploadRoot = 'lua';
        } else {
            this.uploadRoot = 'res';
        }
    }
}
