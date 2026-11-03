// Модуль строит всю квартиру программно: загружать отдельные 3D-модели не нужно.
// Каждый предмет состоит из простых фигур, объединённых в THREE.Group.
import * as THREE from 'three';

// Общая палитра. Цвета записаны в шестнадцатеричном формате RGB.
const C = {
  wall: 0xe6dfcf, wallDark: 0xcac3b4, wood: 0xa87347, woodLight: 0xc89662,
  darkWood: 0x594536, cream: 0xf3ead8, sage: 0x71866c, sageDark: 0x4d6250,
  orange: 0xd86f48, blue: 0x668b96, black: 0x252a29, metal: 0x9ca4a0,
  white: 0xeaeae3, yellow: 0xe2b84f, pink: 0xc78378, green: 0x426b45,
};

// Одинаковые материалы сохраняются в Map и используются повторно.
// Это экономит память: например, вся деревянная мебель может делить один материал.
const materials = new Map();
export function mat(color, roughness = 0.75, metalness = 0) {
  const key = `${color}-${roughness}-${metalness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key);
}

// Три функции ниже — небольшие строительные блоки сцены.
// parent — группа, к которой добавляется фигура; size и position — массивы [x, y, z].
export function box(parent, size, position, color, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), options.material || mat(color, options.roughness, options.metalness));
  mesh.position.set(...position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function sphere(parent, size, position, color, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 14), mat(color));
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(parent, radiusTop, radiusBottom, height, position, color, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Создаёт пустую группу с заданной позицией. Детали мебели затем добавляются
// в локальных координатах группы, поэтому всю мебель легко перемещать целиком.
function groupAt(scene, x, y, z, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  scene.add(group);
  return group;
}

function staticBox(scene, size, position, color, options) {
  return box(scene, size, position, color, options);
}

// createApartment() вызывается один раз при загрузке игры.
// После построения каждого предмета register() делает его интерактивным.
export function createApartment(scene, register) {
  createRoom(scene);

  // Диван: отдельные коробки образуют основание, спинку, подлокотники и подушки.
  // В register передаются не только размеры, но и цена, масса и запас прочности.

  const sofa = groupAt(scene, -4.5, 0, -3.5);
  box(sofa, [4.1, .48, 1.65], [0, .4, 0], C.sageDark);
  box(sofa, [3.35, .35, 1.3], [0, .78, .13], C.sage);
  box(sofa, [4.05, 1.15, .4], [0, 1.05, -.64], C.sage);
  box(sofa, [.4, .85, 1.65], [-1.86, .74, 0], C.sageDark);
  box(sofa, [.4, .85, 1.65], [1.86, .74, 0], C.sageDark);
  box(sofa, [1.25, .7, .24], [-.75, 1.22, -.35], 0x879b79, { rotation: [-.15, 0, 0] });
  box(sofa, [1.25, .7, .24], [.75, 1.22, -.35], 0x879b79, { rotation: [-.15, 0, 0] });
  box(sofa, [.65, .65, .22], [1.15, 1.25, -.05], C.orange, { rotation: [0, 0, -.18] });
  register(sofa, { name: 'Диван «Облако»', value: 85000, size: [4.2, 1.65, 1.8], mass: 8, health: 6, color: C.sage });

  const rug = groupAt(scene, -3.8, .015, -.1);
  box(rug, [5.7, .035, 3.8], [0, 0, 0], 0xd9c8a7);
  for (let i = -2; i <= 2; i++) box(rug, [.18, .041, 3.6], [i * 1.05, .005, 0], i % 2 ? C.orange : C.cream);
  register(rug, { name: 'Персидский ковёр', value: 32000, size: [5.7, .08, 3.8], mass: 2, health: 3, color: 0xd9c8a7 });

  const coffee = groupAt(scene, -3.9, 0, -.2);
  box(coffee, [2.8, .18, 1.45], [0, .7, 0], C.woodLight);
  for (const x of [-1.12, 1.12]) for (const z of [-.5, .5]) box(coffee, [.14, .68, .14], [x, .34, z], C.darkWood);
  register(coffee, { name: 'Журнальный стол', value: 24000, size: [2.9, .85, 1.55], mass: 4, health: 3, color: C.woodLight, wakesAbove: true });

  const vase = groupAt(scene, -4.45, .81, -.25);
  cylinder(vase, .16, .24, .48, [0, .24, 0], C.blue);
  cylinder(vase, .13, .16, .17, [0, .55, 0], C.blue);
  for (let i = 0; i < 4; i++) {
    const stem = cylinder(vase, .018, .018, .55, [(i - 1.5) * .06, .91, 0], C.green, 7);
    stem.rotation.z = (i - 1.5) * .12;
    sphere(vase, [.13, .1, .13], [(i - 1.5) * .12, 1.18 - Math.abs(i - 1.5) * .05, 0], i % 2 ? C.pink : C.cream, 10);
  }
  register(vase, { name: 'Ваза с тюльпанами', value: 7500, size: [.75, 1.35, .65], mass: .7, health: 1, color: C.blue });

  const bookColors = [C.orange, C.blue, C.yellow];
  bookColors.forEach((color, i) => {
    const book = groupAt(scene, -3.25, .82 + i * .09, -.1, -.12);
    box(book, [.65, .08, .45], [0, .04, 0], color);
    box(book, [.58, .055, .43], [.02, .04, 0], C.cream);
    register(book, { name: ['Книга «Кот и смысл жизни»', 'Альбом с котами', 'Поваренная книга'][i], value: 1200 + i * 300, size: [.7, .12, .5], mass: .3, health: 1, color });
  });

  const tvStand = groupAt(scene, -1.1, 0, -5.65);
  box(tvStand, [3.1, .62, .75], [0, .43, 0], C.wood);
  box(tvStand, [1.35, .4, .04], [-.72, .43, .4], C.woodLight);
  box(tvStand, [1.35, .4, .04], [.72, .43, .4], C.woodLight);
  register(tvStand, { name: 'Тумба под телевизор', value: 28000, size: [3.2, .8, .9], mass: 5, health: 4, color: C.wood, wakesAbove: true });

  const tv = groupAt(scene, -1.1, .78, -5.65);
  box(tv, [2.55, 1.45, .13], [0, .83, 0], C.black);
  box(tv, [2.38, 1.28, .015], [0, .84, .074], 0x182c32, { material: new THREE.MeshStandardMaterial({ color: 0x1d343a, roughness: .25, emissive: 0x10282e, emissiveIntensity: .35 }) });
  box(tv, [.55, .12, .4], [0, .08, 0], C.black);
  register(tv, { name: 'Телевизор 65″', value: 115000, size: [2.65, 1.6, .55], mass: 3, health: 2, color: C.black });

  const armchair = groupAt(scene, -7.1, 0, .65, .45);
  box(armchair, [1.55, .45, 1.5], [0, .45, 0], C.orange);
  box(armchair, [1.55, 1.15, .35], [0, 1.05, -.57], C.orange);
  box(armchair, [1.2, .3, 1.15], [0, .8, .08], 0xe58b61);
  for (const x of [-.58, .58]) for (const z of [-.5, .5]) box(armchair, [.12, .35, .12], [x, .17, z], C.darkWood);
  register(armchair, { name: 'Кресло хозяина', value: 42000, size: [1.7, 1.7, 1.7], mass: 5, health: 4, color: C.orange });

  createLamp(scene, register, -7.6, -3.8, 'Торшер');
  createPlant(scene, register, .3, -4.8, 1.15, 'Фикус у окна');

  const bed = groupAt(scene, -5.25, 0, 4.35);
  box(bed, [3.5, .48, 4], [0, .45, 0], C.darkWood);
  box(bed, [3.25, .45, 3.75], [0, .82, 0], C.cream);
  box(bed, [3.55, 1.55, .25], [0, 1.0, -1.9], C.wood);
  box(bed, [3.15, .18, 2.2], [0, 1.09, .65], C.blue);
  box(bed, [1.25, .25, .7], [-.72, 1.15, -1.15], C.white, { rotation: [0, 0, -.08] });
  box(bed, [1.25, .25, .7], [.72, 1.15, -1.15], C.white, { rotation: [0, 0, .08] });
  for (const x of [-1.5, 1.5]) for (const z of [-1.65, 1.65]) box(bed, [.16, .4, .16], [x, .2, z], C.darkWood);
  register(bed, { name: 'Кровать с новым бельём', value: 79000, size: [3.7, 1.85, 4.1], mass: 10, health: 7, color: C.blue });

  const nightstand = groupAt(scene, -7.75, 0, 3.15);
  box(nightstand, [1, .8, .85], [0, .5, 0], C.woodLight);
  box(nightstand, [.8, .25, .05], [0, .58, .45], C.wood);
  register(nightstand, { name: 'Прикроватная тумба', value: 14500, size: [1.1, .95, 1], mass: 3, health: 2, color: C.woodLight, wakesAbove: true });

  const alarm = groupAt(scene, -7.75, .93, 3.15);
  box(alarm, [.55, .32, .18], [0, .16, 0], C.black);
  box(alarm, [.4, .16, .01], [0, .18, .1], 0x9cb66c, { material: new THREE.MeshBasicMaterial({ color: 0x9cb66c }) });
  register(alarm, { name: 'Будильник на 6:00', value: 3200, size: [.6, .38, .25], mass: .3, health: 1, color: C.black });

  const wardrobe = groupAt(scene, -8.25, 0, 5.35);
  box(wardrobe, [1.15, 2.8, 2.2], [0, 1.4, 0], C.woodLight);
  box(wardrobe, [.05, 2.55, 1.95], [.6, 1.4, 0], C.wood);
  sphere(wardrobe, [.05, .05, .05], [.64, 1.45, -.25], C.metal);
  sphere(wardrobe, [.05, .05, .05], [.64, 1.45, .25], C.metal);
  register(wardrobe, { name: 'Шкаф с одеждой', value: 92000, size: [1.3, 2.9, 2.3], mass: 11, health: 7, color: C.woodLight });

  // Большие зоны вынесены в отдельные функции, чтобы их было проще найти и изменять.
  createKitchen(scene, register);
  createWorkspace(scene, register);
  createWallDecor(scene, register);

  const ball = groupAt(scene, .4, 0, 3.2);
  sphere(ball, [.28, .28, .28], [0, .28, 0], C.orange);
  register(ball, { name: 'Любимый мячик', value: 300, size: [.56, .56, .56], mass: .2, health: 1, color: C.orange });

  const bowl = groupAt(scene, 6.9, 0, 5.85);
  cylinder(bowl, .42, .28, .22, [0, .11, 0], C.metal);
  cylinder(bowl, .34, .34, .025, [0, .23, 0], 0x795138);
  register(bowl, { name: 'Миска с кормом', value: 900, size: [.85, .35, .85], mass: .4, health: 1, color: C.metal });
}

// Стены, пол и окна — статичные объекты: их не передают в register(),
// поэтому в отличие от мебели они не участвуют в системе разрушений.
function createRoom(scene) {
  staticBox(scene, [18.6, .25, 14.6], [0, -.18, 0], 0x7b5c43);
  // Два вложенных цикла раскладывают доски по осям X и Z, как сетку на полу.
  const plankColors = [0xb78960, 0xc0946b, 0xae8058, 0xba8b61];
  for (let x = -8.6; x < 9; x += 1.2) {
    for (let z = -6.6; z < 7; z += 2.25) {
      staticBox(scene, [1.17, .035, 2.21], [x, -.02, z], plankColors[Math.floor(Math.random() * plankColors.length)], { castShadow: false });
    }
  }
  // Две высокие стены и два низких бортика оставляют квартиру видимой для камеры.
  staticBox(scene, [18.5, 3.4, .22], [0, 1.65, -7.15], C.wall);
  staticBox(scene, [.22, 3.4, 14.5], [-9.15, 1.65, 0], C.wall);
  staticBox(scene, [18.5, .28, .18], [0, .14, 7.15], C.wallDark);
  staticBox(scene, [.18, .28, 14.5], [9.15, .14, 0], C.wallDark);
  staticBox(scene, [18.2, .14, .12], [0, .11, -6.99], C.cream);
  staticBox(scene, [.12, .14, 14], [-8.99, .11, 0], C.cream);

  // emissive добавляет стеклу собственное свечение, имитируя дневной свет за окном.
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ec5cf, emissive: 0x769ea9, emissiveIntensity: .45, roughness: .15 });
  staticBox(scene, [4.6, 2.15, .05], [-4.8, 1.95, -7.01], 0xffffff, { material: glass, castShadow: false });
  for (const x of [-7.15, -4.8, -2.45]) staticBox(scene, [.09, 2.3, .12], [x, 1.95, -6.95], C.white);
  staticBox(scene, [4.8, .1, .18], [-4.8, .85, -6.92], C.white);
  staticBox(scene, [4.8, .1, .18], [-4.8, 3.05, -6.92], C.white);
  staticBox(scene, [.09, 2.2, .1], [-4.8, 1.95, -6.91], C.white);

  staticBox(scene, [.05, 2.15, 3.3], [-9.01, 1.95, 3.7], 0xffffff, { material: glass, castShadow: false });
  for (const z of [2, 3.7, 5.4]) staticBox(scene, [.12, 2.3, .09], [-8.95, 1.95, z], C.white);
  staticBox(scene, [.18, .1, 3.5], [-8.92, .85, 3.7], C.white);
  staticBox(scene, [.18, .1, 3.5], [-8.92, 3.05, 3.7], C.white);

  // Полупрозрачная плоскость на полу — декоративное пятно солнечного света.
  const sunlight = new THREE.MeshBasicMaterial({ color: 0xffe9b3, transparent: true, opacity: .075, depthWrite: false, side: THREE.DoubleSide });
  const lightPatch = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), sunlight);
  lightPatch.rotation.x = -Math.PI / 2;
  lightPatch.rotation.z = -.3;
  lightPatch.position.set(-3.6, .025, -3.2);
  scene.add(lightPatch);
}

// Повторяющиеся предметы тоже вынесены в функции с параметрами.
// Например, createLamp() может поставить одинаковую лампу в любой точке X/Z.
function createLamp(scene, register, x, z, name) {
  const lamp = groupAt(scene, x, 0, z);
  cylinder(lamp, .38, .42, .09, [0, .045, 0], C.black);
  cylinder(lamp, .035, .035, 1.75, [0, .95, 0], C.metal);
  cylinder(lamp, .28, .52, .62, [0, 1.85, 0], C.cream);
  const glow = new THREE.PointLight(0xffd7a0, 2.2, 5, 2);
  glow.position.set(0, 1.75, 0);
  lamp.add(glow);
  register(lamp, { name, value: 18000, size: [1.05, 2.2, 1.05], mass: 2, health: 2, color: C.cream });
}

function createPlant(scene, register, x, z, scale = 1, name = 'Домашний фикус') {
  const plant = groupAt(scene, x, 0, z);
  cylinder(plant, .34 * scale, .25 * scale, .55 * scale, [0, .275 * scale, 0], C.orange);
  cylinder(plant, .3 * scale, .3 * scale, .04, [0, .55 * scale, 0], 0x44372a);
  cylinder(plant, .035, .05, 1.15 * scale, [0, 1.05 * scale, 0], C.green, 8);
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4;
    const leaf = sphere(plant, [.32 * scale, .09 * scale, .16 * scale], [Math.sin(angle) * .28 * scale, (.85 + i * .09) * scale, Math.cos(angle) * .28 * scale], i % 2 ? 0x527d4c : C.green, 12);
    leaf.rotation.y = angle;
    leaf.rotation.z = Math.sin(angle) * .35;
  }
  register(plant, { name, value: Math.round(9800 * scale), size: [.95 * scale, 1.8 * scale, .95 * scale], mass: 1.4, health: 1, color: C.green });
}

function createKitchen(scene, register) {
  const cabinetPositions = [3.1, 4.55, 6, 7.45];
  cabinetPositions.forEach((x, i) => {
    const cabinet = groupAt(scene, x, 0, -6.15);
    box(cabinet, [1.4, 1.05, 1.25], [0, .525, 0], i === 2 ? C.black : C.cream);
    box(cabinet, [1.46, .12, 1.32], [0, 1.1, 0], C.darkWood);
    if (i !== 2) box(cabinet, [1.18, .82, .04], [0, .53, .65], C.white);
    sphere(cabinet, [.035, .035, .035], [.42, .56, .69], C.metal);
    register(cabinet, { name: i === 2 ? 'Духовой шкаф' : `Кухонный шкаф №${i + 1}`, value: i === 2 ? 68000 : 27000, size: [1.5, 1.2, 1.4], mass: 6, health: 4, color: i === 2 ? C.black : C.cream, wakesAbove: true });
  });

  const fridge = groupAt(scene, 8.15, 0, -4.35);
  box(fridge, [1.55, 2.85, 1.5], [0, 1.425, 0], C.white);
  box(fridge, [1.42, .04, .04], [0, 1.85, .77], C.metal);
  box(fridge, [.05, .8, .06], [-.52, 2.25, .79], C.metal);
  box(fridge, [.05, .65, .06], [-.52, 1.25, .79], C.metal);
  box(fridge, [.38, .48, .015], [.25, 2.25, .77], C.yellow, { rotation: [0, 0, .12] });
  register(fridge, { name: 'Холодильник с магнитами', value: 135000, size: [1.65, 2.9, 1.65], mass: 12, health: 8, color: C.white });

  const kettle = groupAt(scene, 3.2, 1.18, -6.1);
  cylinder(kettle, .22, .28, .42, [0, .21, 0], C.orange);
  cylinder(kettle, .13, .22, .1, [0, .47, 0], C.black);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.27, .04, 8, 16, Math.PI), mat(C.black));
  handle.position.set(0, .35, 0); handle.rotation.z = Math.PI / 2; kettle.add(handle);
  register(kettle, { name: 'Электрический чайник', value: 6500, size: [.65, .65, .65], mass: .6, health: 1, color: C.orange });

  for (let i = 0; i < 3; i++) {
    const plate = groupAt(scene, 5.85, 1.18 + i * .055, -6.05);
    cylinder(plate, .34, .28, .055, [0, .027, 0], C.blue, 24);
    register(plate, { name: `Тарелка ${i + 1}`, value: 850, size: [.7, .08, .7], mass: .2, health: 1, color: C.blue });
  }

  const table = groupAt(scene, 4.55, 0, -.5);
  box(table, [3.1, .16, 2], [0, 1.0, 0], C.woodLight);
  for (const x of [-1.28, 1.28]) for (const z of [-.75, .75]) box(table, [.14, .95, .14], [x, .475, z], C.darkWood);
  register(table, { name: 'Обеденный стол', value: 48000, size: [3.2, 1.12, 2.1], mass: 6, health: 4, color: C.woodLight, wakesAbove: true });

  const fruitBowl = groupAt(scene, 4.55, 1.1, -.5);
  cylinder(fruitBowl, .48, .28, .2, [0, .1, 0], C.cream, 20);
  for (let i = 0; i < 5; i++) sphere(fruitBowl, [.15, .15, .15], [Math.sin(i * 2.4) * .25, .27, Math.cos(i * 2.4) * .2], i % 2 ? C.orange : C.yellow, 12);
  register(fruitBowl, { name: 'Ваза с фруктами', value: 2400, size: [1, .55, 1], mass: .7, health: 1, color: C.cream });

  const chairs = [[2.55, -.5, Math.PI / 2], [6.55, -.5, -Math.PI / 2], [4.55, 1.25, Math.PI]];
  chairs.forEach(([x, z, r], i) => createChair(scene, register, x, z, r, `Стул №${i + 1}`));
  createPlant(scene, register, 7.9, 1.5, .8, 'Пальма в кадке');
}

function createChair(scene, register, x, z, rotation, name) {
  const chair = groupAt(scene, x, 0, z, rotation);
  box(chair, [1.05, .14, 1], [0, .65, 0], C.sage);
  box(chair, [1.05, .85, .13], [0, 1.12, -.43], C.sage);
  for (const px of [-.4, .4]) for (const pz of [-.36, .36]) box(chair, [.1, .62, .1], [px, .31, pz], C.darkWood);
  register(chair, { name, value: 15500, size: [1.15, 1.6, 1.15], mass: 2.4, health: 2, color: C.sage });
}

function createWorkspace(scene, register) {
  const desk = groupAt(scene, 4.55, 0, 5.5);
  box(desk, [3.8, .16, 1.45], [0, .95, 0], C.woodLight);
  box(desk, [.16, .9, 1.25], [-1.65, .45, 0], C.black);
  box(desk, [.16, .9, 1.25], [1.65, .45, 0], C.black);
  register(desk, { name: 'Рабочий стол', value: 38000, size: [3.9, 1.08, 1.55], mass: 6, health: 4, color: C.woodLight, wakesAbove: true });

  const laptop = groupAt(scene, 4.5, 1.05, 5.45);
  box(laptop, [1.2, .07, .8], [0, .035, 0], C.metal);
  box(laptop, [1.2, .75, .07], [0, .43, -.36], C.black, { rotation: [-.12, 0, 0] });
  box(laptop, [1.06, .61, .01], [0, .44, -.315], 0x42636d, { material: new THREE.MeshStandardMaterial({ color: 0x42636d, emissive: 0x294750, emissiveIntensity: .5 }) });
  register(laptop, { name: 'Ноутбук с недописанной работой', value: 128000, size: [1.3, .9, .9], mass: 1, health: 1, color: C.metal });

  const mug = groupAt(scene, 5.75, 1.05, 5.55);
  cylinder(mug, .18, .16, .36, [0, .18, 0], C.orange);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.14, .035, 8, 16), mat(C.orange));
  handle.position.set(.19, .2, 0); mug.add(handle);
  register(mug, { name: 'Кружка «Лучший кот»', value: 1100, size: [.5, .42, .45], mass: .25, health: 1, color: C.orange });

  const chair = groupAt(scene, 4.55, 0, 3.75);
  cylinder(chair, .42, .42, .16, [0, .65, 0], C.black);
  cylinder(chair, .06, .06, .58, [0, .32, 0], C.metal);
  box(chair, [.95, .95, .16], [0, 1.15, .38], C.sageDark, { rotation: [-.08, 0, 0] });
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * .4;
    const leg = box(chair, [.07, .08, .65], [Math.sin(a) * .22, .09, Math.cos(a) * .22], C.metal);
    leg.rotation.y = a;
  }
  register(chair, { name: 'Офисное кресло', value: 33000, size: [1.2, 1.7, 1.2], mass: 3, health: 3, color: C.sageDark });

  const shelf = groupAt(scene, 7.9, 0, 4.6);
  box(shelf, [1.5, 2.35, .65], [0, 1.175, 0], C.wood);
  box(shelf, [1.3, 2.12, .55], [0, 1.2, .05], C.darkWood);
  for (let y = .35; y < 2.2; y += .6) box(shelf, [1.35, .08, .62], [0, y, 0], C.woodLight);
  register(shelf, { name: 'Книжный шкаф', value: 39000, size: [1.6, 2.45, .8], mass: 7, health: 5, color: C.wood });
  createLamp(scene, register, 7.75, 6.05, 'Лампа у двери');
}

function createWallDecor(scene, register) {
  const art = groupAt(scene, 3.9, 1.8, -6.98);
  box(art, [1.6, 1.25, .09], [0, .625, 0], C.darkWood);
  box(art, [1.42, 1.07, .02], [0, .625, .06], C.cream);
  sphere(art, [.35, .35, .02], [0, .72, .08], C.orange, 16);
  box(art, [.6, .08, .02], [0, .3, .08], C.sage);
  register(art, { name: 'Картина «Абстрактный кот»', value: 46000, size: [1.7, 1.35, .2], mass: 1, health: 1, color: C.orange });

  const clock = groupAt(scene, 6.5, 2.05, -6.98);
  const face = cylinder(clock, .48, .48, .08, [0, .48, 0], C.cream, 32);
  face.rotation.x = Math.PI / 2;
  box(clock, [.035, .32, .025], [0, .61, .06], C.black, { rotation: [0, 0, -.35] });
  box(clock, [.25, .025, .025], [.1, .48, .065], C.black, { rotation: [0, 0, .2] });
  register(clock, { name: 'Настенные часы', value: 8900, size: [1.05, 1.05, .2], mass: .6, health: 1, color: C.cream });
}
