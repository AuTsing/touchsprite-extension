// Promise.all([1, 2, 3].map(async item => item ** 2))
//   .then((arr) => { console.log(arr); });

// [1, 2, 3].forEach(item => {
//   console.log(item ** 2)
// });

// [1, 2, 3].forEach(item => {
//   setTimeout(() => console.log(item), 1000);
// });

// let crr = [1, 2, 3].reduce((current, next) => {
//   new Promise<number>((resolve) => {
//     resolve(current + next);
//   })
// }, 0)
// console.log(crr);

// Array.from(Array(10))
//   .reduce((promise) => {
//     return promise.then((value: number) => {
//       console.log(value)
//       setTimeout(() => { return Promise.resolve(value - 1) }, 1000)
//     })
//   }, Promise.resolve(10));

// let arr = [1, 2, 3];
// arr.reduce(
//   (p, subArray) => p.then(() => Promise.all(subArray)),
//   Promise.resolve()
// );