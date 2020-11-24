import * as vscode from 'vscode';
import Tools from '../lib/Tools';
import Ui from '../ui/Ui';

export class PathManager {
    public fileNameToPathMap: { [key: string]: string } | undefined;
    public useAutoPathMode: boolean = false;
    public pathCaseSensitivity: boolean = false;

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

    // 获取扩展中预置的lua文件位置
    public getClibPathInExtension(): string {
        let ClibPathInVSCodeExtension = Tools.vscodeExtensionPath + '/Debugger/debugger_lib/plugins/';
        return ClibPathInVSCodeExtension;
    }

    // 传入局部路径，返回完整路径
    public checkFullPath(shortPath: string, oPath?: string): string {
        if (this.useAutoPathMode === false) {
            return shortPath;
        }

        //如果首字符是@，去除@
        if ('@' === shortPath.substr(0, 1)) {
            shortPath = shortPath.substr(1);
        }

        let nameExtObject = Tools.getPathNameAndExt(shortPath);
        let fileName = nameExtObject['name'];

        let fullPath;
        if (this.pathCaseSensitivity) {
            fullPath = this.fileNameToPathMap ? this.fileNameToPathMap[fileName] : '';
        } else {
            for (const keyPath in this.fileNameToPathMap) {
                if (keyPath.toLowerCase() === fileName) {
                    fullPath = this.fileNameToPathMap[keyPath];
                    break;
                }
            }
        }

        if (fullPath) {
            if (Array.isArray(fullPath)) {
                // 存在同名文件
                if (oPath) {
                    return this.checkRightPath(shortPath, oPath, fullPath);
                } else {
                    // 如果lua文件没有更新，没有传过来oPath，则打开第一个文件
                    for (const element of fullPath) {
                        if (element.indexOf(shortPath)) {
                            return element; // 这里固定返回第一个元素
                        }
                    }
                }
            } else if (typeof fullPath === 'string') {
                return fullPath;
            }
        }
        //最终没有找到，返回输入的地址
        Ui.logging('调试器没有找到文件 ' + shortPath + ' 。 请检查launch.json文件中lua后缀是否配置正确, 以及VSCode打开的工程是否正确');
        return shortPath;
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
        oPath = Tools.genUnifiedPath(oPath);

        if (!this.pathCaseSensitivity) {
            oPath = oPath.toLowerCase();
        }

        //因为 filename 存在不确定性（是否包含后缀），这里把后缀去掉进行对比
        let nameExtObject = Tools.getPathNameAndExt(fileName);
        fileName = nameExtObject['name'];

        // 从oPath中把文件名截取掉
        let idx = oPath.lastIndexOf(fileName);
        oPath = oPath.substring(0, idx - 1); // 此时opath是dir
        oPath = oPath + '/' + fileName;
        // oPath中的. 替换成 /
        oPath = oPath.replace(/\./g, '/');

        for (const iteratorPath of fullPathArray) {
            let pathForCompare = iteratorPath;
            if (!this.pathCaseSensitivity) {
                pathForCompare = iteratorPath.toLowerCase();
            }
            if (pathForCompare.indexOf(oPath) >= 0) {
                // fullPathArray 中包含oPath, 命中
                return iteratorPath;
            }
        }
        // 如果最终都无法命中， 默认第一条。这种情况要避免，否则二次验证也通不过
        if (Tools.developmentMode === true) {
            // 开发模式下提示
            let str = 'file_name:' + fileName + '  opath:' + oPath + '无法命中任何文件路径!';
            Ui.logging(str);
            let Adapterlog = '同名文件无法命中!\n';
            for (const iteratorPath of fullPathArray) {
                Adapterlog += ' + ' + iteratorPath + '\n';
            }
            Adapterlog += str;
            Ui.logging(Adapterlog);
        }
        return fullPathArray[0];
    }
}
