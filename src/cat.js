// Этот модуль создаёт кота из простых геометрических фигур и анимирует его.
// Отдельный класс позволяет не смешивать модель персонажа с логикой всей игры.
import * as THREE from 'three';
import { box, sphere } from './apartment.js';

export class Cat {
  constructor(scene) {
    // group перемещается по квартире, а visual содержит части тела кота.
    // Благодаря вложенности можно покачивать модель без изменения физической позиции.
    this.group = new THREE.Group();
    this.visual = new THREE.Group();
    this.group.add(this.visual);
    scene.add(this.group);
    this.group.position.set(0, 0, 3.2);

    // velocity — горизонтальная скорость, verticalVelocity — скорость прыжка/падения.
    this.velocity = new THREE.Vector3();
    this.verticalVelocity = 0;
    this.facing = Math.PI;
    this.attackTime = 0;
    this.attackCooldown = 0;
    this.step = 0;
    this.grounded = true;

    // Ссылки на ноги и сегменты хвоста сохраняются, чтобы двигать их в update().
    this.legGroups = [];
    this.tailSegments = [];
    this.buildModel();
  }

  // Кот собирается без внешней 3D-модели: тело — из сфер, уши — из конусов,
  // полосы — из тонких параллелепипедов, усы — из линий.
  buildModel() {
    const orange = 0xd98445;
    const light = 0xf2d2a5;
    const dark = 0x9d582f;
    const pink = 0xd88f85;
    const body = sphere(this.visual, [.48, .43, .78], [0, .64, 0], orange);
    body.rotation.x = -.08;
    sphere(this.visual, [.37, .35, .4], [0, .74, -.52], light);
    const head = sphere(this.visual, [.43, .4, .4], [0, 1.03, -.65], orange);
    head.rotation.x = -.08;
    sphere(this.visual, [.24, .17, .17], [0, .92, -.98], light);
    sphere(this.visual, [.07, .055, .05], [0, 1.01, -1.13], pink, 12);

    // Цикл по [-1, 1] строит симметричные левую и правую части морды.
    // Умножение координаты на side зеркально меняет её знак.
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.2, .38, 3), new THREE.MeshStandardMaterial({ color: orange, roughness: .8 }));
      ear.position.set(side * .26, 1.39, -.66);
      ear.rotation.z = side * -.12;
      ear.rotation.y = Math.PI / 4;
      ear.castShadow = true;
      this.visual.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(.1, .22, 3), new THREE.MeshStandardMaterial({ color: pink }));
      inner.position.set(side * .26, 1.39, -.73);
      inner.rotation.z = side * -.12;
      inner.rotation.y = Math.PI / 4;
      this.visual.add(inner);
      sphere(this.visual, [.065, .085, .035], [side * .18, 1.11, -1.005], 0x25251f, 12);
      sphere(this.visual, [.018, .023, .012], [side * .165, 1.14, -1.035], 0xf6efc8, 8);
      for (let i = 0; i < 3; i++) {
        const points = [new THREE.Vector3(side * .15, .95 - i * .045, -1.04), new THREE.Vector3(side * .58, .94 - i * .07, -1.1)];
        const whisker = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xf2e9d4, transparent: true, opacity: .8 }));
        this.visual.add(whisker);
      }
    }

    // Тёмные полосы на спине и по бокам.
    for (const z of [-.28, .18, .47]) {
      const stripe = box(this.visual, [.5, .055, .1], [0, 1.02 - Math.abs(z) * .25, z], dark, { rotation: [0, 0, 0] });
      stripe.rotation.x = z * .1;
    }
    for (const side of [-1, 1]) {
      box(this.visual, [.04, .1, .22], [side * .43, .77, -.25], dark, { rotation: [0, 0, side * .25] });
      box(this.visual, [.04, .09, .18], [side * .43, .72, .18], dark, { rotation: [0, 0, side * -.2] });
    }

    // Каждая нога — отдельная группа. Вращая группу, мы двигаем сразу и ногу, и лапу.
    for (const x of [-.3, .3]) for (const z of [-.43, .43]) {
      const leg = new THREE.Group();
      leg.position.set(x, .48, z);
      sphere(leg, [.14, .32, .15], [0, -.19, 0], orange, 14);
      sphere(leg, [.16, .11, .22], [0, -.43, -.055], light, 14);
      this.visual.add(leg);
      this.legGroups.push(leg);
    }

    // Сегменты хвоста вложены друг в друга, поэтому движение одного сегмента
    // передаётся всем следующим — получается гибкий хвост.
    let parent = this.visual;
    for (let i = 0; i < 7; i++) {
      const segment = new THREE.Group();
      segment.position.set(0, i === 0 ? .7 : 0, i === 0 ? .65 : .22);
      sphere(segment, [.105 - i * .007, .105 - i * .007, .19], [0, 0, .09], i % 3 === 2 ? light : orange, 12);
      parent.add(segment);
      this.tailSegments.push(segment);
      parent = segment;
    }
    this.tailSegments[0].rotation.x = -.55;

    // Простая круглая тень остаётся на полу даже во время прыжка.
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.63, 24), new THREE.MeshBasicMaterial({ color: 0x241c14, transparent: true, opacity: .2, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .015;
    this.group.add(shadow);
    this.shadow = shadow;
  }

  reset() {
    this.group.position.set(0, 0, 3.2);
    this.group.rotation.set(0, Math.PI, 0);
    this.visual.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.attackTime = 0;
    this.attackCooldown = 0;
    this.grounded = true;
  }

  // Возвращает false, если предыдущий удар ещё не закончился.
  // Это не даёт нанести много ударов за один кадр или при удержании F.
  attack() {
    if (this.attackCooldown > 0) return false;
    this.attackTime = .34;
    this.attackCooldown = .38;
    return true;
  }

  // update() вызывается на каждом кадре. dt — время в секундах с прошлого кадра,
  // поэтому скорость движения не зависит от частоты кадров компьютера.
  update(dt, input, cameraYaw, active) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackTime = Math.max(0, this.attackTime - dt);
    let moving = false;
    let sprinting = false;

    if (active) {
      // Противоположные направления вычитаются: W и S вместе дают ноль.
      // Number(true) равен 1, Number(false) — 0, поэтому флаги превращаются в вектор.
      const x = Number(input.right) - Number(input.left);
      const z = Number(input.down) - Number(input.up);
      const length = Math.hypot(x, z);
      sprinting = input.sprint && length > 0;
      const speed = sprinting ? 7.3 : 4.5;
      if (length > 0) {
        // Нормализация делает длину вектора равной 1: по диагонали кот не быстрее.
        const nx = x / length;
        const nz = z / length;
        // Поворачиваем направление вместе с камерой: W всегда означает «вперёд на экране».
        const sin = Math.sin(cameraYaw);
        const cos = Math.cos(cameraYaw);
        const worldX = nx * cos + nz * sin;
        const worldZ = -nx * sin + nz * cos;
        // damp плавно меняет скорость, создавая небольшое ускорение и торможение.
        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, worldX * speed, 12, dt);
        this.velocity.z = THREE.MathUtils.damp(this.velocity.z, worldZ * speed, 12, dt);
        this.facing = Math.atan2(worldX, worldZ) + Math.PI;
        moving = true;
      } else {
        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 10, dt);
        this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 10, dt);
      }
      if (input.jump && this.grounded) {
        this.verticalVelocity = 5.8;
        this.grounded = false;
        input.jump = false;
      }
    } else {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 10, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 10, dt);
    }

    // Новая позиция = старая позиция + скорость × прошедшее время.
    this.group.position.x += this.velocity.x * dt;
    this.group.position.z += this.velocity.z * dt;
    // clamp не выпускает кота за границы квартиры.
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -8.55, 8.55);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -6.55, 6.55);
    // Отрицательное ускорение по Y — гравитация. При касании пола падение прекращается.
    this.verticalVelocity -= 15 * dt;
    this.group.position.y += this.verticalVelocity * dt;
    if (this.group.position.y <= 0) {
      this.group.position.y = 0;
      this.verticalVelocity = 0;
      this.grounded = true;
    }

    // Находим кратчайшую разницу углов, чтобы кот не делал лишний полный оборот.
    const angleDelta = Math.atan2(Math.sin(this.facing - this.group.rotation.y), Math.cos(this.facing - this.group.rotation.y));
    this.group.rotation.y += angleDelta * Math.min(1, dt * 13);

    // Синусоиды по очереди качают ноги, тело и хвост — так получается анимация шага.
    const actualSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.step += dt * actualSpeed * 2.3;
    this.legGroups.forEach((leg, i) => {
      leg.rotation.x = moving ? Math.sin(this.step + (i % 3) * Math.PI) * .55 : THREE.MathUtils.damp(leg.rotation.x, 0, 8, dt);
    });
    this.visual.position.y = moving && this.grounded ? Math.abs(Math.sin(this.step * 2)) * .035 : 0;
    this.visual.rotation.z = this.attackTime > 0 ? Math.sin(this.attackTime * 28) * .09 : THREE.MathUtils.damp(this.visual.rotation.z, 0, 12, dt);
    this.visual.rotation.x = this.attackTime > 0 ? -.15 * Math.sin((this.attackTime / .34) * Math.PI) : THREE.MathUtils.damp(this.visual.rotation.x, 0, 12, dt);
    this.tailSegments.forEach((segment, i) => {
      segment.rotation.y = Math.sin(this.step * .35 + i * .48) * (.13 + i * .016);
      if (i > 0) segment.rotation.x = -.06 + Math.sin(this.step * .22 + i) * .045;
    });
    this.shadow.material.opacity = .2 / (1 + this.group.position.y * .7);
    this.shadow.scale.setScalar(1 + this.group.position.y * .12);
    return { moving, sprinting, speed: actualSpeed };
  }
}
