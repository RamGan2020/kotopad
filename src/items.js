// Здесь находится упрощённая физика игры: толкание, гравитация, урон,
// столкновения предметов друг с другом и исчезающие осколки.
// Это не полноценный физический движок, а небольшие понятные правила для нашей сцены.
import * as THREE from 'three';
import { mat } from './apartment.js';

export class DestructibleSystem {
  constructor(scene, onBreak, onHit) {
    this.scene = scene;
    this.items = [];
    this.debris = [];
    // Эти функции приходят из main.js и обновляют звук, очки и интерфейс.
    this.onBreak = onBreak;
    this.onHit = onHit;
    // Временный вектор используется повторно, чтобы не создавать лишние объекты.
    this.temp = new THREE.Vector3();
  }

  // register() связывает видимую 3D-группу с игровыми свойствами предмета.
  // config содержит цену, размер, массу и количество здоровья.
  register(mesh, config) {
    const item = {
      mesh,
      name: config.name,
      value: config.value,
      size: new THREE.Vector3(...config.size),
      // Для простоты столкновений предмет приблизительно считается кругом на плоскости.
      radius: Math.max(config.size[0], config.size[2]) * .43,
      mass: config.mass || 1,
      health: config.health || 1,
      maxHealth: config.health || 1,
      color: config.color || 0x999999,
      wakesAbove: config.wakesAbove || false,
      velocity: new THREE.Vector3(),
      angular: new THREE.Vector3(),
      // Исходные координаты нужны, чтобы восстановить квартиру перед новым раундом.
      origin: mesh.position.clone(),
      originRotation: mesh.rotation.clone(),
      // Спящий предмет не падает, пока кот его не заденет. Поэтому ваза может стоять на столе.
      awake: false,
      broken: false,
      hitCooldown: 0,
    };
    mesh.userData.destructible = item;
    this.items.push(item);
    return item;
  }

  reset() {
    for (const debris of this.debris) {
      this.scene.remove(debris.mesh);
      debris.mesh.geometry.dispose();
    }
    this.debris.length = 0;
    for (const item of this.items) {
      item.mesh.visible = true;
      item.mesh.position.copy(item.origin);
      item.mesh.rotation.copy(item.originRotation);
      item.velocity.set(0, 0, 0);
      item.angular.set(0, 0, 0);
      item.health = item.maxHealth;
      item.awake = false;
      item.broken = false;
      item.hitCooldown = 0;
    }
  }

  // «Будим» предмет и добавляем импульс к его текущей скорости.
  wake(item, impulse) {
    if (item.broken) return;
    if (!item.awake) {
      item.awake = true;
      if (item.wakesAbove) this.wakeItemsAbove(item);
    }
    if (impulse) item.velocity.add(impulse);
  }

  // Если сдвинули стол или тумбу, предметы, которые стояли на ней, тоже начинают падать.
  wakeItemsAbove(item) {
    for (const other of this.items) {
      if (other === item || other.broken || other.awake) continue;
      const above = other.origin.y > item.origin.y + item.size.y * .55;
      const inside = Math.abs(other.origin.x - item.origin.x) < item.size.x * .55 && Math.abs(other.origin.z - item.origin.z) < item.size.z * .65;
      if (above && inside) {
        other.awake = true;
        other.velocity.set((Math.random() - .5) * 1.5, 1, (Math.random() - .5) * 1.5);
      }
    }
  }

  // damage() уменьшает здоровье. Короткая задержка между ударами исключает
  // многократное срабатывание одного и того же столкновения в соседних кадрах.
  damage(item, amount, impulse) {
    if (item.broken) return false;
    this.wake(item, impulse);
    if (item.hitCooldown > 0) return false;
    item.hitCooldown = .18;
    item.health -= amount;
    this.onHit?.(item, item.health <= 0);
    if (item.health <= 0) {
      this.break(item);
      return true;
    }
    return false;
  }

