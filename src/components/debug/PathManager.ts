import * as path from 'path';
import Ui from '../ui/Ui';

const pathReader = require('path-reader');

interface IFileNameAndPath {
    filename: string;
    files: string[];
}

export class PathManager {
    private readonly acceptExt = ['lua'];
    private fileNameToPathMap: IFileNameAndPath[] = [];

    // 建立/刷新 工程下文件名-路径Map
    public rebuildWorkspaceNamePathMap(rootPath: string) {
        const beginMs = new Date().getTime(); //启动时毫秒数
        const fileNameToPathMap: IFileNameAndPath[] = []; // 文件名-路径 cache
        const workspaceFiles: string[] = pathReader.files(rootPath, { sync: true }); //同步读取工程中所有文件名
        const workspaceFileCount = workspaceFiles.length; //工程文件数量
        let processFilNum = 0; //记录最终处理了多少个文件

        workspaceFiles.forEach((file, fileIndex) => {
            const formatedPath = this.genUnifiedPath(file);
            const nameExtObject = this.getPathNameAndExt(formatedPath);
            if (nameExtObject.name === '' || !this.acceptExt.includes(nameExtObject.ext)) {
                return;
            }
            processFilNum++;
            const filename = nameExtObject.name;
            const filenameAndPath = fileNameToPathMap.find(filenameAndPath => filenameAndPath.filename === filename);
            if (filenameAndPath) {
                filenameAndPath.files.push(formatedPath);
            } else {
                fileNameToPathMap.push({ filename: filename, files: [formatedPath] });
            }
            const processingRate = Math.floor((fileIndex / workspaceFileCount) * 100);
            Ui.outputDebug(processingRate + '%  |  ' + filename);
        });

        const endMs = new Date().getTime(); //文件分析结束时毫秒数
        Ui.outputDebug(`文件刷新完毕, 共 ${processFilNum} / ${workspaceFileCount} 个文件, 耗时 ${endMs - beginMs} 毫秒`);
        if (processFilNum <= 0) {
            Ui.outputError(`文件刷新失败, 请检查文件工程目录是否正确`);
        }
        this.fileNameToPathMap = fileNameToPathMap;
    }

    // 检查同名文件, 如果存在，通过日志输出
    public checkSameNameFile(distinguishSameNameFile: boolean) {
        const sameNameFiles: string[] = [];
        this.fileNameToPathMap.forEach(file => {
            if (file.files.length > 1) {
                sameNameFiles.push(`${file.filename} >> \n${file.files.join('\n')}`);
            }
        });
        if (sameNameFiles.length > 0) {
            const sameNameFilesStr = '工程中存在以下同名lua文件:\n' + sameNameFiles.join('\n');
            if (distinguishSameNameFile) {
                Ui.outputDebug(sameNameFilesStr);
            } else {
                Ui.outputError(sameNameFilesStr);
            }
        }
    }

    // 传入局部路径，返回完整路径
    public checkFullPath(shortPath: string, oPath?: string): string {
        //如果首字符是@，去除@
        if ('@' === shortPath.substr(0, 1)) {
            shortPath = shortPath.substr(1);
        }

        const nameExtObject = this.getPathNameAndExt(shortPath);
        const filename = nameExtObject.name;
        const filenameAndPath = this.fileNameToPathMap.find(filenameAndPath => filenameAndPath.filename === filename);

        if (filenameAndPath) {
            if (filenameAndPath.files.length > 1) {
                // 存在同名文件
                if (oPath) {
                    return this.checkRightPath(shortPath, oPath, filenameAndPath.files);
                } else {
                    // 如果lua文件没有更新，没有传过来oPath，则打开第一个文件
                    return filenameAndPath.files.find(file => file.indexOf(shortPath)) || filenameAndPath.files[0];
                }
            } else {
                return filenameAndPath.files[0];
            }
        } else {
            //最终没有找到，返回输入的地址
            Ui.outputError('调试器没有找到文件 ' + shortPath + ' 。 请检查launch.json文件中lua后缀是否配置正确, 以及VSCode打开的工程是否正确');
            return shortPath;
        }
    }

    // 存在同名文件的情况下, 根据lua虚拟机传来的 fullPath , 判断断点处具体是哪一个文件
    public checkRightPath(fileName: string, oPath: string, fullPathArray: any[]): string {
        //------ 这部分还需要么？
        //如果首字符是@，去除@
        if ('@' === oPath.substr(0, 1)) {
            oPath = oPath.substr(1);
        }
        //如果是相对路径，把 ./ 替换成 /
        if ('./' === oPath.substr(0, 2)) {
            oPath = oPath.substr(1);
        }

        //标准化路径, 盘符变成小写
        oPath = this.genUnifiedPath(oPath);

        //因为 filename 存在不确定性（是否包含后缀），这里把后缀去掉进行对比
        let nameExtObject = this.getPathNameAndExt(fileName);
        fileName = nameExtObject['name'];

        // 从oPath中把文件名截取掉
        let idx = oPath.lastIndexOf(fileName);
        oPath = oPath.substring(0, idx - 1); // 此时opath是dir
        oPath = oPath + '/' + fileName;
        // oPath中的. 替换成 /
        oPath = oPath.replace(/\./g, '/');
        //------

        for (const iteratorPath of fullPathArray) {
            let pathForCompare = iteratorPath;
            if (pathForCompare.indexOf(oPath) >= 0) {
                // fullPathArray 中包含oPath, 命中
                return iteratorPath;
            }
        }
        // 如果最终都无法命中， 默认第一条。这种情况要避免，否则二次验证也通不过

        // 开发模式下提示
        let str = 'file_name:' + fileName + '  opath:' + oPath + '无法命中任何文件路径!';
        Ui.outputError(str);
        let Adapterlog = '同名文件无法命中!\n';
        for (const iteratorPath of fullPathArray) {
            Adapterlog += ' + ' + iteratorPath + '\n';
        }
        Adapterlog += str;
        Ui.outputError(Adapterlog);

        return fullPathArray[0];
    }

    // 把传入的路径转为标准路径
    public genUnifiedPath(beProcessPath: string): string {
        //全部使用 /
        beProcessPath = beProcessPath.replace(/\\/g, '/');
        while (beProcessPath.match(/\/\//)) {
            beProcessPath = beProcessPath.replace(/\/\//g, '/');
        }
        //win盘符转为小写
        beProcessPath = beProcessPath.replace(/^\w:/, function ($1) {
            return $1.toLocaleLowerCase();
        });
        return beProcessPath;
    }

    // 从URI分析出文件名和后缀
    public getPathNameAndExt(UriOrPath: string) {
        const nameAndExt = path.basename(UriOrPath).split('.');
        const name = nameAndExt.shift() || ''; //文件名
        const ext = nameAndExt.join('.') || ''; //文件后缀
        return { name, ext };
    }
}
