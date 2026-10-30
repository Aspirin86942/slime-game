// 设备档案表：尺寸 / DPR / 屏幕比例 / 安全区 / 是否触摸。
// 纯数据与纯函数，不接触浏览器；session 会把这里的值转成 CDP 指标。
'use strict';

const zero = () => ({ top: 0, right: 0, bottom: 0, left: 0 });

// 声明顺序即 matrix 的返回顺序，新增档案请追加在对应分组末尾。
const devices = {
  se: { width: 320, height: 568, dpr: 2, ratio: '16:9', touch: true, safeArea: zero() },
  'android-s': { width: 360, height: 640, dpr: 3, ratio: '16:9', touch: true, safeArea: zero() },
  'iphone-se': { width: 375, height: 667, dpr: 2, ratio: '16:9', touch: true, safeArea: zero() },
  'iphone-14': { width: 390, height: 844, dpr: 3, ratio: '19.5:9', touch: true, safeArea: { top: 47, right: 0, bottom: 34, left: 0 } },
  pixel: { width: 412, height: 915, dpr: 2.625, ratio: '20:9', touch: true, safeArea: zero() },
  'iphone-max': { width: 430, height: 932, dpr: 3, ratio: '19.5:9', touch: true, safeArea: { top: 59, right: 0, bottom: 34, left: 0 } },
  fold: { width: 1080, height: 2520, dpr: 2.5, ratio: '21:9', touch: true, safeArea: zero() },
  'land-568': { width: 568, height: 320, dpr: 2, ratio: '16:9', touch: true, safeArea: zero() },
  'land-844': { width: 844, height: 390, dpr: 3, ratio: '19.5:9', touch: true, safeArea: { top: 0, right: 47, bottom: 21, left: 47 } },
  'land-932': { width: 932, height: 430, dpr: 3, ratio: '19.5:9', touch: true, safeArea: zero() },
  tablet: { width: 768, height: 1024, dpr: 2, ratio: '4:3', touch: true, safeArea: zero() },
  'desktop-s': { width: 1440, height: 900, dpr: 1, ratio: '16:10', touch: false, safeArea: zero() },
  'desktop-m': { width: 1920, height: 1080, dpr: 1, ratio: '16:9', touch: false, safeArea: zero() },
};

const groups = {
  phones: ['se', 'android-s', 'iphone-se', 'iphone-14', 'pixel', 'iphone-max', 'fold'],
  landscape: ['land-568', 'land-844', 'land-932'],
  tablets: ['tablet'],
  desktop: ['desktop-s', 'desktop-m'],
};

function normalizeSafeArea(safeArea) {
  if (!safeArea) return zero();
  return {
    top: safeArea.top ?? 0,
    right: safeArea.right ?? 0,
    bottom: safeArea.bottom ?? 0,
    left: safeArea.left ?? 0,
  };
}

// 按 devices 声明顺序过滤出组内档案；group 缺省为 all。
function matrix({ group = 'all' } = {}) {
  const names = Object.keys(devices);
  if (group === 'all') return names;
  if (!groups[group]) throw new Error('未知设备分组: ' + group);
  return names.filter(name => groups[group].includes(name));
}

// 档案名或现成对象都接受；补齐 name / mobile / touch / safeArea。
function resolve(nameOrObject) {
  let name;
  let device;
  if (typeof nameOrObject === 'string') {
    name = nameOrObject;
    device = devices[name];
    if (!device) throw new Error('未知设备档案: ' + name);
  } else if (nameOrObject && typeof nameOrObject === 'object') {
    device = nameOrObject;
    name = nameOrObject.name;
  } else {
    throw new Error('未知设备档案: ' + nameOrObject);
  }
  return {
    ...device,
    name,
    mobile: device.width < 1000,
    touch: device.touch !== false,
    safeArea: normalizeSafeArea(device.safeArea),
  };
}

module.exports = { devices, matrix, resolve };
