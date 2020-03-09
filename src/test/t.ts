

let arr = [1, 2, 3, 4];
async function print() {
    for (let a of arr) {
        await setTimeout(() => { console.log(a) }, 1000);
    }
}
