import * as path from 'path';
import * as fs from 'fs';

let pathName = "d:/OneDrive/git/JS/workspace1";
fs.readdir(pathName, (err, files) => {
    let dirs: any = [];
    if (err) {
        console.log(err);
    } else {
        (function iterator(i) {
            if (i == files.length) {
                console.log(dirs);
                return;
            }
            fs.stat(path.join(pathName, files[i]), (err, data) => {
                if (data.isFile()) {
                    dirs.push(files[i]);
                }
                iterator(i + 1);
            });
        })(0);
    }
})

fs.readdir(pathName, (err, data) => {
    if (err) {
        console.log(err);
    } else {
        console.log(data);
    }
})
// fs.readdirSync(pathName).forEach(files => { console.log(files); })

// console.log(process.cwd());

console.log(path.dirname(pathName));