  break(item) {
    if (item.broken) return;
    item.broken = true;
    // Цельный предмет скрываем, а вместо него создаём несколько случайных осколков.
    item.mesh.visible = false;
    const center = item.mesh.position.clone().add(new THREE.Vector3(0, item.size.y * .45, 0));
    const count = Math.min(18, 7 + Math.floor(item.size.length() * 1.5));
    for (let i = 0; i < count; i++) {
      const scale = .09 + Math.random() * Math.min(.28, item.size.length() * .07);
      const geometry = i % 3 === 0 ? new THREE.TetrahedronGeometry(scale) : new THREE.BoxGeometry(scale, scale * (.5 + Math.random()), scale * (1 + Math.random()));
      const mesh = new THREE.Mesh(geometry, mat(item.color));
      mesh.position.copy(center).add(new THREE.Vector3((Math.random() - .5) * item.size.x * .6, (Math.random() - .5) * item.size.y * .5, (Math.random() - .5) * item.size.z * .6));
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.debris.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - .5) * 5, 2 + Math.random() * 4, (Math.random() - .5) * 5),
        angular: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 2.4 + Math.random() * .7,
      });
    }
    if (item.wakesAbove) this.wakeItemsAbove(item);
    // main.js получает событие и начисляет деньги именно в этот момент.
    this.onBreak?.(item, center);
  }

  // Удар лапой выбирает один ближайший предмет перед котом.
  attack(cat) {
    // Модель кота смотрит вдоль локальной оси -Z; переводим это направление в мир.
    const forward = new THREE.Vector3(-Math.sin(cat.group.rotation.y), 0, -Math.cos(cat.group.rotation.y));
    let best = null;
    let bestDistance = Infinity;
    for (const item of this.items) {
      if (item.broken) continue;
      this.temp.copy(item.mesh.position).sub(cat.group.position);
      this.temp.y = 0;
      const distance = this.temp.length();
      if (distance > item.radius + 1.25 || distance >= bestDistance) continue;
      if (item.mesh.position.y > cat.group.position.y + 1.5 || item.mesh.position.y + item.size.y < cat.group.position.y) continue;
      // Скалярное произведение показывает, находится ли предмет впереди, а не за спиной.
      const dot = distance > .01 ? this.temp.normalize().dot(forward) : 1;
      if (dot < -.15) continue;
      best = item;
      bestDistance = distance;
    }
    if (!best) return null;
    // Делим импульс на корень массы: тяжёлая мебель отлетает медленнее вазы.
    const impulse = forward.multiplyScalar(5.2 / Math.sqrt(best.mass));
    impulse.y = 2.2 / Math.sqrt(best.mass);
    this.damage(best, cat.group.position.y > .25 ? 1.5 : 1, impulse);
    best.angular.add(new THREE.Vector3((Math.random() - .5) * 3, (Math.random() - .5) * 2, (Math.random() - .5) * 3));
    return best;
  }

  // Находит предмет, название и цену которого показываются в подсказке интерфейса.
  getTarget(cat) {
    let best = null;
    let distance = 1.8;
    for (const item of this.items) {
      if (item.broken || item.size.y < .15) continue;
      const d = Math.hypot(item.mesh.position.x - cat.group.position.x, item.mesh.position.z - cat.group.position.z) - item.radius * .55;
      if (d < distance && item.mesh.position.y < cat.group.position.y + 1.6 && item.mesh.position.y + item.size.y > cat.group.position.y) {
        best = item;
        distance = d;
      }
    }
    return best;
  }

  // Обновляет все движущиеся предметы один раз за кадр.
  update(dt, cat, catState, active) {
    for (const item of this.items) {
      item.hitCooldown = Math.max(0, item.hitCooldown - dt);
      if (item.broken || !item.awake) continue;
      // Гравитация постепенно увеличает скорость падения по оси Y.
      item.velocity.y -= 12.5 * dt;
      item.mesh.position.addScaledVector(item.velocity, dt);
      // angular — скорость вращения вокруг трёх осей. Она постепенно затухает.
      item.mesh.rotation.x += item.angular.x * dt;
      item.mesh.rotation.y += item.angular.y * dt;
      item.mesh.rotation.z += item.angular.z * dt;
      item.angular.multiplyScalar(Math.pow(.35, dt));

      if (item.mesh.position.y <= 0) {
        // Столкновение с полом: сильное падение наносит урон, затем предмет отскакивает.
        const impact = -item.velocity.y;
        item.mesh.position.y = 0;
        if (impact > 3.8 && item.maxHealth > 1 && item.hitCooldown <= 0) this.damage(item, Math.min(2, impact * .12));
        item.velocity.y = impact > 1.2 ? impact * .24 : 0;
        // Трение о пол уменьшает горизонтальную скорость.
        item.velocity.x *= Math.pow(.08, dt);
        item.velocity.z *= Math.pow(.08, dt);
        if (Math.abs(item.velocity.y) < .15) item.velocity.y = 0;
      }
      // На невидимых границах квартиры предмет останавливается и немного отскакивает.
      if (Math.abs(item.mesh.position.x) > 8.65) {
        item.mesh.position.x = THREE.MathUtils.clamp(item.mesh.position.x, -8.65, 8.65);
        item.velocity.x *= -.35;
      }
      if (Math.abs(item.mesh.position.z) > 6.65) {
        item.mesh.position.z = THREE.MathUtils.clamp(item.mesh.position.z, -6.65, 6.65);
        item.velocity.z *= -.35;
      }
    }

    if (active) this.collideWithCat(cat, catState);
    if (active) this.collideItems();
    this.updateDebris(dt);
  }

  collideWithCat(cat, catState) {
    if (catState.speed < .3) return;
    for (const item of this.items) {
      if (item.broken || item.size.y < .15) continue;
      // Сначала проверяем пересечение по высоте, затем — по горизонтальной плоскости.
      if (item.mesh.position.y > cat.group.position.y + 1.25 || item.mesh.position.y + item.size.y < cat.group.position.y + .05) continue;
      const dx = cat.group.position.x - item.mesh.position.x;
      const dz = cat.group.position.z - item.mesh.position.z;
      const distance = Math.hypot(dx, dz);
      const minDistance = item.radius + .43;
      if (distance >= minDistance || distance < .001) continue;
      // (nx, nz) — единичный вектор от кота к предмету, то есть направление толчка.
      const nx = -dx / distance;
      const nz = -dz / distance;
      const toward = cat.velocity.x * nx + cat.velocity.z * nz;
      if (toward <= 0) continue;
      const force = (catState.sprinting ? 7.2 : 3.6) / Math.sqrt(item.mass);
      const impulse = new THREE.Vector3(nx * force, Math.min(2.2, force * .22), nz * force);
      this.wake(item, impulse);
      item.angular.add(new THREE.Vector3(nz * force * .2, (Math.random() - .5) * .5, -nx * force * .2));
      // Обычное касание только двигает предмет, а быстрый рывок дополнительно наносит урон.
      if (catState.sprinting && catState.speed > 5.4) this.damage(item, .7 + catState.speed * .07, impulse);
      const resistance = Math.min(.85, .2 + item.mass * .055);
      cat.velocity.x *= 1 - resistance * .18;
      cat.velocity.z *= 1 - resistance * .18;
      // Выталкиваем кота из предмета, чтобы модели не проходили друг сквозь друга.
      cat.group.position.x = item.mesh.position.x - nx * minDistance;
      cat.group.position.z = item.mesh.position.z - nz * minDistance;
    }
  }

  // Движущийся предмет может задеть другой и создать цепную реакцию разрушений.
  collideItems() {
    for (let i = 0; i < this.items.length; i++) {
      const a = this.items[i];
      if (a.broken || !a.awake || a.velocity.lengthSq() < 3) continue;
      // j начинается с i + 1, чтобы не проверять одну и ту же пару дважды.
      for (let j = i + 1; j < this.items.length; j++) {
        const b = this.items[j];
        if (b.broken || b.size.y < .15) continue;
        if (Math.abs(a.mesh.position.y - b.mesh.position.y) > (a.size.y + b.size.y) * .5) continue;
        const dx = b.mesh.position.x - a.mesh.position.x;
        const dz = b.mesh.position.z - a.mesh.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > (a.radius + b.radius) * .68 || distance < .01) continue;
        const speed = a.velocity.length();
        const impulse = new THREE.Vector3(dx / distance, .25, dz / distance).multiplyScalar(speed * .65 / Math.sqrt(b.mass));
        this.wake(b, impulse);
        if (speed > 3.2 && b.hitCooldown <= 0) this.damage(b, Math.min(1.4, speed * .16), impulse);
        a.velocity.multiplyScalar(.65);
      }
    }
  }

  // Осколки подчиняются тем же простым правилам: гравитация, отскок и трение.
  // Через несколько секунд они уменьшаются и удаляются из сцены, освобождая память.
  updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const debris = this.debris[i];
      debris.life -= dt;
      debris.velocity.y -= 12 * dt;
      debris.mesh.position.addScaledVector(debris.velocity, dt);
      debris.mesh.rotation.x += debris.angular.x * dt;
      debris.mesh.rotation.y += debris.angular.y * dt;
      debris.mesh.rotation.z += debris.angular.z * dt;
      if (debris.mesh.position.y < .05) {
        debris.mesh.position.y = .05;
        debris.velocity.y = Math.abs(debris.velocity.y) * .25;
        debris.velocity.x *= .75;
        debris.velocity.z *= .75;
      }
      if (debris.life < .5) debris.mesh.scale.setScalar(Math.max(0, debris.life * 2));
      if (debris.life <= 0) {
        this.scene.remove(debris.mesh);
        debris.mesh.geometry.dispose();
        this.debris.splice(i, 1);
      }
    }
  }
}
